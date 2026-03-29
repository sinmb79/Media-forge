import type {
  VideoGenerationAdapter,
  VideoGenerationOptions,
  VideoGenerationPrompt,
  VideoGenerationResult,
} from "./video-generation-adapter.js";

export class LocalAdapter implements VideoGenerationAdapter {
  name = "local";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(
    prompt: VideoGenerationPrompt,
    _options: VideoGenerationOptions,
  ): Promise<VideoGenerationResult> {
    return {
      status: "dry_run",
      metadata: {
        adapter: "local",
        prompt_length: prompt.text_prompt.length,
        duration_sec: prompt.duration_sec,
        aspect_ratio: prompt.aspect_ratio,
      },
    };
  }
}
