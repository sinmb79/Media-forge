export type LibraryCategory =
  | "subject"
  | "background"
  | "effect"
  | "motion"
  | "template"
  | "character"
  | "tool";

export interface StudioLibraryCard {
  id: string;
  category: LibraryCategory;
  title: string;
  subtitle: string;
  accent: string;
  tags: string[];
}

export const studioLibraryCatalog: StudioLibraryCard[] = [
  {
    id: "subject-fairy-princess",
    category: "subject",
    title: "동화 주인공",
    subtitle: "주인공 LoRA와 부드러운 시네마틱 조명",
    accent: "from-pink-500/50 via-orange-400/20 to-transparent",
    tags: ["portrait", "fairy_tale", "sdxl"],
  },
  {
    id: "subject-cyber-runner",
    category: "subject",
    title: "사이버 러너",
    subtitle: "Wan 클립용 스트리트웨어 모션 아이덴티티",
    accent: "from-cyan-500/50 via-blue-500/20 to-transparent",
    tags: ["character", "motion", "wan22"],
  },
  {
    id: "background-neon-city",
    category: "background",
    title: "네온 시티",
    subtitle: "비 내리는 골목, 반사되는 노면, 짙은 안개",
    accent: "from-sky-500/45 via-fuchsia-500/15 to-transparent",
    tags: ["background", "night", "city"],
  },
  {
    id: "background-mountain-lake",
    category: "background",
    title: "산속 호수",
    subtitle: "판타지 리빌용 와이드 풍경 플레이트",
    accent: "from-emerald-400/45 via-cyan-400/15 to-transparent",
    tags: ["landscape", "fantasy", "wide"],
  },
  {
    id: "effect-snowfall",
    category: "effect",
    title: "눈 내림 오버레이",
    subtitle: "겨울 장면용 루프형 파티클 레이어",
    accent: "from-slate-200/35 via-white/10 to-transparent",
    tags: ["overlay", "particles", "winter"],
  },
  {
    id: "effect-electric-burst",
    category: "effect",
    title: "전기 충격파",
    subtitle: "임팩트 플래시와 크로마 에너지 스윕",
    accent: "from-lime-400/45 via-emerald-400/15 to-transparent",
    tags: ["vfx", "impact", "energy"],
  },
  {
    id: "motion-push-in",
    category: "motion",
    title: "슬로우 푸시인",
    subtitle: "피사체로 천천히 다가가는 Kling 스타일 렌즈 움직임",
    accent: "from-lime-500/40 via-emerald-500/15 to-transparent",
    tags: ["camera", "wan22", "cinematic"],
  },
  {
    id: "motion-orbit",
    category: "motion",
    title: "시계 방향 오빗",
    subtitle: "얕은 심도 롤이 들어간 주인공 리빌 샷",
    accent: "from-violet-500/40 via-sky-400/15 to-transparent",
    tags: ["camera", "orbit", "hero"],
  },
  {
    id: "template-short-hook",
    category: "template",
    title: "숏폼 훅",
    subtitle: "세로형 주목도를 위한 3장면 스토리보드",
    accent: "from-amber-400/45 via-orange-500/15 to-transparent",
    tags: ["storyboard", "hook", "9:16"],
  },
  {
    id: "template-product-reveal",
    category: "template",
    title: "제품 리빌",
    subtitle: "쇼케이스 광고용 이미지, 모션, 편집 스택",
    accent: "from-indigo-500/40 via-cyan-500/15 to-transparent",
    tags: ["product", "ad", "pipeline"],
  },
  {
    id: "character-host",
    category: "character",
    title: "디지털 호스트",
    subtitle: "TTS 연계를 전제로 한 토킹헤드 프롬프트 시작점",
    accent: "from-rose-500/40 via-fuchsia-500/15 to-transparent",
    tags: ["avatar", "tts", "host"],
  },
  {
    id: "character-anime-guide",
    category: "character",
    title: "애니메 가이드",
    subtitle: "포즈 중심 모션을 위한 2D 스타일 앵커",
    accent: "from-purple-500/40 via-indigo-500/15 to-transparent",
    tags: ["anime", "guide", "character"],
  },
  {
    id: "tool-cleanup-stack",
    category: "tool",
    title: "클린업 스택",
    subtitle: "워터마크 제거, 안정화, 업스케일, 보간 작업 묶음",
    accent: "from-zinc-300/30 via-zinc-100/5 to-transparent",
    tags: ["ffmpeg", "propainter", "repair"],
  },
  {
    id: "tool-audio-finish",
    category: "tool",
    title: "오디오 마감",
    subtitle: "전사, TTS, 자막, BGM 체인",
    accent: "from-sky-400/35 via-cyan-300/10 to-transparent",
    tags: ["audio", "whisper", "tts"],
  },
];

export function filterLibraryCards(category?: LibraryCategory): StudioLibraryCard[] {
  if (!category) {
    return studioLibraryCatalog;
  }

  return studioLibraryCatalog.filter((card) => card.category === category);
}
