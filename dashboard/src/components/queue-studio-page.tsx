"use client";

import { Clock3 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { InfoCard } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import { formatShortTime, formatStatusLabel, statusTone } from "@/lib/studio-format";
import { useStudioStore } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

export function QueueStudioPage() {
  const { jobs, runAction } = useStudioStore(useShallow((state) => ({
    jobs: state.jobs,
    runAction: state.runAction,
  })));

  return (
    <StudioPage
      eyebrow="실행 원장"
      title="로컬 런타임이 실제로 무엇을 했는지 확인합니다"
      description="이 페이지의 모든 작업은 차단, 실행 중, 실패, 검증 완료 상태를 분리해서 보여줍니다. 모호함을 없애기 위한 화면입니다."
      actions={(
        <>
          <Button variant="outline" className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => void runAction("/api/actions/doctor")}>
            Doctor
          </Button>
          <Button variant="outline" className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => void runAction("/api/actions/probe")}>
            Probe
          </Button>
        </>
      )}
    >
      <div className="grid gap-4">
        {jobs.length === 0 ? (
          <StudioPanel title="큐가 비어 있습니다">
            <InfoCard icon={Clock3} title="아직 등록된 작업이 없습니다" body="프롬프트, 이미지, 비디오, 편집, 오디오, 비주얼 작업을 실행하면 큐가 채워집니다." />
          </StudioPanel>
        ) : (
          jobs.map((job) => (
            <StudioPanel key={job.id} title={job.label} description={job.details}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-medium", statusTone(job.status))}>
                  {formatStatusLabel(job.status, job)}
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] text-zinc-300">
                  단계: {job.phase === "verification" ? "검증" : "실행"}
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] text-zinc-300">
                  산출물: {job.expected_artifact ? (job.artifact_exists ? "검증됨" : "예상됨") : "불필요"}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className={cn(
                    "h-full rounded-full",
                    job.status === "failed" ? "bg-rose-400" : "bg-gradient-to-r from-cyan-400 to-emerald-300",
                  )}
                  style={{ width: `${Math.max(job.progress * 100, 4)}%` }}
                />
              </div>
              {job.artifact_path ? (
                <p className="mt-4 text-sm text-zinc-300">산출물 경로: {job.artifact_path}</p>
              ) : null}
              {job.next_step ? (
                <p className="mt-2 text-sm text-emerald-200">다음 단계: {job.next_step}</p>
              ) : null}
              <p className="mt-2 text-xs uppercase tracking-[0.22em] text-zinc-500">시작 {formatShortTime(job.createdAt)}</p>
              <div className="mt-4 rounded-[24px] border border-white/8 bg-[#03050a] p-4">
                <div className="max-h-56 space-y-2 overflow-auto text-xs leading-6 text-zinc-300">
                  {job.logs.map((entry, index) => (
                    <div key={`${entry.timestamp}-${index}`}>
                      <span className={entry.level === "error" ? "text-rose-200" : "text-zinc-500"}>
                        {formatShortTime(entry.timestamp)}
                      </span>{" "}
                      {entry.message}
                    </div>
                  ))}
                </div>
              </div>
            </StudioPanel>
          ))
        )}
      </div>
    </StudioPage>
  );
}
