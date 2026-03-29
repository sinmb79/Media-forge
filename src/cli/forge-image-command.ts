import { runSketchToImage } from "../forge/image/sketch-to-image.js";

export async function forgeImageCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, sketchPath] = positionals;

  if (subcommand !== "sketch" || !sketchPath) {
    return {
      exitCode: 1,
      output: "Usage: engine forge image sketch <sketch.png> --desc <description> [--theme <theme>] [--simulate] [--json]\n",
    };
  }

  const desc = options.optionValues.desc?.[0];
  const theme = options.optionValues.theme?.[0] ?? null;

  if (!desc) {
    return {
      exitCode: 1,
      output: "Usage: engine forge image sketch <sketch.png> --desc <description> [--theme <theme>] [--simulate] [--json]\n",
    };
  }

  const result = await runSketchToImage({
    desc_ko: desc,
    simulate: options.simulate,
    sketchPath,
    theme,
  });

  if (options.json) {
    return {
      exitCode: 0,
      output: `${JSON.stringify(result, null, 2)}\n`,
    };
  }

  return {
    exitCode: 0,
    output: [
      `Sketch-to-image status: ${result.status}`,
      `Workflow: ${result.workflow_id}`,
      `Output: ${result.output_path}`,
    ].join("\n") + "\n",
  };
}
