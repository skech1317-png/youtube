import { GoogleGenAI, Type } from "@google/genai";
import { ScriptAnalysis, ShortsScript } from "../types";

const MODEL_NAME = 'gemini-2.5-flash';

// API 키를 받아서 AI 인스턴스 생성하는 헬퍼 함수
const getAI = (apiKey: string) => new GoogleGenAI({ apiKey });

// 1. 주제 추천 함수
export const suggestTopicsFromScript = async (script: string, apiKey: string): Promise<string[]> => {
  try {
    const ai = getAI(apiKey);
    const trimmedScript = script.length > 2000 ? script.substring(0, 2000) + '...' : script;
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `다음 유튜브 대본(또는 아이디어)을 분석해서, 이와 연관되거나 파생될 수 있는 흥미로운 유튜브 영상 주제 3가지를 추천해줘.
      
      입력된 대본:
      "${trimmedScript}"
      
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

// 2. 대본 작성 함수
export const generateScriptForTopic = async (
  topic: string, 
  originalContext: string,
  apiKey: string,
  historyContext?: string
): Promise<string> => {
  try {
    const ai = getAI(apiKey);
    const trimmedHistory = historyContext && historyContext.length > 1000 
      ? historyContext.substring(0, 1000) + '...'
      : historyContext;
      
    const historyPrompt = trimmedHistory 
      ? `\n\n[참고용 과거 대본 스타일]\n${trimmedHistory}\n위 스타일을 참고하되, 주제에 맞게 새롭게 작성해주세요.`
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
      config: {}
    });

    return response.text || "대본을 생성하지 못했습니다.";
  } catch (error) {
    console.error("Gemini Script Error:", error);
    throw new Error("대본 작성 중 오류가 발생했습니다.");
  }
};

// 3. 조선시대 야담 스타일 대본 생성
export const generateYadamScript = async (
  topic: string,
  originalContext: string,
  apiKey: string,
  historyContext?: string
): Promise<string> => {
  try {
    const ai = getAI(apiKey);
    const inputLength = originalContext.length;
    let targetLength: string;
    
    if (inputLength < 1000) {
      targetLength = "약 8,000~10,000자 내외 (충분히 상세하고 풍성하게)";
    } else if (inputLength < 8000) {
      targetLength = "약 8,000~10,000자 내외 (상세하게 풍성하게 작성)";
    } else if (inputLength <= 10000) {
      targetLength = `약 ${inputLength}자 정도 (입력 대본과 비슷한 길이로)`;
    } else {
      targetLength = "약 8,000~10,000자 내외로 핵심을 유지하면서 간추려서";
    }

    const trimmedOriginal = originalContext.length > 5000 
      ? originalContext.substring(0, 5000) + '...\n(이하 생략, 전체 맥락을 참고하여 작성)'
      : originalContext;
      
    const trimmedHistory = historyContext && historyContext.length > 1000 
      ? historyContext.substring(0, 1000) + '...'
      : historyContext;
      
    const historyPrompt = trimmedHistory 
      ? `\n\n[참고용 과거 야담 대본]\n${trimmedHistory}`
      : '';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `너는 조선시대 야담 전문 스토리텔러야. 
      
      주제: "${topic}"
      
      사용자가 입력한 대본 (참고용):
      """
      ${trimmedOriginal}
      """
      ${historyPrompt}
      
      ## 핵심 지침:
      **위 주제("${topic}")에 딱 맞는 완전히 새로운 조선시대 야담 이야기를 창작해줘.**
      
      - 입력 대본의 스타일(문체, 후킹 방식, 구성)은 참고하되
      - **내용은 주제에 맞는 완전히 새로운 이야기**를 만들어줘
      - 주제 제목과 100% 일치하는 내용이어야 함
      - 길이: ${targetLength}
      
      ## 야담 스타일 특징:
      - 조선시대 배경의 생생한 일화
      - "전하는 바에 의하면", "옛날 어느 때" 같은 구전 화법
      - 짧고 흥미진진한 사건 전개
      - 통쾌한 반전이나 교훈
      
      형식:
      [도입] - 호기심을 자극하는 오프닝
      [전개] - 구체적인 상황과 갈등 전개
      [절정] - 통쾌한 반전
      [마무리] - 여운과 교훈`,
      config: {}
    });

    return response.text || "야담 대본을 생성하지 못했습니다.";
  } catch (error) {
    console.error("Gemini Yadam Error:", error);
    throw new Error("야담 대본 작성 중 오류가 발생했습니다.");
  }
};

// 4. PD 페르소나 - 대본 분석
export const analyzeScriptAsPD = async (script: string, apiKey: string): Promise<ScriptAnalysis> => {
  try {
    const ai = getAI(apiKey);
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `# Role Definition
너는 지금부터 구독자 100만 명을 보유한 유튜브 채널의 '메인 PD'이자 '시나리오 작가'야. 

# Task
다음 유튜브 대본을 분석해서, 시청자 이탈이 발생할 수 있는 치명적인 약점을 찾아내고 수정안을 제안해.

## 대본 (핵심 부분):
"""
${script.substring(0, 5000)}
"""

# Analysis Criteria
1. [후킹 점수]: 초반 30초 안에 시청자의 호기심을 자극하는지 (10점 만점 평가)
2. [논리적 허점]: 주장에 대한 근거가 부족하거나 비약이 심한 구간 지적
3. [지루함 경보]: 문장이 너무 길거나 불필요한 서론이 길어지는 '이탈 위험 구간' 식별`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hookingScore: { type: Type.NUMBER },
            hookingComment: { type: Type.STRING },
            logicalFlaws: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  issue: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                }
              }
            },
            boringParts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  reason: { type: Type.STRING }
                }
              }
            },
            overallComment: { type: Type.STRING },
            actionPlan: { type: Type.STRING }
          },
          required: ["hookingScore", "hookingComment", "logicalFlaws", "boringParts", "overallComment", "actionPlan"]
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return parsed as ScriptAnalysis;
    }
    throw new Error("분석 결과를 파싱할 수 없습니다.");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("대본 분석 중 오류가 발생했습니다.");
  }
};

// 5. 숏츠용 대본 생성
export const generateShortsScript = async (
  longScript: string,
  apiKey: string,
  yadamHistory?: string
): Promise<Omit<ShortsScript, 'id' | 'createdAt'>> => {
  try {
    const ai = getAI(apiKey);
    const historyPrompt = yadamHistory 
      ? `\n\n[과거 생성한 야담 스타일]\n${yadamHistory}`
      : '';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `너는 유튜브 숏츠 전문 작가야. 조선시대 야담 스타일로 60초 이내 숏츠 대본을 만들어.

## 원본 대본:
"""
${longScript.substring(0, 500)}
"""
${historyPrompt}

## 숏츠 대본 작성 원칙:
1. 첫 3초가 생명: 충격적인 질문으로 시작
2. 60초 안에 완결
3. 야담 특유의 반전
4. 짧고 강렬한 문장

JSON으로 응답:
- title: 제목 (20자 이내)
- script: 대본 (50-60초 분량)
- duration: 예상 시간(초)
- reference: 참고한 야담`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            script: { type: Type.STRING },
            duration: { type: Type.NUMBER },
            reference: { type: Type.STRING }
          },
          required: ["title", "script", "duration"]
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return {
        title: parsed.title,
        script: parsed.script,
        duration: parsed.duration,
        reference: parsed.reference || "조선야담"
      };
    }
    throw new Error("숏츠 대본을 파싱할 수 없습니다.");
  } catch (error) {
    console.error("Gemini Shorts Error:", error);
    throw new Error("숏츠 대본 생성 중 오류가 발생했습니다.");
  }
};

// 7. 등장인물 이미지 프롬프트 생성
export const generateImagePrompts = async (script: string, apiKey: string): Promise<Array<{
  sentence: string;
  imagePrompt: string;
  koreanDescription: string;
  sceneNumber: number;
}>> => {
  try {
    const ai = getAI(apiKey);
    const scriptForAnalysis = script.length > 3000 
      ? script.substring(0, 3000) 
      : script;
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `너는 AI 이미지 생성 전문가야. 아래 조선시대 야담 대본을 분석하여, 등장하는 주요 인물들의 캐릭터 이미지 프롬프트를 생성해줘.

대본:
"""
${scriptForAnalysis}
"""

## 작업 지침:
1. 대본에 등장하는 주요 인물들을 파악 (최대 8명)
2. 각 인물의 특징, 신분, 성격을 분석
3. Midjourney/DALL-E용 영문 프롬프트 작성
4. 조선시대 복식, 헤어스타일 구체적 묘사`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sentence: { type: Type.STRING },
              imagePrompt: { type: Type.STRING },
              koreanDescription: { type: Type.STRING },
              sceneNumber: { type: Type.NUMBER }
            },
            required: ["sentence", "imagePrompt", "koreanDescription", "sceneNumber"]
          }
        }
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
    console.error("Gemini Character Image Prompt Error:", error);
    throw new Error("등장인물 이미지 프롬프트 생성 중 오류가 발생했습니다.");
  }
};

// 8. 제목 생성
export const generateVideoTitle = async (script: string, apiKey: string): Promise<string> => {
  try {
    const ai = getAI(apiKey);
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `다음 조선시대 야담 대본을 보고, 클릭률을 극대화할 수 있는 유튜브 제목을 만들어줘.

대본:
"${script.substring(0, 500)}..."

조건:
1. 호기심과 궁금증을 자극
2. 20-40자 이내
3. 숫자나 질문 형식 활용
4. "조선시대", "야담", "실화" 등 키워드 포함

제목만 반환해줘.`
    });

    return response.text?.trim() || "조선시대 야담";
  } catch (error) {
    console.error("Gemini Title Error:", error);
    throw new Error("제목 생성 중 오류가 발생했습니다.");
  }
};

// 9. 썸네일 프롬프트 3개 생성
export const generateThumbnails = async (script: string, title: string, apiKey: string): Promise<Array<{
  id: number;
  concept: string;
  prompt: string;
  textOverlay?: string;
}>> => {
  try {
    const ai = getAI(apiKey);
    const scriptSummary = script.length > 2000 ? script.substring(0, 2000) + '...' : script;
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `다음 조선시대 야담 대본과 제목을 분석하여, 클릭률을 극대화할 수 있는 썸네일 디자인 3가지를 제안해줘.

# 제목
"${title}"

# 대본 내용
"""
${scriptSummary}
"""

# 썸네일 제작 가이드
대본의 핵심 내용, 등장인물, 사건의 절정을 분석하여 각각 다른 전략의 썸네일을 만들어줘.

## 필수 조건
1. **대본 내용 반영**: 제목만이 아니라 대본의 핵심 사건, 인물, 감정을 반영
2. **3가지 다른 전략**:
   - 전략1: 극적인 인물 표정/클로즈업
   - 전략2: 사건의 절정 장면
   - 전략3: 신비롭거나 충격적인 비주얼
3. **조선시대 고증**: 한복, 한옥, 소품
4. **AI 이미지 생성용**: Midjourney/DALL-E 영문 프롬프트
5. **텍스트 오버레이**: 클릭 유도 문구`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.NUMBER },
              concept: { type: Type.STRING },
              prompt: { type: Type.STRING },
              textOverlay: { type: Type.STRING }
            },
            required: ["id", "concept", "prompt"]
          }
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 3);
      }
    }
    return [];
  } catch (error) {
    console.error("Gemini Thumbnail Error:", error);
    throw new Error("썸네일 생성 중 오류가 발생했습니다.");
  }
};

// 10. PD 분석 결과 기반 대본 개선
export const improveScriptWithAnalysis = async (
  originalScript: string,
  analysis: ScriptAnalysis,
  apiKey: string
): Promise<string> => {
  try {
    const ai = getAI(apiKey);
    const flawsSummary = analysis.logicalFlaws
      .map((f, i) => `${i + 1}. [문제] ${f.issue}\n   [제안] ${f.suggestion}`)
      .join('\n');
    
    const boringSummary = analysis.boringParts
      .map((b, i) => `${i + 1}. [이탈위험] ${b.reason}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `# Role
너는 100만 구독자 유튜브 채널의 메인 시나리오 작가야.

# 원본 대본
"""
${originalScript}
"""

# PD 분석 결과
## 후킹 점수: ${analysis.hookingScore}/10
${analysis.hookingComment}

## 논리적 허점
${flawsSummary || '없음'}

## 지루함 경보 구간
${boringSummary || '없음'}

## 종합 의견
${analysis.overallComment}

## 실행 계획
${analysis.actionPlan}

# Task
위 PD 분석을 반영하여 대본을 개선해줘.

## 개선 방향
1. 후킹 강화: 초반 30초 임팩트 있게
2. 논리 보완: 허점 보완
3. 템포 조절: 지루한 구간 간결화
4. 조선시대 야담 스타일 유지
5. 길이 유지: 8,000-10,000자

개선된 대본만 출력해.`,
      config: {
        temperature: 0.8,
        topP: 0.95
      }
    });

    if (response.text) {
      const improved = response.text.trim();
      if (improved.length < 3000) {
        throw new Error("개선된 대본이 너무 짧습니다.");
      }
      return improved;
    }
    throw new Error("대본 개선 결과를 받을 수 없습니다.");
  } catch (error) {
    console.error("Script Improvement Error:", error);
    throw new Error("대본 개선 중 오류가 발생했습니다.");
  }
};
