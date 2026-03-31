"use client";

import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Field, SegmentedOptions, textareaClassName } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import type { VisualTemplateCatalogPayload, VisualTemplateRecord } from "@/lib/mediaforge-types";
import { useStudioStore } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

export function VisualStudioPage() {
  const { actionPending, runAction } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    runAction: state.runAction,
  })));
  const [concept, setConcept] = useState("Black hole bloom with floating signal particles and soft chromatic drift.");
  const [preset, setPreset] = useState("effects/aurora-flow");
  const [duration, setDuration] = useState("15");
  const [fps, setFps] = useState("30");
  const [palette, setPalette] = useState("emerald");
  const [catalog, setCatalog] = useState<VisualTemplateCatalogPayload | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetch("/api/visual/templates", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Template request failed: ${response.status}`);
        }

        return response.json() as Promise<VisualTemplateCatalogPayload>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        setCatalog(payload);
        setCatalogError(null);
        if (payload.templates.length > 0 && !payload.templates.some((template) => template.id === preset)) {
          setPreset(payload.templates[0]!.id);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setCatalogError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
    };
  }, []);

  const sections = catalog?.sections ?? [];
  const selectedTemplate = useMemo(
    () => catalog?.templates.find((entry) => entry.id === preset) ?? null,
    [catalog, preset],
  );

  return (
    <StudioPage
      eyebrow="코드 기반 비주얼 랩"
      title="엔진 템플릿 라이브러리에서 로컬 비주얼 모션 클립을 렌더합니다"
      description="이제 실제 MediaForge 비주얼 카탈로그를 읽고 엔진 런타임으로 렌더 작업을 직접 보냅니다."
      actions={(
        <Button
          className="bg-emerald-400 text-black hover:bg-emerald-300"
          disabled={actionPending}
          onClick={() => void runAction("/api/visual/render", {
            concept,
            preset,
            duration: Number(duration),
            fps: Number(fps),
            palette,
          })}
        >
          비주얼 렌더
        </Button>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <StudioPanel title="프리셋 갤러리" description="아래 카드는 엔진 비주얼 템플릿 카탈로그에서 직접 가져옵니다.">
          {catalogError ? (
            <div className="rounded-[28px] border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
              {catalogError}
            </div>
          ) : null}
          <div className="space-y-5">
            {sections.map((section) => (
              <div key={section.id}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">{section.label}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{section.templates.length} presets</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {section.templates.map((entry) => (
                    <TemplateCard
                      key={entry.id}
                      entry={entry}
                      active={preset === entry.id}
                      onSelect={setPreset}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </StudioPanel>

        <StudioPanel title="렌더 설정" description="선택한 템플릿을 로컬 렌더러로 실행하고, 검증된 MP4를 outputs에 기록합니다.">
          <Field label="콘셉트">
            <textarea className={textareaClassName} value={concept} onChange={(event) => setConcept(event.target.value)} />
          </Field>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="길이">
              <SegmentedOptions options={["8", "15", "30"]} value={duration} onChange={setDuration} />
            </Field>
            <Field label="FPS">
              <SegmentedOptions options={["30", "60"]} value={fps} onChange={setFps} />
            </Field>
          </div>
          <Field label="팔레트">
            <SegmentedOptions options={["emerald", "cyan", "rose", "amber"]} value={palette} onChange={setPalette} />
          </Field>
          {selectedTemplate ? (
            <div className="mt-5 rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
              <div className="text-sm font-semibold text-white">{selectedTemplate.label}</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{selectedTemplate.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedTemplate.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </StudioPanel>
      </div>
    </StudioPage>
  );
}

function TemplateCard({
  entry,
  active,
  onSelect,
}: {
  entry: VisualTemplateRecord;
  active: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className={cn(
        "rounded-[28px] border p-4 text-left transition",
        active
          ? "border-emerald-400/25 bg-emerald-500/10"
          : "border-white/8 bg-white/[0.04] hover:bg-white/[0.08]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{entry.label}</div>
        <div className="text-[0.65rem] uppercase tracking-[0.22em] text-zinc-500">{entry.category}</div>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{entry.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {entry.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}
