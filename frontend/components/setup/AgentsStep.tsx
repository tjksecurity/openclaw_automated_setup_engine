"use client";

import { useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import { setupApi, type Catalog, type Config, type CustomAgent } from "@/lib/setupClient";

// Agents step: toggle built-in agents, edit their models, and create fully
// custom agents from a prompt with a single button press.

export function AgentsStep({
  catalog,
  config,
  onConfig,
  onRefresh,
  pushError,
}: {
  catalog: Catalog;
  config: Config;
  onConfig: (patch: Partial<Config>) => void;
  onRefresh: () => Promise<void>;
  pushError: (msg: string) => void;
}) {
  const enabled = new Set(config.agents.enabled);

  function toggle(id: string, on: boolean) {
    const next = new Set(enabled);
    on ? next.add(id) : next.delete(id);
    onConfig({ agents: { ...config.agents, enabled: Array.from(next) } });
  }
  function setAgentModel(agentId: string, model: string) {
    // Model overrides are stored on custom agents; templates use their default.
    const custom = config.agents.custom.map((a) => (a.id === agentId ? { ...a, model } : a));
    onConfig({ agents: { ...config.agents, custom } });
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Built-in agents
          <Tooltip text="Ready-made agents. Turn on what you want and OpenClaw will run them against your ingested events." />
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
                <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{t.prompt}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
                  Uses: {catalog.models.find((m) => m.id === t.default_model)?.label ?? t.default_model}
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Custom agents
          <Tooltip text="Write a plain-English prompt describing what the agent should do. Press Create — it's saved instantly and shows up in your enabled list." />
        </div>
        <CreateAgentForm
          models={catalog.models}
          pushError={pushError}
          onCreated={async (agent) => {
            const next = Array.from(enabled);
            next.push(agent.id);
            onConfig({ agents: { enabled: next, custom: [...config.agents.custom, agent] } });
            await onRefresh();
          }}
        />

        {config.agents.custom.length > 0 && (
          <ul className="mt-3 space-y-2">
            {config.agents.custom.map((a) => (
              <CustomAgentRow
                key={a.id}
                agent={a}
                models={catalog.models}
                enabled={enabled.has(a.id)}
                onToggle={(on) => toggle(a.id, on)}
                onModel={(m) => setAgentModel(a.id, m)}
                onDelete={async () => {
                  try {
                    await setupApi.deleteAgent(a.id);
                    await onRefresh();
                  } catch (e) {
                    pushError((e as Error).message);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateAgentForm({
  models,
  onCreated,
  pushError,
}: {
  models: Catalog["models"];
  onCreated: (a: CustomAgent) => Promise<void>;
  pushError: (msg: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(models[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const disabled = !label.trim() || !prompt.trim() || busy;

  async function submit() {
    setBusy(true);
    try {
      const agent = await setupApi.createAgent({ label: label.trim(), prompt: prompt.trim(), model });
      setLabel("");
      setPrompt("");
      await onCreated(agent);
    } catch (e) {
      pushError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Agent name (e.g. Bug Triager)"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm md:col-span-2"
        />
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="Describe what this agent should do. Example: 'Read incoming GitHub bug reports, tag them with severity + component, ping #eng-triage if severity is high.'"
        className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
        <span>Plain English works. The prompt IS the agent — write what you'd tell a human analyst.</span>
        <button
          onClick={submit}
          disabled={disabled}
          className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create agent"}
        </button>
      </div>
    </div>
  );
}

function CustomAgentRow({
  agent,
  models,
  enabled,
  onToggle,
  onModel,
  onDelete,
}: {
  agent: CustomAgent;
  models: Catalog["models"];
  enabled: boolean;
  onToggle: (on: boolean) => void;
  onModel: (m: string) => void;
  onDelete: () => void | Promise<void>;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-1 accent-emerald-500"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {agent.label}
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
            custom
          </span>
        </div>
        <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{agent.prompt}</div>
      </div>
      <select
        value={agent.model ?? ""}
        onChange={(e) => onModel(e.target.value)}
        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <button
        onClick={onDelete}
        className="text-xs text-red-400 hover:text-red-300"
        aria-label={`Delete ${agent.label}`}
      >
        Delete
      </button>
    </li>
  );
}
