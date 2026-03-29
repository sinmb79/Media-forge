import type { StoryboardDefinition } from "../forge/video/storyboard.js";

export interface StoryboardModeClient {
  isAvailable(): Promise<boolean>;
  generate(prompt: string, model?: string): Promise<string>;
  generateWithSystemPrompt?(
    prompt: string,
    model: string | undefined,
    systemPrompt: string,
  ): Promise<string>;
}

export async function generateStoryboardMode(
  input: {
    desc_ko: string;
    model?: string;
    ollamaClient: StoryboardModeClient;
    sceneCount?: number;
  },
): Promise<StoryboardDefinition> {
  const sceneCount = input.sceneCount ?? 4;

  if (await input.ollamaClient.isAvailable()) {
    try {
      const generated = input.ollamaClient.generateWithSystemPrompt
        ? await input.ollamaClient.generateWithSystemPrompt(
          input.desc_ko,
          input.model,
          buildStoryboardSystemPrompt(sceneCount),
        )
        : await input.ollamaClient.generate(
          `${input.desc_ko}\n\nReturn JSON with ${sceneCount} scenes.`,
          input.model,
        );
      const parsed = parseStoryboardDefinition(generated);

      if (parsed) {
        return parsed;
      }
    } catch {
      // Fall through to the local splitter.
    }
  }

  return buildFallbackStoryboard(input.desc_ko, sceneCount);
}

function buildStoryboardSystemPrompt(sceneCount: number): string {
  return [
    "You are a storyboard planner for local AI video generation.",
    `Split the user's Korean story description into exactly ${sceneCount} cinematic scenes.`,
    "Return JSON: { scenes: [{ image, desc, duration }], transition, output: { resolution, format } }",
  ].join(" ");
}

function parseStoryboardDefinition(raw: string): StoryboardDefinition | null {
  try {
    const normalized = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(normalized) as StoryboardDefinition;

    if (
      Array.isArray(parsed.scenes)
      && typeof parsed.transition === "string"
      && typeof parsed.output?.resolution === "string"
      && typeof parsed.output?.format === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function buildFallbackStoryboard(
  descKo: string,
  sceneCount: number,
): StoryboardDefinition {
  const segments = splitDescription(descKo, sceneCount);
  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const segment = segments[index] ?? descKo;
    return {
      desc: segment,
      duration: 5,
      image: `scene${index + 1}.png`,
    };
  });

  return {
    output: {
      format: "mp4",
      resolution: "720p",
    },
    scenes,
    transition: "ai",
  };
}

function splitDescription(descKo: string, sceneCount: number): string[] {
  const split = descKo
    .split(/(?:,| 그리고 | 그러다 | 이후 | 그러자 | 하다가 )/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (split.length >= sceneCount) {
    return split.slice(0, sceneCount);
  }

  const expanded = [...split];
  while (expanded.length < sceneCount) {
    const lastSegment = expanded[expanded.length - 1] ?? descKo;
    expanded.push(lastSegment);
  }

  return expanded;
}
