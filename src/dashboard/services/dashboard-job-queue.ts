export type DashboardJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface DashboardJobLogEntry {
  level: "info" | "error";
  message: string;
  timestamp: string;
}

export interface DashboardJob {
  id: string;
  kind: string;
  label: string;
  status: DashboardJobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: number;
  logs: DashboardJobLogEntry[];
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
}

export interface DashboardJobQueueEvent {
  type: "created" | "updated";
  job: DashboardJob;
}

type DashboardJobQueueListener = (event: DashboardJobQueueEvent) => void;

export class DashboardJobQueue {
  private readonly jobs = new Map<string, DashboardJob>();
  private readonly listeners = new Set<DashboardJobQueueListener>();

  createJob(input: {
    id: string;
    kind: string;
    label: string;
    input?: Record<string, unknown>;
  }): DashboardJob {
    const job: DashboardJob = {
      id: input.id,
      kind: input.kind,
      label: input.label,
      status: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      progress: 0,
      logs: [],
      input: input.input ?? {},
      output: null,
      error: null,
    };

    this.jobs.set(job.id, job);
    this.emit({ type: "created", job });
    return this.cloneJob(job);
  }

  markRunning(jobId: string): DashboardJob {
    return this.update(jobId, (job) => {
      job.status = "running";
      job.startedAt = job.startedAt ?? new Date().toISOString();
      job.progress = Math.max(job.progress, 0.05);
      return job;
    });
  }

  updateProgress(jobId: string, progress: number): DashboardJob {
    return this.update(jobId, (job) => {
      job.progress = Math.min(Math.max(progress, 0), 1);
      return job;
    });
  }

  appendLog(jobId: string, message: string, level: "info" | "error" = "info"): DashboardJob {
    return this.update(jobId, (job) => {
      job.logs = [
        ...job.logs,
        {
          level,
          message,
          timestamp: new Date().toISOString(),
        },
      ];
      return job;
    });
  }

  succeed(jobId: string, output: unknown): DashboardJob {
    return this.update(jobId, (job) => {
      job.status = "succeeded";
      job.output = output;
      job.error = null;
      job.finishedAt = new Date().toISOString();
      job.progress = 1;
      return job;
    });
  }

  fail(jobId: string, error: string): DashboardJob {
    return this.update(jobId, (job) => {
      job.status = "failed";
      job.error = error;
      job.finishedAt = new Date().toISOString();
      job.progress = 1;
      return job;
    });
  }

  listJobs(): DashboardJob[] {
    return [...this.jobs.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((job) => this.cloneJob(job));
  }

  subscribe(listener: DashboardJobQueueListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private update(jobId: string, mutate: (job: DashboardJob) => DashboardJob): DashboardJob {
    const existing = this.jobs.get(jobId);

    if (!existing) {
      throw new Error(`Dashboard job not found: ${jobId}`);
    }

    const updated = mutate({
      ...existing,
      logs: [...existing.logs],
      input: { ...existing.input },
    });

    this.jobs.set(jobId, updated);
    this.emit({ type: "updated", job: updated });
    return this.cloneJob(updated);
  }

  private emit(event: DashboardJobQueueEvent): void {
    for (const listener of this.listeners) {
      listener({
        type: event.type,
        job: this.cloneJob(event.job),
      });
    }
  }

  private cloneJob(job: DashboardJob): DashboardJob {
    return {
      ...job,
      logs: [...job.logs],
      input: { ...job.input },
    };
  }
}
