"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { FileDropInput } from "@/components/file-drop-input";
import { Field, SegmentedOptions, inputClassName } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

const editTools = [
  { id: "join", title: "장면 연결", subtitle: "정렬된 클립 폴더를 AI 또는 페이드 전환으로 이어 붙입니다." },
  { id: "concat", title: "이어붙이기", subtitle: "여러 클립을 하나의 검증된 출력으로 합칩니다." },
  { id: "cut", title: "자르기", subtitle: "FFmpeg로 정확한 구간만 추출합니다." },
  { id: "speed", title: "속도 조절", subtitle: "호흡이나 극적 강조를 위해 속도를 조정합니다." },
  { id: "resize", title: "리사이즈", subtitle: "화면비와 출력 해상도를 바꿉니다." },
  { id: "stabilize", title: "안정화", subtitle: "vidstab으로 흔들리는 영상을 부드럽게 보정합니다." },
  { id: "upscale", title: "업스케일", subtitle: "로컬 업스케일 워크플로우로 영상을 보냅니다." },
  { id: "interpolate", title: "보간", subtitle: "더 높은 재생 FPS를 목표로 프레임을 보간합니다." },
  { id: "remove-watermark", title: "워터마크 제거", subtitle: "이미지 또는 비디오 정리 경로를 선택합니다." },
  { id: "remove-object", title: "객체 제거", subtitle: "ProPainter로 마스크 기반 보정을 실행합니다." },
  { id: "smart-cut", title: "스마트 컷", subtitle: "긴 클립에서 더 촘촘한 하이라이트 편집본을 자동 생성합니다." },
] as const;

export function EditStudioPage() {
  const { actionPending, runAction } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    runAction: state.runAction,
  })));
  const [tool, setTool] = useState<string>("cut");
  const [inputPath, setInputPath] = useState("");
  const [extraInputs, setExtraInputs] = useState("");
  const [start, setStart] = useState("00:00");
  const [end, setEnd] = useState("00:05");
  const [factor, setFactor] = useState("0.5");
  const [ratio, setRatio] = useState("9:16");
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState("60");
  const [mask, setMask] = useState("");
  const [scale, setScale] = useState("2");
  const [targetDuration, setTargetDuration] = useState("30");
  const [transition, setTransition] = useState("ai");

  const activeTool = editTools.find((entry) => entry.id === tool) ?? editTools[0];

  return (
    <StudioPage
      eyebrow="CapCut 스타일 도구 선반"
      title="편집 또는 보정 도구를 고르고 실제 로컬 입력으로 실행합니다"
      description="익숙한 카드형 도구 선반 구조를 유지하면서도, 실제 성공을 좌우하는 백엔드와 입력 조건을 그대로 보여줍니다."
      actions={(
        <Button
          className="bg-emerald-400 text-black hover:bg-emerald-300"
          disabled={actionPending || inputPath.length === 0}
          onClick={() => void runAction(`/api/edit/${tool}`, {
            input: inputPath,
            extraInputs: extraInputs.split(",").map((entry) => entry.trim()).filter(Boolean),
            start,
            end,
            factor,
            ratio,
            resolution,
            fps,
            mask,
            scale,
            targetDuration,
            transition,
          })}
        >
          {activeTool.title} 실행
        </Button>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <StudioPanel title="도구 선반" description="정리 또는 타이밍 도구를 선택하면 필요한 입력 항목이 함께 바뀝니다.">
          <div className="grid gap-3 md:grid-cols-2">
            {editTools.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTool(entry.id)}
                className={cn(
                  "rounded-[28px] border p-4 text-left transition",
                  tool === entry.id
                    ? "border-emerald-400/25 bg-emerald-500/10"
                    : "border-white/8 bg-white/[0.04] hover:bg-white/[0.08]",
                )}
              >
                <div className="text-sm font-semibold text-white">{entry.title}</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{entry.subtitle}</p>
              </button>
            ))}
          </div>
        </StudioPanel>

        <StudioPanel title="실행 폼" description={activeTool.subtitle}>
          <FileDropInput
            label="원본 클립 또는 파일 업로드"
            description="업로드한 파일 경로가 폼에 다시 채워져 큐가 실제 로컬 입력을 사용할 수 있게 합니다."
            onUploaded={(record) => setInputPath(record.path)}
          />

          <Field label="입력 경로">
            <input className={inputClassName} value={inputPath} onChange={(event) => setInputPath(event.target.value)} />
          </Field>

          {tool === "concat" ? (
            <Field label="추가 입력 경로 (쉼표 구분)">
              <input className={inputClassName} value={extraInputs} onChange={(event) => setExtraInputs(event.target.value)} placeholder="clip2.mp4, clip3.mp4" />
            </Field>
          ) : null}

          {tool === "join" ? (
            <Field label="전환">
              <SegmentedOptions options={["ai", "fade"]} value={transition} onChange={setTransition} />
            </Field>
          ) : null}

          {tool === "cut" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="시작">
                <input className={inputClassName} value={start} onChange={(event) => setStart(event.target.value)} />
              </Field>
              <Field label="끝">
                <input className={inputClassName} value={end} onChange={(event) => setEnd(event.target.value)} />
              </Field>
            </div>
          ) : null}

          {tool === "speed" ? (
            <Field label="배속">
              <input className={inputClassName} value={factor} onChange={(event) => setFactor(event.target.value)} />
            </Field>
          ) : null}

          {tool === "resize" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="화면비">
                <SegmentedOptions options={["9:16", "16:9", "1:1"]} value={ratio} onChange={setRatio} />
              </Field>
              <Field label="해상도">
                <SegmentedOptions options={["720p", "1080p", "1440p"]} value={resolution} onChange={setResolution} />
              </Field>
            </div>
          ) : null}

          {tool === "interpolate" ? (
            <Field label="FPS">
              <SegmentedOptions options={["30", "60", "120"]} value={fps} onChange={setFps} />
            </Field>
          ) : null}

          {tool === "upscale" ? (
            <Field label="배율">
              <SegmentedOptions options={["2", "3", "4"]} value={scale} onChange={setScale} />
            </Field>
          ) : null}

          {tool === "remove-object" ? (
            <>
              <FileDropInput
                label="마스크 이미지 업로드"
                description="객체 제거 실행에는 마스크가 필요합니다."
                onUploaded={(record) => setMask(record.path)}
              />
              <Field label="마스크 경로">
                <input className={inputClassName} value={mask} onChange={(event) => setMask(event.target.value)} />
              </Field>
            </>
          ) : null}

          {tool === "smart-cut" ? (
            <Field label="목표 길이 (초)">
              <SegmentedOptions options={["10", "20", "30", "60"]} value={targetDuration} onChange={setTargetDuration} />
            </Field>
          ) : null}
        </StudioPanel>
      </div>
    </StudioPage>
  );
}
