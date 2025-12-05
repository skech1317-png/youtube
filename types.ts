// 히스토리 아이템 타입
export interface ScriptHistoryItem {
  id: string;
  topic: string;
  script: string;
  createdAt: number;
  isEdited: boolean;
}

// 생성된 대본 (비교용)
export interface GeneratedScript {
  topic: string;
  script: string;
  timestamp: number;
}

// 대본 분석 결과 (PD 페르소나)
export interface ScriptAnalysis {
  hookingScore: number; // 후킹 점수 (0-10)
  hookingComment: string; // 후킹 평가
  logicalFlaws: Array<{
    original: string; // 원문
    issue: string; // 문제점
    suggestion: string; // 수정안
  }>;
  boringParts: Array<{
    original: string;
    reason: string; // 지루한 이유
  }>;
  overallComment: string; // 총평 (직설적)
  actionPlan: string; // 당장 고쳐야 할 1가지
}

// 숏츠용 대본
export interface ShortsScript {
  id: string;
  title: string; // 숏츠 제목
  script: string; // 60초 이내 대본
  duration: number; // 예상 초
  createdAt: number;
}

// 문장별 이미지 프롬프트
export interface ImagePrompt {
  sentence: string; // 원문 문장
  imagePrompt: string; // AI 이미지 생성용 프롬프트 (영문)
  koreanDescription: string; // 한글 설명
  sceneNumber: number; // 장면 번호
}

export interface ScriptSession {
  originalScript: string;
  suggestedTopics: string[];
  selectedTopic: string | null;
  generatedNewScript: string | null;
  // 새로운 필드들
  isEditMode: boolean; // 대본 편집 모드
  generatedScripts: GeneratedScript[]; // 여러 버전 비교용
  history: ScriptHistoryItem[]; // 대본 히스토리
  analysis: ScriptAnalysis | null; // PD 분석 결과
  shortsScripts: ShortsScript[]; // 숏츠 대본들
  imagePrompts: ImagePrompt[]; // 문장별 이미지 프롬프트
}

export const INITIAL_SESSION: ScriptSession = {
  originalScript: '',
  suggestedTopics: [],
  selectedTopic: null,
  generatedNewScript: null,
  isEditMode: false,
  generatedScripts: [],
  history: [],
  analysis: null,
  shortsScripts: [],
  imagePrompts: [],
};

export interface TodoItem {
  id: string;
  content: string;
  isCompleted: boolean;
}