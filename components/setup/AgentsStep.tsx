"use client";

// Step 3: pick built-in agent templates and optionally define custom ones.
// Each template maps to a real `agents.list[]` entry with skills the user
// can toggle.

import { useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import type { Catalog, WizardState } from "@/lib/setupClient";

const AVAILABLE_SKILLS = [
  { id: "files", help: "Read and write files in the workspace." },
  { id: "shell", help: "Run shell commands. Enable only if you trust the model." },
  { id: "web", help: "Search + fetch web pages." },
  { id: "github", help: "Read repos, comment on PRs. Requires GITHUB_TOKEN." },
  { id: "browser", help: "Drive a headless browser (Playwright)." },
];

export function AgentsStep({
  catalog,
  state,
  onChange,
}: {
  catalog: Catalog;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const enabled = new Set(state.agents.templates);

  function toggle(id: string, on: boolean) {
    const next = new Set(enabled);
    on ? next.add(id) : next.delete(id);
    onChange({ agents: { ...state.agents, templates: Array.from(next) } });
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Built-in agents
          <Tooltip text="Ready-made agent profiles. Each maps to an entry in agents.list[] in OpenClaw's config." />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {catalog.agent_templates.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                enabled.has(t.id)
                  ? "border-emerald-700/60 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-900/40"
              }`}
            >
              <input
                type="checkbox"
                checked={enabled.has(t.id)}
                onChange={(e) => toggle(t.id, e.target.checked)}
                className="mt-0.5 accent-emerald-500"
              />
              <div className="flex-1">
                <div className="flex items-center text-sm font-medium">
                  {t.label}
                  <Tooltip text={t.help} />
                </div>
                <div className="mt-1 text-xs text-zinc-500">{t.prompt}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <CustomAgentForm state={state} onChange={onChange} />

      {state.agents.custom.length > 0 && (
        <section>
          <div className="mb-2 text-sm font-medium text-zinc-200">Your custom agents</div>
          <ul className="space-y-2">
            {state.agents.custom.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded border border-zinc-800 bg-zinc-900/40 p-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{a.prompt}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() =>
                    onChange({
                      agents: {
                        ...state.agents,
                        custom: state.agents.custom.filter((c) => c.id !== a.id),
                      },
                    })
                  }
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CustomAgentForm({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [skills, setSkills] = useState<string[]>(["files"]);

  function toggleSkill(id: string) {
    setSkills((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function submit() {
    if (!label.trim() || !prompt.trim()) return;
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `agent-${Date.now().toString(36)}`;
    onChange({
      agents: {
        ...state.agents,
        custom: [...state.agents.custom, { id, label: label.trim(), prompt: prompt.trim(), skills }],
      },
    });
    setLabel("");
    setPrompt("");
    setSkills(["files"]);
  }

  const disabled = !label.trim() || !prompt.trim();

  return (
    <section>
      <div className="mb-2 flex items-center text-sm font-medium text-zinc-200">
        Custom agent
        <Tooltip text="Write a short prompt describing what this agent should do. It will be saved as an entry in agents.list[]." />
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Agent name (e.g. Bug Triager)"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe what this agent should do in plain English. Example: 'Watch #bug-reports on Discord; classify each report, tag severity, ping @oncall for anything sev-1.'"
          className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
          <span>Skills:</span>
          {AVAILABLE_SKILLS.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 ${
                skills.includes(s.id)
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-100"
                  : "border-zinc-700"
              }`}
            >
              <input
                type="checkbox"
                checked={skills.includes(s.id)}
                onChange={() => toggleSkill(s.id)}
                className="hidden"
              />
              {s.id}
              <Tooltip text={s.help} />
            </label>
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <button
            onClick={submit}
            disabled={disabled}
            className="rounded bg-emerald-500 px-4 py-1.5 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-40"
          >
            Add agent
          </button>
        </div>
      </div>
    </section>
  );
}
