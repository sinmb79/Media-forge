"use client";

import { useMemo, useState } from "react";
import { FileCode2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { InfoCard } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { filterLibraryCards, studioLibraryCatalog } from "@/lib/library-catalog";
import { useStudioStore } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

export function AssetsStudioPage() {
  const { assets } = useStudioStore(useShallow((state) => ({
    assets: state.assets,
  })));
  const [category, setCategory] = useState<string>("all");
  const filteredCatalog = useMemo(() => {
    if (category === "all") {
      return studioLibraryCatalog;
    }

    return filterLibraryCards(category as never);
  }, [category]);

  return (
    <StudioPage
      eyebrow="재사용 가능한 로컬 재료"
      title="큐레이션 라이브러리와 런타임 에셋"
      description="Kling 스타일 프롬프트 시작점, 모션 라이브러리, 실제 로컬 워크플로우를 한곳에 모아 도구 모음이 아닌 진짜 스튜디오처럼 느껴지게 합니다."
    >
      <StudioPanel title="큐레이션 라이브러리" description="피사체, 배경, 모션, 템플릿, 캐릭터, 도구 계열 프리셋 카드를 모아둡니다.">
        <div className="flex flex-wrap gap-2">
          {["all", "subject", "background", "effect", "motion", "template", "character", "tool"].map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setCategory(entry)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition",
                category === entry
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]",
              )}
            >
              {entry}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredCatalog.map((card) => (
            <div key={card.id} className={cn("rounded-[28px] border border-white/8 bg-gradient-to-br p-4", card.accent)}>
              <div className="text-xs uppercase tracking-[0.24em] text-zinc-300">{card.category}</div>
              <div className="mt-3 text-base font-semibold text-white">{card.title}</div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{card.subtitle}</p>
            </div>
          ))}
        </div>
      </StudioPanel>

      <StudioPanel title="런타임 에셋" description="워크플로우, 설정, 최근 출력물에서 발견한 파일을 보여줍니다.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {assets.length === 0 ? (
            <InfoCard icon={FileCode2} title="런타임 에셋이 아직 없습니다" body="대시보드가 로컬 워크플로우와 출력물을 인덱싱하면 여기에 표시됩니다." />
          ) : (
            assets.map((asset) => (
              <div key={asset.id} className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">{asset.category}</div>
                <div className="mt-3 text-sm font-semibold text-white">{asset.name}</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{asset.description}</p>
                <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-zinc-600">{asset.kind}</p>
                <p className="mt-4 text-xs text-zinc-500">{asset.path}</p>
              </div>
            ))
          )}
        </div>
      </StudioPanel>
    </StudioPage>
  );
}
