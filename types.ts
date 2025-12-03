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

export interface ScriptSession {
  originalScript: string;
  suggestedTopics: string[];
  selectedTopic: string | null;
  generatedNewScript: string | null;
  // 새로운 필드들
  isEditMode: boolean; // 대본 편집 모드
  generatedScripts: GeneratedScript[]; // 여러 버전 비교용
  history: ScriptHistoryItem[]; // 대본 히스토리
}

export const INITIAL_SESSION: ScriptSession = {
  originalScript: '',
  suggestedTopics: [],
  selectedTopic: null,
  generatedNewScript: null,
  isEditMode: false,
  generatedScripts: [],
  history: [],
};

export interface TodoItem {
  id: string;
  content: string;
  isCompleted: boolean;
}