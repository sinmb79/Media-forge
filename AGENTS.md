# MediaForge — 에이전트 운영 가이드 (v0.3.0)

> 이 문서는 OpenClaw 에이전트(`mediaforge`)가 참조하는 설명서다.

## 시스템 개요

**MediaForge**는 로컬 GPU(RTX 4080 Super) 기반 이미지/영상/오디오 생성 엔진이다.
LLM 프롬프트 생성은 OpenClaw 서버를 경유하여 ChatGPT가 처리한다.

## 연결된 에이전트

| 에이전트 | 역할 | 프로젝트 |
|----------|------|----------|
| `main` | 글 수집, 작성, 발행, 시나리오 생성 | blog-writer-blog (`C:\Users\sinmb\workspace\blog-writer-blog`) |
| `mediaforge` | 이미지/영상/오디오 생성, 웹툰/숏폼/롱폼 제작 | mediaforge (이 프로젝트) |

---

## OpenClaw Bridge API

mediaforge는 HTTP REST 서버(`http://127.0.0.1:4318`)로 동작하며, 모든 에이전트는 `/invoke`로 명령을 전달한다.

### 공통 호출 형식

```http
POST http://127.0.0.1:4318/invoke
Content-Type: application/json

{
  "action": "<action_id>",
  "input": { ... }
}
```

### 지원 Action 목록

| Action | 설명 | 주요 입력 |
|--------|------|-----------|
| `scenario.ingest` | 시나리오 JSON → 웹툰/숏폼/롱폼 파이프라인 실행 | `scenarioPath`, `simulate` |
| `character.create` | 캐릭터 등록 (reference image 포함) | `name`, `description`, `reference_images`, `type` |
| `character.list` | 등록된 캐릭터 목록 조회 | (없음) |
| `character.get` | 캐릭터 상세 조회 | `id` 또는 `name` |
| `llm.generate` | ChatGPT 경유 텍스트 생성 | `prompt`, `system_prompt`, `model` |
| `prompt.build` | 한국어 설명 → 영어 SDXL/Wan2.2 프롬프트 변환 | `desc_ko`, `theme`, `model` |
| `image.generate` | 텍스트 → 이미지 생성 (SDXL/Flux) | `prompt`, `model`, `resolution`, `aspect_ratio` |
| `image.sketch` | 스케치 → 이미지 (ControlNet) | `desc_ko`, `sketchPath` |
| `video.from-text` | 텍스트 → 영상 (Wan2.2/LTX2) | `desc_ko`, `model`, `quality` |
| `video.from-image` | 이미지 → 영상 | `desc_ko`, `imagePath`, `model`, `quality` |
| `doctor` | 시스템 진단 | (없음) |
| `probe` | 백엔드 상태 확인 | (없음) |

---

## 시나리오 파이프라인 (v0.3.0 신규)

### 전체 흐름

```
blog-writer (main 에이전트)
    └── 시나리오 JSON 생성 → data/scenarios/*.json
                                    ↓
mediaforge (이 에이전트)
    └── scenario.ingest
            ├── 1. 캐릭터 해석/자동생성
            │       ├── character_id 있으면 → DB에서 조회
            │       └── 없으면 → LLM으로 프롬프트 생성 → SDXL로 reference image → DB 등록
            ├── 2. 웹툰 생성 (output_formats에 "webtoon" 포함 시)
            │       ├── panel 모드: 씬별 패널 이미지 → 페이지 조합
            │       └── page 모드: 씬별 통이미지
            ├── 3. 숏폼 스토리보드 (output_formats에 "shortform" 포함 시)
            │       └── LLM이 핵심 3-5장면 선별 → 60초 이내 영상 계획
            └── 4. 롱폼 스토리보드 (output_formats에 "longform" 포함 시)
                    └── 전체 장면 → 전체 길이 영상 계획
```

### 시나리오 JSON 형식 (blog-writer → mediaforge)

```json
{
  "schema_version": "0.1",
  "title": "시나리오 제목",
  "synopsis": "전체 줄거리 요약",
  "characters": [
    {
      "name": "공주",
      "description": "20대 여성, 긴 검은 머리, 하얀 드레스",
      "character_id": "char-princess",
      "reference_image": "assets/characters/princess-ref.png",
      "voice_preset": "ko-KR-SunHiNeural"
    }
  ],
  "scenes": [
    {
      "scene_number": 1,
      "description": "공주가 성에서 깨어난다",
      "dialogue": [
        { "speaker": "공주", "text": "오늘은 뭔가 특별한 날이야", "emotion": "happy" }
      ],
      "duration_hint_sec": 5,
      "camera": "push_in",
      "emotion": "calm",
      "characters_in_scene": ["공주"]
    }
  ],
  "output_formats": ["webtoon", "shortform", "longform"],
  "style": "anime",
  "language": "ko"
}
```

### 시나리오 호출 예시

```http
POST http://127.0.0.1:4318/invoke
{
  "action": "scenario.ingest",
  "input": {
    "scenarioPath": "C:/Users/sinmb/workspace/blog-writer-blog/data/scenarios/episode-01.json",
    "simulate": false
  }
}
```

