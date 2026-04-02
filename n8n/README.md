# MediaForge n8n Integration

This directory contains import-ready n8n workflows for driving MediaForge from automation.

## Included workflows

- `workflow-mediaforge-cli.json`
  - Runs `forge pipeline auto-extend` through `Execute Command`
- `workflow-mediaforge-webhook.json`
  - Calls the local MediaForge dashboard API and polls job status
- `workflow-openclaw-monitor.json`
  - Checks the local OpenClaw snapshot and restarts the bridge when unhealthy
- `workflow-daily-report.json`
  - Sends a simple end-of-day summary from queue/output/OpenClaw data

## Required environment variables

- `MEDIAFORGE_PATH`
  - Example: `C:/Users/sinmb/workspace/mediaforge`
- `MEDIAFORGE_DASHBOARD_URL`
  - Example: `http://127.0.0.1:3000`

## Optional environment variables

- `OPENCLAW_SNAPSHOT_URL`
  - Defaults to `<MEDIAFORGE_DASHBOARD_URL>/api/runtime/openclaw`
- `TELEGRAM_CHAT_ID`
  - Needed only if you enable Telegram nodes after import

## Import steps

1. Open n8n.
2. Import one or more workflow JSON files from this directory.
3. Set the environment variables above.
4. Disable or configure Telegram nodes depending on your setup.
5. Run the workflow manually once before scheduling it.

## CLI workflow input example

```json
{
  "desc": "갈색 바위 괴물이 자기 머리를 두드리다가 눈이 빙글빙글 돈다",
  "model": "skyreels-ref2v",
  "referencePaths": [
    "characters/noggin-front.png",
    "characters/noggin-side.png"
  ],
  "candidates": 2,
  "seedDuration": 10,
  "extendLoops": 1,
  "extendDuration": 5,
  "quality": "production",
  "autoPick": "best",
  "outputPath": "outputs/n8n-auto-extend.mp4",
  "withAudio": true
}
```

## Dashboard workflow

The webhook workflow queues work through:

- `POST /api/video/auto-extend`
- `GET /api/jobs`

Use this when you want MediaForge's local queue and verification metadata instead of a direct CLI call.

## OpenClaw restart handler

`webhook-handlers/restart-openclaw.ps1` prefers the packaged desktop runtime and falls back to:

```powershell
npm run engine -- dashboard
```

## Notes

- These workflow templates are designed for Windows + PowerShell.
- They only automate existing MediaForge CLI/API surfaces.
- You can duplicate the pattern for prompt/image/audio routes later if needed.
