import type {
  VideoGenerationAdapter,
  VideoGenerationOptions,
  VideoGenerationPrompt,
  VideoGenerationResult,
} from "./video-generation-adapter.js";

export class KlingAdapter implements VideoGenerationAdapter {
  name = "kling";

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env["KLING_API_KEY"]);
  }

  async generate(
    _prompt: VideoGenerationPrompt,
    options: VideoGenerationOptions,
  ): Promise<VideoGenerationResult> {
    if (options.dry_run) {
      return {
        status: "dry_run",
        metadata: { adapter: "kling", dry_run: true },
      };
    }

    const apiKey = process.env["KLING_API_KEY"];
    if (!apiKey) {
      return {
        status: "error",
        error: "KLING_API_KEY is not set in environment",
        metadata: { adapter: "kling" },
      };
    }

    // Kling AI API 호출 구조
    // 실제 사용 시 아래 주석을 해제하고 API 키를 .env에 추가하세요.
    //
    // const response = await fetch("https://api.klingai.com/v1/videos/text2video", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${apiKey}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     prompt: prompt.text_prompt,
    //     duration: String(prompt.duration_sec),
    //     aspect_ratio: "9:16",
    //   }),
    // });
    // const data = await response.json() as { task_id: string };
    // return {
    //   status: "success",
    //   metadata: { adapter: "kling", task_id: data.task_id },
    // };

    return {
      status: "dry_run",
      metadata: {
        adapter: "kling",
        note: "Add KLING_API_KEY to .env and uncomment the fetch call above",
      },
    };
  }
}
