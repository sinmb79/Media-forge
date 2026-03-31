import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

export type SeedCandidateStatus = "pending" | "generating" | "generated" | "failed";

export interface SeedCandidate {
  id: string;
  file: string;
  seed: number;
  status: SeedCandidateStatus;
  selected: boolean;
  thumbnail?: string;
  totalDuration: number;
}

export interface SeedSessionExtension {
  id: string;
  parent: string;
  file: string;
  overlapFrames: number;
  addedDuration: number;
  totalDuration: number;
  prompt?: string;
  seed?: number;
  thumbnail?: string;
}

export interface SeedVoiceoverSegment {
  start: number;
  end: number;
  dialogue: string;
  subtitle: string;
  speaker: string;
}

export interface SeedSessionVoiceover {
  enabled: boolean;
  segments: SeedVoiceoverSegment[];
}

export interface SeedSessionManifest {
  sessionId: string;
  createdAt: string;
  prompt: string;
  promptEn?: string;
  model: string;
  refs?: string[];
  duration: number;
  resolution: string;
  candidates: SeedCandidate[];
  extensions: SeedSessionExtension[];
  compositions?: Array<{
    audio?: string;
    output: string;
    rootId: string;
    subtitles?: string;
    upscaled?: string;
    withAudio?: boolean;
  }>;
  sourceImagePath?: string;
  voiceover?: SeedSessionVoiceover;
}

export interface SeedSessionCreateOptions {
  candidateCount: number;
  duration: number;
  model: string;
  outputDir: string;
  prompt: string;
  promptEn?: string;
  refs?: string[];
  resolution?: string;
  sourceImagePath?: string;
  voiceover?: SeedSessionVoiceover;
}

export interface SeedSessionBrowseRecord {
  sessionDir: string;
  sessionId: string;
  prompt: string;
  model: string;
  createdAt: string;
  candidateCount: number;
  extensionCount: number;
  selectedCandidateIds: string[];
}

export class SeedSessionManager {
  readonly sessionDir: string;
  readonly manifestPath: string;
  manifest: SeedSessionManifest;

  private constructor(sessionDir: string, manifest: SeedSessionManifest) {
    this.sessionDir = sessionDir;
    this.manifestPath = path.join(sessionDir, "manifest.json");
    this.manifest = manifest;
  }

  static async create(options: SeedSessionCreateOptions): Promise<SeedSessionManager> {
    const sessionDir = path.resolve(options.outputDir);
    const sessionId = `${path.basename(sessionDir)}-${Date.now()}`;
    const manifest: SeedSessionManifest = {
      candidates: Array.from({ length: options.candidateCount }, (_, index) => ({
        file: "",
        id: formatSeedId(index + 1),
        seed: createCandidateSeed(index),
        selected: false,
        status: "pending",
        totalDuration: options.duration,
      })),
      compositions: [],
      createdAt: new Date().toISOString(),
      duration: options.duration,
      extensions: [],
      model: options.model,
      prompt: options.prompt,
      resolution: options.resolution ?? "832x480",
      sessionId,
      ...(options.promptEn ? { promptEn: options.promptEn } : {}),
      ...(options.refs && options.refs.length > 0 ? { refs: options.refs } : {}),
      ...(options.sourceImagePath ? { sourceImagePath: options.sourceImagePath } : {}),
      ...(options.voiceover ? { voiceover: options.voiceover } : {}),
    };

    const manager = new SeedSessionManager(sessionDir, manifest);
    await manager.save();
    return manager;
  }

  static async load(sessionDir: string): Promise<SeedSessionManager> {
    const resolvedDir = path.resolve(sessionDir);
    const manifestPath = path.join(resolvedDir, "manifest.json");
    const raw = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as SeedSessionManifest;
    manifest.compositions ??= [];
    return new SeedSessionManager(resolvedDir, manifest);
  }

  async save(): Promise<void> {
    await mkdir(this.sessionDir, { recursive: true });
    await writeFile(this.manifestPath, `${JSON.stringify(this.manifest, null, 2)}\n`, "utf8");
  }

  async pick(candidateIds: string[]): Promise<void> {
    const picked = new Set(candidateIds);
    for (const candidate of this.manifest.candidates) {
      candidate.selected = picked.has(candidate.id);
    }
    await this.save();
  }

  async registerCandidateResult(
    candidateId: string,
    update: {
      file: string;
      seed?: number;
      status?: SeedCandidateStatus;
      thumbnail?: string;
    },
  ): Promise<SeedCandidate> {
    const candidate = this.findCandidate(candidateId);
    candidate.file = update.file;
    candidate.seed = update.seed ?? candidate.seed;
    candidate.status = update.status ?? "generated";
    if (update.thumbnail) {
      candidate.thumbnail = update.thumbnail;
    }
    await this.save();
    return candidate;
  }

