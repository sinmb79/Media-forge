import { readFile } from "node:fs/promises";

export interface StoryboardScene {
  image: string;
  desc: string;
  duration: number;
}

export interface StoryboardDefinition {
  scenes: StoryboardScene[];
  transition: string;
  output: {
    resolution: string;
    format: string;
  };
}

export async function loadStoryboardDefinition(filePath: string): Promise<StoryboardDefinition> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as StoryboardDefinition;
}
