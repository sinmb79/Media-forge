import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import {
  HeadlessBrowserRenderer,
  type VisualBrowserRenderer,
} from "./browser-renderer.js";

export interface VisualTemplate {
  category: "effects" | "music" | "particle";
  engine: "canvas";
  id: string;
  label: string;
  primaryColor: string;
  summary: string;
  tags: string[];
}

const VISUAL_TEMPLATES: VisualTemplate[] = [
  { category: "effects", engine: "canvas", id: "effects/lightning", label: "Lightning", primaryColor: "0x4fc3f7", summary: "Electric arcs pulsing across a storm sky.", tags: ["storm", "energy", "cinematic"] },
  { category: "effects", engine: "canvas", id: "effects/petals", label: "Petals", primaryColor: "0xff5fa2", summary: "Rose petals drifting on a cinematic breeze.", tags: ["romance", "floral", "soft"] },
  { category: "effects", engine: "canvas", id: "effects/autumn-leaves", label: "Autumn Leaves", primaryColor: "0xff9f43", summary: "Warm leaf particles flowing through depth.", tags: ["autumn", "warm", "nature"] },
  { category: "effects", engine: "canvas", id: "effects/matrix-rain", label: "Matrix Rain", primaryColor: "0x00ff88", summary: "Falling code columns with neon bloom.", tags: ["cyber", "code", "neon"] },
  { category: "effects", engine: "canvas", id: "effects/snowfall", label: "Snowfall", primaryColor: "0xeaf6ff", summary: "Layered snowfall with depth haze.", tags: ["winter", "particles", "ambient"] },
  { category: "effects", engine: "canvas", id: "effects/aurora-flow", label: "Aurora Flow", primaryColor: "0x5df2d6", summary: "Soft aurora ribbons moving across a nocturne sky.", tags: ["aurora", "glow", "dreamy"] },
  { category: "effects", engine: "canvas", id: "effects/neon-grid", label: "Neon Grid", primaryColor: "0x52b6ff", summary: "Retro-futuristic grid horizon with pulsing scanlines.", tags: ["retro", "grid", "synthwave"] },
  { category: "effects", engine: "canvas", id: "effects/laser-tunnel", label: "Laser Tunnel", primaryColor: "0xff4df2", summary: "Forward-moving laser tunnel for high-energy intros.", tags: ["tunnel", "speed", "club"] },
  { category: "music", engine: "canvas", id: "music/equalizer-bars", label: "Equalizer Bars", primaryColor: "0x00ff88", summary: "Reactive equalizer bars with layered glow and kick pulses.", tags: ["audio", "equalizer", "beats"] },
  { category: "music", engine: "canvas", id: "music/orbit-rings", label: "Orbit Rings", primaryColor: "0x9c6bff", summary: "Concentric orbital rings with beat-synced accents.", tags: ["audio", "orbit", "club"] },
  { category: "particle", engine: "canvas", id: "particle/blackhole", label: "Black Hole", primaryColor: "0x6c5ce7", summary: "Orbital particle vortex around a singularity.", tags: ["space", "gravity", "vortex"] },
  { category: "particle", engine: "canvas", id: "particle/starfield", label: "Starfield", primaryColor: "0x9ed6ff", summary: "Deep-space starfield flying toward the viewer.", tags: ["space", "travel", "depth"] },
];

export function listVisualTemplates(filters: {
  category?: VisualTemplate["category"];
  search?: string;
} = {}): VisualTemplate[] {
  const search = filters.search?.trim().toLowerCase();

  return VISUAL_TEMPLATES.filter((template) => {
    if (filters.category && template.category !== filters.category) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = [
      template.id,
      template.label,
      template.summary,
      ...template.tags,
    ].join(" ").toLowerCase();

    return haystack.includes(search);
  });
}

