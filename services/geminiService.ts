import { GoogleGenAI, Type } from "@google/genai";
import { ScriptAnalysis, ShortsScript } from "../types";

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

// 3. 조선시대 야담 스타일 대본 생성
export const generateYadamScript = async (
  topic: string,
  originalContext: string,
  historyContext?: string
): Promise<string> => {
  try {
    // 입력 대본 길이 분석
    const inputLength = originalContext.length;
    let targetLength: string;
    
    if (inputLength < 1000) {
      // 입력이 짧으면 10,000자 내외로 확장
      targetLength = "약 10,000자 내외 (충분히 상세하고 풍성하게)";
    } else if (inputLength < 5000) {
      // 중간 길이면 비슷하게 유지
      targetLength = `약 ${inputLength}~${inputLength + 2000}자 내외`;
    } else {
      // 긴 대본이면 비슷하게 유지
      targetLength = `약 ${inputLength}자 정도 (입력 대본과 비슷한 길이)`;
    }

    const historyPrompt = historyContext 
      ? `\n\n[참고용 과거 야담 대본]\n${historyContext}`
      : '';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `너는 조선시대 야담 전문 스토리텔러야. 
      
      주제: "${topic}"
      사용자가 입력한 대본 (${inputLength}자):
      """
      ${originalContext}
      """
      ${historyPrompt}
      
      ## 중요 지침:
      **입력 대본을 분석하고, 그 스타일과 내용을 참고하여 조선시대 야담으로 재창작해줘.**
      - 입력 대본의 핵심 메시지와 구조를 유지
      - 하지만 조선시대 배경과 등장인물로 변경
      - 길이: ${targetLength}
      
      ## 야담 스타일 특징:
      - 조선시대 역사적 인물이나 사건을 다룸
      - 짧고 흥미진진한 일화 형식
      - 교훈이나 반전이 있는 구조
      - 민간에서 구전되는 듯한 생생한 묘사
      - "전하는 바에 의하면", "옛날 어느 때" 같은 화법 사용
      
      ## 인기 야담 요소:
      - 권력자의 실수나 허점을 폭로
      - 가난한 선비의 통쾌한 역전
      - 귀신이나 도깨비 등 초자연 요소
      - 기생, 사또, 선비 등 전형적 캐릭터
      
      형식:
      [도입] - "전하는 바에 의하면..." 스타일 오프닝
      [전개] - 사건 전개 (반전 준비)
      [절정] - 통쾌한 반전 또는 교훈
      [마무리] - 여운 남기기
      
      조선시대 분위기를 살려 한글로 작성해줘.`,
      config: {}
    });

    return response.text || "야담 대본을 생성하지 못했습니다.";
  } catch (error) {
    console.error("Gemini Yadam Error:", error);
    throw new Error("야담 대본 작성 중 오류가 발생했습니다.");
  }
};

// 4. PD 페르소나 - 대본 분석
export const analyzeScriptAsPD = async (script: string): Promise<ScriptAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `# Role Definition
너는 지금부터 구독자 100만 명을 보유한 유튜브 채널의 '메인 PD'이자 '시나리오 작가'야. 
냉철하고 비판적인 시각으로 아래 대본을 분석해야 해.

# Task
다음 유튜브 대본을 분석해서, 시청자 이탈이 발생할 수 있는 치명적인 약점을 찾아내고 수정안을 제안해.

## 대본:
"""
${script}
"""

# Analysis Criteria
1. [후킹 점수]: 초반 30초 안에 시청자의 호기심을 자극하는지 (10점 만점 평가)
2. [논리적 허점]: 주장에 대한 근거가 부족하거나 비약이 심한 구간 지적
3. [지루함 경보]: 문장이 너무 길거나 불필요한 서론이 길어지는 '이탈 위험 구간' 식별

응답은 반드시 JSON 형식으로만 출력해줘.`,
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

