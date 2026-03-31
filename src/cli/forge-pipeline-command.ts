import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { resolveLLMClient } from "../backends/resolve-llm-client.js";
import { runSketchToImage } from "../forge/image/sketch-to-image.js";
import { runEpisodeAudioPipeline } from "../forge/pipeline/episode-audio.js";
import { runPipelineChain } from "../forge/pipeline/chain.js";
import { runLongVideoGeneration } from "../forge/video/long-video.js";
import { runVideoFromImage } from "../forge/video/from-image.js";
import { runAutoExtendPipeline } from "../forge/pipeline/auto-extend.js";
import { generateStoryboardMode } from "../novel/storyboard-mode.js";
import { createRequestId } from "../shared/request-id.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";

export async function forgePipelineCommand(
  positionals: string[],
  options: {
    flags: Set<string>;
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

  if (subcommand === "episode-audio") {
    const scriptPath = primaryInput ?? options.optionValues.script?.[0];
    const text = options.optionValues.text?.[0];
    const speakerNames = options.optionValues.speakers?.[0]
      ?.split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      ?? [];

    if (!scriptPath && !text) {
      return {
        exitCode: 1,
        output: "Usage: engine forge pipeline episode-audio [episode.txt|--script <episode.txt>|--text <dialogue>] --speakers <name1,name2> [--simulate] [--json]\n",
      };
    }

    if (speakerNames.length === 0) {
      return {
        exitCode: 1,
        output: "Usage: engine forge pipeline episode-audio ... --speakers <name1,name2> [--simulate] [--json]\n",
      };
    }

    if (options.simulate) {
      return {
        exitCode: 0,
        output: `${JSON.stringify({ status: "simulated", step_count: 3 }, null, 2)}\n`,
      };
    }

    const result = await runEpisodeAudioPipeline({
      include_subtitles: options.flags.has("subs"),
      lang: options.optionValues.lang?.[0] ?? "ko",
      model: options.optionValues.model?.[0] === "realtime-0.5b" ? "realtime-0.5b" : "tts-1.5b",
      ...(scriptPath ? { scriptPath } : {}),
      speakerNames,
      ...(text ? { text } : {}),
      ...(options.optionValues["voice-dir"]?.[0] ? { voiceRootDir: options.optionValues["voice-dir"][0] } : {}),
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Episode audio pipeline: ${result.output_path}\n`,
    };
  }

  if (subcommand === "auto-extend") {
    const desc = options.optionValues.desc?.[0];
    const fromImagePath = options.optionValues["from-image"]?.[0];

    if (!desc && !fromImagePath) {
      return {
        exitCode: 1,
        output: "Usage: engine forge pipeline auto-extend [--desc <description>|--from-image <image>] --candidates <count> --seed-duration <seconds> --extend-loops <count> --extend-duration <seconds> [--refs <ref1,ref2>] [--auto-pick <first|random|manual|best>] [--with-audio] [--output <video.mp4>] [--simulate] [--json]\n",
      };
    }

    const result = await runAutoExtendPipeline({
      autoPick: normalizeAutoPick(options.optionValues["auto-pick"]?.[0]),
      candidates: Number(options.optionValues.candidates?.[0] ?? "4"),
      desc_ko: desc ?? `Auto extend from ${fromImagePath}`,
      extend_duration_sec: Number(options.optionValues["extend-duration"]?.[0] ?? "5"),
      extend_loops: Number(options.optionValues["extend-loops"]?.[0] ?? "1"),
      ...(fromImagePath ? { fromImagePath } : {}),
      model: normalizeAutoExtendModel(options.optionValues.model?.[0]),
      ...(options.optionValues.output?.[0] ? { outputPath: options.optionValues.output[0] } : {}),
      quality: options.optionValues.quality?.[0] === "draft" ? "draft" : "production",
      referencePaths: options.optionValues.refs?.[0]
        ?.split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        ?? [],
      rootDir: process.cwd(),
      seed_duration_sec: Number(options.optionValues["seed-duration"]?.[0] ?? "10"),
      simulate: options.simulate,
      ...(options.flags.has("with-audio") ? { withAudio: true } : {}),
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Auto-extend pipeline: ${result.status}\n`,
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
        ollamaClient: await resolveLLMClient(),
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
    output: "Usage: engine forge pipeline <sketch-to-video|storyboard|episode-audio|auto-extend|sketch-to-long-video> ...\n",
  };
}

function normalizeAutoExtendModel(value: string | undefined) {
  if (value === "ltx2" || value === "skyreels-ref2v") {
    return value;
  }

  return "wan22";
}

function normalizeAutoPick(value: string | undefined) {
  if (value === "random" || value === "manual" || value === "best") {
    return value;
  }

  return "first";
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
  const outputDir = path.resolve(resolveMediaForgeRoot(), "outputs");
  const filePath = path.resolve(outputDir, `${requestId}-storyboard.json`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(storyboard, null, 2)}\n`, "utf8");
  return filePath;
}
