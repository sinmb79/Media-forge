import { runLongVideoGeneration } from "../forge/video/long-video.js";
import { runVideoFromImage } from "../forge/video/from-image.js";
import { runVideoFromText } from "../forge/video/from-text.js";
import type { ForgeVideoModel, ForgeVideoQuality } from "../forge/video/build-video-generation-plan.js";

export async function forgeVideoCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, maybeInput] = positionals;

  if (subcommand === "from-image" && maybeInput) {
    const desc = options.optionValues.desc?.[0];
    const model = (options.optionValues.model?.[0] ?? "wan22") as ForgeVideoModel;
    const quality = (options.optionValues.quality?.[0] ?? "production") as ForgeVideoQuality;

    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video from-image <image> --model <wan22|ltx2> --desc <description> [--quality <draft|production>] [--simulate] [--json]\n",
      };
    }

    const result = await runVideoFromImage({
      desc_ko: desc,
      imagePath: maybeInput,
      model,
      quality,
      simulate: options.simulate,
    });

    return renderVideoResult(result, options.json, "Image-to-video");
  }

  if (subcommand === "from-text") {
    const desc = options.optionValues.desc?.[0];
    const quality = (options.optionValues.quality?.[0] ?? "production") as ForgeVideoQuality;

    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video from-text --desc <description> [--quality <draft|production>] [--simulate] [--json]\n",
      };
    }

    const result = await runVideoFromText({
      desc_ko: desc,
      quality,
      simulate: options.simulate,
    });

    return renderVideoResult(result, options.json, "Text-to-video");
  }

  if (subcommand === "long") {
    const storyboardPath = options.optionValues.storyboard?.[0];

    if (!storyboardPath) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video long --storyboard <storyboard.json> [--simulate] [--json]\n",
      };
    }

    const result = await runLongVideoGeneration({
      simulate: options.simulate,
      storyboardPath,
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
        `Long-video status: ${result.status}`,
        `Workflow: ${result.workflow_id}`,
        `Scenes: ${result.scene_count}`,
        `Output: ${result.output_path}`,
      ].join("\n") + "\n",
    };
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge video <from-image|from-text|long> ...\n",
  };
}

function renderVideoResult(
  result: {
    output_path: string;
    status: string;
    workflow_id: string;
  },
  json: boolean,
  label: string,
): { exitCode: number; output: string } {
  if (json) {
    return {
      exitCode: 0,
      output: `${JSON.stringify(result, null, 2)}\n`,
    };
  }

  return {
    exitCode: 0,
    output: [
      `${label} status: ${result.status}`,
      `Workflow: ${result.workflow_id}`,
      `Output: ${result.output_path}`,
    ].join("\n") + "\n",
  };
}
