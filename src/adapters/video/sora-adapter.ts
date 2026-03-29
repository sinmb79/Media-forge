import type {
  VideoGenerationAdapter,
  VideoGenerationOptions,
  VideoGenerationPrompt,
  VideoGenerationResult,
} from "./video-generation-adapter.js";

export class SoraAdapter implements VideoGenerationAdapter {
  name = "sora";

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env["SORA_API_KEY"]);
  }

  async generate(
    _prompt: VideoGenerationPrompt,
    options: VideoGenerationOptions,
  ): Promise<VideoGenerationResult> {
    if (options.dry_run) {
      return {
        status: "dry_run",
        metadata: { adapter: "sora", dry_run: true },
      };
    }

    const apiKey = process.env["SORA_API_KEY"];
    if (!apiKey) {
      return {
        status: "error",
        error: "SORA_API_KEY is not set in environment",
        metadata: { adapter: "sora" },
      };
    }

    // TODO: Sora API endpoint이 GA되면 아래를 실제 호출로 교체하세요.
    // 현재 Sora API는 공개 미정입니다.
    //
    // 예시 구조:
    // const response = await fetch("https://api.openai.com/v1/video/generations", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${apiKey}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     prompt: prompt.text_prompt,
    //     duration: prompt.duration_sec,
    //     aspect_ratio: prompt.aspect_ratio,
    //   }),
    // });
    // const data = await response.json();
    // return {
    //   status: "success",
    //   output_path: data.url,
    //   metadata: { adapter: "sora", job_id: data.id },
    // };

    return {
      status: "dry_run",
      metadata: {
        adapter: "sora",
        note: "Sora API endpoint not yet GA — update this file when available",
      },
    };
  }
}
