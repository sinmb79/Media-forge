import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import * as path from "node:path";
import { app } from "electron";

import {
  createDesktopRuntimeManifest,
  type DesktopRuntimeManifest,
} from "../../src/desktop/runtime-manifest.js";
import {
  buildDesktopBackendEnsurePlan,
  buildDesktopDashboardServerPlan,
  buildDesktopOpenClawBridgePlan,
  resolveDesktopNodeExecutable,
  resolveDesktopRuntimePaths,
  type DesktopNodeLaunchPlan,
  type DesktopResolvedRuntimePaths,
} from "../../src/desktop/runtime-launcher.js";

export interface DesktopRuntimeStatus {
  agent_bridge_ready: boolean;
  agent_bridge_url: string | null;
  backend_results: Array<{
    name: string;
    ready: boolean;
    reason: string | null;
    started: boolean;
    status: string;
  }>;
  dashboard_url: string | null;
  last_error: string | null;
  started_at: string | null;
  state: "failed" | "idle" | "ready" | "starting" | "stopped";
}

export class DesktopBackendManager extends EventEmitter {
  private bridgeProcess: ChildProcessWithoutNullStreams | null = null;
  private readonly manifest: DesktopRuntimeManifest;
  private process: ChildProcessWithoutNullStreams | null = null;
  private resolvedPaths: DesktopResolvedRuntimePaths | null = null;
  private status: DesktopRuntimeStatus = {
    agent_bridge_ready: false,
    agent_bridge_url: null,
    backend_results: [],
    dashboard_url: null,
    last_error: null,
    started_at: null,
    state: "idle",
  };

  constructor(manifest = createDesktopRuntimeManifest()) {
    super();
    this.manifest = manifest;
  }

  getManifest(): DesktopRuntimeManifest {
    return this.manifest;
  }

  getStatus(): DesktopRuntimeStatus {
    return { ...this.status };
  }

  async startDashboardRuntime(): Promise<string> {
    if (this.process && this.status.state !== "failed" && this.status.state !== "stopped") {
      return this.manifest.dashboard.url;
    }

    const runtimePaths = await resolveDesktopRuntimePaths({
      packaged: app.isPackaged,
      resourcesPath: path.resolve(path.dirname(process.execPath), "resources"),
      rootDir: this.manifest.root_dir,
    });
    const nodeExecutable = await resolveDesktopNodeExecutable({
      packaged: app.isPackaged,
      resourcesPath: path.resolve(path.dirname(process.execPath), "resources"),
    });
    this.resolvedPaths = runtimePaths;
    this.setStatus({
      agent_bridge_ready: false,
      agent_bridge_url: null,
      backend_results: [],
      dashboard_url: null,
      last_error: null,
      started_at: new Date().toISOString(),
      state: "starting",
    });

    const backendResults = await this.ensureBackends(runtimePaths, nodeExecutable);
    const bridgeResult = await this.ensureAgentBridge(runtimePaths, nodeExecutable);
    const launchPlan = buildDesktopDashboardServerPlan(this.manifest, runtimePaths, nodeExecutable);

    this.process = spawn(launchPlan.command, launchPlan.args, {
      cwd: launchPlan.cwd,
      env: launchPlan.env,
      stdio: "pipe",
      windowsHide: true,
    });
    this.process.stdout.on("data", () => undefined);
    this.process.stderr.on("data", (buffer) => {
      const message = buffer.toString("utf8").trim();
      if (!message) {
        return;
      }
      this.setStatus({
        ...this.status,
        last_error: message,
      });
    });
    this.process.once("exit", (code) => {
      this.setStatus({
        agent_bridge_ready: this.status.agent_bridge_ready,
        agent_bridge_url: this.status.agent_bridge_url,
        backend_results: this.status.backend_results,
        dashboard_url: null,
        last_error: code === 0 ? null : `Dashboard runtime exited with code ${code ?? -1}.`,
        started_at: this.status.started_at,
        state: "stopped",
      });
      this.process = null;
    });

    const ready = await waitForDashboard(launchPlan.url, 30_000);
    if (!ready) {
      this.setStatus({
        agent_bridge_ready: bridgeResult.ready,
        agent_bridge_url: bridgeResult.url,
        backend_results: backendResults,
        dashboard_url: null,
        last_error: bridgeResult.reason ?? "Timed out waiting for the MediaForge dashboard runtime.",
        started_at: this.status.started_at,
        state: "failed",
      });
      throw new Error(this.status.last_error ?? "Dashboard runtime failed to start.");
    }

    this.setStatus({
      agent_bridge_ready: bridgeResult.ready,
      agent_bridge_url: bridgeResult.url,
      backend_results: backendResults,
      dashboard_url: launchPlan.url,
      last_error: bridgeResult.reason,
      started_at: this.status.started_at,
      state: "ready",
    });

    return launchPlan.url;
  }

