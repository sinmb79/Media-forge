"use client";

import { create } from "zustand";

import type {
  AssetCardRecord,
  DashboardActionResponse,
  DashboardCollectionResponse,
  DashboardJobRecord,
  DashboardOutputRecord,
  MediaForgeHealthSnapshot,
  StudioBootstrapPayload,
  UploadedFileRecord,
} from "./mediaforge-types";

interface StudioStoreState {
  actionPending: boolean;
  assets: AssetCardRecord[];
  health: MediaForgeHealthSnapshot | null;
  hydrated: boolean;
  jobs: DashboardJobRecord[];
  lastAction: DashboardActionResponse | null;
  lastError: string | null;
  outputs: DashboardOutputRecord[];
  selectedJobId: string | null;
  selectedOutputId: string | null;
  textPreview: string | null;
  uploads: UploadedFileRecord[];
  prime: (payload: StudioBootstrapPayload) => void;
  refreshAll: () => Promise<void>;
  refreshAssets: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  refreshJobs: () => Promise<void>;
  refreshOutputs: () => Promise<void>;
  resetAction: () => void;
  runAction: (endpoint: string, payload?: Record<string, unknown>) => Promise<DashboardActionResponse | null>;
  selectJob: (jobId: string | null) => void;
  selectOutput: (outputId: string | null) => Promise<void>;
  uploadFile: (file: File) => Promise<UploadedFileRecord>;
}

export const useStudioStore = create<StudioStoreState>((set, get) => ({
  actionPending: false,
  assets: [],
  health: null,
  hydrated: false,
  jobs: [],
  lastAction: null,
  lastError: null,
  outputs: [],
  selectedJobId: null,
  selectedOutputId: null,
  textPreview: null,
  uploads: [],

  prime(payload) {
    set({
      assets: payload.assets,
      health: payload.health,
      hydrated: true,
      jobs: payload.jobs,
      outputs: payload.outputs,
      selectedJobId: resolveSelectedJobId(get().selectedJobId, payload.jobs),
      selectedOutputId: resolveSelectedOutputId(get().selectedOutputId, payload.outputs),
    });
  },

  async refreshAll() {
    await Promise.all([
      get().refreshHealth(),
      get().refreshJobs(),
      get().refreshOutputs(),
      get().refreshAssets(),
    ]);

    set({ hydrated: true });
  },

  async refreshAssets() {
    const response = await fetchJson<DashboardCollectionResponse<AssetCardRecord>>("/api/assets");
    set({
      assets: response.items,
      lastError: null,
    });
  },

  async refreshHealth() {
    const response = await fetchJson<MediaForgeHealthSnapshot>("/api/health");
    set({
      health: response,
      lastError: null,
    });
  },

  async refreshJobs() {
    const response = await fetchJson<DashboardCollectionResponse<DashboardJobRecord>>("/api/jobs");
    set((state) => ({
      jobs: response.items,
      lastError: null,
      selectedJobId: resolveSelectedJobId(state.selectedJobId, response.items),
    }));
  },

  async refreshOutputs() {
    const response = await fetchJson<DashboardCollectionResponse<DashboardOutputRecord>>("/api/outputs");
    const selectedOutputId = resolveSelectedOutputId(get().selectedOutputId, response.items);

    set({
      outputs: response.items,
      lastError: null,
      selectedOutputId,
    });

    await get().selectOutput(selectedOutputId);
  },

  resetAction() {
    set({ lastAction: null, lastError: null });
  },

  async runAction(endpoint: string, payload: Record<string, unknown> = {}) {
    set({ actionPending: true, lastError: null });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json() as DashboardActionResponse;
      set({
        actionPending: false,
        lastAction: result,
      });

      if (response.status === 202 && "job_id" in result) {
        set({ selectedJobId: result.job_id });
        await get().refreshJobs();
        window.setTimeout(() => {
          void get().refreshJobs();
          void get().refreshOutputs();
        }, 1200);
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({
        actionPending: false,
        lastError: message,
      });
      return null;
    }
  },

  selectJob(jobId: string | null) {
    set({ selectedJobId: jobId });
  },

  async selectOutput(outputId: string | null) {
    const selectedOutput = get().outputs.find((output) => output.id === outputId) ?? null;
    set({
      selectedOutputId: outputId,
      textPreview: null,
    });

    if (!selectedOutput || selectedOutput.kind !== "text") {
      return;
    }

    try {
      const response = await fetch(selectedOutput.url);
      const text = await response.text();
      set({ textPreview: text });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ textPreview: message });
    }
  },

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const uploaded = await response.json() as UploadedFileRecord;
    set((state) => ({
      uploads: [uploaded, ...state.uploads].slice(0, 12),
    }));
    return uploaded;
  },
}));

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function resolveSelectedJobId(
  currentJobId: string | null,
  jobs: DashboardJobRecord[],
): string | null {
  if (currentJobId && jobs.some((job) => job.id === currentJobId)) {
    return currentJobId;
  }

  return jobs[0]?.id ?? null;
}

function resolveSelectedOutputId(
  currentOutputId: string | null,
  outputs: DashboardOutputRecord[],
): string | null {
  if (currentOutputId && outputs.some((output) => output.id === currentOutputId)) {
    return currentOutputId;
  }

  return outputs[0]?.id ?? null;
}
