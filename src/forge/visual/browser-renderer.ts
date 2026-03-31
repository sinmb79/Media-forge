import * as path from "node:path";
import { access } from "node:fs/promises";

import { defaultExecFile, type ExecFileLike } from "../../backends/process-runner.js";

export interface VisualFrameRenderRequest {
  framePath: string;
  frameUrl: string;
  height?: number;
  width?: number;
}

export interface VisualBrowserRenderer {
  renderFrame(request: VisualFrameRenderRequest): Promise<void>;
}

export interface HeadlessBrowserRendererOptions {
  browserCandidates?: string[];
  execFileFn?: ExecFileLike;
  executablePath?: string;
  pathExists?: (candidate: string) => Promise<boolean>;
}

export class HeadlessBrowserRenderer implements VisualBrowserRenderer {
  private readonly options: HeadlessBrowserRendererOptions;

  constructor(options: HeadlessBrowserRendererOptions = {}) {
    this.options = options;
  }

  async renderFrame(request: VisualFrameRenderRequest): Promise<void> {
    const executablePath = await this.resolveExecutablePath();
    const width = request.width ?? 1280;
    const height = request.height ?? 720;
    const result = await (this.options.execFileFn ?? defaultExecFile)(
      executablePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=2000",
        `--window-size=${width},${height}`,
        `--screenshot=${request.framePath}`,
        request.frameUrl,
      ],
    );

    if (result.exitCode !== 0) {
      throw new Error(`Browser frame render failed: ${result.stderr || result.stdout || executablePath}`);
    }
  }

  private async resolveExecutablePath(): Promise<string> {
    if (this.options.executablePath) {
      return this.options.executablePath;
    }

    const candidates = this.options.browserCandidates ?? createBrowserCandidates();
    const pathExists = this.options.pathExists ?? defaultPathExists;

    for (const candidate of candidates.filter((value): value is string => Boolean(value))) {
      if (candidate.includes(path.sep) && await pathExists(candidate)) {
        return candidate;
      }
    }

    for (const candidate of candidates.filter((value): value is string => Boolean(value))) {
      if (!candidate.includes(path.sep)) {
        return candidate;
      }
    }

    for (const candidate of candidates.filter((value): value is string => Boolean(value))) {
      if (await pathExists(candidate)) {
        return candidate;
      }
    }

    return "msedge";
  }
}

function createBrowserCandidates(): string[] {
  return [
    process.env.MEDIAFORGE_BROWSER,
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.ProgramFiles ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    "msedge",
    "chrome",
  ].filter((candidate): candidate is string => Boolean(candidate));
}

async function defaultPathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}
