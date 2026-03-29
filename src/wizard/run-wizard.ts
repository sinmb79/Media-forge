import type { Interface as ReadlineInterface } from "node:readline";

import type {
  BudgetTier,
  EngineRequest,
  Platform,
  PreferredEngine,
  QualityTier,
} from "../domain/contracts.js";

export interface WizardAnswers {
  topic: string;
  subject: string;
  goal: string;
  emotion: string;
  platform: Platform;
  theme: string;
  duration_sec: number;
  language: string;
  budget_tier: BudgetTier;
  quality_tier: QualityTier;
  hook_type: string;
  pacing_profile: string;
  caption_style: string;
  camera_language: string;
  preferred_engine: PreferredEngine;
}

export type WizardWriter = (text: string) => void;

const PLATFORM_OPTIONS: { value: Platform; label: string; min: number; max: number; recommended: number }[] = [
  { value: "youtube_shorts", label: "YouTube Shorts", min: 15, max: 60, recommended: 30 },
  { value: "tiktok", label: "TikTok", min: 10, max: 45, recommended: 20 },
  { value: "instagram_reels", label: "Instagram Reels", min: 10, max: 45, recommended: 20 },
];

const BUDGET_OPTIONS: { value: BudgetTier; label: string }[] = [
  { value: "low", label: "low — 저비용 로컬 처리" },
  { value: "balanced", label: "balanced — 균형 처리" },
  { value: "high", label: "high — 고품질 처리" },
];

const QUALITY_OPTIONS: { value: QualityTier; label: string }[] = [
  { value: "low", label: "low — 빠른 초안" },
  { value: "balanced", label: "balanced — 일반 품질" },
  { value: "premium", label: "premium — 최고 품질" },
];

const HOOK_OPTIONS = [
  { value: "curiosity", label: "curiosity — 궁금증 유발" },
  { value: "surprise", label: "surprise — 깜짝 놀람" },
  { value: "cliffhanger", label: "cliffhanger — 긴장감 고조" },
  { value: "question", label: "question — 질문으로 시작" },
];

const PACING_OPTIONS = [
  { value: "fast_cut", label: "fast_cut — 빠른 편집" },
  { value: "slow_burn", label: "slow_burn — 느린 전개" },
  { value: "dramatic_build", label: "dramatic_build — 드라마틱한 클라이맥스" },
];

const CAPTION_STYLE_MAP: Record<Platform, string> = {
  youtube_shorts: "informative_clean",
  tiktok: "tiktok_viral",
  instagram_reels: "cinematic_minimal",
};

const CAMERA_LANGUAGE_MAP: Record<string, string> = {
  fast_cut: "simple_push_in",
  slow_burn: "slow_push_in",
  dramatic_build: "slow_push_in",
};

const ENGINE_OPTIONS: { value: PreferredEngine; label: string }[] = [
  { value: "local", label: "local — 로컬 (무료)" },
  { value: "gpu", label: "gpu — GPU 가속" },
  { value: "sora", label: "sora — Sora AI" },
  { value: "premium", label: "premium — 프리미엄 AI" },
];

