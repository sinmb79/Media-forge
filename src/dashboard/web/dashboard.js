const state = {
  backends: [],
  jobs: [],
  outputs: [],
  selectedOutputId: null,
  inspection: { type: "idle" },
};

const elements = {
  backendPills: document.getElementById("backend-pills"),
  hardwareSummary: document.getElementById("hardware-summary"),
  previewMeta: document.getElementById("preview-meta"),
  previewSurface: document.getElementById("preview-surface"),
  queueList: document.getElementById("queue-list"),
  resultLog: document.getElementById("result-log"),
  timelineList: document.getElementById("timeline-list"),
  verificationBadge: document.getElementById("verification-badge"),
  verificationDescription: document.getElementById("verification-description"),
  verificationFacts: document.getElementById("verification-facts"),
  verificationTitle: document.getElementById("verification-title"),
  workspacePath: document.getElementById("workspace-path"),
};

boot().catch((error) => {
  console.error(error);
  renderFatalInspection(error);
});

async function boot() {
  bindTabs();
  bindQuickActions();
  bindForms();
  connectEvents();
  await Promise.all([loadHealth(), loadOutputs(), loadJobs()]);
  renderDashboard();
}

async function loadHealth() {
  const response = await fetch("/api/health");
  const payload = await response.json();

  elements.workspacePath.textContent = payload.workspace_root;
  elements.hardwareSummary.textContent = buildHardwareSummary(payload.doctor?.system);
  state.backends = payload.doctor?.backends ?? [];
  renderBackends(state.backends);
}

async function loadOutputs(preferredArtifactPath = null) {
  const response = await fetch("/api/outputs");
  const payload = await response.json();
  state.outputs = payload.items ?? [];

  if (preferredArtifactPath) {
    const matched = findOutputByArtifactPath(preferredArtifactPath);
    state.selectedOutputId = matched?.id ?? state.selectedOutputId;
  }

  if (state.selectedOutputId && !state.outputs.some((output) => output.id === state.selectedOutputId)) {
    state.selectedOutputId = null;
  }

  if (state.inspection.type === "idle" && state.outputs.length > 0) {
    const newestOutput = state.outputs[0];
    state.selectedOutputId = newestOutput.id;
    state.inspection = {
      type: "output",
      outputId: newestOutput.id,
    };
  }
}

async function loadJobs() {
  const response = await fetch("/api/jobs");
  const payload = await response.json();
  state.jobs = payload.items ?? [];

  if (state.inspection.type === "job" && !getSelectedJob()) {
    state.inspection = { type: "idle" };
  }

  if ((state.inspection.type === "idle" || state.inspection.type === "submitting") && state.jobs.length > 0) {
    state.inspection = {
      type: "job",
      jobId: state.jobs[0].id,
    };
  }
}

function bindTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (!tab) {
        return;
      }

      document.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
    });
  });
}

function bindQuickActions() {
  document.querySelectorAll("[data-quick-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.quickAction;
      if (!action) {
        return;
      }

      await submitAction(action, {});
    });
  });
}

function bindForms() {
  bindActionForm("prompt-form", "prompt-build");
  bindActionForm("image-form", "image-sketch");
  bindActionForm("edit-form", "edit-run");
  bindActionForm("audio-form", "audio-run");
  bindActionForm("pipeline-form", "pipeline-run");

  document.getElementById("video-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = toPlainObject(new FormData(event.currentTarget));
    const action = payload.mode || "video-from-image";
    delete payload.mode;
    void submitAction(action, payload);
  });
}

function bindActionForm(formId, action) {
  document.getElementById(formId)?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAction(action, toPlainObject(new FormData(event.currentTarget)));
  });
}