// 5. 숏츠용 대본 생성 (웹에서 인기 야담 검색 후 참고)
export const generateShortsScript = async (
  longScript: string,
  yadamHistory?: string
): Promise<Omit<ShortsScript, 'id' | 'createdAt'>> => {
  try {
    // 웹에서 인기 야담 참고 자료 검색
    const searchPrompt = `조선시대 야담 중 가장 인기 있는 이야기들:

1. **흥부와 놀부**: 형제간의 선악 대비
2. **춘향전**: 신분을 초월한 사랑과 충절
3. **토끼전**: 지혜로운 토끼가 용왕을 속임
4. **홍길동전**: 서자 차별에 맞선 의적
5. **허생전**: 통쾌한 장사와 양반 비판
6. **장화홍련전**: 억울한 누명과 복수
7. **삼년고개**: 역발상으로 문제 해결
8. **김선달**: 사기꾼의 통쾌한 활약

이런 야담들의 공통점:
- 신분 역전과 통쾌함
- 억압받는 자의 승리
- 권력자의 허점 폭로
- 기발한 지혜와 반전`;

    const historyPrompt = yadamHistory 
      ? `\n\n[과거 생성한 야담 스타일]\n${yadamHistory}`
      : '';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `# Role
너는 유튜브 숏츠 전문 작가야. 조선시대 야담 스타일로 60초 이내 숏츠 대본을 만들어.

## 참고할 인기 야담 스타일:
${searchPrompt}

## 원본 대본 (이것도 참고):
"""
${longScript.substring(0, 1000)}
"""
${historyPrompt}

## 숏츠 대본 작성 원칙:
1. **첫 3초가 생명**: 충격적인 질문이나 반전으로 시작
2. **60초 안에 완결**: 읽는데 50-60초 걸리는 분량
3. **야담 특유의 반전**: 중간에 예상 못한 전개
4. **짧고 강렬한 문장**: 한 문장은 15자 이내
5. **마지막 여운**: "구독하세요" 말고 생각할 거리 남기기

## 인기 야담 숏츠 요소 (위 참고 자료 활용):
- 신분 역전 (가난한 선비가 사또를 혼내줌)
- 기발한 해결책 (엉뚱한 방법으로 문제 해결)
- 풍자와 해학 (권력자의 허점 폭로)

JSON으로 응답해줘:
- title: 클릭을 유도하는 제목 (20자 이내)
- script: 실제 대본 (읽는데 50-60초)
- duration: 예상 소요 시간(초)
- reference: 참고한 야담 이름 (예: "허생전 스타일")`,
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

// 7. 문장별 이미지 프롬프트 생성
export const generateImagePrompts = async (script: string): Promise<Array<{
  sentence: string;
  imagePrompt: string;
  koreanDescription: string;
  sceneNumber: number;
}>> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `너는 AI 이미지 생성 전문가야. 아래 대본의 각 문장을 분석하여, Midjourney/DALL-E/Stable Diffusion에서 사용할 수 있는 영문 이미지 프롬프트를 생성해줘.

대본:
"${script}"

조건:
1. 대본을 의미 단위로 문장별로 나눠서 분석
2. 각 문장마다 시각적으로 표현 가능한 이미지 프롬프트 작성
3. 프롬프트는 영문으로 작성 (예: "A traditional Korean scholar reading ancient books in a dim room, Joseon dynasty, ink painting style, cinematic lighting")
4. 한글 설명도 함께 제공
5. 장면 번호 부여 (1부터 시작)

예시:
{
  "sentence": "어느 날 선비가 책을 읽고 있었다.",
  "imagePrompt": "A traditional Korean scholar reading ancient books in a dim room, Joseon dynasty, ink painting style, cinematic lighting, 4K, detailed",
  "koreanDescription": "조선시대 선비가 어두운 방에서 고서를 읽는 모습, 수묵화 스타일",
  "sceneNumber": 1
}`,
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
    console.error("Gemini Image Prompt Error:", error);
    throw new Error("이미지 프롬프트 생성 중 오류가 발생했습니다.");
  }
};

// 8. 제목 생성
export const generateVideoTitle = async (script: string): Promise<string> => {
  try {
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
5. 클릭베이트지만 대본 내용과 일치

예시:
- "조선시대 사또가 울고 간 선비의 한 마디"
- "500년 전 실화, 귀신을 속인 기생의 기지"
- "이 양반, 왕 앞에서 거짓말을 했다가..."

제목만 반환해줘.`
    });

    return response.text?.trim() || "조선시대 야담";
  } catch (error) {
    console.error("Gemini Title Error:", error);
    throw new Error("제목 생성 중 오류가 발생했습니다.");
  }
};

// 9. 썸네일 프롬프트 3개 생성
export const generateThumbnails = async (script: string, title: string): Promise<Array<{
  id: number;
  concept: string;
  prompt: string;
  textOverlay?: string;
}>> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `다음 조선시대 야담 대본과 제목을 보고, 클릭률을 높일 수 있는 썸네일 디자인 3가지를 제안해줘.

제목: "${title}"
대본: "${script.substring(0, 500)}..."

조건:
1. 각 썸네일마다 다른 컨셉
2. 조선시대 분위기 (한복, 한옥, 수묵화 스타일)
3. AI 이미지 생성용 영문 프롬프트 포함
4. 썸네일에 넣을 텍스트 추천

컨셉 예시:
- 극적인 캐릭터 클로즈업
- 사건의 절정 장면
- 신비로운 분위기

각 썸네일은 다음 형식으로:
{
  "id": 1,
  "concept": "한글 설명",
  "prompt": "영문 이미지 프롬프트",
  "textOverlay": "썸네일 텍스트"
}`,
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