import type { ForgeMode, ForgePromptPlan } from "../contracts.js";

export interface ForgePromptPlanInput {
  request_id: string;
  mode: ForgeMode;
  desc_ko: string;
  theme?: string | null;
}

export function buildForgePromptPlan(input: ForgePromptPlanInput): ForgePromptPlan {
  const normalizedTheme = input.theme?.trim() ? input.theme.trim() : null;
  const promptHints = normalizedTheme ? [`theme:${normalizedTheme}`] : [];

  return {
    request_id: input.request_id,
    mode: input.mode,
    theme: normalizedTheme,
    source_text: input.desc_ko,
    prompt_seed: normalizedTheme
      ? `${input.desc_ko} | theme=${normalizedTheme}`
      : input.desc_ko,
    prompt_hints: promptHints,
  };
}
