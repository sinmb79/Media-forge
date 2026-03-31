import { OllamaBackend } from "../backends/ollama.js";
import { getSuccessPatterns, saveFeedback } from "../learning/feedback.js";
import { buildForgePromptBundle } from "../prompt/forge-prompt-builder.js";

export async function forgePromptCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand] = positionals;

  if (subcommand === "build") {
    const desc = options.optionValues.desc?.[0];
    const model = options.optionValues.model?.[0];
    const theme = options.optionValues.theme?.[0] ?? null;

    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge prompt build --desc <description> [--theme <theme>] [--json]\n",
      };
    }

    const bundle = await buildForgePromptBundle({
      desc_ko: desc,
      ollamaClient: new OllamaBackend({ autoStart: true }),
      theme,
      ...(model ? { model } : {}),
    });

    if (options.json) {
      return {
        exitCode: 0,
        output: `${JSON.stringify(bundle, null, 2)}\n`,
      };
    }

    return {
      exitCode: 0,
      output: [
        `Prompt source: ${bundle.source}`,
        `Image prompt: ${bundle.image_prompt}`,
        `Image negative: ${bundle.image_negative}`,
        `Video prompt: ${bundle.video_prompt}`,
        `Video negative: ${bundle.video_negative}`,
      ].join("\n") + "\n",
    };
  }

  if (subcommand === "feedback") {
    const resultId = positionals[1];
    const scoreValue = Number(options.optionValues.score?.[0] ?? "0");

    if (!resultId || !Number.isFinite(scoreValue) || scoreValue < 1 || scoreValue > 5) {
      return {
        exitCode: 1,
        output: "Usage: engine forge prompt feedback <result_id> --score <1-5> [--theme <theme>] [--desc <description>] [--json]\n",
      };
    }

    const entry = await saveFeedback({
      entry: {
        id: resultId,
        timestamp: Date.now(),
        theme: options.optionValues.theme?.[0] ?? "general",
        desc_ko: options.optionValues.desc?.[0] ?? "",
        image_prompt: options.optionValues["image-prompt"]?.[0] ?? "",
        video_prompt: options.optionValues["video-prompt"]?.[0] ?? "",
        score: scoreValue as 1 | 2 | 3 | 4 | 5,
        tags: options.optionValues.tags?.[0]?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
      },
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(entry, null, 2)}\n`
        : `Saved prompt feedback for ${entry.id} with score ${entry.score}\n`,
    };
  }

  if (subcommand === "suggest") {
    const theme = options.optionValues.theme?.[0];
    const patterns = await getSuccessPatterns(undefined, theme);
    const response = {
      suggestions: patterns.slice(0, 5),
      theme: theme ?? "all",
    };

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(response, null, 2)}\n`
        : `Prompt suggestions for ${response.theme}: ${response.suggestions.length}\n`,
    };
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge prompt <build|feedback|suggest> ...\n",
  };
}
