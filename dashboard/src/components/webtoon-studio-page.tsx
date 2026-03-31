"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Field, inputClassName, SegmentedOptions } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/lib/studio-store";

interface WebtoonResult {
  pageCount: number;
  outputDir: string;
}

const styleOptions = ["anime", "realistic", "ghibli", "cyberpunk"];
const modeOptions = ["panel", "page"];

export function WebtoonStudioPage() {
  const { actionPending, runAction } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    runAction: state.runAction,
  })));

  const [scenarioPath, setScenarioPath] = useState("");
  const [mode, setMode] = useState("panel");
  const [panelsPerPage, setPanelsPerPage] = useState("4");
  const [style, setStyle] = useState("anime");
  const [result, setResult] = useState<WebtoonResult | null>(null);

  const handleGenerate = async () => {
    if (!scenarioPath.trim()) return;
    const response = await runAction("/api/webtoon/generate", {
      scenarioPath: scenarioPath.trim(),
      mode,
      panelsPerPage: Number(panelsPerPage),
      style,
    });
    if (response && "result" in response) {
      setResult(response.result as WebtoonResult);
    }
  };

  return (
    <StudioPage
      eyebrow="웹툰 스튜디오"
      title="웹툰 생성"
      description="시나리오를 패널별 또는 페이지별 웹툰 이미지로 생성합니다."
      actions={(
        <Button
          className="bg-emerald-400 text-black hover:bg-emerald-300"
          disabled={actionPending || !scenarioPath.trim()}
          onClick={() => void handleGenerate()}
        >
          웹툰 생성
        </Button>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <StudioPanel title="생성 설정" description="시나리오 경로, 모드, 스타일을 설정합니다.">
          <Field label="시나리오 경로">
            <input
              className={inputClassName}
              value={scenarioPath}
              onChange={(event) => setScenarioPath(event.target.value)}
              placeholder="C:\workspace\...\scenario.json"
            />
          </Field>

          <Field label="모드">
            <SegmentedOptions options={modeOptions} value={mode} onChange={setMode} />
          </Field>

          <Field label="페이지당 패널 수">
            <input
              type="number"
              className={inputClassName}
              value={panelsPerPage}
              onChange={(event) => setPanelsPerPage(event.target.value)}
              min={1}
              max={12}
            />
          </Field>

          <Field label="스타일">
            <SegmentedOptions options={styleOptions} value={style} onChange={setStyle} />
          </Field>
        </StudioPanel>

        <StudioPanel title="생성 결과" description="웹툰 생성 결과를 확인합니다.">
          {!result ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-center">
              <div className="text-sm font-semibold text-white">아직 생성 결과가 없습니다</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                웹툰을 생성하면 페이지 수와 출력 경로가 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-[28px] border border-white/8 bg-white/[0.05] p-4">
                <div className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">페이지 수</div>
                <div className="mt-3 text-lg font-semibold text-white">{result.pageCount}p</div>
              </div>
              <div className="rounded-[28px] border border-white/8 bg-white/[0.05] p-4">
                <div className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">출력 디렉토리</div>
                <div className="mt-3 text-sm font-semibold text-white break-all">{result.outputDir}</div>
              </div>
            </div>
          )}
        </StudioPanel>
      </div>
    </StudioPage>
  );
}
