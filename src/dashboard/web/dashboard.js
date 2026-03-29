const state = {
  jobs: [],
  outputs: [],
  selectedOutputId: null,
};

const elements = {
  backendPills: document.getElementById("backend-pills"),
  hardwareSummary: document.getElementById("hardware-summary"),
  previewMeta: document.getElementById("preview-meta"),
  previewSurface: document.getElementById("preview-surface"),
  queueList: document.getElementById("queue-list"),
  resultLog: document.getElementById("result-log"),
  timelineList: document.getElementById("timeline-list"),
  workspacePath: document.getElementById("workspace-path"),
};

boot().catch((error) => {
  console.error(error);
  elements.resultLog.textContent = String(error);
});

async function boot() {
  bindTabs();
  bindQuickActions();
  bindForms();
  connectEvents();
  await Promise.all([loadHealth(), loadOutputs(), loadJobs()]);
}

async function loadHealth() {
  const response = await fetch("/api/health");
  const payload = await response.json();

  elements.workspacePath.textContent = payload.workspace_root;
  elements.hardwareSummary.textContent = buildHardwareSummary(payload.doctor?.system);
  renderBackends(payload.doctor?.backends ?? []);
}

async function loadOutputs() {
  const response = await fetch("/api/outputs");
  const payload = await response.json();
  state.outputs = payload.items ?? [];
  renderOutputs();
}

async function loadJobs() {
  const response = await fetch("/api/jobs");
  const payload = await response.json();
  state.jobs = payload.items ?? [];
  renderJobs();
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
    renderJobs();
  });

  source.addEventListener("job", (event) => {
    const payload = JSON.parse(event.data);
    const index = state.jobs.findIndex((job) => job.id === payload.job.id);
    if (index >= 0) {
      state.jobs[index] = payload.job;
    } else {
      state.jobs.unshift(payload.job);
    }
    renderJobs();
    if (payload.job.output) {
      elements.resultLog.textContent = JSON.stringify(payload.job.output, null, 2);
      void loadOutputs();
    }
  });
}

async function submitAction(action, payload) {
  elements.resultLog.textContent = `Submitting ${action}...`;
  const response = await fetch(`/api/actions/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const accepted = await response.json();
  elements.resultLog.textContent = JSON.stringify(accepted, null, 2);
  await loadJobs();
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
    const item = document.createElement("article");
    item.className = "queue-item";
    item.innerHTML = `
      <h3>${escapeHtml(job.label)}</h3>
      <div class="job-meta">${escapeHtml(job.status)} · ${escapeHtml(job.createdAt)}</div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.round((job.progress ?? 0) * 100)}%"></div></div>
      <div class="job-meta">${escapeHtml(job.error ?? latestLog(job.logs))}</div>
    `;
    elements.queueList.appendChild(item);
  }
}

function renderOutputs() {
  elements.timelineList.innerHTML = "";

  if (state.outputs.length === 0) {
    elements.timelineList.innerHTML = `<div class="timeline-item"><h3>No outputs yet</h3><div class="timeline-meta">Generated files will appear here.</div></div>`;
    return;
  }

  if (!state.selectedOutputId) {
    state.selectedOutputId = state.outputs[0].id;
  }

  for (const output of state.outputs) {
    const item = document.createElement("article");
    item.className = `timeline-item ${state.selectedOutputId === output.id ? "active" : ""}`;
    item.innerHTML = `
      <span class="timeline-kind">${escapeHtml(output.kind)}</span>
      <h3>${escapeHtml(output.name)}</h3>
      <div class="timeline-meta">${escapeHtml(output.modifiedAt)}</div>
    `;
    item.addEventListener("click", () => {
      state.selectedOutputId = output.id;
      renderOutputs();
      renderPreview(output);
    });
    elements.timelineList.appendChild(item);
  }

  const selected = state.outputs.find((output) => output.id === state.selectedOutputId);
  if (selected) {
    renderPreview(selected);
  }
}

function renderPreview(output) {
  elements.previewMeta.innerHTML = `
    <div><strong>${escapeHtml(output.name)}</strong></div>
    <div>${escapeHtml(output.kind)} · ${escapeHtml(output.relativePath)}</div>
  `;

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

function buildHardwareSummary(system) {
  const gpu = system?.gpu ? `${system.gpu.name} ${system.gpu.total_vram_gb}GB` : "No GPU info";
  const ram = system?.ram ? `RAM ${system.ram.total_gb}GB` : "RAM unavailable";
  return `${gpu} · ${ram}`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
