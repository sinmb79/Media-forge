import { inspectBackends, loadBackendPathCatalog } from "../backends/registry.js";
import { buildForgeDoctorReport } from "../forge/doctor/build-forge-doctor-report.js";
import { validateForgePaths } from "../forge/doctor/validate-forge-paths.js";
import type { BackendName } from "../backends/types.js";
import { EXIT_CODE_INTERNAL_ERROR, EXIT_CODE_SUCCESS } from "./exit-codes.js";
import { forgeAudioCommand } from "./forge-audio-command.js";
import { forgeImageCommand } from "./forge-image-command.js";
import { forgeEditCommand } from "./forge-edit-command.js";
import { forgePipelineCommand } from "./forge-pipeline-command.js";
import { forgePromptCommand } from "./forge-prompt-command.js";
import { forgeVideoCommand } from "./forge-video-command.js";
import { renderForgeDoctorOutput } from "./render-forge-doctor-output.js";
import { renderForgePathsOutput } from "./render-forge-paths-output.js";
import { renderForgeProbeOutput } from "./render-forge-probe-output.js";

const FORGE_PHASE_MAP = {
  image: "Phase 1",
  prompt: "Phase 1",
  video: "Phase 2",
  edit: "Phase 3",
  audio: "Phase 4",
  pipeline: "Phase 4",
} as const;

type ForgeNamespace = keyof typeof FORGE_PHASE_MAP;

export async function forgeEngineCommand(
  positionals: string[],
  options: {
    dry_run: boolean;
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
  return "Usage: engine forge <doctor|backend|paths|install|prompt|image|video|edit|audio|pipeline> [subcommand] [--json]\n";
}

function isForgeNamespace(value: string): value is ForgeNamespace {
  return value in FORGE_PHASE_MAP;
}

async function handleBackendNamespace(
  rest: string[],
  json: boolean,
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, backendName] = rest;

  if (subcommand !== "probe") {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: "Usage: engine forge backend probe [backend_name] [--json]\n",
    };
  }

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

async function handleInstallNamespace(
  rest: string[],
  json: boolean,
): Promise<{ exitCode: number; output: string }> {
  const [backendName] = rest;
  const catalog = await loadBackendPathCatalog(process.cwd());

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
