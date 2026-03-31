import { runBrowseVideoSessions } from "../forge/video/browse.js";
import { composeSeedSession } from "../forge/video/compose.js";
import { runLongVideoGeneration } from "../forge/video/long-video.js";
import { runVideoFromImage } from "../forge/video/from-image.js";
import { runMotionVideo } from "../forge/video/motion.js";
import { runSkyReelsRef2V } from "../forge/video/ref2v.js";
import { runVideoReference } from "../forge/video/reference.js";
import { runVideoRestyle } from "../forge/video/restyle.js";
import { runVideoSeedSession } from "../forge/video/seed.js";
import { SeedSessionManager } from "../forge/video/seed-session.js";
import { runStoryboardVideo } from "../forge/video/storyboard.js";
import { runSkyReelsTalkingAvatar } from "../forge/video/talking.js";
import { runVideoFromText } from "../forge/video/from-text.js";
import { runSessionVideoExtend, runSkyReelsVideoExtend } from "../forge/video/extend.js";
import { runTalkingScenePipeline } from "../forge/pipeline/talking-scene.js";
import type { ForgeVideoModel, ForgeVideoQuality } from "../forge/video/build-video-generation-plan.js";

export async function forgeVideoCommand(
  positionals: string[],
  options: {
    flags?: Set<string>;
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, maybeInput] = positionals;

  if (subcommand === "seed") {
    const desc = options.optionValues.desc?.[0];
    const fromImagePath = options.optionValues["from-image"]?.[0];
    const model = (options.optionValues.model?.[0] ?? "skyreels-ref2v") as ForgeVideoModel;
    const quality = (options.optionValues.quality?.[0] ?? "production") as ForgeVideoQuality;
    const outputDir = options.optionValues.output?.[0];

    if (!outputDir || (!desc && !fromImagePath)) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video seed --output <session-dir> [--desc <description>] [--from-image <image>] [--model <wan22|ltx2|skyreels-ref2v>] [--refs <ref1,ref2>] [--candidates <count>] [--duration <seconds>] [--simulate] [--json]\n",
      };
    }

    const result = await runVideoSeedSession({
      candidates: Number(options.optionValues.candidates?.[0] ?? "4"),
      desc_ko: desc ?? `Seed from ${fromImagePath}`,
      duration_sec: Number(options.optionValues.duration?.[0] ?? "10"),
      ...(fromImagePath ? { fromImagePath } : {}),
      model,
      outputDir,
      quality,
      referencePaths: splitPathList(options.optionValues.refs?.[0] ?? ""),
      rootDir: process.cwd(),
      simulate: options.simulate,
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Seed session ${result.session_dir}: ${result.status}\n`,
    };
  }

  if (subcommand === "pick") {
    const sessionDir = options.optionValues.session?.[0];
    const selected = splitPathList(options.optionValues.select?.[0] ?? "");

    if (!sessionDir || selected.length === 0) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video pick --session <session-dir> --select <seed-001[,seed-002]> [--json]\n",
      };
    }

    const manager = await SeedSessionManager.load(sessionDir);
    await manager.pick(selected);
    const result = {
      selected,
      session_dir: manager.sessionDir,
      status: "updated" as const,
    };

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Picked ${selected.join(", ")} in ${manager.sessionDir}\n`,
    };
  }

  if (subcommand === "browse") {
    const result = await runBrowseVideoSessions({
      rootDir: process.cwd(),
      ...(options.optionValues.session?.[0] ? { sessionDir: options.optionValues.session[0] } : {}),
      ...(options.optionValues.root?.[0] ? { sessionsRootDir: options.optionValues.root[0] } : {}),
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : ("sessions" in result
          ? `Sessions: ${result.sessions.length}\n`
          : `Session: ${result.session_dir}\n`),
    };
  }

  if (subcommand === "compose") {
    const sessionDir = options.optionValues.session?.[0];
    const sourceId = options.optionValues.source?.[0];

    if (!sessionDir || !sourceId) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video compose --session <session-dir> --source <seed-001|ext-001-001> [--output <video.mp4>] [--with-audio] [--upscale <factor>] [--simulate] [--json]\n",
      };
    }

    const result = await composeSeedSession({
      ...(options.optionValues.output?.[0] ? { outputPath: options.optionValues.output[0] } : {}),
      rootDir: process.cwd(),
      sessionDir,
      simulate: options.simulate,
      sourceId,
      ...(options.flags?.has("with-audio") ? { withAudio: true } : {}),
      ...(options.optionValues.upscale?.[0] ? { upscale: Number(options.optionValues.upscale[0]) } : {}),
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Composed ${result.output_path}\n`,
    };
  }

  if (subcommand === "from-image" && maybeInput) {
    const desc = options.optionValues.desc?.[0];
    const model = (options.optionValues.model?.[0] ?? "wan22") as ForgeVideoModel;
    const quality = (options.optionValues.quality?.[0] ?? "production") as ForgeVideoQuality;

    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video from-image <image> --model <wan22|ltx2> --desc <description> [--quality <draft|production>] [--simulate] [--json]\n",
      };
    }

    const result = await runVideoFromImage({
      desc_ko: desc,
      imagePath: maybeInput,
      model,
      quality,
      simulate: options.simulate,
    });

    return renderVideoResult(result, options.json, "Image-to-video");
  }

  if (subcommand === "from-text") {
    const desc = options.optionValues.desc?.[0];
    const quality = (options.optionValues.quality?.[0] ?? "production") as ForgeVideoQuality;

    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video from-text --desc <description> [--quality <draft|production>] [--simulate] [--json]\n",
      };
    }

    const result = await runVideoFromText({
      desc_ko: desc,
      quality,
      simulate: options.simulate,
    });

    return renderVideoResult(result, options.json, "Text-to-video");
  }

  if (subcommand === "ref2v" && maybeInput) {
    const desc = options.optionValues.desc?.[0];
    const quality = (options.optionValues.quality?.[0] ?? "production") as ForgeVideoQuality;

    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video ref2v <ref1[,ref2,...]> --desc <description> [--quality <draft|production>] [--duration <seconds>] [--simulate] [--json]\n",
      };
    }

    const result = await runSkyReelsRef2V({
      desc_ko: desc,
      duration_sec: Number(options.optionValues.duration?.[0] ?? "5"),
      quality,
      referencePaths: splitPathList(maybeInput),
      simulate: options.simulate,
    });

    return renderVideoResult(result, options.json, "SkyReels Ref2V");
  }

  if (subcommand === "talking" && maybeInput) {
    const desc = options.optionValues.desc?.[0];
    const audioPath = options.optionValues.audio?.[0];
    const text = options.optionValues.text?.[0];
    const quality = (options.optionValues.quality?.[0] ?? "production") as ForgeVideoQuality;

    if (!desc || (!audioPath && !text)) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video talking <portrait> (--audio <audio.mp3> | --text <dialogue>) --desc <description> [--voice-preset <name>] [--voice-dir <path>] [--quality <draft|production>] [--duration <seconds>] [--simulate] [--json]\n",
      };
    }

    const result = audioPath
      ? await runSkyReelsTalkingAvatar({
        audioPath,
        desc_ko: desc,
        duration_sec: Number(options.optionValues.duration?.[0] ?? "10"),
        portraitPath: maybeInput,
        quality,
        simulate: options.simulate,
      })
      : await runTalkingScenePipeline({
        desc_ko: desc,
        duration_sec: Number(options.optionValues.duration?.[0] ?? "10"),
        lang: options.optionValues.lang?.[0] ?? "ko",
        narrationModel: options.optionValues["narration-model"]?.[0] === "tts-1.5b" ? "tts-1.5b" : "realtime-0.5b",
        portraitPath: maybeInput,
        quality,
        rootDir: process.cwd(),
        simulate: options.simulate,
        ...(text ? { text } : {}),
        ...(options.optionValues.voice?.[0] ? { voice: options.optionValues.voice[0] } : {}),
        ...(options.optionValues["voice-dir"]?.[0] ? { voiceRootDir: options.optionValues["voice-dir"][0] } : {}),
        ...(options.optionValues["voice-preset"]?.[0] ? { voicePresetName: options.optionValues["voice-preset"][0] } : {}),
      });

    return renderVideoResult(result, options.json, "SkyReels Talking Avatar");
  }

  if (subcommand === "extend" && options.optionValues.session?.[0] && options.optionValues.source?.[0]) {
    const desc = options.optionValues.desc?.[0];
    const quality = (options.optionValues.quality?.[0] ?? "production") as ForgeVideoQuality;

    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video extend --session <session-dir> --source <seed-001|ext-001-001> --desc <description> [--loops <count>] [--overlap <frames>] [--duration <seconds>] [--simulate] [--json]\n",
      };
    }

    const result = await runSessionVideoExtend({
      desc_ko: desc,
      duration_sec: Number(options.optionValues.duration?.[0] ?? "5"),
      loops: Number(options.optionValues.loops?.[0] ?? "1"),
      overlap_frames: Number(options.optionValues.overlap?.[0] ?? "8"),
      quality,
      rootDir: process.cwd(),
      sessionDir: options.optionValues.session[0],
      simulate: options.simulate,
      sourceId: options.optionValues.source[0],
    });

    return {
      exitCode: 0,
      output: options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Session extension ${result.extension_id}: ${result.status}\n`,
    };
  }

  if (subcommand === "extend" && maybeInput) {
    const desc = options.optionValues.desc?.[0];
    const quality = (options.optionValues.quality?.[0] ?? "production") as ForgeVideoQuality;

    if (!desc) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video extend <source-video> --desc <description> [--overlap <frames>] [--quality <draft|production>] [--duration <seconds>] [--simulate] [--json]\n",
      };
    }

    const result = await runSkyReelsVideoExtend({
      desc_ko: desc,
      duration_sec: Number(options.optionValues.duration?.[0] ?? "5"),
      overlap_frames: Number(options.optionValues.overlap?.[0] ?? "8"),
      quality,
      simulate: options.simulate,
      sourceVideoPath: maybeInput,
    });

    return renderVideoResult(result, options.json, "SkyReels Extension");
  }

  if (subcommand === "long") {
    const storyboardPath = options.optionValues.storyboard?.[0];

    if (!storyboardPath) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video long --storyboard <storyboard.json> [--simulate] [--json]\n",
      };
    }

    const result = await runLongVideoGeneration({
      simulate: options.simulate,
      storyboardPath,
    });

    if (options.json) {
      return {
        exitCode: 0,
        output: `${JSON.stringify(result, null, 2)}\n`,
      };
    }

    return {
      exitCode: 0,
      output: [
        `Long-video status: ${result.status}`,
        `Workflow: ${result.workflow_id}`,
        `Scenes: ${result.scene_count}`,
        `Output: ${result.output_path}`,
      ].join("\n") + "\n",
    };
  }

  if (subcommand === "storyboard" && maybeInput) {
    const result = await runStoryboardVideo({
      rootDir: process.cwd(),
      simulate: options.simulate,
      storyboardPath: maybeInput,
    });

    if (options.json) {
      return {
        exitCode: 0,
        output: `${JSON.stringify(result, null, 2)}\n`,
      };
    }

    return {
      exitCode: 0,
      output: [
        `Storyboard status: ${result.status}`,
        `Shots: ${result.shot_count}`,
        `Transition: ${result.transition}`,
        `Output: ${result.output_path}`,
      ].join("\n") + "\n",
    };
  }

  if (subcommand === "motion" && maybeInput) {
    const action = options.optionValues.action?.[0];
    const duration = Number(options.optionValues.duration?.[0] ?? "5");

    if (!action) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video motion <image> --action <preset|custom> [--duration <seconds>] [--simulate] [--json]\n",
      };
    }

    const result = await runMotionVideo({
      action,
      direction: options.optionValues.direction?.[0] === "mirror" ? "mirror" : "forward",
      duration_sec: duration,
      image_path: maybeInput,
      simulate: options.simulate,
      ...(options.optionValues.custom?.[0] ? { custom_motion: options.optionValues.custom[0] } : {}),
    });

    return renderVideoResult(result, options.json, "Motion video");
  }

  if (subcommand === "restyle" && maybeInput) {
    const prompt = options.optionValues.prompt?.[0];

    if (!prompt) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video restyle <video> --prompt <description> [--style <style>] [--simulate] [--json]\n",
      };
    }

    const result = await runVideoRestyle({
      inputPath: maybeInput,
      prompt,
      simulate: options.simulate,
      ...(options.optionValues.style?.[0] ? { style: options.optionValues.style[0] } : {}),
    });

    return renderVideoResult(result, options.json, "Video restyle");
  }

  if (subcommand === "reference" && maybeInput) {
    const prompt = options.optionValues.prompt?.[0];

    if (!prompt) {
      return {
        exitCode: 1,
        output: "Usage: engine forge video reference <reference-video> --prompt <description> [--simulate] [--json]\n",
      };
    }

    const result = await runVideoReference({
      prompt,
      referencePath: maybeInput,
      simulate: options.simulate,
    });

    return renderVideoResult(result, options.json, "Reference video");
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge video <seed|pick|browse|compose|from-image|from-text|ref2v|talking|extend|long|storyboard|motion|restyle|reference> ...\n",
  };
}

function renderVideoResult(
  result: {
    audio_path?: string;
    output_path: string;
    resolved_preset?: unknown;
    status: string;
    workflow_id: string;
  },
  json: boolean,
  label: string,
): { exitCode: number; output: string } {
  if (json) {
    return {
      exitCode: 0,
      output: `${JSON.stringify(result, null, 2)}\n`,
    };
  }

  return {
    exitCode: 0,
    output: [
      `${label} status: ${result.status}`,
      `Workflow: ${result.workflow_id}`,
      ...(result.audio_path ? [`Audio: ${result.audio_path}`] : []),
      `Output: ${result.output_path}`,
    ].join("\n") + "\n",
  };
}

function splitPathList(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
