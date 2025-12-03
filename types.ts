export interface ScriptSession {
  originalScript: string;
  suggestedTopics: string[];
  selectedTopic: string | null;
  generatedNewScript: string | null;
}

export const INITIAL_SESSION: ScriptSession = {
  originalScript: '',
  suggestedTopics: [],
  selectedTopic: null,
  generatedNewScript: null,
};

export interface TodoItem {
  id: string;
  content: string;
  isCompleted: boolean;
}