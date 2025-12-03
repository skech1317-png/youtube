import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

// 1. 주제 추천 함수
export const suggestTopicsFromScript = async (script: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `다음 유튜브 대본(또는 아이디어)을 분석해서, 이와 연관되거나 파생될 수 있는 흥미로운 유튜브 영상 주제 3가지를 추천해줘.
      
      입력된 대본:
      "${script}"
      
      조건:
      1. 한글로 작성할 것.
      2. 클릭하고 싶은 매력적인 제목 형태로 3가지만 추천할 것.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        },
        systemInstruction: "You are a creative YouTube strategist. Analyze content and suggest viral video topics."
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    return [];
  } catch (error) {
    console.error("Gemini Topic Error:", error);
    throw new Error("주제 추천 중 오류가 발생했습니다.");
  }
};

// 2. 대본 작성 함수 (히스토리 참고 기능 추가)
export const generateScriptForTopic = async (
  topic: string, 
  originalContext: string,
  historyContext?: string
): Promise<string> => {
  try {
    const historyPrompt = historyContext 
      ? `\n\n[참고용 과거 대본 스타일]\n${historyContext}\n위 스타일을 참고하되, 주제에 맞게 새롭게 작성해주세요.`
      : '';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `다음 주제로 유튜브 영상 대본을 작성해줘.
      
      주제: "${topic}"
      참고(이전 대본 맥락): "${originalContext.substring(0, 500)}..."
      ${historyPrompt}
      
      형식:
      [오프닝] - 시청자의 주의를 끄는 멘트
      [본론] - 핵심 내용 3가지
      [클로징] - 요약 및 구독 유도
      
      한글로 자연스럽게 작성해줘.`,
      config: {
        // Text output is preferred for scripts
      }
    });

    return response.text || "대본을 생성하지 못했습니다.";
  } catch (error) {
    console.error("Gemini Script Error:", error);
    throw new Error("대본 작성 중 오류가 발생했습니다.");
  }
};