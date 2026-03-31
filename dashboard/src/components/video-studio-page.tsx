"use client";

import { useEffect, useMemo, useState } from "react";
import { Compass, Gauge, HardDriveDownload, ListVideo, WandSparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { FileDropInput } from "@/components/file-drop-input";
import {
  Field,
  InfoCard,
  LibraryGrid,
  SegmentedOptions,
  inputClassName,
  textareaClassName,
} from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import type { DashboardCollectionResponse, DashboardVoicePresetRecord } from "@/lib/mediaforge-types";
import { useStudioStore } from "@/lib/studio-store";

const videoQualities = ["draft", "production"];
const generationModes = ["seed", "image", "text", "ref2v", "talking", "extend"] as const;
const autoPickModes = ["first", "best", "random", "manual"];

interface SeedSessionManifest {
  candidates: Array<{
    id: string;
    file: string;
    selected: boolean;
    status: string;
    thumbnail?: string;
  }>;
  createdAt: string;
  duration: number;
  extensions: Array<{
    id: string;
    parent: string;
    totalDuration: number;
  }>;
  model: string;
  prompt: string;
  sessionId: string;
}

export function VideoStudioPage() {
  const { actionPending, runAction } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    runAction: state.runAction,
  })));

  const [mode, setMode] = useState<(typeof generationModes)[number]>("image");
  const [desc, setDesc] = useState("갈색 바위 괴물 너긴이 자기 머리를 두드리며 눈이 빙글빙글 돈다.");
  const [imagePath, setImagePath] = useState("");
  const [referencePaths, setReferencePaths] = useState("");
  const [portraitPath, setPortraitPath] = useState("");
  const [audioPath, setAudioPath] = useState("");
  const [talkingText, setTalkingText] = useState("우린 지금 바로 움직여야 해. 더 가까이 붙어.");
  const [voicePreset, setVoicePreset] = useState("");
  const [voiceDir, setVoiceDir] = useState("");
  const [talkingVoice, setTalkingVoice] = useState("");
  const [talkingLang, setTalkingLang] = useState("ko");
  const [sourceVideoPath, setSourceVideoPath] = useState("");
  const [model, setModel] = useState("wan22");
  const [quality, setQuality] = useState("production");
  const [aspect, setAspect] = useState("9:16");
  const [duration, setDuration] = useState("5");
  const [overlapFrames, setOverlapFrames] = useState("8");
  const [voicePresets, setVoicePresets] = useState<DashboardVoicePresetRecord[]>([]);

  const [seedOutputDir, setSeedOutputDir] = useState("workspace/seeds/ep23-noggin");
  const [seedCandidates, setSeedCandidates] = useState("4");
  const [autoPick, setAutoPick] = useState<"first" | "best" | "random" | "manual">("first");
  const [autoExtendLoops, setAutoExtendLoops] = useState("2");
  const [withAudio, setWithAudio] = useState(false);

  const [sessionDir, setSessionDir] = useState("");
  const [sessionManifest, setSessionManifest] = useState<SeedSessionManifest | null>(null);
  const [sessionSelectedIds, setSessionSelectedIds] = useState<string[]>([]);
  const [sessionSourceId, setSessionSourceId] = useState("");
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const availableModels = useMemo(() => {
    switch (mode) {
      case "seed":
        return ["wan22", "ltx2", "skyreels-ref2v"];
      case "text":
        return ["wan22"];
      case "ref2v":
        return ["skyreels-ref2v"];
      case "talking":
        return ["skyreels-a2v"];
      case "extend":
        return ["skyreels-v2v"];
      default:
        return ["wan22", "ltx2"];
    }
  }, [mode]);

  const selectedModel = availableModels.includes(model) ? model : (availableModels[0] ?? "wan22");
  const selectedChainRoot = sessionSourceId || sessionSelectedIds[0] || sessionManifest?.candidates[0]?.id || "";
  const generationDisabled = actionPending
    || (mode === "seed" && seedOutputDir.trim().length === 0)
    || (mode === "seed" && desc.trim().length === 0 && imagePath.trim().length === 0)
    || (mode === "image" && imagePath.trim().length === 0)
    || (mode === "ref2v" && referencePaths.trim().length === 0)
    || (mode === "talking" && (portraitPath.trim().length === 0 || (audioPath.trim().length === 0 && talkingText.trim().length === 0)))
    || (mode === "extend" && sourceVideoPath.trim().length === 0);

  useEffect(() => {
    void fetch("/api/audio/presets", { cache: "no-store" })
      .then(async (response) => response.json() as Promise<DashboardCollectionResponse<DashboardVoicePresetRecord>>)
      .then((payload) => setVoicePresets(payload.items ?? []))
      .catch(() => setVoicePresets([]));
  }, []);

  async function browseSession() {
    if (!sessionDir.trim()) {
      setSessionMessage("세션 경로를 먼저 입력해 주세요.");
      return;
    }

    const response = await fetch("/api/video/browse", {
      body: JSON.stringify({ sessionDir }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json() as { manifest?: SeedSessionManifest; session_dir?: string };

    if (!response.ok || !payload.manifest) {
      setSessionMessage("세션 정보를 불러오지 못했습니다.");
      return;
    }

    setSessionManifest(payload.manifest);
    setSessionDir(payload.session_dir ?? sessionDir);
    const selected = payload.manifest.candidates
      .filter((candidate) => candidate.selected)
      .map((candidate) => candidate.id);
    setSessionSelectedIds(selected);
    setSessionSourceId(selected[0] ?? payload.manifest.candidates[0]?.id ?? "");
    setSessionMessage(`세션 ${payload.manifest.sessionId} 을(를) 불러왔습니다.`);
  }

  async function saveSelection() {
    if (!sessionDir.trim() || sessionSelectedIds.length === 0) {
      setSessionMessage("세션 경로와 선택된 시드가 필요합니다.");
      return;
    }

    const response = await fetch("/api/video/pick", {
      body: JSON.stringify({ selected: sessionSelectedIds, sessionDir }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      setSessionMessage("시드 선택을 저장하지 못했습니다.");
      return;
    }

    setSessionMessage(`선택 저장 완료: ${sessionSelectedIds.join(", ")}`);
    await browseSession();
  }

  function runPrimaryVideoAction() {
    if (mode === "seed") {
      void runAction("/api/video/seed", {
        candidates: Number(seedCandidates),
        desc,
        duration: Number(duration),
        fromImagePath: imagePath || null,
        model: selectedModel,
        outputDir: seedOutputDir,
        quality,
        referencePaths: splitPathList(referencePaths),
      });
      setSessionDir(seedOutputDir);
      return;
    }

    void runAction("/api/generate/video", {
      mode,
      desc,
      audioPath,
      imagePath,
      lang: talkingLang,
      model: selectedModel,
      overlapFrames: Number(overlapFrames),
      quality,
      aspect,
      duration: Number(duration),
      portraitPath,
      referencePaths: splitPathList(referencePaths),
      sourceVideoPath,
      text: talkingText,
      voice: talkingVoice,
      voiceDir,
      voicePreset,
    });
  }

  function runAutoExtend() {
    void runAction("/api/video/auto-extend", {
      autoPick,
      candidates: Number(seedCandidates),
      desc,
      extendDuration: Number(duration),
      extendLoops: Number(autoExtendLoops),
      fromImagePath: imagePath || null,
      model: selectedModel,
      outputDir: seedOutputDir,
      outputPath: `${seedOutputDir}/auto-final.mp4`,
      quality,
      referencePaths: splitPathList(referencePaths),
      seedDuration: Number(duration),
      withAudio,
    });
    setSessionDir(seedOutputDir);
  }

  return (
    <StudioPage
      eyebrow="로컬 비디오 엔진"
      title="비디오 스튜디오"
      description="일반 비디오 생성과 SkyReels 기반 시드 세션, 선택, 확장, 조립 흐름을 한 화면에서 다룹니다."
      actions={(
        <div className="flex flex-wrap gap-2">
          {mode === "seed" ? (
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={generationDisabled}
              onClick={runAutoExtend}
            >
              자동 확장 실행
            </Button>
          ) : null}
          <Button
            className="bg-emerald-400 text-black hover:bg-emerald-300"
            disabled={generationDisabled}
            onClick={runPrimaryVideoAction}
          >
            {mode === "seed" ? "시드 세션 생성" : "비디오 생성"}
          </Button>
        </div>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <StudioPanel title="생성 제어" description="모드에 따라 입력 자산과 모델을 바꾸고, 로컬 백엔드로 직접 실행합니다.">
          <Field label="생성 모드">
            <SegmentedOptions
              options={[...generationModes]}
              value={mode}
              onChange={(value) => setMode(value as (typeof generationModes)[number])}
            />
          </Field>

          <Field label="장면 설명">
            <textarea className={textareaClassName} value={desc} onChange={(event) => setDesc(event.target.value)} />
          </Field>

          {(mode === "image" || mode === "seed") ? (
            <>
              <FileDropInput
                accept={{
                  "image/jpeg": [".jpg", ".jpeg"],
                  "image/png": [".png"],
                  "image/webp": [".webp"],
                }}
                description={mode === "seed"
                  ? "선택 사항입니다. 시작 이미지를 주면 시드 세션에 함께 기록합니다."
                  : "이미지에서 비디오를 만들 때 사용할 시작 프레임입니다."}
                label={mode === "seed" ? "시작 이미지 업로드" : "기준 이미지 업로드"}
                onUploaded={(record) => setImagePath(record.path)}
              />
              <Field label={mode === "seed" ? "시작 이미지 경로" : "이미지 경로"}>
                <input className={inputClassName} value={imagePath} onChange={(event) => setImagePath(event.target.value)} placeholder="C:\\workspace\\frame.png" />
              </Field>
            </>
          ) : null}

          {(mode === "seed" || mode === "ref2v") ? (
            <Field label="레퍼런스 이미지 경로">
              <textarea
                className={textareaClassName}
                value={referencePaths}
                onChange={(event) => setReferencePaths(event.target.value)}
                placeholder={"C:\\workspace\\hero-front.png,\nC:\\workspace\\hero-side.png"}
              />
            </Field>
          ) : null}

          {mode === "seed" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="세션 폴더">
                  <input className={inputClassName} value={seedOutputDir} onChange={(event) => setSeedOutputDir(event.target.value)} placeholder="workspace/seeds/ep23-noggin" />
                </Field>
                <Field label="후보 개수">
                  <SegmentedOptions options={["2", "4", "6", "8"]} value={seedCandidates} onChange={setSeedCandidates} />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="자동 선택">
                  <SegmentedOptions options={autoPickModes} value={autoPick} onChange={(value) => setAutoPick(value as typeof autoPick)} />
                </Field>
                <Field label="확장 횟수">
                  <SegmentedOptions options={["0", "1", "2", "3"]} value={autoExtendLoops} onChange={setAutoExtendLoops} />
                </Field>
                <Field label="오디오 포함">
                  <SegmentedOptions options={["all", "queue"]} value={withAudio ? "all" : "queue"} onChange={(value) => setWithAudio(value === "all")} />
                </Field>
              </div>
            </>
          ) : null}

          {mode === "talking" ? (
            <>
              <Field label="초상화 이미지 경로">
                <input className={inputClassName} value={portraitPath} onChange={(event) => setPortraitPath(event.target.value)} placeholder="C:\\workspace\\portrait.png" />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="대사 오디오 경로">
                  <input className={inputClassName} value={audioPath} onChange={(event) => setAudioPath(event.target.value)} placeholder="없으면 아래 텍스트를 사용합니다." />
                </Field>
                <Field label="음성 프리셋">
                  <input className={inputClassName} value={voicePreset} onChange={(event) => setVoicePreset(event.target.value)} placeholder="Hero" />
                </Field>
              </div>
              <Field label="대사 텍스트">
                <textarea className={textareaClassName} value={talkingText} onChange={(event) => setTalkingText(event.target.value)} />
              </Field>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="음성 ID">
                  <input className={inputClassName} value={talkingVoice} onChange={(event) => setTalkingVoice(event.target.value)} placeholder="직접 지정할 때만 입력" />
                </Field>
                <Field label="언어">
                  <input className={inputClassName} value={talkingLang} onChange={(event) => setTalkingLang(event.target.value)} />
                </Field>
                <Field label="프리셋 폴더">
                  <input className={inputClassName} value={voiceDir} onChange={(event) => setVoiceDir(event.target.value)} placeholder="voice preset root" />
                </Field>
              </div>
              {voicePresets.length > 0 ? (
                <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">저장된 음성 프리셋</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {voicePresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setVoicePreset(preset.name)}
                        className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === "extend" ? (
            <>
              <Field label="원본 비디오 경로">
                <input className={inputClassName} value={sourceVideoPath} onChange={(event) => setSourceVideoPath(event.target.value)} placeholder="C:\\workspace\\scene.mp4" />
              </Field>
              <Field label="겹침 프레임">
                <SegmentedOptions options={["4", "8", "12", "16"]} value={overlapFrames} onChange={setOverlapFrames} />
              </Field>
            </>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="모델">
              <SegmentedOptions options={availableModels} value={selectedModel} onChange={setModel} />
            </Field>
            <Field label="품질">
              <SegmentedOptions options={videoQualities} value={quality} onChange={setQuality} />
            </Field>
          </div>

          {mode !== "talking" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="화면비">
                <SegmentedOptions options={["9:16", "16:9", "1:1"]} value={aspect} onChange={setAspect} />
              </Field>
              <Field label="길이">
                <SegmentedOptions options={mode === "seed" ? ["5", "8", "10", "15"] : ["3", "5", "8", "10"]} value={duration} onChange={setDuration} />
              </Field>
            </div>
          ) : (
            <Field label="길이">
              <SegmentedOptions options={["5", "8", "10", "15"]} value={duration} onChange={setDuration} />
            </Field>
          )}
        </StudioPanel>

        <StudioPanel title="모션 라이브러리" description="프로젝트를 빠르게 시작할 수 있는 모션 힌트와 카메라 움직임 프리셋입니다.">
          <LibraryGrid category="motion" />
        </StudioPanel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <StudioPanel title="시드 세션" description="후보를 만들고, 고르고, 확장하고, 조립하는 반복형 영상 워크플로우입니다.">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <Field label="세션 경로">
              <input className={inputClassName} value={sessionDir} onChange={(event) => setSessionDir(event.target.value)} placeholder="workspace/seeds/ep23-noggin" />
            </Field>
            <Field label="체인 시작 ID">
              <input className={inputClassName} value={sessionSourceId} onChange={(event) => setSessionSourceId(event.target.value)} placeholder="seed-002" />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => void browseSession()}>
              세션 불러오기
            </Button>
            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => void saveSelection()}>
              선택 저장
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={actionPending || !sessionDir || !selectedChainRoot}
              onClick={() => void runAction("/api/video/extend", {
                desc,
                duration: Number(duration),
                loops: 1,
                overlapFrames: Number(overlapFrames),
                quality,
                sessionDir,
                sourceId: selectedChainRoot,
              })}
            >
              선택 체인 확장
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={actionPending || !sessionDir || !selectedChainRoot}
              onClick={() => void runAction("/api/video/compose", {
                sessionDir,
                sourceId: selectedChainRoot,
                withAudio,
              })}
            >
              체인 조립
            </Button>
          </div>

          {sessionMessage ? (
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
              {sessionMessage}
            </div>
          ) : null}

          {sessionManifest ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">세션 요약</div>
                <div className="mt-2 text-sm font-semibold text-white">{sessionManifest.sessionId}</div>
                <div className="mt-1 text-sm text-zinc-400">{sessionManifest.prompt}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-300">
                  <span className="rounded-full bg-white/8 px-3 py-1">{sessionManifest.model}</span>
                  <span className="rounded-full bg-white/8 px-3 py-1">{sessionManifest.duration}s</span>
                  <span className="rounded-full bg-white/8 px-3 py-1">{sessionManifest.candidates.length} 후보</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sessionManifest.candidates.map((candidate) => {
                  const selected = sessionSelectedIds.includes(candidate.id);
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => {
                        setSessionSelectedIds((current) => (
                          current.includes(candidate.id)
                            ? current.filter((value) => value !== candidate.id)
                            : [...current, candidate.id]
                        ));
                        setSessionSourceId(candidate.id);
                      }}
                      className={`rounded-3xl border p-4 text-left transition ${
                        selected
                          ? "border-emerald-400/40 bg-emerald-500/12"
                          : "border-white/8 bg-white/[0.04] hover:bg-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white">{candidate.id}</div>
                        <span className="rounded-full bg-white/8 px-2 py-1 text-[0.7rem] text-zinc-300">{candidate.status}</span>
                      </div>
                      <div className="mt-3 text-xs text-zinc-400">{candidate.file || "아직 생성되지 않았습니다."}</div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ListVideo className="h-4 w-4 text-emerald-200" />
                  확장 체인
                </div>
                {sessionManifest.extensions.length === 0 ? (
                  <div className="mt-3 text-sm text-zinc-400">아직 확장 체인이 없습니다. 후보를 선택한 뒤 확장을 실행해 보세요.</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {sessionManifest.extensions.map((extension) => (
                      <div key={extension.id} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                        {extension.parent} → {extension.id} ({extension.totalDuration}s)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </StudioPanel>

        <StudioPanel title="운영 메모" description="시드 세션 방식은 후보를 먼저 만들고 사람이 고른 다음 확장하는 흐름에 맞춰 GPU 시간을 줄입니다.">
          <div className="grid gap-3 lg:grid-cols-1">
            <InfoCard icon={Gauge} title="후보를 먼저 생성" body="SkyReels 전체 품질로 바로 달리기보다 2~4개의 후보를 먼저 만든 뒤 가장 좋은 시드를 고르면 GPU 낭비를 줄일 수 있습니다." />
            <InfoCard icon={Compass} title="선택 후 반복 확장" body="선택된 시드만 5초 단위로 붙여 나가면 장면 길이를 통제하면서도 모션 연속성을 유지하기 좋습니다." />
            <InfoCard icon={HardDriveDownload} title="조립 단계 분리" body="확장 체인을 별도로 관리하면 마지막에만 조립하거나, 특정 지점부터 다시 이어 붙이기 편합니다." />
            <InfoCard icon={WandSparkles} title="로컬 백엔드 결합" body="이 화면은 Wan/LTX 일반 생성과 SkyReels 시드·확장 흐름을 같은 비디오 스튜디오 안에서 다루도록 정리되어 있습니다." />
          </div>
        </StudioPanel>
      </div>
    </StudioPage>
  );
}

function splitPathList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
