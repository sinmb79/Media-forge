export interface StudioNavItem {
  href: string;
  id: string;
  label: string;
  section: "workspace" | "library" | "system";
}

export interface CreationSurface {
  id: string;
  title: string;
  description: string;
  href: string;
  accent: string;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
}

export const dashboardNavItems: StudioNavItem[] = [
  { id: "dashboard", label: "대시보드", href: "/", section: "workspace" },
  { id: "image", label: "이미지", href: "/image", section: "workspace" },
  { id: "video", label: "비디오", href: "/video", section: "workspace" },
  { id: "storyboard", label: "스토리보드", href: "/video/storyboard", section: "workspace" },
  { id: "edit", label: "편집", href: "/edit", section: "workspace" },
  { id: "visual", label: "비주얼", href: "/visual", section: "workspace" },
  { id: "audio", label: "오디오", href: "/audio", section: "workspace" },
  { id: "scenario", label: "시나리오", href: "/scenario", section: "workspace" },
  { id: "webtoon", label: "웹툰", href: "/webtoon", section: "workspace" },
  { id: "characters", label: "캐릭터", href: "/characters", section: "library" },
  { id: "assets", label: "에셋", href: "/assets", section: "library" },
  { id: "queue", label: "큐", href: "/queue", section: "system" },
  { id: "settings", label: "설정", href: "/settings", section: "system" },
];

export const creationSurfaces: CreationSurface[] = [
  {
    id: "image",
    title: "이미지 스튜디오",
    description: "로컬 SDXL, Flux 워크플로우로 프롬프트, 스케치, 스타일 생성을 진행합니다.",
    href: "/image",
    accent: "from-emerald-400/60 via-cyan-400/30 to-transparent",
  },
  {
    id: "video",
    title: "비디오 스튜디오",
    description: "Wan, LTX 파이프라인으로 이미지 투 비디오, 텍스트 투 비디오, 모션 제어를 실행합니다.",
    href: "/video",
    accent: "from-lime-400/50 via-emerald-500/20 to-transparent",
  },
  {
    id: "storyboard",
    title: "스토리보드",
    description: "Kling 스타일의 멀티씬 계획을 로컬 큐 실행과 함께 구성합니다.",
    href: "/video/storyboard",
    accent: "from-violet-400/50 via-sky-400/20 to-transparent",
  },
  {
    id: "edit",
    title: "편집 도구",
    description: "FFmpeg와 AI 보정 도구를 로컬 CapCut 스타일 선반처럼 묶어둔 공간입니다.",
    href: "/edit",
    accent: "from-orange-400/50 via-red-400/20 to-transparent",
  },
  {
    id: "visual",
    title: "비주얼 엔진",
    description: "코드 기반 모션 씬, 파티클 프리셋, 렌더링 실험을 한곳에서 다룹니다.",
    href: "/visual",
    accent: "from-fuchsia-400/50 via-indigo-400/20 to-transparent",
  },
  {
    id: "audio",
    title: "오디오",
    description: "TTS, 전사, 자막 번인, 사운드트랙 구성을 실행합니다.",
    href: "/audio",
    accent: "from-sky-400/50 via-cyan-400/20 to-transparent",
  },
  {
    id: "scenario",
    title: "시나리오 파이프라인",
    description: "블로그에서 생성된 시나리오를 웹툰, 숏폼, 롱폼으로 자동 변환합니다.",
    href: "/scenario",
    accent: "from-amber-400/50 via-orange-400/20 to-transparent",
  },
  {
    id: "webtoon",
    title: "웹툰 스튜디오",
    description: "시나리오를 패널별 또는 페이지별 웹툰 이미지로 생성합니다.",
    href: "/webtoon",
    accent: "from-pink-400/50 via-rose-400/20 to-transparent",
  },
  {
    id: "characters",
    title: "캐릭터 관리",
    description: "캐릭터를 등록하고 레퍼런스 이미지로 모든 씬에서 동일 외형을 유지합니다.",
    href: "/characters",
    accent: "from-blue-400/50 via-indigo-400/20 to-transparent",
  },
  {
    id: "assets",
    title: "에셋 라이브러리",
    description: "테마, LoRA, 프롬프트 팩, 배경, 재사용 가능한 로컬 레퍼런스를 모아둡니다.",
    href: "/assets",
    accent: "from-zinc-300/40 via-zinc-500/10 to-transparent",
  },
];

export const quickActions: QuickAction[] = [
  {
    id: "doctor",
    label: "Doctor 실행",
    description: "로컬 백엔드, VRAM, RAM, 디스크 상태를 확인합니다.",
    href: "/queue?action=doctor",
  },
  {
    id: "prompt",
    label: "프롬프트 생성",
    description: "한국어 장면 설명을 SDXL, Wan 프롬프트 번들로 변환합니다.",
    href: "/image?panel=prompt",
  },
  {
    id: "image",
    label: "이미지 생성",
    description: "로컬 이미지 생성과 스케치 워크플로우로 바로 이동합니다.",
    href: "/image",
  },
  {
    id: "video",
    label: "비디오 생성",
    description: "로컬 GPU 상태와 함께 Wan, LTX 생성 화면을 엽니다.",
    href: "/video",
  },
  {
    id: "visual",
    label: "비주얼 렌더",
    description: "GPU 없이도 실행 가능한 코드 비주얼 엔진을 엽니다.",
    href: "/visual",
  },
  {
    id: "queue",
    label: "큐 열기",
    description: "실행 중인 작업, 검증 상태, 생성 산출물을 확인합니다.",
    href: "/queue",
  },
];

export const creationSurfaceIds = creationSurfaces.map((surface) => surface.id);
export const quickActionIds = quickActions.map((action) => action.id);
