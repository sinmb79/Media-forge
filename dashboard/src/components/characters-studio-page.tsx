"use client";

import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Trash2 } from "lucide-react";

import { Field, inputClassName, SegmentedOptions, textareaClassName } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/lib/studio-store";

interface CharacterRecord {
  id: string;
  name: string;
  description: string;
  type: string;
  refImageCount: number;
}

const characterTypes = ["realistic", "anime", "2d"];

export function CharactersStudioPage() {
  const { actionPending, runAction } = useStudioStore(useShallow((state) => ({
    actionPending: state.actionPending,
    runAction: state.runAction,
  })));

  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("realistic");
  const [refImagePath, setRefImagePath] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCharacters = useCallback(async () => {
    try {
      const response = await fetch("/api/characters");
      if (response.ok) {
        const data = await response.json() as { items: CharacterRecord[] };
        setCharacters(data.items ?? []);
      }
    } catch {
      // silently ignore fetch errors
    }
  }, []);

  useEffect(() => {
    void fetchCharacters();
  }, [fetchCharacters]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await runAction("/api/characters", {
        name: name.trim(),
        description: description.trim(),
        type,
        refImagePath: refImagePath.trim() || undefined,
      });
      setName("");
      setDescription("");
      setRefImagePath("");
      await fetchCharacters();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (characterId: string) => {
    try {
      await fetch("/api/characters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: characterId }),
      });
      await fetchCharacters();
    } catch {
      // silently ignore
    }
  };

  return (
    <StudioPage
      eyebrow="캐릭터 라이브러리"
      title="캐릭터 관리"
      description="캐릭터를 등록하고 레퍼런스 이미지로 모든 씬에서 동일 외형을 유지합니다."
      actions={(
        <Button
          className="bg-emerald-400 text-black hover:bg-emerald-300"
          disabled={actionPending || loading || !name.trim()}
          onClick={() => void handleCreate()}
        >
          캐릭터 생성
        </Button>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <StudioPanel title="캐릭터 등록" description="새 캐릭터를 등록하고 레퍼런스 이미지를 연결합니다.">
          <Field label="캐릭터 이름">
            <input
              className={inputClassName}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 하늘이"
            />
          </Field>

          <Field label="설명">
            <textarea
              className={textareaClassName}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="캐릭터 외형, 성격, 역할 등을 설명하세요."
            />
          </Field>

          <Field label="유형">
            <SegmentedOptions options={characterTypes} value={type} onChange={setType} />
          </Field>

          <Field label="레퍼런스 이미지 경로">
            <input
              className={inputClassName}
              value={refImagePath}
              onChange={(event) => setRefImagePath(event.target.value)}
              placeholder="C:\workspace\...\character_ref.png"
            />
          </Field>
        </StudioPanel>

        <StudioPanel title="등록된 캐릭터" description="현재 등록된 캐릭터 목록입니다.">
          {characters.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-center">
              <div className="text-sm font-semibold text-white">등록된 캐릭터가 없습니다</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                왼쪽 패널에서 캐릭터를 등록하면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {characters.map((character) => (
                <div
                  key={character.id}
                  className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{character.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-100">
                          {character.type}
                        </span>
                        <span className="text-xs text-zinc-400">
                          레퍼런스 {character.refImageCount}장
                        </span>
                      </div>
                      {character.description ? (
                        <p className="mt-2 text-sm leading-6 text-zinc-400">{character.description}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(character.id)}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </StudioPanel>
      </div>
    </StudioPage>
  );
}
