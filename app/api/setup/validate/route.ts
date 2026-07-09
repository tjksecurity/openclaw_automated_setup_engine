import { NextRequest, NextResponse } from "next/server";
import { configValidate } from "@/src/openclaw/cli";
import { toConfigPatch, type WizardState } from "@/src/openclaw/configTransform";

export const dynamic = "force-dynamic";

interface Finding {
  severity: "error" | "warning";
  field: string;
  message: string;
  fix?: string;
}

function localValidate(state: WizardState): Finding[] {
  const findings: Finding[] = [];
  if (!state.model?.primary) {
    findings.push({
      severity: "error",
      field: "model.primary",
      message: "No primary model selected.",
      fix: "Pick a model on the Model step. Claude Sonnet is a good default.",
    });
  }
  const anyChannel = Object.values(state.channels || {}).some((c) => c.enabled);
  if (!anyChannel) {
    findings.push({
      severity: "warning",
      field: "channels",
      message: "No messaging channels enabled — OpenClaw will run but you won't be able to talk to it.",
      fix: "Enable at least one channel (Telegram is easiest to get running).",
    });
  }
  for (const [id, ch] of Object.entries(state.channels || {})) {
    if (!ch.enabled) continue;
    for (const [fName, val] of Object.entries(ch.fields || {})) {
      if (val === "" || val == null) {
        findings.push({
          severity: "warning",
          field: `channels.${id}.${fName}`,
          message: `Channel ${id} field ${fName} is empty.`,
        });
      }
    }
  }
  return findings;
}

export async function POST(req: NextRequest) {
  let state: WizardState;
  try {
    state = (await req.json()) as WizardState;
  } catch {
    return NextResponse.json({ ok: false, findings: [{ severity: "error", field: "body", message: "Invalid JSON body." }] }, { status: 400 });
  }

  const findings = localValidate(state);

  // Cross-check with OpenClaw's own validator if available.
  let openclawSays: { ok: boolean; message: string } | null = null;
  try {
    // We DON'T patch the real config here — validate just checks the
    // current on-disk state. The patch check happens in /deploy.
    openclawSays = await configValidate();
  } catch {
    openclawSays = null;
  }

  const patch = toConfigPatch(state);
  return NextResponse.json({
    ok: findings.every((f) => f.severity !== "error"),
    findings,
    patch_preview: patch,
    openclaw_current_valid: openclawSays,
  });
}
