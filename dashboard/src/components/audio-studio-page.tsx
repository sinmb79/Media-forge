"use client";

import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { FileDropInput } from "@/components/file-drop-input";
import { Field, inputClassName, textareaClassName } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import type { DashboardCollectionResponse, DashboardVoicePresetRecord } from "@/lib/mediaforge-types";
import { useStudioStore } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

const audioTools = [
  { id: "tts", title: "텍스트 음성 변환", subtitle: "로컬 음성으로 나레이션을 생성합니다." },
  { id: "drama", title: "오디오 드라마", subtitle: "장편 다화자 VibeVoice 대화 생성을 실행합니다." },
  { id: "narrate", title: "VibeVoice 나레이션", subtitle: "VibeVoice로 프리뷰 또는 장문 나레이션을 생성합니다." },
  { id: "asr", title: "ASR", subtitle: "Whisper 또는 VibeVoice ASR 경로로 음성을 전사합니다." },
  { id: "transcribe", title: "전사", subtitle: "로컬 오디오나 비디오를 자막 텍스트로 변환합니다." },
  { id: "add-subs", title: "자막 추가", subtitle: "출력물에 SRT 자막을 번인합니다." },
  { id: "add-bgm", title: "BGM 추가", subtitle: "기존 비디오에 배경 음악을 믹싱합니다." },
  { id: "separate", title: "오디오 분리", subtitle: "내장된 오디오 트랙을 별도 파일로 추출합니다." },
  { id: "voice-change", title: "보이스 변경", subtitle: "FFmpeg rubberband로 로컬 나레이션이나 대사를 재조정합니다." },
] as const;

