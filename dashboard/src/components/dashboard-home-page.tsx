"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { creationSurfaces, quickActions } from "@/lib/studio-config";
import { cn } from "@/lib/utils";

export function DashboardHomePage() {
  return (
    <StudioPage
      eyebrow="스튜디오 시작 화면"
      title="추측 없이 로컬 제작을 시작하세요"
      description="Kling과 CapCut에서 가져온 진입 경험을 로컬 환경에 맞춘 화면입니다. 핵심 실행 카드와 빠른 작업을 먼저 보여주고 각 전용 페이지로 자연스럽게 이어집니다."
      actions={(
        <>
          <Link
            href="/image"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-400 px-4 text-sm font-medium text-black transition hover:bg-emerald-300"
          >
            이미지 스튜디오 열기
          </Link>
          <Link
            href="/queue"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white transition hover:bg-white/[0.08]"
          >
            큐 열기
          </Link>
        </>
      )}
    >
      <StudioPanel title="하이브리드 런치 데크" description="먼저 맞는 작업 경로를 고르고, 큐와 미리보기 영역에서 실제 실행 결과를 확인하세요.">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(81,255,180,0.28),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(77,138,255,0.18),transparent_30%),linear-gradient(145deg,rgba(10,14,28,0.98),rgba(5,7,14,0.95))] p-6">
          <div className="max-w-3xl">
            <div className="text-[0.68rem] uppercase tracking-[0.28em] text-emerald-200/80">올인원 로컬 플로우</div>
            <h3 className="mt-3 text-3xl font-semibold leading-tight text-white">
              프롬프트, 프레임, 모션, 보정, 마감까지 하나의 워크스테이션 중심 스튜디오에 담았습니다.
            </h3>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              이 시작 화면은 의도적으로 가볍게 유지했습니다. 실제 런타임 상태는 셸, 큐, 각 전용 도구 페이지에서 보여주어 대시보드가 빠르고 믿을 수 있게 동작합니다.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-zinc-100 transition hover:bg-white/[0.1]"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </StudioPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        {creationSurfaces.map((surface) => (
          <Link
            key={surface.id}
            href={surface.href}
            className={cn(
              "group rounded-[32px] border border-white/8 bg-gradient-to-br p-5 transition hover:-translate-y-0.5 hover:border-white/14",
              surface.accent,
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">{surface.title}</div>
              <ArrowRight className="h-4 w-4 text-zinc-300 transition group-hover:text-white" />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{surface.description}</p>
          </Link>
        ))}
      </div>
    </StudioPage>
  );
}
