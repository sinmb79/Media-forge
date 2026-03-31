"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { FileDropInput } from "@/components/file-drop-input";
import { Field, LibraryGrid, SegmentedOptions, inputClassName, textareaClassName } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/lib/studio-store";

const imageThemes = ["fairy_tale", "editorial", "anime", "luxury", "cyberpunk"];
const promptModels = ["qwen3.5:9b", "qwen3:14b"];
const imageModels = ["sdxl", "flux"];
const aspectOptions = ["9:16", "16:9", "1:1", "3:4"];
const resolutionOptions = ["1k", "2k", "4k"];

export function ImageStudioPage() {
  const { actionPending, runAction } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    runAction: state.runAction,
  })));

  const [desc, setDesc] = useState("A fairy tale princess follows a glowing butterfly into a magical forest lake at sunset.");
  const [theme, setTheme] = useState("fairy_tale");
  const [promptModel, setPromptModel] = useState("qwen3.5:9b");
  const [renderModel, setRenderModel] = useState("sdxl");
  const [aspect, setAspect] = useState("9:16");
  const [resolution, setResolution] = useState("2k");
  const [draftCount, setDraftCount] = useState("2");
  const [sketchPath, setSketchPath] = useState("");

  return (
    <StudioPage
      eyebrow="Kling 스타일 장면 설정"
      title="프롬프트에서 이미지까지, 로컬 스케치 경로와 함께"
      description="한국어 또는 영어 장면 설명으로 로컬 프롬프트를 만들고, 텍스트 투 이미지 또는 스케치 투 이미지로 직접 보냅니다."
      actions={(
        <>
          <Button
            variant="outline"
            className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            disabled={actionPending}
            onClick={() => void runAction("/api/prompt", { desc, theme, model: promptModel })}
          >
            프롬프트 생성
          </Button>
          <Button
            className="bg-emerald-400 text-black hover:bg-emerald-300"
            disabled={actionPending}
            onClick={() => void runAction("/api/generate/image", {
              aspect,
              desc,
              drafts: Number(draftCount),
              renderModel,
              resolution,
              sketchPath,
              theme,
            })}
          >
            이미지 생성
          </Button>
        </>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <StudioPanel title="프롬프트 빌더" description="샷을 설명하면 로컬 프롬프트 계층이 이미지 생성 단계로 넘겨줍니다.">
          <Field label="장면 설명">
            <textarea className={textareaClassName} value={desc} onChange={(event) => setDesc(event.target.value)} />
          </Field>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="테마">
              <select className={inputClassName} value={theme} onChange={(event) => setTheme(event.target.value)}>
                {imageThemes.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="프롬프트 모델">
              <select className={inputClassName} value={promptModel} onChange={(event) => setPromptModel(event.target.value)}>
                {promptModels.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="렌더 모델">
              <select className={inputClassName} value={renderModel} onChange={(event) => setRenderModel(event.target.value)}>
                {imageModels.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="해상도">
              <SegmentedOptions options={resolutionOptions} value={resolution} onChange={setResolution} />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="화면비">
              <SegmentedOptions options={aspectOptions} value={aspect} onChange={setAspect} />
            </Field>
            <Field label="초안 개수">
              <SegmentedOptions options={["1", "2", "3", "4"]} value={draftCount} onChange={setDraftCount} />
            </Field>
          </div>
        </StudioPanel>

        <StudioPanel title="피사체 라이브러리" description="Kling 피사체 선반과 CapCut 템플릿 감각을 참고한 시작 카드 모음입니다.">
          <LibraryGrid category="subject" />
        </StudioPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <StudioPanel title="스케치 및 레퍼런스 입력" description="로컬 스케치나 레퍼런스 이미지를 넣으면 작업공간에 저장한 뒤 실제 경로로 전달합니다.">
          <FileDropInput
            accept={{
              "image/png": [".png"],
              "image/jpeg": [".jpg", ".jpeg"],
              "image/webp": [".webp"],
            }}
            label="스케치 또는 레퍼런스 업로드"
            description="ControlNet 스타일 시작점을 두고 이미지 생성하고 싶을 때 사용하세요."
            onUploaded={(record) => setSketchPath(record.path)}
          />

          <Field label="저장된 스케치 경로">
            <input className={inputClassName} value={sketchPath} onChange={(event) => setSketchPath(event.target.value)} placeholder="C:\\workspace\\...\\sketch.png" />
          </Field>
        </StudioPanel>

        <StudioPanel title="배경과 효과" description="Kling의 테마 라이브러리처럼 재사용 가능한 프롬프트 팩을 조합합니다.">
          <div className="space-y-4">
            <LibraryGrid category="background" />
            <LibraryGrid category="effect" compact />
          </div>
        </StudioPanel>
      </div>
    </StudioPage>
  );
}
