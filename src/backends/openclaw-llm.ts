import { loadForgeDefaults } from "../forge/config/load-forge-defaults.js";
import type { ForgePromptClient } from "../prompt/forge-prompt-builder.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";

interface FetchLike {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface OpenClawLLMClientOptions {
  baseUrl?: string;
  defaultModel?: string;
  fetchFn?: FetchLike;
  rootDir?: string;
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = "You are a prompt engineer for SD XL and Wan 2.2 video generation. Convert the user's Korean scene description into optimized English prompts. Output JSON: { image_prompt, image_negative, video_prompt, video_negative }";

export class OpenClawLLMClient implements ForgePromptClient {
  readonly name = "openclaw" as const;
  private readonly options: OpenClawLLMClientOptions;

  constructor(options: OpenClawLLMClientOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = await this.resolveBaseUrl();
      const response = await (this.options.fetchFn ?? fetch)(`${baseUrl}/health`, {
        method: "GET",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    return null;
  }

  async generate(prompt: string, model?: string): Promise<string> {
    return this.generateWithSystemPrompt(
      prompt,
      model,
      this.options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    );
  }

  async generateWithSystemPrompt(
    prompt: string,
    model: string | undefined,
    systemPrompt: string,
  ): Promise<string> {
    const baseUrl = await this.resolveBaseUrl();
    const resolvedModel = model ?? await this.resolveDefaultModel();
    const response = await (this.options.fetchFn ?? fetch)(`${baseUrl}/invoke`, {
      body: JSON.stringify({
        action: "llm.generate",
        input: {
          model: resolvedModel,
          prompt,
          system_prompt: systemPrompt,
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`OpenClaw LLM request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as {
      output?: { text?: string };
      status?: string;
    };

    if (payload.status === "failed") {
      throw new Error("OpenClaw LLM generation failed.");
    }

    return payload.output?.text?.trim() ?? "";
  }

  private async resolveBaseUrl(): Promise<string> {
    if (this.options.baseUrl) {
      return this.options.baseUrl;
    }

    const defaults = await loadForgeDefaults(this.options.rootDir ?? resolveMediaForgeRoot());
    return defaults.llm?.openclaw_url ?? "http://127.0.0.1:4318";
  }

  private async resolveDefaultModel(): Promise<string> {
    if (this.options.defaultModel) {
      return this.options.defaultModel;
    }

    const defaults = await loadForgeDefaults(this.options.rootDir ?? resolveMediaForgeRoot());
    return defaults.llm?.default_model ?? "gpt-4o";
  }
}