### 응답 형식

```json
{
  "action": "scenario.ingest",
  "status": "completed",
  "output": {
    "scenario": { "title": "...", "scenes": [...] },
    "resolved_characters": [
      { "name": "공주", "character_id": "char-princess", "newly_created": false, "reference_images": ["..."] }
    ],
    "planned_outputs": [
      { "format": "webtoon", "scene_count": 5, "status": "completed", "output_path": "outputs/webtoon/..." },
      { "format": "shortform", "scene_count": 3, "estimated_duration_sec": 45, "status": "planned", "output_path": "outputs/shortform/...-shortform.json" },
      { "format": "longform", "scene_count": 10, "estimated_duration_sec": 120, "status": "planned", "output_path": "outputs/longform/...-longform.json" }
    ],
    "storyboard_path": "outputs/shortform/...-shortform.json"
  }
}
```

---

## 캐릭터 관리

캐릭터를 등록하면 reference image가 모든 씬에서 재사용되어 동일한 외형이 유지된다.

### 캐릭터 생성

```http
POST http://127.0.0.1:4318/invoke
{
  "action": "character.create",
  "input": {
    "name": "공주",
    "description": "20대 여성, 긴 검은 머리, 하얀 드레스, 파란 눈",
    "type": "anime",
    "reference_images": ["C:/path/to/princess-ref.png"]
  }
}
```

reference_image를 제공하지 않으면, `scenario.ingest` 시 LLM으로 프롬프트를 생성하고 SDXL로 캐릭터 reference image를 자동 생성한다.

### 캐릭터 조회

```http
POST http://127.0.0.1:4318/invoke
{ "action": "character.list" }
```

```http
POST http://127.0.0.1:4318/invoke
{ "action": "character.get", "input": { "name": "공주" } }
```

### 캐릭터 일관성 원리

1. 캐릭터의 `reference_images`가 `StoryboardSubject`로 전달됨
2. 각 영상 shot에서 reference image를 사용하여 Ref2V/I2V 생성
3. 동일 캐릭터가 모든 장면에서 같은 외형으로 등장

---

## LLM 설정

프롬프트 생성은 OpenClaw 서버를 경유하여 ChatGPT가 처리한다.

| 설정 | 값 | 설명 |
|------|-----|------|
| `llm.provider` | `"openclaw"` (기본) | OpenClaw → ChatGPT |
| `llm.provider` | `"ollama"` | 로컬 Ollama fallback |
| `llm.default_model` | `"gpt-4o"` | ChatGPT 모델 |
| `llm.openclaw_url` | `"http://127.0.0.1:4318"` | OpenClaw 서버 주소 |

설정 파일: `config/defaults.yaml`

---

## CLI 명령어

```bash
# 시나리오 파이프라인
engine scenario ingest <scenario.json> [--simulate] [--json]

# 캐릭터 관리
engine scenario character create --name "공주" --desc "긴 머리 여성" --type anime [--ref image.png]
engine scenario character list [--json]
engine scenario character get <id-or-name> [--json]

# 프롬프트 생성
engine forge prompt build --desc "한국어 설명" --theme cinematic [--json]

# 이미지 생성
engine forge image generate --prompt "English prompt" --model sdxl --resolution 2k [--json]

# 영상 생성
engine forge video from-text --desc "장면 설명" --model wan22 --quality production [--json]

# 시스템 진단
engine doctor [--json]
```

---

## 포맷별 처리 가이드

| 포맷 | 작업 | 기본 설정 |
|------|------|-----------|
| `webtoon` | scene별 `image.generate` → 패널 조합 | 3:4, sdxl, anime |
| `shortform` | 핵심 장면 선별 → 스토리보드 → `runStoryboardVideo` | 9:16, wan22, 60초 이내 |
| `longform` | 전체 장면 → 스토리보드 → `runStoryboardVideo` | 16:9, wan22, 전체 길이 |

---

## The 4th Path 콘텐츠 전체 흐름

```
아이디어/뉴스
    ↓
[main 에이전트] blog-writer-blog
    ├── collector_bot → 글감 수집
    ├── writer_bot → 블로그 원고 → Blogger 발행
    └── scenario_bot → 시나리오 JSON
                          ↓
                 data/scenarios/*.json
                          ↓
[mediaforge 에이전트] mediaforge
    ├── scenario.ingest → 캐릭터 등록 + 웹툰/숏폼/롱폼 생성
    ├── character.create → 캐릭터 등록 (reference image)
    ├── image.generate → 웹툰 패널
    ├── video.from-text → 영상 클립
    ├── audio tts → 나레이션
    └── pipeline → 완성 콘텐츠
```

---

## 시나리오 파일 위치

```
C:\Users\sinmb\workspace\blog-writer-blog\data\scenarios\*.json
```

## 백엔드 요구사항

| 백엔드 | 용도 | 필수 |
|--------|------|------|
| ComfyUI | 이미지/영상 생성 | O |
| edge-tts | 텍스트→음성 | O |
| FFmpeg | 영상 편집/병합 | O |
| Ollama | 로컬 LLM fallback | X |
| Python | 도구 실행 | O |
