import { execFile } from "node:child_process";

import type { BackendExecutionResult } from "./types.js";

export interface ExecFileLike {
  (file: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }): Promise<BackendExecutionResult>;
}

export const defaultExecFile: ExecFileLike = (file, args, options) => {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      ...options?.env,
      PYTHONIOENCODING: "utf-8",
    };
    execFile(file, args, { cwd: options?.cwd, encoding: "utf8", env }, (error, stdout, stderr) => {
      if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(error);
        return;
      }

      resolve({
        exitCode: error ? 1 : 0,
        stderr: stderr ?? "",
        stdout: stdout ?? "",
      });
    });
  });
};
