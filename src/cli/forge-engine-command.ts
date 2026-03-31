import { inspectBackends, loadBackendPathCatalog } from "../backends/registry.js";
import { ensureBackendsReady } from "../backends/supervisor.js";
import { loadDesktopRuntimeStageSnapshot, stageDesktopLocalRuntime } from "../desktop/runtime-staging.js";
import { inspectOpenClawBridge, startOpenClawBridgeServer } from "../forge/agent/openclaw-bridge.js";
import { buildForgeDoctorReport } from "../forge/doctor/build-forge-doctor-report.js";
import { validateForgePaths } from "../forge/doctor/validate-forge-paths.js";
import type { BackendName } from "../backends/types.js";
import { EXIT_CODE_INTERNAL_ERROR, EXIT_CODE_SUCCESS } from "./exit-codes.js";
import { forgeAudioCommand } from "./forge-audio-command.js";
import { forgeAssetsCommand } from "./forge-assets-command.js";
import { forgeCharacterCommand } from "./forge-character-command.js";
import { forgeImageCommand } from "./forge-image-command.js";
import { forgeEditCommand } from "./forge-edit-command.js";
import { forgePipelineCommand } from "./forge-pipeline-command.js";
import { forgePromptCommand } from "./forge-prompt-command.js";
import { forgeVideoCommand } from "./forge-video-command.js";
import { forgeVisualCommand } from "./forge-visual-command.js";
import { renderForgeDoctorOutput } from "./render-forge-doctor-output.js";
import { renderForgePathsOutput } from "./render-forge-paths-output.js";
import { renderForgeProbeOutput } from "./render-forge-probe-output.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";

const FORGE_PHASE_MAP = {
  image: "Phase 1",
  prompt: "Phase 1",
  video: "Phase 2",
  edit: "Phase 3",
  audio: "Phase 4",
  pipeline: "Phase 4",
  assets: "Feature Map",
  character: "Feature Map",
  visual: "Phase 6",
} as const;

type ForgeNamespace = keyof typeof FORGE_PHASE_MAP;

export async function forgeEngineCommand(
  positionals: string[],
  options: {
    dry_run: boolean;
    flags: Set<string>;
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [namespace, ...rest] = positionals;

  if (!namespace) {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: renderForgeUsage(),
    };
  }

  if (namespace === "doctor") {
    const result = await buildForgeDoctorReport();

    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: renderForgeDoctorOutput(result, options.json),
    };
  }

  if (namespace === "backend") {
    return handleBackendNamespace(rest, options.json);
  }

  if (namespace === "agent") {
    return handleAgentNamespace(rest, options.json, options.optionValues);
  }

  if (namespace === "desktop") {
    return handleDesktopNamespace(rest, options.json);
  }

  if (namespace === "paths") {
    return handlePathsNamespace(rest, options.json);
  }

  if (namespace === "install") {
    return handleInstallNamespace(rest, options.json);
  }

  if (namespace === "prompt") {
    return forgePromptCommand(rest, {
      json: options.json,
      optionValues: options.optionValues,
    });
  }

  if (namespace === "image") {
    return forgeImageCommand(rest, {
      json: options.json,
      optionValues: options.optionValues,
      simulate: options.simulate,
    });
  }

  if (namespace === "video") {
    return forgeVideoCommand(rest, {
      flags: options.flags,
      json: options.json,
      optionValues: options.optionValues,
      simulate: options.simulate,
    });
  }

  if (namespace === "edit") {
    return forgeEditCommand(rest, {
      json: options.json,
      optionValues: options.optionValues,
      simulate: options.simulate,
    });
  }

  if (namespace === "audio") {
    return forgeAudioCommand(rest, {
      json: options.json,
      optionValues: options.optionValues,
      simulate: options.simulate,
    });
  }

  if (namespace === "pipeline") {
    return forgePipelineCommand(rest, {
      flags: options.flags,
      json: options.json,
      optionValues: options.optionValues,
      simulate: options.simulate,
    });
  }

  if (namespace === "visual") {
    return forgeVisualCommand(rest, {
      json: options.json,
      optionValues: options.optionValues,
      simulate: options.simulate,
    });
  }

  if (namespace === "assets") {
    return forgeAssetsCommand(rest, {
      json: options.json,
      optionValues: options.optionValues,
    });
  }

  if (namespace === "character") {
    return forgeCharacterCommand(rest, {
      json: options.json,
      optionValues: options.optionValues,
      simulate: options.simulate,
    });
  }

  if (isForgeNamespace(namespace)) {
    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: renderForgeNamespaceStub(namespace, rest, options.json),
    };
  }

  return {
    exitCode: EXIT_CODE_INTERNAL_ERROR,
    output: renderForgeUsage(),
  };
}

