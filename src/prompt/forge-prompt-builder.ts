import { resolvePlanningContext } from "../cli/resolve-planning-context.js";
import type { EngineRequest } from "../domain/contracts.js";
import { getSuccessPatterns } from "../learning/feedback.js";
import { buildPromptResult } from "./build-prompt-result.js";

export interface ForgePromptBundle {
  desc_ko: string;
  theme: string | null;
  image_prompt: string;
  image_negative: string;
  video_prompt: string;
  video_negative: string;
  source: "ollama" | "fallback";
}

export interface ForgePromptBundleInput {
  dataDir?: string;
  desc_ko: string;
  theme?: string | null | undefined;
  ollamaClient: ForgePromptClient;
  model?: string;
}

export interface ForgePromptClient {
  isAvailable(): Promise<boolean>;
  generate(prompt: string, model?: string): Promise<string>;
  generateWithSystemPrompt?(
    prompt: string,
    model: string | undefined,
    systemPrompt: string,
  ): Promise<string>;
  getVersion?(): Promise<string | null>;
  execute?(request: unknown): Promise<unknown>;
  name?: string;
}

export async function buildForgePromptBundle(
  input: ForgePromptBundleInput,
): Promise<ForgePromptBundle> {
  const theme = input.theme?.trim() ? input.theme.trim() : null;
  const successPatterns = await getSuccessPatterns(input.dataDir, theme ?? undefined);

  if (await input.ollamaClient.isAvailable()) {
    try {
      const systemPrompt = buildOllamaSystemPrompt(successPatterns);
      const generated = input.ollamaClient.generateWithSystemPrompt
        ? await input.ollamaClient.generateWithSystemPrompt(input.desc_ko, input.model, systemPrompt)
        : await input.ollamaClient.generate(
          buildPromptWithSuccessPatterns(input.desc_ko, successPatterns),
          input.model,
        );
      const parsed = parsePromptJson(generated);

      if (parsed) {
        return {
          desc_ko: input.desc_ko,
          image_negative: parsed.image_negative,
          image_prompt: parsed.image_prompt,
          source: "ollama",
          theme,
          video_negative: parsed.video_negative,
          video_prompt: parsed.video_prompt,
        };
      }
    } catch {
      // Fall back to deterministic local prompt planning.
    }
  }

  return buildFallbackPromptBundle(input.desc_ko, theme);
}

export async function buildImagePrompt(
  desc_ko: string,
  theme: string | null | undefined,
  ollamaClient: ForgePromptClient,
): Promise<string> {
  const bundle = await buildForgePromptBundle({ desc_ko, theme, ollamaClient });
  return bundle.image_prompt;
}

export async function buildVideoPrompt(
  desc_ko: string,
  theme: string | null | undefined,
  ollamaClient: ForgePromptClient,
): Promise<string> {
  const bundle = await buildForgePromptBundle({ desc_ko, theme, ollamaClient });
  return bundle.video_prompt;
}

function buildFallbackPromptBundle(desc_ko: string, theme: string | null): ForgePromptBundle {
  const request = buildSyntheticRequest(desc_ko, theme);
  const context = resolvePlanningContext(request);
  const promptResult = buildPromptResult({
    brollPlan: context.broll_plan,
    effectiveRequest: context.effective_request,
    learningState: context.learning_state,
    motionPlan: context.motion_plan,
    novelShortsPlan: context.novel_shorts_plan,
    platformOutputSpec: context.platform_output_spec,
    routing: context.routing,
    scoring: context.scoring,
  });

  return {
    desc_ko,
    image_negative: promptResult.negative_prompt,
    image_prompt: [theme ?? "default_theme", "still image", promptResult.main_prompt].join(", "),
    source: "fallback",
    theme,
    video_negative: promptResult.negative_prompt,
    video_prompt: `${promptResult.main_prompt} Camera language: ${context.effective_request.base.style.camera_language}.`,
  };
}

function buildSyntheticRequest(desc_ko: string, theme: string | null): EngineRequest {
  return {
    version: "0.1",
    intent: {
      duration_sec: 5,
      emotion: "wonder",
      goal: "generate media asset",
      platform: "youtube_shorts",
      subject: desc_ko,
      theme: theme ?? "default_theme",
      topic: desc_ko,
    },
    constraints: {
      budget_tier: "low",
      content_policy_safe: true,
      language: "ko",
      quality_tier: "balanced",
      visual_consistency_required: true,
    },
    style: {
      camera_language: "simple_push_in",
      caption_style: "cinematic_minimal",
      hook_type: "curiosity",
      pacing_profile: "gentle",
    },
    backend: {
      allow_fallback: true,
      preferred_engine: "local",
    },
    output: {
      type: "video_prompt",
    },
  };
}

function parsePromptJson(raw: string): {
  image_prompt: string;
  image_negative: string;
  video_prompt: string;
  video_negative: string;
} | null {
  try {
    const normalized = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(normalized) as Record<string, unknown>;

    if (
      typeof parsed.image_prompt === "string" &&
      typeof parsed.image_negative === "string" &&
      typeof parsed.video_prompt === "string" &&
      typeof parsed.video_negative === "string"
    ) {
      return {
        image_negative: parsed.image_negative,
        image_prompt: parsed.image_prompt,
        video_negative: parsed.video_negative,
        video_prompt: parsed.video_prompt,
      };
    }
  } catch {
    // Invalid JSON payload.
  }

  return null;
}

function buildOllamaSystemPrompt(
  successPatterns: Array<{
    image_prompt: string;
    video_prompt: string;
  }>,
): string {
  const basePrompt = "You are a prompt engineer for SD XL and Wan 2.2 video generation. Convert the user's Korean scene description into optimized English prompts. Output JSON: { image_prompt, image_negative, video_prompt, video_negative }";

  if (successPatterns.length === 0) {
    return basePrompt;
  }

  const patternLines = successPatterns
    .slice(0, 3)
    .map((entry, index) => {
      return `Pattern ${index + 1}: image="${entry.image_prompt}" video="${entry.video_prompt}"`;
    });

  return [
    basePrompt,
    "Prefer these proven patterns when they fit the user's theme and scene:",
    ...patternLines,
  ].join("\n");
}

function buildPromptWithSuccessPatterns(
  desc_ko: string,
  successPatterns: Array<{
    image_prompt: string;
    video_prompt: string;
  }>,
): string {
  if (successPatterns.length === 0) {
    return desc_ko;
  }

  const hints = successPatterns
    .slice(0, 3)
    .map((entry) => `${entry.image_prompt} | ${entry.video_prompt}`)
    .join("\n");

  return `${desc_ko}\n\nReference successful patterns:\n${hints}`;
}
