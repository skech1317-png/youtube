import { GoogleGenAI, Type } from "@google/genai";
import { ScriptAnalysis, ShortsScript } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

// 1. 주제 추천 함수
export const suggestTopicsFromScript = async (script: string): Promise<string[]> => {
  try {
    // 입력 대본이 너무 길면 앞부분만 사용 (비용 절감)
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

// 2. 대본 작성 함수 (히스토리 참고 기능 추가)
export const generateScriptForTopic = async (
  topic: string, 
  originalContext: string,
  historyContext?: string
): Promise<string> => {
  try {
    // 히스토리도 길이 제한 (비용 절감)
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
    
    // 대부분 8,000~10,000자 사이로 생성
    if (inputLength < 1000) {
      // 입력이 짧으면 8,000~10,000자로 확장
      targetLength = "약 8,000~10,000자 내외 (충분히 상세하고 풍성하게)";
    } else if (inputLength < 8000) {
      // 8,000자 미만이면 8,000~10,000자로 확장
      targetLength = "약 8,000~10,000자 내외 (상세하게 풍성하게 작성)";
    } else if (inputLength <= 10000) {
      // 8,000~10,000자 사이면 입력과 비슷하게 유지
      targetLength = `약 ${inputLength}자 정도 (입력 대본과 비슷한 길이로)`;
    } else {
      // 10,000자 초과면 8,000~10,000자로 조정
      targetLength = "약 8,000~10,000자 내외로 핵심을 유지하면서 간추려서";
    }

    // 히스토리와 원본 대본도 길이 제한 (비용 최적화)
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
      - 예: 주제가 "선비와 도깨비의 거래"면 → 선비와 도깨비가 나오는 새 이야기
      - 예: 주제가 "기생과 사또의 지혜 대결"이면 → 기생과 사따가 나오는 새 이야기
      
      ## 창작 방법:
      1. 주제를 분석하여 등장인물, 배경, 갈등 설정
      2. 조선시대 실제 있을 법한 구체적인 상황 설정
      3. 입력 대본의 문체와 후킹 방식만 참고
      4. 완전히 새로운 플롯과 결말 창작
      5. 길이: ${targetLength}
      
      ## 야담 스타일 특징:
      - 조선시대 배경의 생생한 일화
      - "전하는 바에 의하면", "옛날 어느 때" 같은 구전 화법
      - 짧고 흥미진진한 사건 전개
      - 통쾌한 반전이나 교훈
      
      ## 인기 야담 요소 (활용):
      - 신분 역전과 통쾌함
      - 권력자의 허점 폭로
      - 지혜로운 서민의 승리
      - 귀신, 도깨비 등 초자연적 요소
      - 사또, 선비, 기생, 상인 등 전형적 캐릭터
      
      형식:
      [도입] - 호기심을 자극하는 오프닝 (3문장)
      [전개] - 구체적인 상황과 갈등 전개
      [절정] - 통쾌한 반전 또는 결정적 순간
      [마무리] - 여운과 교훈
      
      **주제 "${topic}"에 완벽히 맞는 독창적인 조선시대 야담을 작성해줘.**`,
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

## 대본 (핵심 부분):
"""
${script.substring(0, 5000)}
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
${longScript.substring(0, 500)}
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

// 7. 등장인물 이미지 프롬프트 생성
export const generateImagePrompts = async (script: string): Promise<Array<{
  sentence: string;
  imagePrompt: string;
  koreanDescription: string;
  sceneNumber: number;
}>> => {
  try {
    // 대본이 너무 길면 앞부분만 분석 (등장인물 파악용)
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
3. Midjourney/DALL-E/Stable Diffusion용 영문 프롬프트 작성
4. 조선시대 복식, 헤어스타일, 분위기 구체적으로 묘사

## 프롬프트 작성 가이드:
- **신분 표현**: scholar(선비), nobleman(양반), commoner(평민), gisaeng(기생), official(관리), merchant(상인)
- **복식**: white hanbok(흰 한복), colorful hanbok(색동 한복), official robe(관복), traditional Korean attire
- **스타일**: Joseon dynasty, traditional Korean, historical portrait, detailed, 4K, cinematic lighting
- **구도**: portrait shot, full body shot, character design, concept art
- **분위기**: dignified(위엄), elegant(우아), cunning(교활), innocent(순진), wise(현명)

## 출력 예시:
{
  "sentence": "주인공 이몽학 - 가난하지만 지혜로운 선비",
  "imagePrompt": "A young Korean scholar in white hanbok, gentle face, intelligent eyes, holding ancient books, Joseon dynasty, traditional Korean portrait, soft lighting, detailed facial features, historical painting style, 4K, concept art",
  "koreanDescription": "흰 한복을 입은 젊은 선비, 온화한 얼굴, 지적인 눈빛, 고서를 들고 있는 모습",
  "sceneNumber": 1
},
{
  "sentence": "탐관오리 김사또 - 욕심 많고 교활한 관리",
  "imagePrompt": "A corrupt Korean official in dark official robe with gold embroidery, cunning expression, middle-aged, greedy eyes, Joseon dynasty, traditional Korean portrait, dramatic lighting, detailed, 4K, character design",
  "koreanDescription": "금실로 수놓은 검은 관복을 입은 중년 관리, 교활한 표정, 탐욕스러운 눈빛",
  "sceneNumber": 2
}

대본을 분석해서 등장하는 주요 인물들의 이미지 프롬프트를 JSON 배열로 생성해줘.`,
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

// 9. PD 분석 결과 기반 대본 개선 함수
export const improveScriptWithAnalysis = async (
  originalScript: string,
  analysis: ScriptAnalysis
): Promise<string> => {
  try {
    // 분석 결과를 요약하여 프롬프트에 포함
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
메인 PD의 분석 결과를 토대로 대본을 개선해야 해.

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
1. **후킹 강화**: 초반 30초 안에 시청자를 사로잡는 임팩트 있는 오프닝으로 수정
2. **논리 보완**: 지적된 논리적 허점을 근거와 함께 보완
3. **템포 조절**: 지루한 구간을 간결하게 정리하고, 긴장감 있는 전개로 수정
4. **조선시대 야담 스타일 유지**: 기존 톤앤매너는 유지하되 완성도만 높임
5. **길이 유지**: 원본 대본과 비슷한 길이(8,000-10,000자)로 작성

응답은 개선된 대본만 출력해. 메타 설명이나 주석은 불필요해.`,
      config: {
        temperature: 0.8,
        topP: 0.95
      }
    });

    if (response.text) {
      const improved = response.text.trim();
      // 최소 길이 검증
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