function ask(rl: ReadlineInterface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function askText(
  rl: ReadlineInterface,
  prompt: string,
  fallback?: string,
): Promise<string> {
  const hint = fallback ? ` (기본값: ${fallback})` : "";
  const answer = await ask(rl, `${prompt}${hint}: `);
  return answer || fallback || "";
}

async function askChoice<T extends string>(
  rl: ReadlineInterface,
  out: WizardWriter,
  prompt: string,
  options: { value: T; label: string }[],
  defaultIndex = 0,
): Promise<T> {
  out(`\n${prompt}\n`);
  for (let i = 0; i < options.length; i++) {
    const marker = i === defaultIndex ? " [기본값]" : "";
    out(`  ${i + 1}. ${options[i]!.label}${marker}\n`);
  }

  while (true) {
    const answer = await ask(rl, `선택 (1-${options.length}, 기본값 ${defaultIndex + 1}): `);
    if (answer === "") return options[defaultIndex]!.value;

    const num = parseInt(answer, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) {
      return options[num - 1]!.value;
    }

    out(`  올바른 번호를 입력하세요 (1-${options.length}).\n`);
  }
}

async function askDuration(
  rl: ReadlineInterface,
  out: WizardWriter,
  platform: Platform,
): Promise<number> {
  const p = PLATFORM_OPTIONS.find((o) => o.value === platform)!;
  const answer = await ask(
    rl,
    `\n영상 길이 (초, ${p.min}~${p.max}초, 기본값 ${p.recommended}): `,
  );

  if (answer === "") return p.recommended;

  const num = parseInt(answer, 10);
  if (!isNaN(num)) {
    if (num < p.min) {
      out(`  ${p.min}초 미만은 자동으로 ${p.min}초로 조정됩니다.\n`);
      return p.min;
    }
    if (num > p.max) {
      out(`  ${p.max}초 초과는 자동으로 ${p.max}초로 조정됩니다.\n`);
      return p.max;
    }
    return num;
  }

  out(`  숫자를 입력하세요. 기본값(${p.recommended}초)을 사용합니다.\n`);
  return p.recommended;
}

export async function runWizard(
  rl: ReadlineInterface,
  out: WizardWriter = (text) => process.stdout.write(text),
): Promise<WizardAnswers> {
  out("\n=== Shorts Engine 설정 마법사 ===\n");
  out("질문에 답하면 요청 파일이 자동으로 생성됩니다.\n");
  out("Enter 키를 누르면 기본값이 적용됩니다.\n\n");

  const topic = await askText(rl, "영상 주제 (예: AI 생산성 도구 소개)", "my topic");
  const subject = await askText(rl, "주요 등장 인물/사물 (예: 노트북 앞의 직장인)", "main subject");
  const goal = await askText(rl, "영상의 목적 (예: 제품을 간단하게 소개하기)", "make a short-form clip");
  const emotion = await askText(rl, "전달할 감정 (예: 호기심과 만족감)", "curiosity and satisfaction");

  const platform = await askChoice(rl, out, "플랫폼 선택:", PLATFORM_OPTIONS);
  const theme = await askText(rl, "\n영상 테마 (예: explainer, product_launch, story_tease)", "explainer");
  const duration_sec = await askDuration(rl, out, platform);
  const language = await askText(rl, "\n언어 코드 (예: ko, en)", "ko");

  const budget_tier = await askChoice(rl, out, "예산 등급:", BUDGET_OPTIONS);
  const quality_tier = await askChoice(rl, out, "품질 등급:", QUALITY_OPTIONS);
  const hook_type = await askChoice(rl, out, "훅(Hook) 스타일:", HOOK_OPTIONS);
  const pacing_profile = await askChoice(rl, out, "영상 페이싱:", PACING_OPTIONS);
  const preferred_engine = await askChoice(rl, out, "처리 엔진:", ENGINE_OPTIONS);

  const caption_style = CAPTION_STYLE_MAP[platform];
  const camera_language = CAMERA_LANGUAGE_MAP[pacing_profile] ?? "simple_push_in";

  return {
    topic,
    subject,
    goal,
    emotion,
    platform,
    theme,
    duration_sec,
    language,
    budget_tier,
    quality_tier,
    hook_type,
    pacing_profile,
    caption_style,
    camera_language,
    preferred_engine,
  };
}

export function buildRequestFromAnswers(answers: WizardAnswers): EngineRequest {
  return {
    version: "0.1",
    intent: {
      topic: answers.topic,
      subject: answers.subject,
      goal: answers.goal,
      emotion: answers.emotion,
      platform: answers.platform,
      theme: answers.theme,
      duration_sec: answers.duration_sec,
    },
    constraints: {
      language: answers.language,
      budget_tier: answers.budget_tier,
      quality_tier: answers.quality_tier,
      visual_consistency_required: true,
      content_policy_safe: true,
    },
    style: {
      hook_type: answers.hook_type,
      pacing_profile: answers.pacing_profile,
      caption_style: answers.caption_style,
      camera_language: answers.camera_language,
    },
    backend: {
      preferred_engine: answers.preferred_engine,
      allow_fallback: true,
    },
    output: {
      type: "video_prompt",
    },
  };
}
