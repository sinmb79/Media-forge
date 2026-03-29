# MediaForge

MediaForge는 기존 Shorts-engine을 확장해 만든 로컬 우선 미디어 제작 CLI입니다.  
핵심 목표는 "외부 API 없이", "기존 엔진은 깨지지 않게", "필요한 백엔드만 연결해서" 이미지, 영상, 편집, 오디오, 파이프라인 작업을 하나의 명령 체계로 묶는 것입니다.

## 프로젝트 원칙

- 기존 Shorts-engine 명령과 테스트는 유지합니다.
- 의존성 버전은 임의로 올리지 않습니다.
- AI 생성 경로는 로컬 백엔드 기준으로 설계합니다.
- 설치 자동화보다 진단과 경로 검증을 먼저 제공합니다.
- 공개 저장소에는 소스, 테스트, 설정, 문서만 올리고 로컬 산출물과 민감 데이터는 제외합니다.

## 주요 기능

MediaForge는 `engine forge` 네임스페이스 아래에서 다음 기능을 제공합니다.

- 백엔드 진단: `doctor`, `backend probe`, `paths validate`, `install`
- 프롬프트 생성: Ollama 기반 한국어 장면 설명 -> 이미지/영상 프롬프트 변환
- 이미지 생성: 스케치 -> SDXL + ControlNet Scribble 워크플로우
- 영상 생성: image-to-video, text-to-video, long-video
- 편집: cut, concat, join, resize, stabilize, upscale, interpolate, remove-watermark, remove-object
- 오디오: TTS, 전사, 자막 추가, BGM 추가, 오디오 분리
- 파이프라인: sketch-to-video, storyboard, sketch-to-long-video
- 학습/최적화: 프롬프트 피드백 저장, 성공 패턴 추천, VRAM 기반 메모리 전략 선택

## 설치

기본 요구 사항:

- Node.js 24 이상
- npm
- 선택 설치 백엔드: ComfyUI, FFmpeg, Python, Ollama, ProPainter, openai-whisper, edge-tts

프로젝트 설치:

```bash
npm install
```

테스트 실행:

```bash
npm test
```

## 시작 전 진단

실제 생성 작업 전에 아래 세 명령부터 실행하는 것을 권장합니다.

```bash
npm run engine -- forge doctor --json
npm run engine -- forge backend probe --json
npm run engine -- forge paths validate --json
```

특정 백엔드 설치 안내를 보고 싶다면:

```bash
npm run engine -- forge install comfyui --json
npm run engine -- forge install ollama --json
npm run engine -- forge install ffmpeg --json
```

`install` 명령은 자동 설치기가 아니라 공개 저장소 친화적인 설치 안내 명령입니다.  
실행 파일 이름, 예상 경로, 공식 설치 URL을 출력합니다.

## 기존 Shorts-engine 명령

기존 엔진 명령은 그대로 사용할 수 있습니다.

```bash
npm run engine -- run tests/fixtures/valid-low-cost-request.json --json
npm run engine -- prompt tests/fixtures/valid-low-cost-request.json --json
npm run engine -- render tests/fixtures/valid-low-cost-request.json --json
npm run engine -- publish tests/fixtures/valid-low-cost-request.json --json
npm run engine -- doctor --json
```

## MediaForge 명령 예시

### 1. 프롬프트 생성

한국어 설명을 로컬 Ollama 프롬프트 번들로 변환합니다.

```bash
npm run engine -- forge prompt build --desc "공주가 숲에서 나비를 쫓다가 마법의 호수를 발견한다" --theme fairy_tale --json
```

프롬프트 피드백 저장과 추천:

```bash
npm run engine -- forge prompt feedback result_001 --score 5 --theme fairy_tale --json
npm run engine -- forge prompt suggest --theme fairy_tale --json
```

### 2. 이미지 생성

스케치 이미지에서 SDXL 기반 이미지를 생성합니다.

```bash
npm run engine -- forge image sketch tests/fixtures/sketch-placeholder.png --desc "공주가 숲에서 나비를 쫓다가 마법의 호수를 발견한다" --json
```

### 3. 영상 생성

이미지 기반, 텍스트 기반, 장면 묶음 기반 영상 생성이 가능합니다.

