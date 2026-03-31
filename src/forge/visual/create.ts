import { resolveLLMClient } from "../../backends/resolve-llm-client.js";
import type { FFmpegBackend } from "../../backends/ffmpeg.js";
import {
  runVisualRender,
} from "./render.js";
import type { VisualBrowserRenderer } from "./browser-renderer.js";

const VISUAL_CREATE_SYSTEM_PROMPT = [
  "You are a creative coding expert.",
  "Generate a complete single HTML document for a local canvas visualization.",
  "Requirements:",
  "- Read window.location.search to extract frame, frames, fps, duration, template, and params.",
  "- Render deterministically to a full-window canvas without external network access.",
  "- Output only HTML.",
].join(" ");

export interface VisualCreateOptions {
  durationSec: number;
  fps?: number;
  outputDir?: string;
  prompt: string;
  rootDir?: string;
  simulate?: boolean;
}

interface VisualHtmlGenerator {
  generate?(prompt: string): Promise<string>;
  generateWithSystemPrompt?(
    prompt: string,
    model: string | undefined,
    systemPrompt: string,
  ): Promise<string>;
}

export async function runVisualCreate(
  input: VisualCreateOptions,
  dependencies: {
    browserRenderer?: VisualBrowserRenderer;
    ffmpeg?: Pick<FFmpegBackend, "execute">;
    ollama?: VisualHtmlGenerator;
  } = {},
): Promise<{
    operation: "visual-create";
    output_path: string;
    source: "ollama-generated" | "template-fallback";
    status: "simulated" | "completed";
    template: string;
  }> {
  const fallbackTemplate = selectFallbackVisualTemplate(input.prompt);

  if (input.simulate !== false) {
    const simulated = await runVisualRender({
      durationSec: input.durationSec,
      simulate: true,
      template: fallbackTemplate,
      ...(input.fps !== undefined ? { fps: input.fps } : {}),
      ...(input.outputDir ? { outputDir: input.outputDir } : {}),
      ...(input.rootDir ? { rootDir: input.rootDir } : {}),
    });

    return {
      operation: "visual-create",
      output_path: simulated.output_path,
      source: "template-fallback",
      status: "simulated",
      template: fallbackTemplate,
    };
  }

  const generator = dependencies.ollama ?? await resolveLLMClient();
  const generatedHtml = await tryGenerateVisualHtml(generator, input.prompt);
  const validHtml = isRenderableHtml(generatedHtml);
  const renderResult = await runVisualRender(
    {
      durationSec: input.durationSec,
      simulate: false,
      template: fallbackTemplate,
      ...(input.fps !== undefined ? { fps: input.fps } : {}),
      ...(validHtml && generatedHtml ? { htmlDocument: generatedHtml } : {}),
      ...(input.outputDir ? { outputDir: input.outputDir } : {}),
      ...(input.rootDir ? { rootDir: input.rootDir } : {}),
    },
    {
      ...(dependencies.browserRenderer ? { browserRenderer: dependencies.browserRenderer } : {}),
      ...(dependencies.ffmpeg ? { ffmpeg: dependencies.ffmpeg } : {}),
    },
  );

  return {
    operation: "visual-create",
    output_path: renderResult.output_path,
    source: validHtml ? "ollama-generated" : "template-fallback",
    status: "completed",
    template: fallbackTemplate,
  };
}

async function tryGenerateVisualHtml(
  generator: VisualHtmlGenerator,
  prompt: string,
): Promise<string | null> {
  try {
    if (generator.generateWithSystemPrompt) {
      const output = await generator.generateWithSystemPrompt(prompt, undefined, VISUAL_CREATE_SYSTEM_PROMPT);
      return output.trim();
    }

    if (generator.generate) {
      const output = await generator.generate(prompt);
      return output.trim();
    }
  } catch {
    return null;
  }

  return null;
}

function isRenderableHtml(value: string | null): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return normalized.includes("<html") && normalized.includes("window.location.search") && normalized.includes("canvas");
}

function selectFallbackVisualTemplate(prompt: string): string {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("lightning") || normalized.includes("storm")) {
    return "effects/lightning";
  }

  if (normalized.includes("snow")) {
    return "effects/snowfall";
  }

  if (normalized.includes("aurora") || normalized.includes("northern lights")) {
    return "effects/aurora-flow";
  }

  if (normalized.includes("grid") || normalized.includes("retro")) {
    return "effects/neon-grid";
  }

  if (normalized.includes("tunnel") || normalized.includes("laser")) {
    return "effects/laser-tunnel";
  }

  if (normalized.includes("matrix") || normalized.includes("code")) {
    return "effects/matrix-rain";
  }

  if (normalized.includes("music") || normalized.includes("beat") || normalized.includes("equalizer")) {
    return "music/equalizer-bars";
  }

  if (normalized.includes("petal") || normalized.includes("flower")) {
    return "effects/petals";
  }

  if (normalized.includes("autumn") || normalized.includes("leaf")) {
    return "effects/autumn-leaves";
  }

  if (normalized.includes("black hole") || normalized.includes("galaxy") || normalized.includes("orbit")) {
    return "particle/blackhole";
  }

  if (normalized.includes("star") || normalized.includes("warp")) {
    return "particle/starfield";
  }

  return "effects/snowfall";
}
