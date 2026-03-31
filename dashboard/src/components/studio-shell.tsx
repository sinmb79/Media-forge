"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Blocks,
  BookOpen,
  Clapperboard,
  FolderKanban,
  ImagePlus,
  LayoutDashboard,
  ListVideo,
  Music4,
  PanelTop,
  Settings2,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildSystemSnapshotView } from "@/lib/studio-view-model";
import { dashboardNavItems } from "@/lib/studio-config";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/lib/studio-store";
import { formatBytes, formatShortTime, formatStatusLabel, outputTone, statusTone } from "@/lib/studio-format";

const navIcons = {
  dashboard: LayoutDashboard,
  image: ImagePlus,
  video: Clapperboard,
  storyboard: ListVideo,
  edit: Sparkles,
  visual: WandSparkles,
  audio: Music4,
  scenario: BookOpen,
  webtoon: PanelTop,
  characters: Users,
  assets: FolderKanban,
  queue: Blocks,
  settings: Settings2,
} as const;

export const studioPageCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/": {
    eyebrow: "로컬 프로덕션 스튜디오",
    title: "MediaForge Studio",
    description: "Kling 스타일 생성 흐름과 CapCut 스타일 후반 작업 구성을 로컬 GPU와 로컬 모델 위에서 실행합니다.",
  },
  "/image": {
    eyebrow: "이미지 생성",
    title: "이미지 스튜디오",
    description: "프롬프트, 스케치, 참조 이미지를 바탕으로 로컬 SDXL·FLUX 계열 워크플로우를 실행합니다.",
  },
  "/video": {
    eyebrow: "비디오 생성",
    title: "비디오 스튜디오",
    description: "Wan, LTX, SkyReels 기반 생성과 시드 세션·확장·조립 흐름을 한곳에서 관리합니다.",
  },
  "/video/storyboard": {
    eyebrow: "장면 구성",
    title: "스토리보드 스튜디오",
    description: "장면을 미리 정리하고 생성 순서를 관리하면서 결과물 검증 상태까지 함께 확인합니다.",
  },
  "/edit": {
    eyebrow: "보정과 마감",
    title: "편집 스튜디오",
    description: "FFmpeg와 AI 편집 도구로 컷 편집, 속도 조절, 안정화, 업스케일을 처리합니다.",
  },
  "/visual": {
    eyebrow: "코드 기반 비주얼",
    title: "비주얼 스튜디오",
    description: "렌더 템플릿과 음악 시각화, 코드 기반 이펙트를 조합해 시각 자산을 만듭니다.",
  },
  "/audio": {
    eyebrow: "음성 및 자막",
    title: "오디오 스튜디오",
    description: "TTS, 드라마 음성, 전사, BGM, 믹싱, 보이스 분리를 로컬에서 이어서 다룹니다.",
  },
  "/characters": {
    eyebrow: "캐릭터 라이브러리",
    title: "캐릭터 관리",
    description: "캐릭터를 등록하고 레퍼런스 이미지로 모든 씬에서 동일 외형을 유지합니다.",
  },
  "/scenario": {
    eyebrow: "시나리오 파이프라인",
    title: "시나리오 수집",
    description: "블로그에서 생성된 시나리오를 웹툰, 숏폼, 롱폼으로 자동 변환합니다.",
  },
  "/webtoon": {
    eyebrow: "웹툰 스튜디오",
    title: "웹툰 생성",
    description: "시나리오를 패널별 또는 페이지별 웹툰 이미지로 생성합니다.",
  },
  "/assets": {
    eyebrow: "프로젝트 자산",
    title: "에셋 라이브러리",
    description: "캐릭터, 배경, 효과, 모션, 프롬프트 프리셋을 작업 흐름에 맞게 탐색합니다.",
  },
  "/queue": {
    eyebrow: "실행 추적",
    title: "실행 큐",
    description: "현재 작업, 검증 결과, 다음 단계, 실패 원인을 한 번에 확인합니다.",
  },
  "/settings": {
    eyebrow: "로컬 환경",
    title: "설정",
    description: "작업 경로, 백엔드 준비 상태, 하드웨어 인식, OpenClaw 연결 상태를 관리합니다.",
  },
};