function renderForgeNamespaceStub(
  namespace: ForgeNamespace,
  rest: string[],
  json: boolean,
): string {
  const requestedSubcommand = rest[0] ?? null;
  const message = `engine forge ${namespace} is scaffolded for ${FORGE_PHASE_MAP[namespace]}.`;

  if (json) {
    return `${JSON.stringify({
      schema_version: "0.1",
      namespace,
      requested_subcommand: requestedSubcommand,
      status: "scaffolded",
      message,
    }, null, 2)}\n`;
  }

  const lines = [
    message,
    `Requested subcommand: ${requestedSubcommand ?? "(none)"}`,
  ];

  return `${lines.join("\n")}\n`;
}

function renderForgeUsage(): string {
  return "Usage: engine forge <doctor|backend|agent|desktop|paths|install|prompt|image|video|edit|audio|pipeline|assets|character|visual> [subcommand] [--json]\n";
}

function isForgeNamespace(value: string): value is ForgeNamespace {
  return value in FORGE_PHASE_MAP;
}

async function handleBackendNamespace(
  rest: string[],
  json: boolean,
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, backendName] = rest;

  if (subcommand === "probe") {
    const statuses = await inspectBackends();
    const backends = backendName
      ? statuses.filter((status) => status.name === backendName as BackendName)
      : statuses;

    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: renderForgeProbeOutput({
        schema_version: "0.1",
        backends,
        available_count: backends.filter((backend) => backend.available).length,
        unavailable_count: backends.filter((backend) => !backend.available).length,
      }, json),
    };
  }

  if (subcommand === "ensure" || subcommand === "start") {
    const requestedBackends: BackendName[] = backendName
      ? [backendName as BackendName]
      : subcommand === "start"
        ? ["comfyui", "ollama"]
        : ["comfyui", "ollama", "ffmpeg", "python", "propainter"];
    const results = await ensureBackendsReady(requestedBackends, {
      rootDir: resolveMediaForgeRoot(),
    });
    const readyCount = results.filter((result) => result.ready).length;
    const payload = {
      requested_backends: requestedBackends,
      results,
      schema_version: "0.1",
      started_count: results.filter((result) => result.started).length,
      status: readyCount === results.length ? "ready" : "partial",
    };

    if (json) {
      return {
        exitCode: readyCount === results.length ? EXIT_CODE_SUCCESS : EXIT_CODE_INTERNAL_ERROR,
        output: `${JSON.stringify(payload, null, 2)}\n`,
      };
    }

    return {
      exitCode: readyCount === results.length ? EXIT_CODE_SUCCESS : EXIT_CODE_INTERNAL_ERROR,
      output: [
        `Backend ${subcommand} status: ${payload.status}`,
        ...results.map((result) => {
          const mode = result.started ? "started" : result.ready ? "ready" : "missing";
          const detail = result.reason ? ` - ${result.reason}` : "";
          return `${result.name}: ${mode}${detail}`;
        }),
      ].join("\n") + "\n",
    };
  }

  {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: "Usage: engine forge backend <probe|ensure|start> [backend_name] [--json]\n",
    };
  }
}

async function handlePathsNamespace(
  rest: string[],
  json: boolean,
): Promise<{ exitCode: number; output: string }> {
  const [subcommand] = rest;

  if (subcommand !== "validate") {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: "Usage: engine forge paths validate [--json]\n",
    };
  }

  const result = await validateForgePaths();

  return {
    exitCode: EXIT_CODE_SUCCESS,
    output: renderForgePathsOutput(result, json),
  };
}

