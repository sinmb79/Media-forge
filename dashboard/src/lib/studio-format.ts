import type {
  DashboardJobRecord,
  DashboardJobStatus,
  DashboardOutputKind,
} from "./mediaforge-types";

export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatShortTime(value: string | null): string {
  if (!value) {
    return "대기 중";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatStatusLabel(status: DashboardJobStatus, job: DashboardJobRecord): string {
  if (status === "failed" && job.phase === "verification") {
    return "검증 실패";
  }

  if (status === "failed") {
    return "실행 실패";
  }

  if (status === "running" && job.phase === "verification") {
    return "검증 중";
  }

  if (status === "running") {
    return "실행 중";
  }

  if (status === "queued") {
    return "대기열";
  }

  return job.expected_artifact ? "생성 및 검증 완료" : "파일 생성 없음";
}

export function statusTone(status: DashboardJobStatus): string {
  switch (status) {
    case "succeeded":
      return "text-emerald-200 bg-emerald-500/15 border-emerald-400/30";
    case "failed":
      return "text-rose-100 bg-rose-500/15 border-rose-400/30";
    case "running":
      return "text-cyan-100 bg-cyan-500/15 border-cyan-400/30";
    default:
      return "text-zinc-200 bg-zinc-500/15 border-zinc-400/20";
  }
}

export function outputTone(kind: DashboardOutputKind): string {
  switch (kind) {
    case "image":
      return "from-fuchsia-500/35 via-orange-400/20 to-transparent";
    case "video":
      return "from-lime-400/35 via-emerald-400/20 to-transparent";
    case "audio":
      return "from-sky-400/35 via-cyan-400/20 to-transparent";
    case "text":
      return "from-zinc-200/20 via-zinc-100/10 to-transparent";
    default:
      return "from-zinc-300/15 via-zinc-100/5 to-transparent";
  }
}
