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
  title?: string; // 추천 제목
  thumbnails?: ThumbnailPrompt[]; // 썸네일 프롬프트
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

// 상세 대본 분석 결과
export interface DetailedScriptAnalysis {
  structureAnalysis: {
    hasIntro: boolean; // 인트로 유무
    hasBody: boolean; // 본론 유무
    hasConclusion: boolean; // 결론 유무
    structureScore: number; // 구조 점수 (0-10)
    structureFeedback: string; // 구조 피드백
  };
  flowAnalysis: {
    flowScore: number; // 흐름 점수 (0-10)
    pacing: string; // 전개 속도 평가
    transitionQuality: string; // 장면 전환 평가
    improvements: string[]; // 개선 제안
  };
  contentQuality: {
    clarityScore: number; // 명확성 점수 (0-10)
    engagementScore: number; // 흥미도 점수 (0-10)
    originalityScore: number; // 독창성 점수 (0-10)
    strengths: string[]; // 강점
    weaknesses: string[]; // 약점
  };
  technicalIssues: Array<{
    lineNumber?: number; // 문제 발생 라인
    issue: string; // 문제점
    severity: 'high' | 'medium' | 'low'; // 심각도
    suggestion: string; // 수정 제안
  }>;
  overallSummary: string; // 종합 평가
  improvementPriorities: string[]; // 개선 우선순위 (1-3개)
}

// 대본 수정 제안
export interface ScriptRevision {
  original: string; // 원본 대본
  revised: string; // 수정된 대본
  changes: Array<{
    type: 'structure' | 'flow' | 'content' | 'technical'; // 수정 타입
    original: string; // 원본 부분
    revised: string; // 수정된 부분
    reason: string; // 수정 이유
  }>;
  summary: string; // 수정 요약
}

// 숏츠용 대본
export interface ShortsScript {
  id: string;
  title: string; // 숏츠 제목
  script: string; // 60초 이내 대본
  duration: number; // 예상 초
  createdAt: number;
  reference?: string; // 참고한 웹 야담 출처
}

// 유튜브 채널 기획서
export interface ChannelPlan {
  id: string;
  topic: string; // 떡상 주제
  targetAudience: string; // 타겟 시청자
  contentStrategy: string; // 콘텐츠 전략
  competitiveAdvantage: string; // 경쟁력
  trendAnalysis: string; // 트렌드 분석
  videoStructure: string; // 영상 구성안
  monetizationPlan: string; // 수익화 방안
  uploadSchedule: string; // 업로드 계획
  createdAt: number;
}

// 등장인물 이미지 프롬프트
export interface ImagePrompt {
  sentence: string; // 원문 문장
  imagePrompt: string; // AI 이미지 생성용 프롬프트 (영문)
  koreanDescription: string; // 한글 설명
  sceneNumber: number; // 장면 번호
}

// 썸네일 프롬프트
export interface ThumbnailPrompt {
  id: number;
  concept: string; // 한글 컨셉 설명
  prompt: string; // 영문 이미지 프롬프트
  textOverlay?: string; // 썸네일에 넣을 텍스트
}

export interface ScriptSession {
  originalScript: string;
  suggestedTopics: string[];
  selectedTopic: string | null;
  generatedNewScript: string | null;
  // 새로운 필드들
  apiKey: string; // 사용자 Gemini API 키
  isEditMode: boolean; // 대본 편집 모드
  generatedScripts: GeneratedScript[]; // 여러 버전 비교용
  history: ScriptHistoryItem[]; // 대본 히스토리
  analysis: ScriptAnalysis | null; // PD 분석 결과
  detailedAnalysis: DetailedScriptAnalysis | null; // 상세 분석 결과
  scriptRevision: ScriptRevision | null; // 대본 수정 제안
  shortsScripts: ShortsScript[]; // 숏츠 대본들
  channelPlans: ChannelPlan[]; // 채널 기획서들
  imagePrompts: ImagePrompt[]; // 등장인물 이미지 프롬프트
  videoTitle: string | null; // 생성된 제목
  videoDescription: string | null; // 생성된 영상 설명
  thumbnails: ThumbnailPrompt[]; // 썸네일 프롬프트들
}

export const INITIAL_SESSION: ScriptSession = {
  originalScript: '',
  suggestedTopics: [],
  selectedTopic: null,
  generatedNewScript: null,
  apiKey: '',
  isEditMode: false,
  generatedScripts: [],
  history: [],
  analysis: null,
  detailedAnalysis: null,
  scriptRevision: null,
  shortsScripts: [],
  channelPlans: [],
  imagePrompts: [],
  videoTitle: null,
  videoDescription: null,
  thumbnails: [],
};

export interface TodoItem {
  id: string;
  content: string;
  isCompleted: boolean;
}