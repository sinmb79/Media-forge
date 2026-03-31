import { loadForgeDefaults } from "../forge/config/load-forge-defaults.js";
import type { ForgePromptClient } from "../prompt/forge-prompt-builder.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import { OllamaBackend } from "./ollama.js";
import { OpenClawLLMClient } from "./openclaw-llm.js";

export interface ResolveLLMClientOptions {
  rootDir?: string;
}

export async function resolveLLMClient(
  options: ResolveLLMClientOptions = {},
): Promise<ForgePromptClient> {
  const rootDir = options.rootDir ?? resolveMediaForgeRoot();
  const defaults = await loadForgeDefaults(rootDir);
  const provider = defaults.llm?.provider ?? "openclaw";

  if (provider === "ollama") {
    return new OllamaBackend({ autoStart: true, rootDir });
  }

  return new OpenClawLLMClient({ rootDir });
}
