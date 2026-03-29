import { access } from "node:fs/promises";
import * as path from "node:path";

import type { DoctorCheck, DoctorResult, DoctorStatus } from "../domain/contracts.js";
import { SUPPORTED_COMMANDS } from "../config/profile-catalog.js";

export async function buildDoctorReport(): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];

  checks.push({
    name: "node_version",
    status: isSupportedNodeVersion(process.versions.node) ? "ok" : "warning",
    message: `Detected Node ${process.versions.node}`,
  });

  checks.push(await checkPath("package_json", path.resolve(process.cwd(), "package.json")));
  checks.push(await checkPath("fixtures_directory", path.resolve(process.cwd(), "tests", "fixtures")));
  checks.push({
    name: "command_catalog",
    status: SUPPORTED_COMMANDS.length >= 8 ? "ok" : "warning",
    message: `Supported commands: ${SUPPORTED_COMMANDS.join(", ")}`,
  });

  const status = deriveOverallStatus(checks);

  return {
    schema_version: "0.1",
    status,
    checks,
    warnings: checks.filter((check) => check.status !== "ok").map((check) => check.name),
  };
}

async function checkPath(name: string, targetPath: string): Promise<DoctorCheck> {
  try {
    await access(targetPath);
    return {
      name,
      status: "ok",
      message: `${name} available`,
    };
  } catch {
    return {
      name,
      status: "error",
      message: `${name} missing`,
    };
  }
}

function isSupportedNodeVersion(version: string): boolean {
  const major = Number(version.split(".")[0]);
  return Number.isFinite(major) && major >= 24;
}

function deriveOverallStatus(checks: DoctorCheck[]): DoctorStatus {
  if (checks.some((check) => check.status === "error")) {
    return "error";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }

  return "ok";
}