export function formatStudioSectionLabel(section: "workspace" | "library" | "system"): string {
  switch (section) {
    case "workspace":
      return "작업";
    case "library":
      return "라이브러리";
    default:
      return "시스템";
  }
}

export function StudioShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const normalizedPathname = pathname === "/" ? "/queue" : pathname;
  const {
    actionPending,
    health,
    jobs,
    lastAction,
    lastError,
    outputs,
    selectJob,
    selectOutput,
    selectedJobId,
    selectedOutputId,
    textPreview,
  } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    health: state.health,
    jobs: state.jobs,
    lastAction: state.lastAction,
    lastError: state.lastError,
    outputs: state.outputs,
    selectJob: state.selectJob,
    selectOutput: state.selectOutput,
    selectedJobId: state.selectedJobId,
    selectedOutputId: state.selectedOutputId,
    textPreview: state.textPreview,
  })));

  useEffect(() => {
    void useStudioStore.getState().refreshAll();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void useStudioStore.getState().refreshAll();
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  const pageMeta = studioPageCopy[normalizedPathname] ?? studioPageCopy["/"];
  const systemView = health ? buildSystemSnapshotView(health) : null;
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
  const selectedOutput = outputs.find((output) => output.id === selectedOutputId) ?? outputs[0] ?? null;

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(46,255,162,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(42,132,255,0.14),transparent_32%),linear-gradient(180deg,rgba(8,10,18,0.98),rgba(3,4,8,1))]" />
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-black/25 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:w-[94px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-5 py-4 lg:block lg:px-4 lg:py-6">
            <div className="flex items-center gap-3 lg:flex-col lg:gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-[0.7rem] font-semibold tracking-[0.24em] text-emerald-200 shadow-[0_0_40px_rgba(38,255,161,0.16)]">
                MF
              </div>
              <div className="hidden lg:block">
                <div className="text-[0.62rem] uppercase tracking-[0.28em] text-zinc-400">스튜디오</div>
                <div className="text-sm font-semibold text-white">로컬 AI</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10 lg:hidden"
              onClick={() => void useStudioStore.getState().refreshAll()}
            >
              새로고침
            </Button>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible lg:px-3">
            {dashboardNavItems.map((item) => {
              const Icon = navIcons[item.id as keyof typeof navIcons];
              const active = normalizedPathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "group flex min-w-[112px] items-center gap-3 rounded-2xl border px-3 py-3 transition lg:min-w-0 lg:flex-col lg:justify-center lg:px-2 lg:py-3",
                    active
                      ? "border-emerald-400/40 bg-emerald-500/14 text-white shadow-[0_0_28px_rgba(46,255,162,0.18)]"
                      : "border-white/6 bg-white/[0.04] text-zinc-300 hover:border-white/14 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-emerald-200" : "text-zinc-400 group-hover:text-white")} />
                  <div className="flex flex-col lg:items-center">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="hidden text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500 lg:block">
                      {formatStudioSectionLabel(item.section)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-white/8 bg-black/20 px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <div className="text-[0.68rem] uppercase tracking-[0.28em] text-emerald-200/80">{pageMeta.eyebrow}</div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{pageMeta.title}</h1>
                  {actionPending ? (
                    <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100">
                      작업 실행 중
                    </span>
                  ) : null}
                </div>
                <p className="max-w-3xl text-sm leading-6 text-zinc-400">{pageMeta.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[540px]">
                <div className="rounded-3xl border border-white/8 bg-white/[0.05] px-4 py-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.26em] text-zinc-500">작업공간</div>
                  <div className="mt-1 truncate text-sm font-medium text-white">
                    {systemView?.workspacePath ?? "작업공간을 불러오는 중"}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.05] px-4 py-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.26em] text-zinc-500">하드웨어</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {systemView?.gpuHeadline ?? "로컬 하드웨어 확인 중"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {systemView?.vramLabel ?? "VRAM 확인 중"} / {systemView?.ramLabel ?? "RAM 확인 중"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(health?.doctor.backends ?? []).map((backend) => (
                <span
                  key={backend.name}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium capitalize",
                    backend.available
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                      : "border-amber-400/25 bg-amber-500/10 text-amber-100",
                  )}
                >
                  {backend.name} {backend.available ? "준비됨" : "없음"}
                </span>
              ))}
            </div>
          </header>

          <div className="grid min-h-0 flex-1 gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <main className="min-w-0">{children}</main>

            <aside className="space-y-4">
              <StudioPanel title="검증 요약" description="실행 전 차단, 실행 중, 최종 검증 완료 여부를 바로 확인합니다.">
                {lastAction ? (
                  <div className="space-y-3 rounded-3xl border border-white/8 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">
                        {"label" in lastAction ? lastAction.label : lastAction.action}
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[0.7rem] font-medium",
                          lastAction.status === "queued"
                            ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-100"
                            : "border-amber-400/25 bg-amber-500/10 text-amber-100",
                        )}
                      >
                        {lastAction.status === "queued" ? "대기열 등록" : "실행 전 차단"}
                      </span>
                    </div>
                    {"reason" in lastAction ? (
                      <>
                        <p className="text-sm leading-6 text-zinc-300">{lastAction.reason}</p>
                        <div className="flex flex-wrap gap-2">
                          {lastAction.missing_backends.map((backend) => (
                            <span key={backend} className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[0.7rem] text-rose-100">
                              백엔드 {backend}
                            </span>
                          ))}
                          {lastAction.missing_inputs.map((field) => (
                            <span key={field} className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[0.7rem] text-amber-100">
                              입력값 {field}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm leading-6 text-zinc-300">
                        작업이 대기열에 들어갔습니다. 아래 실행 큐 카드에서 실행과 검증 진행 상태를 확인해 주세요.
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="선택된 작업이 없습니다"
                    body="Doctor, 프롬프트, 생성 작업을 실행하면 여기에 차단 여부와 검증 결과가 표시됩니다."
                  />
                )}

                {lastError ? (
                  <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                    {lastError}
                  </div>
                ) : null}
              </StudioPanel>

              <StudioPanel title="미리보기 작업공간" description="검증이 끝난 결과물만 여기에서 즉시 확인합니다. 텍스트 출력은 원본 인스펙터 내용으로 보여줍니다.">
                {selectedOutput ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => void selectOutput(selectedOutput.id)}
                      className={cn(
                        "w-full overflow-hidden rounded-[28px] border bg-gradient-to-br p-4 text-left",
                        outputTone(selectedOutput.kind),
                        "border-white/8",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-zinc-300">{selectedOutput.kind}</div>
                          <div className="mt-1 text-sm font-semibold text-white">{selectedOutput.name}</div>
                        </div>
                        <div className="text-xs text-zinc-300">{formatBytes(selectedOutput.sizeBytes)}</div>
                      </div>
                    </button>
                    <OutputPreviewCard output={selectedOutput} textPreview={textPreview} />
                  </div>
                ) : (
                  <EmptyState
                    title="검증된 출력이 아직 없습니다"
                    body="실제 파일이 생성되고 검증까지 끝나면 여기에서 바로 미리볼 수 있습니다."
                  />
                )}
              </StudioPanel>

              <StudioPanel title="실행 큐" description="실시간 작업과 검증 상태를 확인합니다.">
                <div className="space-y-3">
                  {jobs.length === 0 ? (
                    <EmptyState
                      title="큐가 비어 있습니다"
                      body="대기 중인 작업, 완료 및 검증 실패 기록이 여기에 모입니다."
                    />
                  ) : (
                    jobs.slice(0, 6).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => selectJob(job.id)}
                        className={cn(
                          "w-full rounded-3xl border p-4 text-left transition",
                          selectedJob?.id === job.id
                            ? "border-emerald-400/25 bg-emerald-500/10"
                            : "border-white/8 bg-white/[0.04] hover:bg-white/[0.07]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{job.label}</div>
                            <div className="mt-1 text-xs text-zinc-400">{formatShortTime(job.createdAt)}</div>
                          </div>
                          <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-medium", statusTone(job.status))}>
                            {formatStatusLabel(job.status, job)}
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              job.status === "failed" ? "bg-rose-400" : "bg-gradient-to-r from-cyan-400 to-emerald-300",
                            )}
                            style={{ width: `${Math.max(job.progress * 100, 6)}%` }}
                          />
                        </div>
                        <div className="mt-3 text-sm leading-6 text-zinc-300">{job.summary}</div>
                      </button>
                    ))
                  )}
                </div>

                {selectedJob ? (
                  <div className="mt-4 rounded-3xl border border-white/8 bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">선택된 작업</div>
                      <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-medium", statusTone(selectedJob.status))}>
                        {formatStatusLabel(selectedJob.status, selectedJob)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">{selectedJob.details}</p>
                    {selectedJob.next_step ? (
                      <p className="mt-3 text-xs uppercase tracking-[0.24em] text-emerald-200">
                        다음 단계 / {selectedJob.next_step}
                      </p>
                    ) : null}
                    <div className="mt-4 max-h-56 space-y-2 overflow-auto rounded-2xl border border-white/8 bg-[#03050a] p-3">
                      {selectedJob.logs.map((entry, index) => (
                        <div key={`${entry.timestamp}-${index}`} className="text-xs leading-5 text-zinc-300">
                          <span className={entry.level === "error" ? "text-rose-200" : "text-zinc-500"}>
                            {formatShortTime(entry.timestamp)}
                          </span>{" "}
                          {entry.message}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </StudioPanel>
            </aside>
          </div>

          <footer className="border-t border-white/8 bg-black/20 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">
                백엔드 준비 {systemView?.backendReadyCount ?? 0}/{systemView?.backendTotalCount ?? 0}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">
                {systemView?.vramLabel ?? "VRAM 확인 중"}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">
                {systemView?.ramLabel ?? "RAM 확인 중"}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">
                {systemView?.diskLabel ?? "디스크 확인 중"}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">
                경로 경고 {systemView?.pathWarningCount ?? 0}
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export function StudioPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[32px] border border-white/8 bg-white/[0.05] p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[0.68rem] uppercase tracking-[0.28em] text-emerald-200/80">{eyebrow}</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function StudioPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-white/8 bg-white/[0.05] p-5 shadow-[0_32px_80px_rgba(0,0,0,0.25)]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-center">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
    </div>
  );
}

function OutputPreviewCard({
  output,
  textPreview,
}: {
  output: {
    kind: string;
    name: string;
    url: string;
  };
  textPreview: string | null;
}) {
  if (output.kind === "image") {
    return (
      <div className="overflow-hidden rounded-[28px] border border-white/8 bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={output.url} alt={output.name} className="h-auto w-full object-cover" />
      </div>
    );
  }

  if (output.kind === "video") {
    return (
      <div className="overflow-hidden rounded-[28px] border border-white/8 bg-black/30">
        <video controls className="h-auto w-full" src={output.url} />
      </div>
    );
  }

  if (output.kind === "audio") {
    return (
      <div className="rounded-[28px] border border-white/8 bg-black/30 p-4">
        <audio controls className="w-full" src={output.url} />
      </div>
    );
  }

  if (output.kind === "text") {
    return (
      <div className="rounded-[28px] border border-white/8 bg-[#03050a] p-4">
        <pre className="max-h-96 overflow-auto text-xs leading-6 text-zinc-300">{textPreview ?? "텍스트 출력을 불러오는 중..."}</pre>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-white/8 bg-black/30 p-4">
      <a href={output.url} target="_blank" rel="noreferrer" className="text-sm text-emerald-200 underline">
        {output.name} 열기
      </a>
    </div>
  );
}
