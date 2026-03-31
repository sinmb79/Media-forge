"use client";

import { useEffect, useState } from "react";
import { FileCode2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { InfoCard, MetricCard } from "@/components/studio-page-helpers";
import { StudioPage, StudioPanel } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import type {
  BackendEnsureResponse,
  DesktopRuntimeStageSnapshot,
  DesktopSetupSnapshot,
  OpenClawBridgeSnapshot,
} from "@/lib/mediaforge-types";
import {
  buildOpenClawBridgeView,
  buildRuntimeStageView,
  buildSetupSnapshotView,
  buildSystemSnapshotView,
} from "@/lib/studio-view-model";
import { useStudioStore } from "@/lib/studio-store";

export function SettingsStudioPage() {
  const { assets, health, refreshHealth, runAction } = useStudioStore(useShallow((state) => ({
    assets: state.assets,
    health: state.health,
    refreshHealth: state.refreshHealth,
    runAction: state.runAction,
  })));
  const [pendingBackend, setPendingBackend] = useState<string | null>(null);
  const [lastEnsureResult, setLastEnsureResult] = useState<BackendEnsureResponse | null>(null);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const [setupSnapshot, setSetupSnapshot] = useState<DesktopSetupSnapshot | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [stageSnapshot, setStageSnapshot] = useState<DesktopRuntimeStageSnapshot | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [stagePending, setStagePending] = useState(false);
  const [openClawSnapshot, setOpenClawSnapshot] = useState<OpenClawBridgeSnapshot | null>(null);
  const [openClawError, setOpenClawError] = useState<string | null>(null);
  const systemView = health ? buildSystemSnapshotView(health) : null;
  const setupView = setupSnapshot ? buildSetupSnapshotView(setupSnapshot) : null;
  const stageView = stageSnapshot ? buildRuntimeStageView(stageSnapshot) : null;
  const openClawView = openClawSnapshot ? buildOpenClawBridgeView(openClawSnapshot) : null;
  const configAssets = assets.filter((asset) => asset.kind === "config");
  const backends = health?.doctor.backends ?? [];
  const mediaStack = health?.doctor.media_stack ?? null;
  const readyMediaCapabilityCount = mediaStack?.capabilities.filter((capability) => capability.ready).length ?? 0;
  const mediaCapabilityCount = mediaStack?.capabilities.length ?? 0;
  const missingMediaDependencyCount = new Set(
    mediaStack?.capabilities.flatMap((capability) => capability.missing_dependencies) ?? [],
  ).size;

  useEffect(() => {
    void refreshSetupSnapshot();
    void refreshRuntimeStageSnapshot();
    void refreshOpenClawSnapshot();
  }, []);

  return (
    <StudioPage
      eyebrow="런타임 전제 조건"
      title="실행에 영향을 주는 로컬 머신, 설정 파일, 경고를 점검합니다"
      description="장시간 작업에 들어가기 전에 하드웨어, 백엔드 준비 상태, 설정 상태를 확인하는 페이지입니다."
      actions={(
        <>
          <Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={() => void runAction("/api/actions/doctor")}>
            Doctor 실행
          </Button>
          <Button variant="outline" className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => void runAction("/api/actions/paths-validate")}>
            경로 검증
          </Button>
        </>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="작업공간" value={systemView?.workspacePath ?? "확인 중"} detail={systemView?.updatedAtLabel ?? "새로고침해서 확인"} />
        <MetricCard label="GPU" value={systemView?.gpuHeadline ?? "확인 중"} detail={systemView?.vramLabel ?? "VRAM 확인 중"} />
        <MetricCard label="누락 백엔드" value={String(systemView?.missingBackends.length ?? 0)} detail={(systemView?.missingBackends ?? []).join(", ") || "표시된 백엔드가 모두 준비되었습니다"} />
      </div>

      <StudioPanel title="데스크톱 설치 상태" description="최종 MediaForge.exe 흐름이 의존하는 번들 설치 단계를 추적합니다.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="현재 단계" value={setupView?.stepLabel ?? "확인 중"} detail="데스크톱 부트스트랩에서 아직 끝나지 않은 첫 단계입니다." />
          <MetricCard label="진행률" value={setupView?.progressLabel ?? "0%"} detail="시스템 점검, 백엔드, 모델, Ollama 모델 준비 상태를 합산합니다." />
          <MetricCard label="기본 Ollama 모델" value={setupView?.defaultModelLabel ?? "확인 중"} detail={setupView?.installedOllamaModelsLabel ?? "스냅샷을 새로고쳐 로컬 태그를 확인하세요"} />
          <MetricCard label="필수 모델" value={setupSnapshot?.required_model_status.completed ? "준비 완료" : "누락"} detail={setupView?.missingRequiredModelsLabel ?? "확인 중"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            onClick={() => void refreshSetupSnapshot()}
          >
            설치 스냅샷 새로고침
          </Button>
          {setupSnapshot ? (
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-300">
              시스템: {setupSnapshot.system_ready ? "준비됨" : "차단됨"} / 백엔드: {setupSnapshot.backends_ready ? "준비됨" : "대기"} / Ollama 모델: {setupSnapshot.ollama_model_ready ? "준비됨" : "누락"}
            </div>
          ) : null}
        </div>
        {setupError ? (
          <p className="mt-4 text-sm text-rose-200">{setupError}</p>
        ) : null}
      </StudioPanel>

      <StudioPanel title="개인 런타임 스테이지" description="이 머신의 Node 런타임, 백엔드 경로, OpenClaw 프로필을 데스크톱 stage 디렉터리에 고정합니다.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="스테이지 상태" value={stageView?.readyLabel ?? "확인 중"} detail={stageSnapshot?.stage_dir ?? "이 머신 정보를 고정하려면 로컬 스냅샷을 만드세요"} />
          <MetricCard label="Node 런타임" value={stageView?.nodeRuntimeLabel ?? "확인 중"} detail={stageSnapshot?.node_runtime_path ?? "스테이징된 런타임 없음"} />
          <MetricCard label="백엔드 설정" value={stageView?.backendConfigLabel ?? "확인 중"} detail={`${stageView?.backendOverrideCount ?? 0}개 백엔드 오버라이드가 스테이징됨`} />
          <MetricCard label="OpenClaw 프로필" value={stageView?.openclawProfileLabel ?? "확인 중"} detail={stageSnapshot?.openclaw_profile_path ?? "스테이징된 프로필 없음"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            className="bg-emerald-400 text-black hover:bg-emerald-300"
            disabled={stagePending}
            onClick={() => void createRuntimeStageSnapshot()}
          >
            {stagePending ? "스테이징 중..." : "로컬 런타임 스냅샷 만들기"}
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            onClick={() => void refreshRuntimeStageSnapshot()}
          >
            스테이지 스냅샷 새로고침
          </Button>
        </div>
        {stageError ? (
          <p className="mt-4 text-sm text-rose-200">{stageError}</p>
        ) : null}
      </StudioPanel>

      <StudioPanel title="OpenClaw 브리지" description="외부 에이전트 런타임에서 사용할 안정적인 로컬 REST 브리지를 제공합니다.">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="브리지 상태" value={openClawView?.statusLabel ?? "확인 중"} detail={openClawView?.urlLabel ?? "브리지 엔드포인트를 찾지 못했습니다"} />
          <MetricCard label="지원 작업 수" value={openClawView?.actionCountLabel ?? "0"} detail="프롬프트, 이미지, 비디오, 상태 확인, 런타임 점검 작업을 포함합니다." />
          <MetricCard label="스테이지 바인딩" value={stageSnapshot?.openclaw_url ?? "확인 중"} detail={stageSnapshot?.ready ? "데스크톱 스테이지 프로필이 준비되었습니다." : "브리지 메타데이터를 고정하려면 로컬 런타임 스냅샷을 만드세요."} />
        </div>
        {openClawSnapshot ? (
          <div className="mt-4 rounded-[24px] border border-white/8 bg-[#03050a] p-4 text-sm text-zinc-300">
            <div className="font-semibold text-white">엔드포인트</div>
            <p className="mt-2">{openClawSnapshot.openclaw.url}</p>
            <p>실행 중: {String(openClawSnapshot.openclaw.running)}</p>
            <p>작업: {openClawSnapshot.actions.map((action) => action.id).join(", ")}</p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            onClick={() => void refreshOpenClawSnapshot()}
          >
            OpenClaw 스냅샷 새로고침
          </Button>
        </div>
        {openClawError ? (
          <p className="mt-4 text-sm text-rose-200">{openClawError}</p>
        ) : null}
      </StudioPanel>

      <StudioPanel title="백엔드 준비 상태" description="대시보드를 벗어나지 않고 설치 상태, 감지 경로, 서비스 시작까지 확인합니다.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {backends.map((backend) => (
            <div key={backend.name} className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{backend.name}</div>
                  <p className="mt-2 text-sm text-zinc-400">
                    {backend.available ? "준비됨" : "누락 또는 응답 없음"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                  disabled={pendingBackend === backend.name}
                  onClick={() => void ensureBackend(backend.name)}
                >
                  {pendingBackend === backend.name ? "확인 중..." : "Ensure"}
                </Button>
              </div>
              <div className="mt-4 space-y-2 text-xs leading-6 text-zinc-400">
                <p>버전: {backend.version ?? "알 수 없음"}</p>
                <p>경로: {backend.detectedPath ?? "감지되지 않음"}</p>
                <p>소스: {backend.source ?? "알 수 없음"}</p>
                {backend.installGuideUrl ? (
                  <a className="text-emerald-200 underline-offset-4 hover:underline" href={backend.installGuideUrl} target="_blank" rel="noreferrer">
                    설치 가이드
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {lastEnsureResult ? (
          <div className="mt-4 rounded-[24px] border border-white/8 bg-[#03050a] p-4 text-sm text-zinc-300">
            <div className="font-semibold text-white">마지막 ensure 결과: {lastEnsureResult.name}</div>
            <p className="mt-2">상태: {lastEnsureResult.status}</p>
            <p>준비됨: {String(lastEnsureResult.ready)}</p>
            <p>사유: {lastEnsureResult.reason ?? "추가 메시지 없음"}</p>
          </div>
        ) : null}
        {ensureError ? (
          <p className="mt-4 text-sm text-rose-200">{ensureError}</p>
        ) : null}
      </StudioPanel>

      <StudioPanel title="ComfyUI 프로덕션 팩" description="SkyReels와 VibeVoice 워크플로우에 필요한 로컬 커스텀 노드와 모델 파일을 점검합니다.">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="ComfyUI 루트" value={mediaStack?.comfyui_root ?? "확인 중"} detail={mediaStack?.ready ? "설정된 팩이 모두 준비되었습니다." : "장시간 렌더 전에 누락 팩을 설치하세요."} />
          <MetricCard label="준비된 기능" value={`${readyMediaCapabilityCount}/${mediaCapabilityCount}`} detail="SkyReels Ref2V, Talking, Extend와 VibeVoice 모드를 각각 따로 점검합니다." />
          <MetricCard label="누락 의존성" value={String(missingMediaDependencyCount)} detail={(mediaStack?.warnings[0] ?? "새 노드나 모델 설치 후 Doctor를 다시 실행하세요.").slice(0, 140)} />
        </div>
        {mediaStack ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {mediaStack.capabilities.map((capability) => (
              <div key={capability.id} className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{capability.label}</div>
                    <p className="mt-2 text-sm text-zinc-400">{capability.summary}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-medium ${capability.ready ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-100"}`}>
                    {capability.ready ? "준비됨" : "차단됨"}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {capability.dependencies.map((dependency) => (
                    <div key={dependency.id} className="rounded-2xl border border-white/6 bg-[#03050a] px-3 py-2 text-xs text-zinc-300">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-white">{dependency.label}</div>
                        <div className={dependency.ready ? "text-emerald-200" : "text-amber-100"}>
                          {dependency.ready ? "준비됨" : "누락"}
                        </div>
                      </div>
                      <p className="mt-1 break-all text-zinc-400">
                        {dependency.detected_path ?? dependency.expected_paths.join(" or ")}
                      </p>
                      {!dependency.ready && dependency.install_guide_url ? (
                        <a className="mt-2 inline-flex text-emerald-200 underline-offset-4 hover:underline" href={dependency.install_guide_url} target="_blank" rel="noreferrer">
                          설치 가이드
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4 text-sm text-zinc-300">
            Doctor를 실행해 로컬 SkyReels, VibeVoice 준비 상태를 확인하세요.
          </div>
        )}
      </StudioPanel>

      <StudioPanel title="설정 파일" description="로컬 작업공간에서 발견한 런타임 설정 파일입니다.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {configAssets.length === 0 ? (
            <InfoCard icon={FileCode2} title="인덱싱된 설정 에셋이 없습니다" body="에셋 인덱서를 실행하거나 설정 변경 후 대시보드를 새로고치세요." />
          ) : (
            configAssets.map((asset) => (
              <div key={asset.id} className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
                <div className="text-sm font-semibold text-white">{asset.name}</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{asset.path}</p>
              </div>
            ))
          )}
        </div>
      </StudioPanel>
    </StudioPage>
  );

  async function ensureBackend(name: string) {
    setPendingBackend(name);
    setEnsureError(null);

    try {
      const response = await fetch(`/api/runtime/backends/${name}`, {
        method: "POST",
      });
      const result = await response.json() as BackendEnsureResponse | { reason?: string };

      if (!response.ok || !("name" in result)) {
        throw new Error(result.reason ?? `Failed to ensure ${name}.`);
      }

      setLastEnsureResult(result);
      await refreshHealth();
      await refreshSetupSnapshot();
    } catch (error) {
      setEnsureError(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingBackend(null);
    }
  }

  async function refreshSetupSnapshot() {
    setSetupError(null);

    try {
      const response = await fetch("/api/runtime/setup", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Setup snapshot failed with status ${response.status}.`);
      }

      const result = await response.json() as DesktopSetupSnapshot;
      setSetupSnapshot(result);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshRuntimeStageSnapshot() {
    setStageError(null);

    try {
      const response = await fetch("/api/runtime/stage", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Runtime stage snapshot failed with status ${response.status}.`);
      }

      const result = await response.json() as DesktopRuntimeStageSnapshot;
      setStageSnapshot(result);
    } catch (error) {
      setStageError(error instanceof Error ? error.message : String(error));
    }
  }

  async function createRuntimeStageSnapshot() {
    setStagePending(true);
    setStageError(null);

    try {
      const response = await fetch("/api/runtime/stage", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Runtime stage failed with status ${response.status}.`);
      }

      const result = await response.json() as DesktopRuntimeStageSnapshot;
      setStageSnapshot(result);
      await refreshOpenClawSnapshot();
    } catch (error) {
      setStageError(error instanceof Error ? error.message : String(error));
    } finally {
      setStagePending(false);
    }
  }

  async function refreshOpenClawSnapshot() {
    setOpenClawError(null);

    try {
      const response = await fetch("/api/runtime/openclaw", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`OpenClaw snapshot failed with status ${response.status}.`);
      }

      const result = await response.json() as OpenClawBridgeSnapshot;
      setOpenClawSnapshot(result);
    } catch (error) {
      setOpenClawError(error instanceof Error ? error.message : String(error));
    }
  }
}