function connectEvents() {
  const source = new EventSource("/api/events");

  source.addEventListener("snapshot", (event) => {
    const payload = JSON.parse(event.data);
    state.jobs = payload.jobs ?? [];
    if (state.inspection.type === "job" && !getSelectedJob()) {
      state.inspection = state.jobs[0]
        ? { type: "job", jobId: state.jobs[0].id }
        : { type: "idle" };
    }
    renderDashboard();
  });

  source.addEventListener("job", async (event) => {
    const payload = JSON.parse(event.data);
    const index = state.jobs.findIndex((job) => job.id === payload.job.id);
    if (index >= 0) {
      state.jobs[index] = payload.job;
    } else {
      state.jobs.unshift(payload.job);
    }

    state.inspection = {
      type: "job",
      jobId: payload.job.id,
    };

    if (payload.job.result_kind === "file" && payload.job.artifact_exists && payload.job.artifact_path) {
      await loadOutputs(payload.job.artifact_path);
      syncOutputSelectionToJob(payload.job);
    }

    renderDashboard();
  });
}

async function submitAction(action, payload) {
  state.inspection = {
    type: "submitting",
    action,
  };
  renderDashboard();

  const response = await fetch(`/api/actions/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (response.status === 422 || result.status === "blocked") {
    state.inspection = {
      type: "blocked",
      action,
      response: result,
    };
    renderDashboard();
    return;
  }

  state.inspection = {
    type: "job",
    jobId: result.job_id,
  };
  await loadJobs();
  renderDashboard();
}

function renderDashboard() {
  ensureInspectionTarget();
  renderJobs();
  renderOutputs();
  renderInspection();
}

function renderBackends(backends) {
  elements.backendPills.innerHTML = "";
  for (const backend of backends) {
    const pill = document.createElement("div");
    pill.className = `backend-pill ${backend.available ? "available" : ""}`;
    pill.textContent = `${backend.name} ${backend.available ? "ready" : "missing"}`;
    elements.backendPills.appendChild(pill);
  }
}

function renderJobs() {
  elements.queueList.innerHTML = "";

  if (state.jobs.length === 0) {
    elements.queueList.innerHTML = `<div class="queue-item"><h3>No jobs yet</h3><div class="job-meta">Run an action from the studio panel.</div></div>`;
    return;
  }

  for (const job of state.jobs) {
    const presentation = buildJobPresentation(job);
    const active = state.inspection.type === "job" && state.inspection.jobId === job.id;
    const item = document.createElement("article");
    item.className = `queue-item ${active ? "active" : ""}`;
    item.innerHTML = `
      <div class="queue-item-header">
        <div class="queue-heading">
          <h3>${escapeHtml(job.label)}</h3>
          <div class="job-meta">${escapeHtml(formatTimestamp(job.createdAt))}</div>
        </div>
        <span class="status-badge ${escapeHtml(presentation.badgeClass)}">${escapeHtml(presentation.badgeLabel)}</span>
      </div>
      <div class="queue-summary">${escapeHtml(presentation.title)}</div>
      <div class="job-meta">${escapeHtml(presentation.detail)}</div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.round((job.progress ?? 0) * 100)}%"></div></div>
    `;
    item.addEventListener("click", () => {
      state.inspection = {
        type: "job",
        jobId: job.id,
      };
      syncOutputSelectionToJob(job);
      renderDashboard();
    });
    elements.queueList.appendChild(item);
  }
}

function renderOutputs() {
  elements.timelineList.innerHTML = "";

  if (state.outputs.length === 0) {
    elements.timelineList.innerHTML = `<div class="timeline-item"><h3>No outputs yet</h3><div class="timeline-meta">Generated files will appear here after verification.</div></div>`;
    return;
  }

  for (const output of state.outputs) {
    const item = document.createElement("article");
    item.className = `timeline-item ${state.selectedOutputId === output.id ? "active" : ""}`;
    item.innerHTML = `
      <span class="timeline-kind">${escapeHtml(output.kind)}</span>
      <h3>${escapeHtml(output.name)}</h3>
      <div class="timeline-meta">${escapeHtml(formatTimestamp(output.modifiedAt))}</div>
    `;
    item.addEventListener("click", () => {
      state.selectedOutputId = output.id;
      state.inspection = {
        type: "output",
        outputId: output.id,
      };
      renderDashboard();
    });
    elements.timelineList.appendChild(item);
  }
}

function renderInspection() {
  switch (state.inspection.type) {
    case "submitting":
      renderStatusSummary({
        badgeClass: "status-running",
        badgeLabel: "Submitting",
        description: "Sending the request to the dashboard action API.",
        facts: [
          createFact("Action", humanizeAction(state.inspection.action)),
          createFact("Phase", "Execution"),
        ],
        title: "Submitting action",
      });
      renderEmptyPreview("Submitting request", "The action is being sent to the local dashboard server.");
      renderPreviewMetaBlock("Preparing action", "Waiting for the job to enter the queue.");
      renderResultLog({
        action: state.inspection.action,
        status: "submitting",
      });
      return;
    case "blocked":
      renderBlockedInspection(state.inspection);
      return;
    case "job": {
      const job = getSelectedJob();
      if (job) {
        renderJobInspection(job);
        return;
      }
      break;
    }
    case "output": {
      const output = getSelectedOutput();
      if (output) {
        renderOutputInspection(output);
        return;
      }
      break;
    }
    default:
      break;
  }

  renderStatusSummary({
    badgeClass: "status-idle",
    badgeLabel: "Idle",
    description: "Run an action or select a job from the queue to inspect its result.",
    facts: [
      createFact("Expected artifact", "No job selected"),
      createFact("Next step", "Choose a queue item or run an action."),
    ],
    title: "Nothing selected",
  });
  renderEmptyPreview("No output selected yet.", "Choose a recent result or run an action from the studio panel.");
  renderPreviewMetaBlock("Preview is waiting", "No active job or output is selected.");
  renderResultLog("Waiting for action output...");
}

function renderBlockedInspection(inspection) {
  const requiredBackends = resolveRequiredBackends(inspection.action, {});
  renderStatusSummary({
    badgeClass: "status-blocked",
    badgeLabel: "Blocked",
    description: inspection.response.reason,
    facts: [
      createFact("Action", humanizeAction(inspection.action)),
      createFact("Required backends", formatBackendAvailability(requiredBackends, inspection.response.missing_backends)),
      createFact("Missing inputs", formatList(inspection.response.missing_inputs, "None")),
      createFact("Expected artifact", isNonFileAction(inspection.action) ? "No file expected" : "File required"),
      createFact("Next step", formatList(inspection.response.next_steps, "Fix the form and retry.")),
    ],
    title: "Blocked before run",
  });
  renderEmptyPreview("Action blocked", "Fix the missing inputs or unavailable backends, then run the action again.");
  renderPreviewMetaBlock(humanizeAction(inspection.action), "The request was stopped before execution.");
  renderResultLog(inspection.response);
}

function renderJobInspection(job) {
  const presentation = buildJobPresentation(job);
  const requiredBackends = resolveRequiredBackends(job.kind, job.input);
  const selectedOutput = job.result_kind === "file"
    ? findOutputByArtifactPath(job.artifact_path)
    : null;

  renderStatusSummary({
    badgeClass: presentation.badgeClass,
    badgeLabel: presentation.badgeLabel,
    description: presentation.detail,
    facts: [
      createFact("Action", job.label),
      createFact("Phase", capitalize(job.phase)),
      createFact("Required backends", formatBackendAvailability(requiredBackends, [])),
      createFact("Expected artifact", job.expected_artifact ? "File required" : "No file expected"),
      createFact("Artifact state", formatArtifactState(job)),
      createFact("Artifact path", job.artifact_path ?? "None"),
      createFact("Next step", job.next_step ?? defaultNextStep(job)),
    ],
    title: presentation.title,
  });

  if (job.result_kind === "file" && job.artifact_exists && selectedOutput) {
    state.selectedOutputId = selectedOutput.id;
    renderPreviewFromOutput(selectedOutput);
    renderPreviewMetaBlock(job.label, `${presentation.title} • ${selectedOutput.relativePath}`);
  } else if (job.result_kind === "file" && job.artifact_exists && job.artifact_path) {
    renderEmptyPreview("Artifact verified", "The file exists, but it is not inside the dashboard outputs list yet.");
    renderPreviewMetaBlock(job.label, job.artifact_path);
  } else if (job.result_kind === "non_file") {
    renderEmptyPreview("No file expected", "This action returns structured data instead of a generated file.");
    renderPreviewMetaBlock(job.label, `${presentation.title} • JSON result`);
  } else if (job.status === "failed") {
    renderEmptyPreview(presentation.title, job.error ?? job.details);
    renderPreviewMetaBlock(job.label, `${presentation.title} • ${formatTimestamp(job.finishedAt ?? job.createdAt)}`);
  } else {
    renderEmptyPreview("Waiting for verified artifact", "The action is still running or verification has not completed yet.");
    renderPreviewMetaBlock(job.label, `${presentation.title} • ${formatTimestamp(job.createdAt)}`);
  }

  renderResultLog(buildJobInspectorPayload(job));
}

function renderOutputInspection(output) {
  renderStatusSummary({
    badgeClass: "status-succeeded",
    badgeLabel: "Preview",
    description: "This output is available in the recent outputs timeline.",
    facts: [
      createFact("Kind", output.kind),
      createFact("Relative path", output.relativePath),
      createFact("Size", formatBytes(output.sizeBytes)),
      createFact("Updated", formatTimestamp(output.modifiedAt)),
      createFact("Expected artifact", "Verified file"),
    ],
    title: "Recent output selected",
  });
  renderPreviewFromOutput(output);
  renderPreviewMetaBlock(output.name, `${output.kind} • ${output.relativePath}`);
  renderResultLog(output);
}

function renderStatusSummary(summary) {
  elements.verificationBadge.className = `status-badge ${summary.badgeClass}`;
  elements.verificationBadge.textContent = summary.badgeLabel;
  elements.verificationTitle.textContent = summary.title;
  elements.verificationDescription.textContent = summary.description;
  elements.verificationFacts.innerHTML = summary.facts
    .filter((fact) => fact.value && String(fact.value).trim().length > 0)
    .map((fact) => `
      <div class="fact-card">
        <span class="fact-label">${escapeHtml(fact.label)}</span>
        <div class="fact-value">${escapeHtml(String(fact.value))}</div>
      </div>
    `)
    .join("");
}

function renderPreviewFromOutput(output) {
  if (output.kind === "image") {
    elements.previewSurface.innerHTML = `<img src="${output.url}" alt="${escapeHtml(output.name)}" />`;
    return;
  }

  if (output.kind === "video") {
    elements.previewSurface.innerHTML = `<video controls src="${output.url}"></video>`;
    return;
  }

  if (output.kind === "audio") {
    elements.previewSurface.innerHTML = `<audio controls src="${output.url}"></audio>`;
    return;
  }

  elements.previewSurface.innerHTML = `
    <div class="empty-preview">
      <p>${escapeHtml(output.name)}</p>
      <small>${escapeHtml(output.relativePath)}</small>
    </div>
  `;
}

function renderEmptyPreview(title, subtitle) {
  elements.previewSurface.innerHTML = `
    <div class="empty-preview">
      <p>${escapeHtml(title)}</p>
      <small>${escapeHtml(subtitle)}</small>
    </div>
  `;
}

function renderPreviewMetaBlock(title, description) {
  elements.previewMeta.innerHTML = `
    <div><strong>${escapeHtml(title)}</strong></div>
    <div>${escapeHtml(description)}</div>
  `;
}

function renderResultLog(payload) {
  elements.resultLog.textContent = typeof payload === "string"
    ? payload
    : JSON.stringify(payload, null, 2);
}

function renderFatalInspection(error) {
  const message = error instanceof Error ? error.message : String(error);
  renderStatusSummary({
    badgeClass: "status-failed",
    badgeLabel: "Error",
    description: message,
    facts: [
      createFact("Next step", "Reload the dashboard or inspect the local server logs."),
    ],
    title: "Dashboard failed to load",
  });
  renderEmptyPreview("Dashboard error", message);
  renderPreviewMetaBlock("Dashboard error", "The interface could not finish loading.");
  renderResultLog({
    error: message,
  });
}

function ensureInspectionTarget() {
  if (state.inspection.type === "job" && !getSelectedJob()) {
    state.inspection = state.jobs[0]
      ? { type: "job", jobId: state.jobs[0].id }
      : { type: "idle" };
  }

  if (state.inspection.type === "output" && !getSelectedOutput()) {
    state.inspection = state.jobs[0]
      ? { type: "job", jobId: state.jobs[0].id }
      : state.outputs[0]
        ? { type: "output", outputId: state.outputs[0].id }
        : { type: "idle" };
  }
}

function syncOutputSelectionToJob(job) {
  if (job.result_kind !== "file" || !job.artifact_path) {
    return;
  }

  const matched = findOutputByArtifactPath(job.artifact_path);
  if (matched) {
    state.selectedOutputId = matched.id;
  }
}

function getSelectedJob() {
  if (state.inspection.type !== "job") {
    return null;
  }

  return state.jobs.find((job) => job.id === state.inspection.jobId) ?? null;
}

function getSelectedOutput() {
  if (state.inspection.type === "output") {
    return state.outputs.find((output) => output.id === state.inspection.outputId) ?? null;
  }

  if (state.selectedOutputId) {
    return state.outputs.find((output) => output.id === state.selectedOutputId) ?? null;
  }

  return null;
}

function findOutputByArtifactPath(artifactPath) {
  if (!artifactPath) {
    return null;
  }

  const normalizedTarget = normalizePath(artifactPath);
  return state.outputs.find((output) => normalizePath(output.path) === normalizedTarget) ?? null;
}

function buildHardwareSummary(system) {
  const gpu = system?.gpu ? `${system.gpu.name} ${system.gpu.total_vram_gb}GB` : "No GPU info";
  const ram = system?.ram ? `RAM ${system.ram.total_gb}GB` : "RAM unavailable";
  return `${gpu} • ${ram}`;
}

function buildJobPresentation(job) {
  if (job.status === "queued") {
    return {
      badgeClass: "status-queued",
      badgeLabel: "Queued",
      detail: job.details || "Waiting for execution.",
      title: job.summary || "Queued for execution",
    };
  }

  if (job.status === "running") {
    return {
      badgeClass: "status-running",
      badgeLabel: job.phase === "verification" ? "Verifying" : "Running",
      detail: job.details || latestLog(job.logs),
      title: job.summary || (job.phase === "verification" ? "Verifying result" : "Execution running"),
    };
  }

  if (job.status === "succeeded") {
    return {
      badgeClass: "status-succeeded",
      badgeLabel: "Verified",
      detail: job.details || "Execution and verification both succeeded.",
      title: job.summary || "Generated and verified",
    };
  }

  return {
    badgeClass: "status-failed",
    badgeLabel: job.phase === "verification" ? "Verification failed" : "Execution failed",
    detail: job.error || job.details || latestLog(job.logs),
    title: job.phase === "verification" ? "Verification failed" : "Execution failed",
  };
}

function buildJobInspectorPayload(job) {
  if (job.output !== null && job.output !== undefined) {
    return job.output;
  }

  return {
    artifact_exists: job.artifact_exists,
    artifact_path: job.artifact_path,
    details: job.details,
    error: job.error,
    expected_artifact: job.expected_artifact,
    logs: job.logs.slice(-6),
    next_step: job.next_step,
    phase: job.phase,
    result_kind: job.result_kind,
    status: job.status,
    summary: job.summary,
  };
}

function resolveRequiredBackends(action, payload) {
  switch (action) {
    case "image-sketch":
    case "video-from-image":
    case "video-from-text":
      return ["comfyui"];
    case "edit-run":
      return resolveEditBackends(payload);
    case "audio-run":
      return resolveAudioBackends(payload);
    case "pipeline-run":
      return resolvePipelineBackends(payload);
    default:
      return [];
  }
}

function resolveEditBackends(payload) {
  switch (payload.subcommand) {
    case "join":
    case "upscale":
      return ["comfyui"];
    case "remove-object":
      return ["propainter"];
    case "remove-watermark":
      return isImageLikePath(payload.input) ? ["comfyui"] : ["propainter"];
    case "cut":
    case "concat":
    case "speed":
    case "resize":
    case "stabilize":
    case "interpolate":
      return ["ffmpeg"];
    default:
      return [];
  }
}

function resolveAudioBackends(payload) {
  switch (payload.subcommand) {
    case "tts":
    case "transcribe":
      return ["python"];
    case "add-subs":
    case "add-bgm":
    case "separate":
      return ["ffmpeg"];
    default:
      return [];
  }
}

function resolvePipelineBackends(payload) {
  switch (payload.subcommand) {
    case "sketch-to-video":
    case "storyboard":
      return ["comfyui"];
    case "sketch-to-long-video":
      return ["comfyui", "ollama"];
    default:
      return [];
  }
}

function formatBackendAvailability(requiredBackends, missingBackends) {
  if (!Array.isArray(requiredBackends) || requiredBackends.length === 0) {
    return "No required backend";
  }

  return requiredBackends.map((backend) => {
    const known = state.backends.find((entry) => entry.name === backend);
    const isMissing = Array.isArray(missingBackends) && missingBackends.includes(backend);
    if (isMissing || (known && !known.available)) {
      return `${backend}: missing`;
    }
    if (known?.available) {
      return `${backend}: ready`;
    }
    return `${backend}: unknown`;
  }).join(" • ");
}

function formatArtifactState(job) {
  if (!job.expected_artifact) {
    return "No file expected";
  }

  if (job.artifact_exists === true) {
    return "Generated and verified";
  }

  if (job.artifact_exists === false) {
    return "Verification failed";
  }

  if (job.status === "running") {
    return "Verification pending";
  }

  return "Waiting for artifact";
}

function defaultNextStep(job) {
  if (job.result_kind === "non_file") {
    return "Review the JSON result in the inspector.";
  }

  if (job.status === "succeeded") {
    return "Review the generated file in Preview Workspace.";
  }

  return "Review the details and retry the action.";
}

function formatList(values, fallback) {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }

  return values.join(" • ");
}

function createFact(label, value) {
  return { label, value };
}

function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 ** 2) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 ** 3) {
    return `${(size / (1024 ** 2)).toFixed(1)} MB`;
  }

  return `${(size / (1024 ** 3)).toFixed(1)} GB`;
}

function formatTimestamp(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function normalizePath(value) {
  return String(value).replaceAll("\\", "/").toLowerCase();
}

function latestLog(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return "Waiting for logs";
  }
  return logs[logs.length - 1].message;
}

function toPlainObject(formData) {
  const result = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      continue;
    }

    if (result[key] !== undefined) {
      if (!Array.isArray(result[key])) {
        result[key] = [result[key]];
      }
      result[key].push(value);
      continue;
    }

    result[key] = value;
  }

  document.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
    if (!checkbox.name || !(checkbox.form && checkbox.form.contains(checkbox))) {
      return;
    }
    if (result[checkbox.name] !== undefined) {
      result[checkbox.name] = checkbox.checked;
    }
  });

  return result;
}

function isImageLikePath(filePath) {
  const lower = String(filePath || "").toLowerCase();
  return lower.endsWith(".png")
    || lower.endsWith(".jpg")
    || lower.endsWith(".jpeg")
    || lower.endsWith(".webp");
}

function isNonFileAction(action) {
  return action === "prompt-build"
    || action === "doctor"
    || action === "probe"
    || action === "paths-validate";
}

function humanizeAction(action) {
  switch (action) {
    case "prompt-build":
      return "Prompt Build";
    case "image-sketch":
      return "Image Sketch";
    case "video-from-image":
      return "Video From Image";
    case "video-from-text":
      return "Video From Text";
    case "edit-run":
      return "Edit Run";
    case "audio-run":
      return "Audio Run";
    case "pipeline-run":
      return "Pipeline Run";
    case "paths-validate":
      return "Paths Validate";
    case "doctor":
      return "Forge Doctor";
    case "probe":
      return "Backend Probe";
    default:
      return String(action);
  }
}

function capitalize(value) {
  const text = String(value ?? "");
  return text.length > 0 ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