export function AudioStudioPage() {
  const { actionPending, runAction } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    runAction: state.runAction,
  })));
  const [tool, setTool] = useState<string>("tts");
  const [text, setText] = useState("안녕하세요. MediaForge 로컬 스튜디오 테스트 나레이션입니다.");
  const [inputPath, setInputPath] = useState("");
  const [subsPath, setSubsPath] = useState("");
  const [musicPath, setMusicPath] = useState("");
  const [lang, setLang] = useState("ko");
  const [voice, setVoice] = useState("ko-KR-SunHiNeural");
  const [scriptPath, setScriptPath] = useState("");
  const [scriptText, setScriptText] = useState("Speaker 1: We need to leave now.\nSpeaker 2: Then let's move.");
  const [speakers, setSpeakers] = useState("Hero,Ally");
  const [engine, setEngine] = useState("whisper");
  const [model, setModel] = useState("realtime-0.5b");
  const [volume, setVolume] = useState("0.3");
  const [pitch, setPitch] = useState("1.1");
  const [voiceDir, setVoiceDir] = useState("");
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [voicePresets, setVoicePresets] = useState<DashboardVoicePresetRecord[]>([]);
  const [selectedPresetNames, setSelectedPresetNames] = useState<string[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetEmotion, setPresetEmotion] = useState("neutral");
  const [presetSpeed, setPresetSpeed] = useState("1");
  const [presetNotes, setPresetNotes] = useState("");
  const [presetRefSample, setPresetRefSample] = useState("");
  const [presetLoraPath, setPresetLoraPath] = useState("");
  const [presetPending, setPresetPending] = useState(false);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);

  const activeTool = audioTools.find((entry) => entry.id === tool) ?? audioTools[0];
  const resolvedSpeakerNames = useMemo(
    () => (
      selectedPresetNames.length > 0
        ? selectedPresetNames
        : speakers
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
    ),
    [selectedPresetNames, speakers],
  );

  useEffect(() => {
    void refreshVoicePresets();
  }, []);

  async function refreshVoicePresets() {
    setPresetPending(true);

    try {
      const response = await fetch("/api/audio/presets", { cache: "no-store" });
      const payload = await response.json() as DashboardCollectionResponse<DashboardVoicePresetRecord>;
      setVoicePresets(payload.items ?? []);
      setPresetMessage(null);
    } catch (error) {
      setPresetMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPresetPending(false);
    }
  }

  async function savePreset() {
    const name = presetName.trim();
    if (name.length === 0) {
      setPresetMessage("프리셋 이름이 필요합니다.");
      return;
    }

    setPresetPending(true);

    try {
      const response = await fetch("/api/audio/presets", {
        body: JSON.stringify({
          emotion: presetEmotion,
          loraPath: presetLoraPath,
          name,
          notes: presetNotes,
          refSample: presetRefSample,
          speed: Number(presetSpeed),
          voice,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = await response.json() as DashboardVoicePresetRecord | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && typeof payload.error === "string" ? payload.error : `Save failed with status ${response.status}`);
      }

      await refreshVoicePresets();
      setPresetMessage(`프리셋 저장 완료: ${name}`);
      setPresetName("");
      setPresetNotes("");
      setPresetRefSample("");
      setPresetLoraPath("");
      setSelectedPresetNames((current) => current.includes(name) ? current : [...current, name]);
    } catch (error) {
      setPresetMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPresetPending(false);
    }
  }

  function toggleSelectedPreset(name: string) {
    setSelectedPresetNames((current) => (
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name]
    ));
  }

  return (
    <StudioPage
      eyebrow="음성, 자막, 마감"
      title="같은 검증 규칙으로 로컬 오디오 작업을 실행합니다"
      description="오디오 작업도 입력값과 백엔드 조건이 분명해야 하며, 실제 산출물이 있을 때만 성공으로 인정합니다."
      actions={(
        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-emerald-400 text-black hover:bg-emerald-300"
            disabled={actionPending}
            onClick={() => void runAction(`/api/audio/${tool}`, {
              engine,
              text,
              input: inputPath,
              model,
              subs: subsPath,
              music: musicPath,
              lang,
              script: scriptPath,
              scriptText,
              speakers: resolvedSpeakerNames.join(","),
              voice,
              voiceDir,
              volume,
              pitch,
            })}
          >
            {activeTool.title} 실행
          </Button>
          {tool === "drama" ? (
            <Button
              variant="outline"
              className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              disabled={actionPending}
              onClick={() => void runAction("/api/pipeline/episode-audio", {
                lang,
                model,
                primaryInput: scriptPath,
                speakers: resolvedSpeakerNames.join(","),
                subs: includeSubtitles,
                text: scriptText,
                voiceDir,
              })}
            >
              에피소드 오디오 큐잉
            </Button>
          ) : null}
        </div>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <StudioPanel title="오디오 도구 선반" description="나레이션, 전사, 자막 번인, 음악 믹싱 사이를 빠르게 전환합니다.">
          <div className="grid gap-3 md:grid-cols-2">
            {audioTools.map((entry) => (
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

        <StudioPanel title="오디오 실행 폼" description={activeTool.subtitle}>
          {tool === "tts" ? (
            <>
              <Field label="나레이션 텍스트">
                <textarea className={textareaClassName} value={text} onChange={(event) => setText(event.target.value)} />
              </Field>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="언어">
                  <input className={inputClassName} value={lang} onChange={(event) => setLang(event.target.value)} />
                </Field>
                <Field label="음성">
                  <input className={inputClassName} value={voice} onChange={(event) => setVoice(event.target.value)} />
                </Field>
              </div>
            </>
          ) : null}

          {tool === "drama" ? (
            <>
              <FileDropInput
                label="대사 스크립트 업로드"
                description="장편 VibeVoice 대화 생성을 위해 화자 태그가 있는 텍스트 파일을 넣어주세요."
                onUploaded={(record) => setScriptPath(record.path)}
              />
              <Field label="스크립트 경로">
                <input className={inputClassName} value={scriptPath} onChange={(event) => setScriptPath(event.target.value)} />
              </Field>
              <Field label="스크립트 텍스트 대체값">
                <textarea className={textareaClassName} value={scriptText} onChange={(event) => setScriptText(event.target.value)} />
              </Field>
              <Field label="화자 이름">
                <input className={inputClassName} value={speakers} onChange={(event) => setSpeakers(event.target.value)} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="모델">
                  <input className={inputClassName} value={model} onChange={(event) => setModel(event.target.value)} />
                </Field>
                <Field label="음성 프리셋 디렉터리">
                  <input className={inputClassName} value={voiceDir} onChange={(event) => setVoiceDir(event.target.value)} placeholder="선택적 사용자 프리셋 루트" />
                </Field>
              </div>
              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={includeSubtitles}
                  onChange={(event) => setIncludeSubtitles(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                />
                episode-audio 파이프라인에서 자막도 함께 생성
              </label>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">저장된 음성 프리셋</div>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">
                        프리셋을 선택하면 화자 배정과 이후 VibeVoice 보이스 클론 경로에 함께 사용됩니다.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                      disabled={presetPending}
                      onClick={() => void refreshVoicePresets()}
                    >
                      새로고침
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {resolvedSpeakerNames.map((name) => (
                      <span key={name} className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
                        {name}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3">
                    {voicePresets.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-400">
                        저장된 음성 프리셋이 아직 없습니다.
                      </div>
                    ) : (
                      voicePresets.map((preset) => {
                        const selected = selectedPresetNames.includes(preset.name);
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => toggleSelectedPreset(preset.name)}
                            className={cn(
                              "rounded-[24px] border p-4 text-left transition",
                              selected
                                ? "border-emerald-400/25 bg-emerald-500/10"
                                : "border-white/8 bg-black/20 hover:bg-white/[0.06]",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-white">{preset.name}</div>
                                <p className="mt-1 text-sm leading-6 text-zinc-400">{preset.summary}</p>
                              </div>
                              {selected ? (
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-emerald-100">
                                  선택됨
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                              {preset.has_ref_sample ? <span>레퍼런스 샘플</span> : null}
                              {preset.has_lora ? <span>LoRA 연결됨</span> : null}
                              {preset.notes ? <span>노트 있음</span> : null}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="text-sm font-semibold text-white">음성 프리셋 저장 또는 수정</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    VibeVoice 드라마와 episode-audio 실행에 쓸 재사용 가능한 캐릭터 음성 프로필을 만듭니다.
                  </p>

                  <Field label="프리셋 이름">
                    <input className={inputClassName} value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Hero" />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="감정">
                      <input className={inputClassName} value={presetEmotion} onChange={(event) => setPresetEmotion(event.target.value)} />
                    </Field>
                    <Field label="속도">
                      <input className={inputClassName} value={presetSpeed} onChange={(event) => setPresetSpeed(event.target.value)} />
                    </Field>
                  </div>
                  <FileDropInput
                    label="레퍼런스 샘플 업로드"
                    description="향후 보이스 클론이나 프리셋 라우팅에 사용할 짧은 레퍼런스 음성 샘플입니다."
                    onUploaded={(record) => setPresetRefSample(record.path)}
                  />
                  <Field label="레퍼런스 샘플 경로">
                    <input className={inputClassName} value={presetRefSample} onChange={(event) => setPresetRefSample(event.target.value)} />
                  </Field>
                  <Field label="LoRA 경로">
                    <input className={inputClassName} value={presetLoraPath} onChange={(event) => setPresetLoraPath(event.target.value)} placeholder="선택적 LoRA 가중치 경로" />
                  </Field>
                  <Field label="노트">
                    <textarea className={textareaClassName} value={presetNotes} onChange={(event) => setPresetNotes(event.target.value)} />
                  </Field>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      className="bg-white text-black hover:bg-zinc-200"
                      disabled={presetPending}
                      onClick={() => void savePreset()}
                    >
                      프리셋 저장
                    </Button>
                    {presetMessage ? <p className="text-sm text-zinc-400">{presetMessage}</p> : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {tool === "narrate" ? (
            <>
              <Field label="나레이션 텍스트">
                <textarea className={textareaClassName} value={text} onChange={(event) => setText(event.target.value)} />
              </Field>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="모델">
                  <input className={inputClassName} value={model} onChange={(event) => setModel(event.target.value)} />
                </Field>
                <Field label="음성">
                  <input className={inputClassName} value={voice} onChange={(event) => setVoice(event.target.value)} />
                </Field>
              </div>
            </>
          ) : null}

          {tool === "asr" ? (
            <>
              <FileDropInput
                label="원본 미디어 업로드"
                description="전사할 로컬 오디오 또는 비디오 파일을 선택하세요."
                onUploaded={(record) => setInputPath(record.path)}
              />
              <Field label="입력 경로">
                <input className={inputClassName} value={inputPath} onChange={(event) => setInputPath(event.target.value)} />
              </Field>
              <Field label="엔진">
                <input className={inputClassName} value={engine} onChange={(event) => setEngine(event.target.value)} />
              </Field>
            </>
          ) : null}

          {tool !== "tts" && tool !== "drama" && tool !== "narrate" && tool !== "asr" ? (
            <>
              <FileDropInput
                label="원본 미디어 업로드"
                description="전사, 자막 번인, 음악 믹싱, 추출, 보이스 재조정용 비디오 또는 오디오 입력입니다."
                onUploaded={(record) => setInputPath(record.path)}
              />
              <Field label="입력 경로">
                <input className={inputClassName} value={inputPath} onChange={(event) => setInputPath(event.target.value)} />
              </Field>
            </>
          ) : null}

          {tool === "add-subs" ? (
            <>
              <FileDropInput
                label="자막 파일 업로드"
                description="기존 SRT 파일을 넣어 자막 번인을 진행합니다."
                onUploaded={(record) => setSubsPath(record.path)}
              />
              <Field label="자막 경로">
                <input className={inputClassName} value={subsPath} onChange={(event) => setSubsPath(event.target.value)} />
              </Field>
            </>
          ) : null}

          {tool === "add-bgm" ? (
            <>
              <FileDropInput
                label="음악 트랙 업로드"
                description="현재 비디오 뒤에 믹싱할 로컬 MP3 또는 WAV 트랙을 선택하세요."
                onUploaded={(record) => setMusicPath(record.path)}
              />
              <Field label="음악 경로">
                <input className={inputClassName} value={musicPath} onChange={(event) => setMusicPath(event.target.value)} />
              </Field>
              <Field label="볼륨">
                <input className={inputClassName} value={volume} onChange={(event) => setVolume(event.target.value)} />
              </Field>
            </>
          ) : null}

          {tool === "voice-change" ? (
            <Field label="피치">
              <input className={inputClassName} value={pitch} onChange={(event) => setPitch(event.target.value)} />
            </Field>
          ) : null}
        </StudioPanel>
      </div>
    </StudioPage>
  );
}
