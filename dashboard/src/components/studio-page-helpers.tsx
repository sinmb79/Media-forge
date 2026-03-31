"use client";

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

import { filterLibraryCards } from "@/lib/library-catalog";
import { cn } from "@/lib/utils";

export const inputClassName = "mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-emerald-300/40 focus:bg-white/[0.06]";
export const textareaClassName = `${inputClassName} min-h-[144px] resize-none leading-6`;

const segmentedOptionLabels: Record<string, string> = {
  "add-bgm": "BGM 추가",
  "add-subs": "자막 추가",
  ai: "AI 전환",
  all: "전체",
  asr: "ASR",
  background: "배경",
  character: "캐릭터",
  concat: "이어붙이기",
  cut: "자르기",
  draft: "초안",
  drama: "드라마",
  edit: "편집",
  effect: "효과",
  extend: "확장",
  fade: "페이드",
  image: "이미지",
  interpolate: "보간",
  join: "장면 연결",
  motion: "모션",
  narrate: "나레이션",
  production: "프로덕션",
  queue: "큐",
  ref2v: "레퍼런스 기반",
  "remove-object": "객체 제거",
  "remove-watermark": "워터마크 제거",
  resize: "리사이즈",
  separate: "오디오 분리",
  speed: "속도 조절",
  stabilize: "안정화",
  storyboard: "스토리보드",
  subject: "주제",
  talking: "립싱크",
  template: "템플릿",
  text: "텍스트",
  tool: "도구",
  transcribe: "전사",
  tts: "TTS",
  upscale: "업스케일",
  video: "비디오",
  "voice-change": "보이스 변경",
  visual: "비주얼",
};

function getSegmentedOptionLabel(option: string): string {
  return segmentedOptionLabels[option] ?? option;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mt-4 block">
      <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      {children}
    </label>
  );
}

export function SegmentedOptions({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition",
            option === value
              ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
              : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]",
          )}
        >
          {getSegmentedOptionLabel(option)}
        </button>
      ))}
    </div>
  );
}

function getLibraryCategoryLabel(category: string): string {
  return segmentedOptionLabels[category] ?? category;
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.05] p-4">
      <div className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">{label}</div>
      <div className="mt-3 text-lg font-semibold text-white">{value}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
    </div>
  );
}

export function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CheckCircle2;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <Icon className="h-5 w-5 text-emerald-200" />
        </div>
        <div className="text-base font-semibold text-white">{title}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-400">{body}</p>
    </div>
  );
}

export function LibraryGrid({
  category,
  compact = false,
}: {
  category: Parameters<typeof filterLibraryCards>[0];
  compact?: boolean;
}) {
  const cards = filterLibraryCards(category);

  return (
    <div className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {cards.map((card) => (
        <div key={card.id} className={cn("rounded-[28px] border border-white/8 bg-gradient-to-br p-4", card.accent)}>
          <div className="text-xs uppercase tracking-[0.24em] text-zinc-300">{getLibraryCategoryLabel(card.category)}</div>
          <div className="mt-3 text-sm font-semibold text-white">{card.title}</div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