```bash
npm run engine -- forge video from-image tests/fixtures/sketch-placeholder.png --model wan22 --desc "카메라가 천천히 전진한다" --quality production --json
npm run engine -- forge video from-text --desc "안개 낀 숲속의 마법 호수" --quality draft --json
npm run engine -- forge video long --storyboard tests/fixtures/storyboard-sample.json --json
```

### 4. 편집

FFmpeg, ComfyUI, ProPainter 래퍼를 통해 편집 작업을 수행합니다.

```bash
npm run engine -- forge edit join outputs --transition ai --json
npm run engine -- forge edit cut tests/fixtures/video-placeholder.mp4 --start 00:05 --end 00:15 --json
npm run engine -- forge edit resize tests/fixtures/video-placeholder.mp4 --ratio 9:16 --resolution 1080p --json
npm run engine -- forge edit upscale tests/fixtures/video-placeholder.mp4 --scale 2 --json
npm run engine -- forge edit interpolate tests/fixtures/video-placeholder.mp4 --fps 60 --json
npm run engine -- forge edit remove-watermark tests/fixtures/sketch-placeholder.png --json
npm run engine -- forge edit remove-object tests/fixtures/video-placeholder.mp4 --mask tests/fixtures/mask-placeholder.png --json
```

### 5. 오디오

TTS, 자막, 전사, BGM 추가, 오디오 분리 기능을 제공합니다.

```bash
npm run engine -- forge audio tts --text "안녕하세요" --lang ko --json
npm run engine -- forge audio transcribe tests/fixtures/video-placeholder.mp4 --lang ko --json
npm run engine -- forge audio add-subs tests/fixtures/video-placeholder.mp4 --subs tests/fixtures/subtitles-sample.srt --json
npm run engine -- forge audio add-bgm tests/fixtures/video-placeholder.mp4 --music tests/fixtures/audio-placeholder.mp3 --volume 0.3 --json
npm run engine -- forge audio separate tests/fixtures/video-placeholder.mp4 --json
```

### 6. 파이프라인

여러 단계를 묶어 한 번에 실행할 수 있습니다.

```bash
npm run engine -- forge pipeline sketch-to-video tests/fixtures/sketch-placeholder.png --desc "공주가 숲에서 나비를 쫓다가 마법의 호수를 발견한다" --json
npm run engine -- forge pipeline sketch-to-long-video tests/fixtures/sketch-placeholder.png --desc "공주가 숲에서 나비를 쫓다가 마법의 호수를 발견한다" --json
npm run engine -- forge pipeline storyboard tests/fixtures/storyboard-sample.json --json
```

## 설정 파일

주요 설정은 `config/` 아래에 있습니다.

- `config/hardware-profile.yaml`: GPU, CPU, RAM, 전략 정보
- `config/backend-paths.yaml`: 백엔드 탐색 경로와 실행 파일 정의
- `config/defaults.yaml`: 기본 포트, 기본 모델, 출력 경로

워크플로우 템플릿은 `src/forge/workflows/`에 있습니다.

## 내부 구조

MediaForge는 실행 경계를 분리해서 유지합니다.

1. `ForgePromptPlan`
2. `ForgeRenderPlan`
3. `ForgeExecutionJob`

이 구조 덕분에 프롬프트 생성, 워크플로우 선택, 실제 백엔드 실행을 분리해서 교체하거나 확장할 수 있습니다.

## 공개 배포 기준

이 저장소는 공개 배포를 염두에 두고 정리되어 있습니다.

- `node_modules/`, `dist/`, `data/`, `outputs/`는 Git 추적에서 제외합니다.
- `.env`, 인증 파일, 키, 인증서, 개인 메모는 업로드하지 않습니다.
- 테스트용 `.env.example`만 유지합니다.
- 공개 저장소에는 실행에 필요한 코드, 테스트, 문서, 설정만 포함합니다.

## 현재 상태

- MediaForge 명령군 구현 완료
- 테스트 통과
- 로컬 Ollama 실환경 스모크 테스트 확인
- ComfyUI, FFmpeg, Whisper, Edge TTS, ProPainter는 사용자 환경 설치 후 바로 연결 가능
