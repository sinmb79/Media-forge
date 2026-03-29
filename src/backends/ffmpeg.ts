import { writeFile, mkdir } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { defaultExecFile, type ExecFileLike } from "./process-runner.js";
import { inspectBackends } from "./registry.js";
import type {
  BackendExecutionRequest,
  BackendExecutionResult,
  IBackend,
} from "./types.js";

export interface MediaInfo {
  duration: number;
  resolution: string;
  fps: number;
  codec: string;
}

export interface FFmpegBackendOptions {
  execFileFn?: ExecFileLike;
  executablePath?: string;
  ffprobePath?: string;
}

export class FFmpegBackend implements IBackend {
  readonly name = "ffmpeg" as const;
  private readonly options: FFmpegBackendOptions;

  constructor(options: FFmpegBackendOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    const status = await lookupBackendStatus(this.name);
    return status?.available ?? false;
  }

  async getVersion(): Promise<string | null> {
    const status = await lookupBackendStatus(this.name);
    return status?.version ?? null;
  }

  async execute(request: BackendExecutionRequest): Promise<BackendExecutionResult> {
    return this.run(request.args ?? [], request.cwd);
  }

  async cut(input: string, start: string, end: string, output: string): Promise<string> {
    await this.run(["-y", "-i", input, "-ss", start, "-to", end, "-c", "copy", output]);
    return output;
  }

  async concat(inputs: string[], output: string): Promise<string> {
    const listPath = path.join(os.tmpdir(), `mediaforge-concat-${Date.now()}.txt`);
    await mkdir(path.dirname(listPath), { recursive: true });
    await writeFile(listPath, inputs.map((file) => `file '${file}'`).join("\n"));
    await this.run(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", output]);
    return output;
  }

  async speed(input: string, factor: number, output: string): Promise<string> {
    await this.run([
      "-y",
      "-i",
      input,
      "-filter:v",
      `setpts=${Number((1 / factor).toFixed(4))}*PTS`,
      "-filter:a",
      `atempo=${factor}`,
      output,
    ]);
    return output;
  }

  async resize(input: string, ratio: string, resolution: string, output: string): Promise<string> {
    const [width, height] = resolveResolution(ratio, resolution);
    await this.run(["-y", "-i", input, "-vf", `scale=${width}:${height}`, output]);
    return output;
  }

  async stabilize(input: string, output: string): Promise<string> {
    const trfPath = path.join(os.tmpdir(), `mediaforge-stabilize-${Date.now()}.trf`);
    await this.run(["-y", "-i", input, "-vf", `vidstabdetect=shakiness=5:accuracy=15:result=${trfPath}`, "-f", "null", "-"]);
    await this.run(["-y", "-i", input, "-vf", `vidstabtransform=input=${trfPath}:zoom=0:smoothing=30`, output]);
    return output;
  }

  async addSubtitles(video: string, srt: string, output: string): Promise<string> {
    await this.run(["-y", "-i", video, "-vf", `subtitles=${srt}`, output]);
    return output;
  }

  async addAudio(video: string, audio: string, volume: number, output: string): Promise<string> {
    await this.run([
      "-y",
      "-i",
      video,
      "-i",
      audio,
      "-filter_complex",
      `[1:a]volume=${volume}[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]`,
      "-map",
      "0:v",
      "-map",
      "[aout]",
      output,
    ]);
    return output;
  }

  async extractAudio(video: string, output: string): Promise<string> {
    await this.run(["-y", "-i", video, "-vn", "-acodec", "copy", output]);
    return output;
  }

  async getMediaInfo(input: string): Promise<MediaInfo> {
    const result = await (this.options.execFileFn ?? defaultExecFile)(
      this.options.ffprobePath ?? "ffprobe",
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", input],
    );
    const parsed = JSON.parse(result.stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        avg_frame_rate?: string;
        codec_name?: string;
        codec_type?: string;
        height?: number;
        width?: number;
      }>;
    };
    const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video");

    return {
      codec: videoStream?.codec_name ?? "unknown",
      duration: Number(parsed.format?.duration ?? 0),
      fps: parseFrameRate(videoStream?.avg_frame_rate ?? "0/1"),
      resolution: videoStream?.width && videoStream.height
        ? `${videoStream.width}x${videoStream.height}`
        : "unknown",
    };
  }

  private async run(args: string[], cwd?: string): Promise<BackendExecutionResult> {
    return (this.options.execFileFn ?? defaultExecFile)(
      this.options.executablePath ?? "ffmpeg",
      args,
      cwd ? { cwd } : {},
    );
  }
}

async function lookupBackendStatus(name: IBackend["name"]) {
  const statuses = await inspectBackends();
  return statuses.find((status) => status.name === name) ?? null;
}

function resolveResolution(ratio: string, resolution: string): [number, number] {
  const shortEdge = Number.parseInt(resolution.replace(/p$/i, ""), 10);

  if (ratio === "9:16") {
    return [shortEdge, Math.round((shortEdge / 9) * 16)];
  }

  if (ratio === "16:9") {
    return [Math.round((shortEdge / 9) * 16), shortEdge];
  }

  return [shortEdge, shortEdge];
}

function parseFrameRate(value: string): number {
  const [numerator = 0, denominator = 1] = value.split("/").map((part) => Number(part));
  if (!denominator) {
    return numerator || 0;
  }
  return Number((numerator / denominator).toFixed(2));
}
