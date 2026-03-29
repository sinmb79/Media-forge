import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { createInterface } from "node:readline";

import { buildRequestFromAnswers, runWizard } from "../wizard/run-wizard.js";
import {
  EXIT_CODE_INTERNAL_ERROR,
  EXIT_CODE_SUCCESS,
} from "./exit-codes.js";

export async function wizardEngineCommand(
  outputPath: string,
): Promise<{ exitCode: number; output: string }> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answers = await runWizard(rl);
    rl.close();

    const request = buildRequestFromAnswers(answers);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(request, null, 2)}\n`, "utf8");

    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: `\n요청 파일이 생성되었습니다: ${outputPath}\n\n다음 명령어로 실행하세요:\n  npm run engine -- run ${outputPath}\n`,
    };
  } catch (error) {
    rl.close();
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: `Fatal error: ${error instanceof Error ? error.message : "Unknown error"}\n`,
    };
  }
}