async function handleAgentNamespace(
  rest: string[],
  json: boolean,
  optionValues: Record<string, string[]>,
): Promise<{ exitCode: number; keepAlive?: boolean; output: string }> {
  const [agentName, subcommand] = rest;
  if (agentName !== "openclaw") {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: "Usage: engine forge agent openclaw <inspect|serve> [--host 127.0.0.1] [--port 4318] [--json]\n",
    };
  }

  const host = optionValues.host?.[0]?.trim() || "127.0.0.1";
  const requestedPort = Number(optionValues.port?.[0]);
  const port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 4318;

  if (subcommand === "inspect") {
    const result = await inspectOpenClawBridge({
      host,
      port,
      rootDir: resolveMediaForgeRoot(),
    });

    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: json
        ? `${JSON.stringify(result, null, 2)}\n`
        : [
          "OpenClaw bridge contract",
          `URL: ${result.openclaw.url}`,
          `Running: ${result.openclaw.running}`,
          `Stage ready: ${result.stage.ready}`,
        ].join("\n") + "\n",
    };
  }

  if (subcommand === "serve") {
    const started = await startOpenClawBridgeServer({
      host,
      port,
      rootDir: resolveMediaForgeRoot(),
    });
    const payload = {
      host: started.host,
      port: started.port,
      schema_version: "0.1",
      status: "started",
      url: started.url,
    };

    return {
      exitCode: EXIT_CODE_SUCCESS,
      keepAlive: true,
      output: json
        ? `${JSON.stringify(payload, null, 2)}\n`
        : [
          "OpenClaw bridge is running.",
          `URL: ${started.url}`,
          "Press Ctrl+C to stop.",
        ].join("\n") + "\n",
    };
  }

  return {
    exitCode: EXIT_CODE_INTERNAL_ERROR,
    output: "Usage: engine forge agent openclaw <inspect|serve> [--host 127.0.0.1] [--port 4318] [--json]\n",
  };
}

async function handleDesktopNamespace(
  rest: string[],
  json: boolean,
): Promise<{ exitCode: number; output: string }> {
  const [subcommand] = rest;

  if (subcommand === "inspect-stage") {
    const snapshot = await loadDesktopRuntimeStageSnapshot();
    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: json
        ? `${JSON.stringify(snapshot, null, 2)}\n`
        : [
          "Desktop runtime stage",
          `Ready: ${snapshot.ready}`,
          `Stage dir: ${snapshot.stage_dir}`,
          `Node staged: ${snapshot.node_runtime_staged}`,
          `Backend config staged: ${snapshot.backend_config_staged}`,
        ].join("\n") + "\n",
    };
  }

  if (subcommand === "stage") {
    const snapshot = await stageDesktopLocalRuntime();
    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: json
        ? `${JSON.stringify(snapshot, null, 2)}\n`
        : [
          "Desktop runtime snapshot created.",
          `Stage dir: ${snapshot.stage_dir}`,
          `Default Ollama model: ${snapshot.default_ollama_model}`,
          `Ready: ${snapshot.ready}`,
        ].join("\n") + "\n",
    };
  }

  return {
    exitCode: EXIT_CODE_INTERNAL_ERROR,
    output: "Usage: engine forge desktop <inspect-stage|stage> [--json]\n",
  };
}

async function handleInstallNamespace(
  rest: string[],
  json: boolean,
): Promise<{ exitCode: number; output: string }> {
  const [backendName] = rest;
  const catalog = await loadBackendPathCatalog(resolveMediaForgeRoot());

  if (!backendName || !(backendName in catalog.backends)) {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: "Usage: engine forge install <comfyui|ffmpeg|python|ollama|propainter> [--json]\n",
    };
  }

  const entry = catalog.backends[backendName as BackendName];
  const response = {
    backend: backendName,
    install_guide_url: entry.install_guide_url,
    configured_paths: entry.configured_paths ?? [],
    executables: entry.executables ?? [],
    status: "guide",
  };

  if (json) {
    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: `${JSON.stringify(response, null, 2)}\n`,
    };
  }

  return {
    exitCode: EXIT_CODE_SUCCESS,
    output: [
      `Install guide for ${backendName}`,
      `Guide: ${entry.install_guide_url}`,
      entry.executables?.length ? `Executables: ${entry.executables.join(", ")}` : null,
      entry.configured_paths?.length ? `Expected paths: ${entry.configured_paths.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n") + "\n",
  };
}
