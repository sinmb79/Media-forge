import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { OllamaBackend } from "../backends/ollama.js";
import { runSketchToImage } from "../forge/image/sketch-to-image.js";
import { runPipelineChain } from "../forge/pipeline/chain.js";
import { runLongVideoGeneration } from "../forge/video/long-video.js";
import { runVideoFromImage } from "../forge/video/from-image.js";
import { generateStoryboardMode } from "../novel/storyboard-mode.js";
import { createRequestId } from "../shared/request-id.js";

export async function forgePipelineCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, primaryInput] = positionals;

  if (subcommand === "sketch-to-video" && primaryInput) {
    const desc = options.optionValues.desc?.[0];
    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge pipeline sketch-to-video <sketch.png> --desc <description> [--simulate] [--json]\n",
      };
    }

    if (options.simulate) {
      return {
        exitCode: 0,
        output: `${JSON.stringify({ status: "simulated", step_count: 2 }, null, 2)}\n`,
      };
    }

    const result = await runPipelineChain({
      error_strategy: "skip_optional_continue",
      id: "sketch-to-video",
      steps: [
        {
          backend: "comfyui",
          name: "sketch_to_image",
          run: async () => {
            const imageResult = await runSketchToImage({
              desc_ko: desc,
              sketchPath: primaryInput,
            });
            return { image: imageResult.output_path };
          },
        },
        {
          backend: "comfyui",
          input: { image: "$steps.sketch_to_image.image" },
          name: "image_to_video",
          run: async (context) => {
            const imagePath = context.inputs.image;
            if (!imagePath) {
              throw new Error("Missing image input from sketch_to_image step.");
            }
            const videoResult = await runVideoFromImage({
              desc_ko: desc,
              imagePath,
              model: "wan22",
              quality: "production",
            });
            return { video: videoResult.output_path };
          },
        },
      ],
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify({ ...result, step_count: result.steps.length }, null, 2)}\n`
        : `Pipeline ${result.id}: ${result.status}\n`,
    };
  }

  if (subcommand === "storyboard") {
    const storyboardPath = primaryInput ?? options.optionValues.storyboard?.[0];
    if (!storyboardPath) {
      return {
        exitCode: 1,
        output: "Usage: engine forge pipeline storyboard <storyboard.json> [--simulate] [--json]\n",
      };
    }

    const result = await runLongVideoGeneration({
      simulate: options.simulate,
      storyboardPath,
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Storyboard pipeline: ${result.status}\n`,
    };
  }

  if (subcommand === "sketch-to-long-video" && primaryInput) {
    const desc = options.optionValues.desc?.[0];
    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge pipeline sketch-to-long-video <sketch.png> --desc <description> [--simulate] [--json]\n",
      };
    }

    if (options.simulate) {
      return {
        exitCode: 0,
        output: `${JSON.stringify({ status: "simulated", step_count: 3 }, null, 2)}\n`,
      };
    }

    const result = await runPipelineChain({
      error_strategy: "skip_optional_continue",
      id: "sketch-to-long-video",
      steps: [
        {
          backend: "comfyui",
          name: "sketch_to_image",
          run: async () => {
            const imageResult = await runSketchToImage({
              desc_ko: desc,
              sketchPath: primaryInput,
            });
            return { image: imageResult.output_path };
          },
        },
        {
          backend: "ollama",
          name: "storyboard_mode",
          run: async () => {
            const storyboard = await generateStoryboardMode({
              desc_ko: desc,
              ollamaClient: new OllamaBackend(),
            });
            const storyboardPath = await writeGeneratedStoryboard(storyboard);
            return { storyboard: storyboardPath };
          },
        },
        {
          backend: "comfyui",
          input: { storyboard: "$steps.storyboard_mode.storyboard" },
          name: "long_video",
          run: async (context) => {
            const storyboardPath = context.inputs.storyboard;
            if (!storyboardPath) {
              throw new Error("Missing storyboard input from storyboard_mode step.");
            }
            const longVideoResult = await runLongVideoGeneration({
              storyboardPath,
            });
            return { video: longVideoResult.output_path };
          },
        },
      ],
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify({ ...result, step_count: result.steps.length }, null, 2)}\n`
        : `Pipeline ${result.id}: ${result.status}\n`,
    };
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge pipeline <sketch-to-video|storyboard|sketch-to-long-video> ...\n",
  };
}

async function writeGeneratedStoryboard(storyboard: {
  output: {
    format: string;
    resolution: string;
  };
  scenes: Array<{
    desc: string;
    duration: number;
    image: string;
  }>;
  transition: string;
}): Promise<string> {
  const requestId = createRequestId(storyboard);
  const outputDir = path.resolve(process.cwd(), "outputs");
  const filePath = path.resolve(outputDir, `${requestId}-storyboard.json`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(storyboard, null, 2)}\n`, "utf8");
  return filePath;
}