  async addExtension(
    input: {
      addedDuration: number;
      file: string;
      overlapFrames: number;
      parent: string;
      prompt?: string;
      seed?: number;
      thumbnail?: string;
    },
  ): Promise<SeedSessionExtension> {
    const parent = this.findClip(input.parent);
    const extension: SeedSessionExtension = {
      addedDuration: input.addedDuration,
      file: input.file,
      id: this.nextExtensionId(rootSeedIdFor(input.parent)),
      overlapFrames: input.overlapFrames,
      parent: input.parent,
      totalDuration: parent.totalDuration + input.addedDuration,
      ...(input.prompt ? { prompt: input.prompt } : {}),
      ...(typeof input.seed === "number" ? { seed: input.seed } : {}),
      ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
    };
    this.manifest.extensions.push(extension);
    await this.save();
    return extension;
  }

  async saveComposition(input: {
    audio?: string;
    output: string;
    rootId: string;
    subtitles?: string;
    upscaled?: string;
    withAudio?: boolean;
  }): Promise<void> {
    this.manifest.compositions ??= [];
    this.manifest.compositions = [
      ...this.manifest.compositions.filter((entry) => entry.rootId !== input.rootId),
      input,
    ];
    await this.save();
  }

  getExtensionChain(rootId: string): Array<SeedCandidate | SeedSessionExtension> {
    const chain: Array<SeedCandidate | SeedSessionExtension> = [this.findCandidate(rootId)];
    let cursor = rootId;

    while (true) {
      const next = this.manifest.extensions.find((entry) => entry.parent === cursor);
      if (!next) {
        break;
      }
      chain.push(next);
      cursor = next.id;
    }

    return chain;
  }

  resolveLatestClip(rootId: string): SeedCandidate | SeedSessionExtension {
    const chain = this.getExtensionChain(rootId);
    return chain[chain.length - 1] ?? this.findCandidate(rootId);
  }

  findClip(id: string): SeedCandidate | SeedSessionExtension {
    const candidate = this.manifest.candidates.find((entry) => entry.id === id);
    if (candidate) {
      return candidate;
    }

    const extension = this.manifest.extensions.find((entry) => entry.id === id);
    if (extension) {
      return extension;
    }

    throw new Error(`Unknown clip: ${id}`);
  }

  private findCandidate(id: string): SeedCandidate {
    const candidate = this.manifest.candidates.find((entry) => entry.id === id);
    if (!candidate) {
      throw new Error(`Unknown seed candidate: ${id}`);
    }
    return candidate;
  }

  private findExtension(id: string): SeedSessionExtension {
    const extension = this.manifest.extensions.find((entry) => entry.id === id);
    if (!extension) {
      throw new Error(`Unknown extension clip: ${id}`);
    }
    return extension;
  }

  private nextExtensionId(rootId: string): string {
    const rootSuffix = rootId.split("-")[1] ?? "001";
    const count = this.manifest.extensions.filter((entry) => entry.id.startsWith(`ext-${rootSuffix}-`)).length + 1;
    return `ext-${rootSuffix}-${String(count).padStart(3, "0")}`;
  }
}

export async function browseSeedSessions(rootDir: string): Promise<SeedSessionBrowseRecord[]> {
  const entries = await readdir(path.resolve(rootDir), { withFileTypes: true }).catch(() => []);
  const sessions: SeedSessionBrowseRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      const manager = await SeedSessionManager.load(path.join(rootDir, entry.name));
      sessions.push({
        candidateCount: manager.manifest.candidates.length,
        createdAt: manager.manifest.createdAt,
        extensionCount: manager.manifest.extensions.length,
        model: manager.manifest.model,
        prompt: manager.manifest.prompt,
        selectedCandidateIds: manager.manifest.candidates
          .filter((candidate) => candidate.selected)
          .map((candidate) => candidate.id),
        sessionDir: manager.sessionDir,
        sessionId: manager.manifest.sessionId,
      });
    } catch {
      continue;
    }
  }

  return sessions.sort((left, right) => left.sessionId.localeCompare(right.sessionId));
}

function formatSeedId(index: number): string {
  return `seed-${String(index).padStart(3, "0")}`;
}

function createCandidateSeed(index: number): number {
  return 1000 + (index * 7919);
}

function rootSeedIdFor(id: string): string {
  if (id.startsWith("seed-")) {
    return id;
  }
  const [, root] = id.split("-");
  return `seed-${root ?? "001"}`;
}
