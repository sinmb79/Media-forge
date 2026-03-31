"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Field, LibraryGrid, SegmentedOptions, inputClassName, textareaClassName } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/lib/studio-store";

export function StoryboardStudioPage() {
  const { actionPending, runAction, uploadFile } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    runAction: state.runAction,
    uploadFile: state.uploadFile,
  })));
  const [storyTitle, setStoryTitle] = useState("Butterfly lake reveal");
  const [scenes, setScenes] = useState([
    { id: "scene-1", desc: "The princess runs through a dark forest path.", imagePath: "", duration: "5" },
    { id: "scene-2", desc: "A glowing butterfly crosses the frame and the camera follows.", imagePath: "", duration: "5" },
    { id: "scene-3", desc: "The magical lake is revealed with soft mist and reflections.", imagePath: "", duration: "6" },
  ]);

  async function runStoryboardPipeline() {
    const storyboard = {
      title: storyTitle,
      scenes: scenes.map((scene) => ({
        image: scene.imagePath,
        desc: scene.desc,
        duration: Number(scene.duration),
      })),
      transition: "ai",
      output: {
        resolution: "1080p",
        format: "mp4",
      },
    };

    const file = new File([JSON.stringify(storyboard, null, 2)], `${storyTitle.replace(/\s+/g, "-").toLowerCase() || "storyboard"}.json`, {
      type: "application/json",
    });
    const uploaded = await uploadFile(file);
    await runAction("/api/pipeline/storyboard", {
      primaryInput: uploaded.path,
    });
  }

  return (
    <StudioPage
      eyebrow="멀티씬 구성"
      title="GPU 시간을 쓰기 전에 전체 흐름을 스토리보드로 정리합니다"
      description="Kling 커스텀 스토리보드의 장점처럼, 실제 생성에 들어가기 전에 장면별 제어를 먼저 잡는 화면입니다."
      actions={(
        <Button className="bg-emerald-400 text-black hover:bg-emerald-300" disabled={actionPending} onClick={() => void runStoryboardPipeline()}>
          스토리보드 파이프라인 큐잉
        </Button>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <StudioPanel title="장면 시퀀스" description="장면 설명을 추가하고 필요하면 프레임을 연결한 뒤, 파이프라인 실행용 스토리보드를 로컬 작업공간에 저장합니다.">
          <Field label="스토리보드 제목">
            <input className={inputClassName} value={storyTitle} onChange={(event) => setStoryTitle(event.target.value)} />
          </Field>

          <div className="mt-4 space-y-4">
            {scenes.map((scene, index) => (
              <div key={scene.id} className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">장면 {index + 1}</div>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    onClick={() => setScenes((current) => current.filter((entry) => entry.id !== scene.id))}
                  >
                    제거
                  </Button>
                </div>
                <Field label="설명">
                  <textarea
                    className={textareaClassName}
                    value={scene.desc}
                    onChange={(event) => setScenes((current) => current.map((entry) => entry.id === scene.id ? { ...entry, desc: event.target.value } : entry))}
                  />
                </Field>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="길이 (초)">
                    <SegmentedOptions
                      options={["3", "5", "6", "8"]}
                      value={scene.duration}
                      onChange={(value) => setScenes((current) => current.map((entry) => entry.id === scene.id ? { ...entry, duration: value } : entry))}
                    />
                  </Field>
                  <Field label="이미지 경로 (선택)">
                    <input
                      className={inputClassName}
                      value={scene.imagePath}
                      onChange={(event) => setScenes((current) => current.map((entry) => entry.id === scene.id ? { ...entry, imagePath: event.target.value } : entry))}
                      placeholder="C:\\workspace\\...\\scene.png"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Button
              variant="outline"
              className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              onClick={() => setScenes((current) => [
                ...current,
                {
                  id: createSceneId(),
                  desc: "",
                  imagePath: "",
                  duration: "5",
                },
              ])}
            >
              장면 추가
            </Button>
          </div>
        </StudioPanel>

        <StudioPanel title="템플릿 시작점" description="실행 전에 로컬 템플릿으로 시퀀스 구조를 잡아보세요.">
          <LibraryGrid category="template" />
        </StudioPanel>
      </div>
    </StudioPage>
  );
}

function createSceneId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `scene-${Date.now()}`;
}
