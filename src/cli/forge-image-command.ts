import { runRemoveWatermark } from "../forge/edit/remove-watermark.js";
import { runUpscaleMedia } from "../forge/edit/upscale.js";
import { runImageGenerate } from "../forge/image/generate.js";
import { runImageInpaint } from "../forge/image/inpaint.js";
import { runImg2Img } from "../forge/image/img2img.js";
import { runRemoveBackground } from "../forge/image/remove-bg.js";
import { runSketchToImage } from "../forge/image/sketch-to-image.js";

export async function forgeImageCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, inputPath] = positionals;

  if (subcommand === "sketch" && inputPath) {
    const desc = options.optionValues.desc?.[0];
    const theme = options.optionValues.theme?.[0] ?? null;

    if (!desc) {
      return imageUsage();
    }

    const result = await runSketchToImage({
      desc_ko: desc,
      simulate: options.simulate,
      sketchPath: inputPath,
      theme,
    });

    return renderImageResult(result, options.json, "Sketch-to-image");
  }

  if (subcommand === "generate") {
    const prompt = options.optionValues.prompt?.[0];
    if (!prompt) {
      return imageUsage();
    }

    const result = await runImageGenerate({
      aspect_ratio: normalizeRatio(options.optionValues.ratio?.[0]),
      batch_count: Number(options.optionValues.count?.[0] ?? "1"),
      model: options.optionValues.model?.[0] === "flux" ? "flux" : "sdxl",
      prompt,
      resolution: normalizeSize(options.optionValues.size?.[0]),
      simulate: options.simulate,
      ...(options.optionValues.negative?.[0] ? { negative_prompt: options.optionValues.negative[0] } : {}),
      ...(options.optionValues.theme?.[0] ? { theme: options.optionValues.theme[0] } : {}),
    });

    return renderImageResult(result, options.json, "Image generate");
  }

  if (subcommand === "style" && inputPath) {
    const style = normalizeStyle(options.optionValues.style?.[0]);
    const strength = Number(options.optionValues.strength?.[0] ?? "0.7");
    const result = await runImg2Img({
      input_path: inputPath,
      model: options.optionValues.model?.[0] === "flux" ? "flux" : "sdxl",
      simulate: options.simulate,
      strength,
      style,
      ...(options.optionValues.prompt?.[0] ? { prompt: options.optionValues.prompt[0] } : {}),
    });

    return renderImageResult(result, options.json, "Image style");
  }

  if (subcommand === "upscale" && inputPath) {
    const result = await runUpscaleMedia({
      inputPath,
      scale: Number(options.optionValues.scale?.[0] ?? "4"),
      simulate: options.simulate,
    });

    return renderImageResult(result, options.json, "Image upscale");
  }

  if (subcommand === "remove-bg" && inputPath) {
    const result = await runRemoveBackground({
      inputPath,
      simulate: options.simulate,
    });

    return renderImageResult(result, options.json, "Remove background");
  }

  if (subcommand === "inpaint" && inputPath) {
    const maskPath = options.optionValues.mask?.[0];
    const prompt = options.optionValues.prompt?.[0];

    if (!maskPath || !prompt) {
      return imageUsage();
    }

    const result = await runImageInpaint({
      inputPath,
      maskPath,
      prompt,
      simulate: options.simulate,
    });

    return renderImageResult(result, options.json, "Inpaint");
  }

  if (subcommand === "remove-watermark" && inputPath) {
    const result = await runRemoveWatermark({
      inputPath,
      simulate: options.simulate,
    });

    return renderImageResult(result, options.json, "Remove watermark");
  }

  return imageUsage();
}

function imageUsage(): { exitCode: number; output: string } {
  return {
    exitCode: 1,
    output: "Usage: engine forge image <sketch|generate|style|upscale|remove-bg|inpaint|remove-watermark> ...\n",
  };
}

function renderImageResult(
  result: {
    output_path?: string;
    output_paths?: string[];
    status?: string;
    workflow_id?: string | null;
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

  const outputPath = Array.isArray(result.output_paths)
    ? result.output_paths.join(", ")
    : typeof result.output_path === "string"
      ? result.output_path
      : "(none)";

  return {
    exitCode: 0,
    output: [
      `${label} status: ${String(result.status ?? "completed")}`,
      result.workflow_id ? `Workflow: ${String(result.workflow_id)}` : null,
      `Output: ${outputPath}`,
    ].filter(Boolean).join("\n") + "\n",
  };
}

function normalizeSize(value: string | undefined): "1k" | "2k" | "4k" {
  if (value === "2k" || value === "4k") {
    return value;
  }

  return "1k";
}

function normalizeRatio(
  value: string | undefined,
): "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9" {
  switch (value) {
    case "3:4":
    case "4:3":
    case "16:9":
    case "9:16":
    case "2:3":
    case "3:2":
    case "21:9":
      return value;
    default:
      return "1:1";
  }
}

function normalizeStyle(
  value: string | undefined,
): "anime" | "ghibli" | "realistic" | "watercolor" | "oil" | "pixel" {
  switch (value) {
    case "ghibli":
    case "realistic":
    case "watercolor":
    case "oil":
    case "pixel":
      return value;
    default:
      return "anime";
  }
}
