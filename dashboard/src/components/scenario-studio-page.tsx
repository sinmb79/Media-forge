"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Field, inputClassName } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

interface ScenarioResult {
  characters: { name: string; role: string }[];
  plannedOutputs: { format: string; status: string }[];
}

const outputFormats = [
  { id: "webtoon", label: "웹툰" },
  { id: "shortform", label: "숏폼" },
  { id: "longform", label: "롱폼" },
];

export function ScenarioStudioPage() {
  const { actionPending, runAction } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    runAction: state.runAction,
  })));

  const [scenarioPath, setScenarioPath] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["webtoon"]);
  const [simulate, setSimulate] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const toggleFormat = (formatId: string) => {
    setSelectedFormats((prev) =>
      prev.includes(formatId) ? prev.filter((f) => f !== formatId) : [...prev, formatId],
    );
  };

  const handleIngest = async () => {
    if (!scenarioPath.trim()) return;
    const response = await runAction("/api/scenario/ingest", {
      scenarioPath: scenarioPath.trim(),
      formats: selectedFormats,
      simulate,
    });
    if (response && "result" in response) {
      setResult(response.result as ScenarioResult);
    }
  };

  return (
    <StudioPage
      eyebrow="시나리오 파이프라인"
      title="시나리오 수집"
      description="블로그에서 생성된 시나리오를 웹툰, 숏폼, 롱폼으로 자동 변환합니다."
      actions={(
        <Button
          className="bg-emerald-400 text-black hover:bg-emerald-300"
          disabled={actionPending || !scenarioPath.trim()}
          onClick={() => void handleIngest()}
        >
          시나리오 수집
        </Button>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <StudioPanel title="수집 설정" description="시나리오 JSON 파일 경로와 출력 형식을 설정합니다.">
          <Field label="시나리오 파일 경로">
            <input
              className={inputClassName}
              value={scenarioPath}
              onChange={(event) => setScenarioPath(event.target.value)}
              placeholder="C:\workspace\...\scenario.json"
            />
          </Field>

          <Field label="출력 형식">
            <div className="mt-2 flex flex-wrap gap-2">
              {outputFormats.map((format) => (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => toggleFormat(format.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    selectedFormats.includes(format.id)
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]",
                  )}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="시뮬레이션">
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setSimulate(!simulate)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm transition",
                  simulate
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]",
                )}
              >
                {simulate ? "시뮬레이션 켜짐" : "시뮬레이션 꺼짐"}
              </button>
            </div>
          </Field>
        </StudioPanel>

        <StudioPanel title="수집 결과" description="시나리오에서 추출된 캐릭터와 변환 계획입니다.">
          {!result ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-center">
              <div className="text-sm font-semibold text-white">아직 수집 결과가 없습니다</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                시나리오를 수집하면 캐릭터 목록과 변환 계획이 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {result.characters.length > 0 ? (
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">캐릭터</div>
                  <div className="mt-2 space-y-2">
                    {result.characters.map((char) => (
                      <div
                        key={char.name}
                        className="rounded-[28px] border border-white/8 bg-white/[0.04] p-3"
                      >
                        <div className="text-sm font-semibold text-white">{char.name}</div>
                        <div className="mt-1 text-xs text-zinc-400">{char.role}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {result.plannedOutputs.length > 0 ? (
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">변환 계획</div>
                  <div className="mt-2 space-y-2">
                    {result.plannedOutputs.map((output) => (
                      <div
                        key={output.format}
                        className="flex items-center justify-between rounded-[28px] border border-white/8 bg-white/[0.04] p-3"
                      >
                        <div className="text-sm font-semibold text-white">{output.format}</div>
                        <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-100">
                          {output.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </StudioPanel>
      </div>
    </StudioPage>
  );
}