export function getVisualTemplate(id: string): VisualTemplate | null {
  return VISUAL_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function buildVisualTemplateDocument(input: {
  params?: Record<string, boolean | number | string>;
  template: string;
}): string {
  const template = getVisualTemplate(input.template)?.id ?? "effects/snowfall";
  const defaultParams = JSON.stringify(input.params ?? {});

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${template}</title>
  <style>
    :root { color-scheme: dark; }
    html, body { margin: 0; background: #050816; overflow: hidden; height: 100%; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="scene"></canvas>
  <script>
    (() => {
      const search = new URLSearchParams(window.location.search);
      const frameIndex = Number(search.get("frame") ?? "0");
      const frameCount = Math.max(1, Number(search.get("frames") ?? "1"));
      const durationSec = Math.max(1, Number(search.get("duration") ?? "5"));
      const fps = Math.max(1, Number(search.get("fps") ?? "12"));
      const templateId = search.get("template") || ${JSON.stringify(template)};
      const injectedParams = ${defaultParams};
      const queryParamsRaw = search.get("params");
      const queryParams = queryParamsRaw ? JSON.parse(decodeURIComponent(queryParamsRaw)) : {};
      const params = Object.assign({}, injectedParams, queryParams);
      const progress = frameCount <= 1 ? 0 : frameIndex / (frameCount - 1);
      const canvas = document.getElementById("scene");
      const ctx = canvas.getContext("2d");
      const width = Math.max(1, Number(search.get("width") ?? "1280"));
      const height = Math.max(1, Number(search.get("height") ?? "720"));
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      function clearBackground(top, bottom) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, top);
        gradient.addColorStop(1, bottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      function drawSnowfall() {
        clearBackground("#041226", "#0b1f3b");
        const density = Number(params.density ?? 1);
        for (let i = 0; i < 120 * density; i += 1) {
          const seed = i * 12.9898;
          const x = ((Math.sin(seed) + 1) * 0.5) * width;
          const drift = Math.sin(progress * 6 + i) * 18;
          const y = (height * ((progress * 1.1) + ((i * 0.037) % 1))) % (height + 32) - 16;
          const radius = 1 + ((i % 7) / 2);
          ctx.globalAlpha = 0.35 + ((i % 5) * 0.1);
          ctx.beginPath();
          ctx.fillStyle = "#f2f8ff";
          ctx.arc(x + drift, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function drawMatrixRain() {
        clearBackground("#020706", "#04140d");
        ctx.font = "18px monospace";
        const columns = Math.max(12, Math.floor(width / 26));
        for (let i = 0; i < columns; i += 1) {
          const x = i * (width / columns);
          const trail = (progress * height * 1.4 + i * 41) % (height + 240) - 240;
          const alpha = 0.35 + ((i % 4) * 0.12);
          for (let row = 0; row < 18; row += 1) {
            const y = trail - row * 22;
            ctx.fillStyle = row === 0 ? "rgba(210,255,235,0.95)" : \`rgba(0,255,136,\${Math.max(0.08, alpha - row * 0.04)})\`;
            ctx.fillText(String((i * 7 + row + frameIndex) % 10), x, y);
          }
        }
      }

      function drawLightning() {
        clearBackground("#050816", "#12233c");
        ctx.fillStyle = "rgba(132,196,255,0.08)";
        ctx.fillRect(0, 0, width, height);
        for (let bolt = 0; bolt < 3; bolt += 1) {
          const startX = width * (0.18 + bolt * 0.24);
          let x = startX;
          let y = -20;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let step = 0; step < 14; step += 1) {
            x += Math.sin(progress * 12 + step + bolt) * 36;
            y += height / 13;
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = "rgba(120,220,255,0.92)";
          ctx.lineWidth = 5;
          ctx.shadowBlur = 30;
          ctx.shadowColor = "#8fe8ff";
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }

      function drawPetals() {
        clearBackground("#140612", "#2b1020");
        for (let i = 0; i < 42; i += 1) {
          const x = (width * ((i * 0.07 + progress * 0.3) % 1));
          const y = (height * ((i * 0.11 + progress * 0.9) % 1));
          const rotation = progress * Math.PI * 4 + i;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rotation);
          ctx.fillStyle = i % 2 === 0 ? "rgba(255,95,162,0.8)" : "rgba(255,182,193,0.72)";
          ctx.beginPath();
          ctx.ellipse(0, 0, 10 + (i % 4) * 2, 18 + (i % 5) * 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      function drawAutumnLeaves() {
        clearBackground("#1a0f08", "#40210f");
        for (let i = 0; i < 36; i += 1) {
          const x = width * ((i * 0.09 + progress * 0.4) % 1);
          const y = height * ((i * 0.13 + progress * 0.75) % 1);
          const size = 18 + (i % 6) * 4;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(progress * 5 + i);
          ctx.fillStyle = i % 3 === 0 ? "#ff9f43" : i % 3 === 1 ? "#ff6b35" : "#ffd166";
          ctx.beginPath();
          ctx.moveTo(0, -size);
          ctx.quadraticCurveTo(size, -size / 2, size / 2, size);
          ctx.quadraticCurveTo(0, size / 1.5, -size / 2, size);
          ctx.quadraticCurveTo(-size, -size / 2, 0, -size);
          ctx.fill();
          ctx.restore();
        }
      }

      function drawBlackHole() {
        clearBackground("#02010a", "#0d0619");
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.18;
        const ring = ctx.createRadialGradient(centerX, centerY, radius * 0.35, centerX, centerY, radius * 1.8);
        ring.addColorStop(0, "rgba(0,0,0,1)");
        ring.addColorStop(0.45, "rgba(108,92,231,0.7)");
        ring.addColorStop(1, "rgba(6,3,12,0)");
        ctx.fillStyle = ring;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 2.2, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 180; i += 1) {
          const angle = progress * Math.PI * 4 + i * 0.27;
          const orbit = radius + (i % 11) * 10;
          const x = centerX + Math.cos(angle) * orbit;
          const y = centerY + Math.sin(angle) * orbit * 0.55;
          ctx.fillStyle = i % 3 === 0 ? "#b388ff" : "#6c5ce7";
          ctx.globalAlpha = 0.3 + ((i % 6) * 0.08);
          ctx.beginPath();
          ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function drawAuroraFlow() {
        clearBackground("#020913", "#09162a");
        for (let layer = 0; layer < 5; layer += 1) {
          ctx.beginPath();
          ctx.moveTo(0, height * (0.2 + layer * 0.08));
          for (let x = 0; x <= width; x += 24) {
            const sway = Math.sin((x / 180) + progress * 7 + layer) * (30 + layer * 12);
            ctx.lineTo(x, height * (0.2 + layer * 0.08) + sway);
          }
          ctx.lineTo(width, 0);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fillStyle = layer % 2 === 0
            ? "rgba(93,242,214," + String(0.08 + layer * 0.03) + ")"
            : "rgba(111,143,255," + String(0.06 + layer * 0.03) + ")";
          ctx.fill();
        }
      }

      function drawNeonGrid() {
        clearBackground("#040517", "#11122d");
        ctx.strokeStyle = "rgba(82,182,255,0.36)";
        ctx.lineWidth = 1.5;
        const horizon = height * 0.42;
        for (let i = 0; i < 18; i += 1) {
          const y = horizon + Math.pow(i / 17, 2) * (height - horizon);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        for (let i = -9; i <= 9; i += 1) {
          ctx.beginPath();
          ctx.moveTo(width / 2, horizon);
          ctx.lineTo(width / 2 + i * 140 + Math.sin(progress * 3) * 25, height);
          ctx.stroke();
        }
      }

      function drawLaserTunnel() {
        clearBackground("#060111", "#16051d");
        const centerX = width / 2;
        const centerY = height / 2;
        for (let ring = 0; ring < 18; ring += 1) {
          const depth = (ring / 18 + progress * 1.4) % 1;
          const size = 40 + depth * Math.min(width, height) * 0.65;
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(depth * 6 + ring * 0.2);
          ctx.strokeStyle = ring % 2 === 0
            ? "rgba(255,77,242," + String(0.18 + (1 - depth) * 0.45) + ")"
            : "rgba(82,182,255," + String(0.16 + (1 - depth) * 0.4) + ")";
          ctx.lineWidth = 2 + (1 - depth) * 3;
          ctx.strokeRect(-size / 2, -size / 2, size, size);
          ctx.restore();
        }
      }

      function drawEqualizerBars() {
        clearBackground("#040611", "#081729");
        const bars = 32;
        const barWidth = width / (bars * 1.35);
        for (let index = 0; index < bars; index += 1) {
          const beat = Math.abs(Math.sin(progress * 10 + index * 0.45));
          const heightFactor = 0.15 + beat * 0.8;
          const x = 60 + index * barWidth * 1.2;
          const barHeight = height * heightFactor * (0.45 + (index % 5) * 0.08);
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, "#00ff88");
          gradient.addColorStop(1, "#7ef9ff");
          ctx.fillStyle = gradient;
          ctx.fillRect(x, height - 80 - barHeight, barWidth, barHeight);
        }
      }

      function drawOrbitRings() {
        clearBackground("#050311", "#100726");
        const centerX = width / 2;
        const centerY = height / 2;
        for (let ring = 0; ring < 7; ring += 1) {
          ctx.beginPath();
          ctx.strokeStyle = ring % 2 === 0 ? "rgba(156,107,255,0.55)" : "rgba(82,182,255,0.45)";
          ctx.lineWidth = 2.5;
          ctx.arc(centerX, centerY, 60 + ring * 34 + Math.sin(progress * 6 + ring) * 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let point = 0; point < 18; point += 1) {
          const orbit = 60 + (point % 6) * 34;
          const angle = progress * Math.PI * 4 + point * 0.7;
          const x = centerX + Math.cos(angle) * orbit;
          const y = centerY + Math.sin(angle) * orbit;
          ctx.beginPath();
          ctx.fillStyle = point % 2 === 0 ? "#d7c2ff" : "#6ff5ff";
          ctx.arc(x, y, 4 + (point % 3), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function drawStarfield() {
        clearBackground("#01030c", "#070d1f");
        for (let star = 0; star < 240; star += 1) {
          const depth = ((star * 0.013) + progress * 0.8) % 1;
          const x = ((Math.sin(star * 19.3) + 1) * 0.5) * width;
          const y = ((Math.cos(star * 13.7) + 1) * 0.5) * height;
          const radius = 0.8 + (1 - depth) * 3.5;
          const offsetX = (x - width / 2) * progress * 0.12;
          const offsetY = (y - height / 2) * progress * 0.12;
          ctx.globalAlpha = 0.2 + (1 - depth) * 0.7;
          ctx.beginPath();
          ctx.fillStyle = "#d5e9ff";
          ctx.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      const renderers = {
        "effects/aurora-flow": drawAuroraFlow,
        "effects/autumn-leaves": drawAutumnLeaves,
        "effects/laser-tunnel": drawLaserTunnel,
        "effects/lightning": drawLightning,
        "effects/matrix-rain": drawMatrixRain,
        "effects/neon-grid": drawNeonGrid,
        "effects/petals": drawPetals,
        "effects/snowfall": drawSnowfall,
        "music/equalizer-bars": drawEqualizerBars,
        "music/orbit-rings": drawOrbitRings,
        "particle/blackhole": drawBlackHole,
        "particle/starfield": drawStarfield,
      };

      const render = renderers[templateId] || drawSnowfall;
      render();

      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "12px monospace";
      ctx.fillText(\`\${templateId} | frame \${frameIndex + 1}/\${frameCount} | \${fps}fps | \${durationSec}s\`, 20, height - 24);
    })();
  </script>
</body>
</html>`;
}

export async function runVisualRender(
  input: {
    fps?: number;
    height?: number;
    htmlDocument?: string;
    params?: Record<string, boolean | number | string>;
    width?: number;
    template: string;
    durationSec: number;
    rootDir?: string;
    outputDir?: string;
    simulate?: boolean;
  },
  dependencies: {
    browserRenderer?: VisualBrowserRenderer;
    ffmpeg?: Pick<FFmpegBackend, "execute">;
  } = {},
): Promise<{
    fps?: number;
    frame_count?: number;
    operation: "visual-render";
    output_path: string;
    request_id: string;
    status: "simulated" | "completed";
    template: string;
  }> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const requestId = createRequestId({
    durationSec: input.durationSec,
    template: input.template,
  });
  const outputPath = path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${requestId}-visual-render.mp4`,
  );
  const template = getVisualTemplate(input.template);

  if (input.simulate !== false) {
    return {
      operation: "visual-render",
      output_path: outputPath,
      request_id: requestId,
      status: "simulated",
      template: input.template,
    };
  }

  const fps = Math.max(1, Math.round(input.fps ?? 12));
  const width = Math.max(320, Math.round(input.width ?? 1280));
  const height = Math.max(320, Math.round(input.height ?? 720));
  const frameCount = Math.max(1, Math.round(Math.max(1, input.durationSec) * fps));
  const workDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-visual-"));
  const frameDir = path.join(workDir, "frames");
  const templateFilePath = path.join(workDir, `${input.template.replace(/[\\/]/g, "-")}.html`);
  const framePattern = path.join(frameDir, "frame_%05d.png");
  const browserRenderer = dependencies.browserRenderer ?? new HeadlessBrowserRenderer();
  const htmlDocument = input.htmlDocument ?? buildVisualTemplateDocument({
    template: input.template,
    ...(input.params ? { params: input.params } : {}),
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(frameDir, { recursive: true });
  await writeFile(templateFilePath, htmlDocument, "utf8");

  try {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const framePath = path.join(frameDir, `frame_${String(frameIndex).padStart(5, "0")}.png`);
      const frameUrl = buildVisualFrameUrl(templateFilePath, {
        durationSec: input.durationSec,
        fps,
        frameCount,
        frameIndex,
        height,
        template: input.template,
        width,
        ...(input.params ? { params: input.params } : {}),
      });

      await browserRenderer.renderFrame({
        framePath,
        frameUrl,
        height,
        width,
      });
    }

    await (dependencies.ffmpeg ?? new FFmpegBackend()).execute({
      args: [
        "-y",
        "-framerate",
        String(fps),
        "-i",
        framePattern,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        outputPath,
      ],
    });
  } finally {
    await rm(workDir, { force: true, recursive: true }).catch(() => undefined);
  }

  return {
    fps,
    frame_count: frameCount,
    operation: "visual-render",
    output_path: outputPath,
    request_id: requestId,
    status: "completed",
    template: input.template,
  };
}

function buildVisualFrameUrl(
  templateFilePath: string,
  input: {
    durationSec: number;
    fps: number;
    frameCount: number;
    frameIndex: number;
    height: number;
    params?: Record<string, boolean | number | string>;
    template: string;
    width: number;
  },
): string {
  const params = input.params ? encodeURIComponent(JSON.stringify(input.params)) : "%7B%7D";
  return `${pathToFileURL(templateFilePath).href}?frame=${input.frameIndex}&frames=${input.frameCount}&fps=${input.fps}&duration=${input.durationSec}&template=${input.template}&width=${input.width}&height=${input.height}&params=${params}`;
}
