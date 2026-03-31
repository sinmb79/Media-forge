#!/usr/bin/env node

import { analyzeEngineCommand } from "./analyze-engine-command.js";
import {
  EXIT_CODE_INTERNAL_ERROR,
} from "./exit-codes.js";
import { configEngineCommand } from "./config-engine-command.js";
import { createEngineCommand } from "./create-engine-command.js";
import { dashboardEngineCommand } from "./dashboard-engine-command.js";
import { doctorEngineCommand } from "./doctor-engine-command.js";
import { forgeEngineCommand } from "./forge-engine-command.js";
import { promptEngineCommand } from "./prompt-engine-command.js";
import { publishEngineCommand } from "./publish-engine-command.js";
import { renderEngineCommand } from "./render-engine-command.js";
import { runEngineCommand } from "./run-engine-command.js";
import { wizardEngineCommand } from "./wizard-engine-command.js";
import { executeEngineCommand } from "./execute-engine-command.js";
import { parseCommandArgs } from "./parse-command-args.js";

const args = process.argv.slice(2);
const [command, ...rest] = args;
const parsed = parseCommandArgs(rest);
const json = parsed.flags.has("json");
const simulate = parsed.flags.has("simulate");

if (!command) {
  process.stderr.write(
    "Usage: engine <run|prompt|create|wizard|execute|config|doctor|dashboard|analyze|render|publish|forge> [request.json] [--json] [--simulate]\n",
  );
  process.exit(EXIT_CODE_INTERNAL_ERROR);
}

const dry_run = parsed.flags.has("dry-run");
const result = await executeCommand(command, parsed.positionals, {
  dry_run,
  flags: parsed.flags,
  json,
  optionValues: parsed.optionValues,
  simulate,
});
process.stdout.write(result.output);

if (!result.keepAlive) {
  process.exit(result.exitCode);
}

async function executeCommand(
  commandName: string,
  positionals: string[],
  options: {
    json: boolean;
    simulate: boolean;
    dry_run: boolean;
    flags: Set<string>;
    optionValues: Record<string, string[]>;
  },
): Promise<{ exitCode: number; keepAlive?: boolean; output: string }> {
  if (commandName === "config") {
    return configEngineCommand({ json: options.json });
  }

  if (commandName === "doctor") {
    return doctorEngineCommand({ json: options.json });
  }

  if (commandName === "dashboard") {
    return dashboardEngineCommand({
      host: options.optionValues.host?.[0] ?? null,
      json: options.json,
      open: options.flags.has("open"),
      port: options.optionValues.port?.[0] ? Number(options.optionValues.port[0]) : null,
    });
  }

  if (commandName === "forge") {
    return forgeEngineCommand(positionals, {
      dry_run: options.dry_run,
      flags: options.flags,
      json: options.json,
      optionValues: options.optionValues,
      simulate: options.simulate,
    });
  }

  if (commandName === "wizard") {
    const [outputPath] = positionals;
    const resolvedPath = outputPath ?? "my-request.json";
    return wizardEngineCommand(resolvedPath);
  }

  if (commandName === "execute") {
    const [requestPath] = positionals;
    if (!requestPath) {
      return {
        exitCode: EXIT_CODE_INTERNAL_ERROR,
        output: "Usage: engine execute <request.json> [--dry-run] [--json]\n",
      };
    }
    return executeEngineCommand(requestPath, { json: options.json, dry_run: options.dry_run });
  }

  if (commandName === "create") {
    const [profileId, outputPath] = positionals;

    if (!profileId || !outputPath) {
      return {
        exitCode: EXIT_CODE_INTERNAL_ERROR,
        output: "Usage: engine create <profile> <output.json> [--json]\n",
      };
    }

    return createEngineCommand(profileId, outputPath, { json: options.json });
  }

  const [requestPath] = positionals;

  if (
    !requestPath
    || (commandName !== "run"
      && commandName !== "prompt"
      && commandName !== "analyze"
      && commandName !== "dashboard"
      && commandName !== "render"
      && commandName !== "publish")
  ) {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: "Usage: engine <run|prompt|create|wizard|execute|config|doctor|dashboard|analyze|render|publish|forge> [request.json] [--json] [--simulate]\n",
    };
  }

  if (commandName === "analyze") {
    return analyzeEngineCommand(requestPath, { json: options.json });
  }

  if (commandName === "render") {
    return renderEngineCommand(requestPath, { json: options.json });
  }

  if (commandName === "publish") {
    return publishEngineCommand(requestPath, { json: options.json });
  }

  return commandName === "prompt"
    ? promptEngineCommand(requestPath, { json: options.json })
    : runEngineCommand(requestPath, { json: options.json, simulate: options.simulate });
}
