import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

export interface PipelineBatchItem<TPayload = unknown> {
  id: string;
  payload: TPayload;
}

interface BatchCheckpoint {
  completed: string[];
  outputs: Record<string, Record<string, string>>;
}

export interface PipelineBatchResult {
  checkpoint_path: string;
  completed_count: number;
  outputs: Record<string, Record<string, string>>;
  resumed_from_checkpoint: boolean;
  status: "completed" | "interrupted";
  total_count: number;
}

export async function runPipelineBatch<TPayload>(
  input: {
    checkpointPath: string;
    items: Array<PipelineBatchItem<TPayload>>;
    runItem(item: PipelineBatchItem<TPayload>): Promise<Record<string, string>>;
  },
): Promise<PipelineBatchResult> {
  const checkpoint = await loadCheckpoint(input.checkpointPath);
  const resumedFromCheckpoint = checkpoint.completed.length > 0;

  for (const item of input.items) {
    if (checkpoint.completed.includes(item.id)) {
      continue;
    }

    try {
      checkpoint.outputs[item.id] = await input.runItem(item);
      checkpoint.completed.push(item.id);
      await saveCheckpoint(input.checkpointPath, checkpoint);
    } catch {
      await saveCheckpoint(input.checkpointPath, checkpoint);
      return {
        checkpoint_path: input.checkpointPath,
        completed_count: checkpoint.completed.length,
        outputs: checkpoint.outputs,
        resumed_from_checkpoint: resumedFromCheckpoint,
        status: "interrupted",
        total_count: input.items.length,
      };
    }
  }

  return {
    checkpoint_path: input.checkpointPath,
    completed_count: checkpoint.completed.length,
    outputs: checkpoint.outputs,
    resumed_from_checkpoint: resumedFromCheckpoint,
    status: "completed",
    total_count: input.items.length,
  };
}

async function loadCheckpoint(checkpointPath: string): Promise<BatchCheckpoint> {
  try {
    const raw = await readFile(checkpointPath, "utf8");
    return JSON.parse(raw) as BatchCheckpoint;
  } catch {
    return {
      completed: [],
      outputs: {},
    };
  }
}

async function saveCheckpoint(
  checkpointPath: string,
  checkpoint: BatchCheckpoint,
): Promise<void> {
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}
