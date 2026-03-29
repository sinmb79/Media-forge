import { buildDoctorReport } from "../doctor/build-doctor-report.js";
import { EXIT_CODE_SUCCESS } from "./exit-codes.js";
import { renderDoctorOutput } from "./render-doctor-output.js";

export async function doctorEngineCommand(
  options: { json: boolean },
): Promise<{ exitCode: number; output: string }> {
  const result = await buildDoctorReport();

  return {
    exitCode: EXIT_CODE_SUCCESS,
    output: renderDoctorOutput(result, options.json),
  };
}
