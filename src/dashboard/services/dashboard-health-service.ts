import { buildForgeDoctorReport } from "../../forge/doctor/build-forge-doctor-report.js";
import { validateForgePaths } from "../../forge/doctor/validate-forge-paths.js";
import type { ForgeDoctorResult, ForgePathsValidationResult } from "../../forge/contracts.js";

export interface DashboardHealthSnapshot {
  schema_version: string;
  workspace_root: string;
  doctor: ForgeDoctorResult;
  paths: ForgePathsValidationResult;
  generated_at: string;
}

export class DashboardHealthService {
  constructor(private readonly rootDir: string = process.cwd()) {}

  async getSnapshot(): Promise<DashboardHealthSnapshot> {
    const [doctor, paths] = await Promise.all([
      buildForgeDoctorReport({ rootDir: this.rootDir }),
      validateForgePaths(this.rootDir),
    ]);

    return {
      schema_version: "0.1",
      workspace_root: this.rootDir,
      doctor,
      paths,
      generated_at: new Date().toISOString(),
    };
  }
}