  async stopDashboardRuntime(): Promise<void> {
    if (this.bridgeProcess) {
      this.bridgeProcess.kill("SIGTERM");
      this.bridgeProcess = null;
    }

    if (!this.process) {
      this.setStatus({
        agent_bridge_ready: false,
        agent_bridge_url: null,
        backend_results: this.status.backend_results,
        dashboard_url: null,
        last_error: null,
        started_at: this.status.started_at,
        state: "stopped",
      });
      return;
    }

    this.process.kill("SIGTERM");
    this.process = null;
    this.setStatus({
      agent_bridge_ready: false,
      agent_bridge_url: null,
      backend_results: this.status.backend_results,
      dashboard_url: null,
      last_error: null,
      started_at: this.status.started_at,
      state: "stopped",
    });
  }

  private async ensureBackends(
    runtimePaths: DesktopResolvedRuntimePaths,
    nodeExecutable: string,
  ): Promise<DesktopRuntimeStatus["backend_results"]> {
    const results: NonNullable<DesktopRuntimeStatus["backend_results"]> = [];

    for (const backend of this.manifest.auto_start_backends) {
      const plan = buildDesktopBackendEnsurePlan(this.manifest, runtimePaths, backend, nodeExecutable);

      try {
        const result = await runJsonProcess(plan);
        results.push({
          name: String(result.name ?? backend),
          ready: Boolean(result.ready),
          reason: typeof result.reason === "string" ? result.reason : null,
          started: Boolean(result.started),
          status: typeof result.status === "string" ? result.status : "missing",
        });
      } catch (error) {
        results.push({
          name: backend,
          ready: false,
          reason: error instanceof Error ? error.message : String(error),
          started: false,
          status: "missing",
        });
      }
    }

    return results;
  }

  private async ensureAgentBridge(
    runtimePaths: DesktopResolvedRuntimePaths,
    nodeExecutable: string,
  ): Promise<{
    ready: boolean;
    reason: string | null;
    url: string | null;
  }> {
    if (!this.manifest.openclaw.auto_start) {
      return {
        ready: false,
        reason: null,
        url: null,
      };
    }

    if (await waitForDashboard(this.manifest.openclaw.url, 500)) {
      return {
        ready: true,
        reason: null,
        url: this.manifest.openclaw.url,
      };
    }

    const plan = buildDesktopOpenClawBridgePlan(this.manifest, runtimePaths, nodeExecutable);
    this.bridgeProcess = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      stdio: "pipe",
      windowsHide: true,
    });
    this.bridgeProcess.stdout.on("data", () => undefined);
    this.bridgeProcess.stderr.on("data", () => undefined);
    this.bridgeProcess.once("exit", () => {
      this.bridgeProcess = null;
    });

    const ready = await waitForDashboard(plan.url, 15_000);
    return {
      ready,
      reason: ready ? null : "Timed out waiting for the OpenClaw bridge.",
      url: ready ? plan.url : null,
    };
  }

  private setStatus(status: DesktopRuntimeStatus): void {
    this.status = status;
    this.emit("status", this.getStatus());
  }
}

async function waitForDashboard(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    try {
      const response = await fetch(url, {
        method: "GET",
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Keep polling until the dashboard is reachable.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

async function runJsonProcess(
  plan: DesktopNodeLaunchPlan,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      stdio: "pipe",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (buffer) => {
      stdout += buffer.toString("utf8");
    });
    child.stderr.on("data", (buffer) => {
      stderr += buffer.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Process exited with code ${code ?? -1}.`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}
