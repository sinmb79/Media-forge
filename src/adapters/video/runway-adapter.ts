import type {
  VideoGenerationAdapter,
  VideoGenerationOptions,
  VideoGenerationPrompt,
  VideoGenerationResult,
} from "./video-generation-adapter.js";

export class RunwayAdapter implements VideoGenerationAdapter {
  name = "runway";

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env["RUNWAY_API_KEY"]);
  }

  async generate(
    _prompt: VideoGenerationPrompt,
    options: VideoGenerationOptions,
  ): Promise<VideoGenerationResult> {
    if (options.dry_run) {
      return {
        status: "dry_run",
        metadata: { adapter: "runway", dry_run: true },
      };
    }

    const apiKey = process.env["RUNWAY_API_KEY"];
    if (!apiKey) {
      return {
        status: "error",
        error: "RUNWAY_API_KEY is not set in environment",
        metadata: { adapter: "runway" },
      };
    }

    // Runway Gen-3 API 호출 구조
    // 실제 사용 시 아래 주석을 해제하고 API 키를 .env에 추가하세요.
    //
    // const response = await fetch("https://api.runwayml.com/v1/image_to_video", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${apiKey}`,
    //     "Content-Type": "application/json",
    //     "X-Runway-Version": "2024-11-06",
    //   },
    //   body: JSON.stringify({
    //     promptText: prompt.text_prompt,
    //     duration: prompt.duration_sec <= 5 ? 5 : 10,
    //     ratio: "720:1280",
    //   }),
    // });
    // const data = await response.json() as { id: string };
    // return {
    //   status: "success",
    //   metadata: { adapter: "runway", task_id: data.id },
    // };

    return {
      status: "dry_run",
      metadata: {
        adapter: "runway",
        note: "Add RUNWAY_API_KEY to .env and uncomment the fetch call above",
      },
    };
  }
}
