import { runVisualCreate } from "../forge/visual/create.js";
import { runVisualComposite } from "../forge/visual/compositor.js";
import { runMusicVisualization } from "../forge/visual/music-viz.js";
import { listVisualTemplates, runVisualRender } from "../forge/visual/render.js";

export async function forgeVisualCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand] = positionals;

  if (subcommand === "create") {
    const prompt = options.optionValues.prompt?.[0];
    const durationSec = Number(options.optionValues.duration?.[0] ?? "5");

    if (!prompt) {
      return {
        exitCode: 1,
        output: "Usage: engine forge visual create --prompt <text> [--duration <seconds>] [--simulate] [--json]\n",
      };
    }

    const result = await runVisualCreate({
      durationSec,
      prompt,
      simulate: options.simulate,
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Visual create ${result.status}: ${result.output_path}\n`,
    };
  }

  if (subcommand === "composite") {
    const foreground = options.optionValues.fg?.[0];
    const background = options.optionValues.bg?.[0];
    const blend = (options.optionValues.blend?.[0] ?? "overlay") as "overlay" | "screen" | "multiply" | "add";

    if (!foreground || !background) {
      return {
        exitCode: 1,
        output: "Usage: engine forge visual composite --fg <video> --bg <asset> [--blend <overlay|screen|multiply|add>] [--simulate] [--json]\n",
      };
    }

    const result = await runVisualComposite({
      background,
      blend,
      foreground,
      simulate: options.simulate,
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Visual composite ${result.status}: ${result.output_path}\n`,
    };
  }

  if (subcommand === "music-viz") {
    const audioPath = options.optionValues.audio?.[0];
    const style = (options.optionValues.style?.[0] ?? "spectrum") as "spectrum" | "waveform";

    if (!audioPath) {
      return {
        exitCode: 1,
        output: "Usage: engine forge visual music-viz --audio <file> [--style <spectrum|waveform>] [--simulate] [--json]\n",
      };
    }

    const result = await runMusicVisualization({
      audioPath,
      simulate: options.simulate,
      style,
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Visual music-viz ${result.status}: ${result.output_path}\n`,
    };
  }

  if (subcommand === "render") {
    const template = options.optionValues.template?.[0];
    const durationSec = Number(options.optionValues.duration?.[0] ?? "5");
    const fps = Number(options.optionValues.fps?.[0] ?? "12");
    const params = parseVisualParams(options.optionValues.params?.[0]);

    if (!template) {
      return {
        exitCode: 1,
        output: "Usage: engine forge visual render --template <effects/...> [--duration <seconds>] [--fps <frames>] [--params <json|key=value,...>] [--simulate] [--json]\n",
      };
    }

    const result = await runVisualRender({
      durationSec,
      fps,
      simulate: options.simulate,
      template,
      ...(params ? { params } : {}),
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Visual render ${result.status}: ${result.output_path}\n`,
    };
  }

  if (subcommand === "list" || subcommand === "templates") {
    const category = options.optionValues.category?.[0] as "effects" | "music" | "particle" | undefined;
    const search = options.optionValues.search?.[0];
    const templates = listVisualTemplates({
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
    });
    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify({ templates, count: templates.length }, null, 2)}\n`
        : `${templates.map((template) => `${template.id}  ${template.label}  [${template.category}]`).join("\n")}\n`,
    };
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge visual <list|create|render|music-viz|composite|templates> ...\n",
  };
}

function parseVisualParams(
  value: string | undefined,
): Record<string, boolean | number | string> | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as Record<string, boolean | number | string>;
  }

  const entries = trimmed.split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [rawKey, ...rest] = segment.split("=");
      const key = rawKey?.trim();
      const rawValue = rest.join("=").trim();
      if (!key) {
        return null;
      }

      return [key, coerceVisualParamValue(rawValue)] as const;
    })
    .filter((entry): entry is readonly [string, boolean | number | string] => entry !== null);

  if (!entries.length) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function coerceVisualParamValue(value: string): boolean | number | string {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value.length > 0) {
    return numeric;
  }

  return value;
}
