export interface VideoGenerationPrompt {
  text_prompt: string;
  duration_sec: number;
  aspect_ratio: "9:16";
  style_tags: string[];
  motion_notes?: string;
}

export interface VideoGenerationResult {
  status: "success" | "error" | "dry_run";
  output_path?: string;
  error?: string;
  metadata: Record<string, unknown>;
}

export interface VideoGenerationOptions {
  dry_run: boolean;
}

export interface VideoGenerationAdapter {
  name: string;
  isAvailable(): Promise<boolean>;
  generate(
    prompt: VideoGenerationPrompt,
    options: VideoGenerationOptions,
  ): Promise<VideoGenerationResult>;
}
