import { GoogleGenAI, Type } from "@google/genai";
import { ScriptAnalysis, ShortsScript, DetailedScriptAnalysis, ScriptRevision } from "../types";

const MODEL_NAME = 'gemini-2.0-flash-exp';

// API 키를 받아서 AI 인스턴스 생성하는 헬퍼 함수
const getAI = (apiKey: string) => {
  console.log('getAI 호출됨, API 키 길이:', apiKey?.length);
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API 키가 제공되지 않았습니다.');
  }
  return new GoogleGenAI({ apiKey });
};

// 1. 주제 추천 함수
export const suggestTopicsFromScript = async (script: string, apiKey: string): Promise<string[]> => {
  try {
    console.log('API 키로 AI 인스턴스 생성 시도...');
    const ai = getAI(apiKey);
    const trimmedScript = script.length > 2000 ? script.substring(0, 2000) + '...' : script;
    
    console.log('Gemini API 호출 시작...');
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
        console.log('주제 추천 성공:', parsed.length, '개');
        return parsed;
      }
    }
    return [];
  } catch (error: any) {
    console.error("Gemini Topic Error 상세:", error);
    console.error("에러 메시지:", error.message);
    console.error("에러 스택:", error.stack);
    
    // 구체적인 에러 메시지 제공
    let errorMessage = '알 수 없는 오류';
    if (error.message) {
      if (error.message.includes('API key')) {
        errorMessage = 'API 키가 유효하지 않습니다. 올바른 Gemini API 키를 입력했는지 확인하세요.';
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage = '모델을 찾을 수 없습니다. gemini-1.5-flash 모델에 접근 권한이 있는지 확인하세요.';
      } else if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('limit')) {
        errorMessage = 'API 사용량 한도를 초과했습니다 (429 에러).\n\n해결 방법:\n1. 5-10분 후 다시 시도\n2. 새 API 키 발급 (https://aistudio.google.com/apikey)\n3. 무료 티어는 분당 15회 제한이 있습니다.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = '네트워크 연결 오류입니다. 인터넷 연결을 확인하세요.';
      } else {
        errorMessage = error.message;
      }
    }
    
    throw new Error(`주제 추천 실패: ${errorMessage}`);
  }
};

// 2. 대본 작성 함수 (제목-내용 일치 강화)
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
      ? `\n\n[참고용 과거 대본 스타일]\n${trimmedHistory}\n\n⚠️ 위 스타일은 참고만 하고, 내용은 아래 주제에 100% 맞춰 완전히 새로 창작하세요.`
      : '';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `:: 핵심 미션 ::
너는 유튜브 대본 작가야. 아래 주제(제목)에 딱 맞는 대본을 창작해야 해.

:: 주제(제목) ::
"${topic}"

:: 중요 ::
- 대본의 모든 내용은 위 주제("${topic}")를 직접적으로 다뤄야 함
- 주제에서 벗어나면 안 됨
- 제목을 보고 들어온 시청자가 "이거 아니네?" 하면 안 됨
- 제목이 약속한 내용을 100% 전달할 것

:: 참고 자료 (스타일만 참고) ::
${originalContext.substring(0, 500)}...
${historyPrompt}

:: 대본 구조 ::
[오프닝] - 주제("${topic}")를 언급하며 호기심 유발
[본론] - "${topic}"에 대한 핵심 내용 3가지
[클로징] - "${topic}" 요약 및 구독 유도

:: 길이 ::
8,000-10,000자

한글로 자연스럽게, 주제에 완벽히 맞게 작성해줘.`,
      config: {
        temperature: 0.8,
        topP: 0.95
      }
    });

    return response.text || "대본을 생성하지 못했습니다.";
  } catch (error: any) {
    console.error("Gemini Script Error:", error);
    const errorMsg = error?.message || "알 수 없는 오류";
    throw new Error(`대본 작성 실패: ${errorMsg}. API 키와 네트워크 연결을 확인하세요.`);
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
      contents: `:: Role ::
너는 조선시대 야담 전문 스토리텔러야.

:: 핵심 미션 ::
아래 주제(제목)에 **완벽하게 일치하는** 조선시대 야담 이야기를 창작해야 해.

:: 주제(제목) ::
"${topic}"

:: 절대 규칙 ::
1. 이야기의 모든 내용은 "${topic}"를 직접 다뤄야 함
2. 주제에서 1%도 벗어나면 안 됨
3. 제목 = 내용 (100% 일치 필수)
4. 시청자가 "제목이랑 다르네?"라고 느끼면 실패
5. 주제가 약속한 내용을 반드시 전달할 것

:: 참고 자료 (스타일만 참고, 내용은 주제에 맞게 새로 창작) ::
"""
${trimmedOriginal}
"""
${historyPrompt}

⚠️ 위 대본은 문체/구성/후킹 방식만 참고하고, 내용은 "${topic}"에 딱 맞는 완전히 새로운 조선시대 이야기를 창작하세요.

:: 야담 스타일 특징 ::
- 조선시대 배경의 생생한 실화 같은 일화
- "전하는 바에 의하면", "옛날 어느 때", "한양 어느 골목에" 같은 구전 화법
- 짧고 강렬한 문장, 흥미진진한 사건 전개
- 통쾌한 반전이나 교훈
- 등장인물의 생생한 대사와 행동

:: 이름 표현 규칙 (자연스러운 한국어) ::
⚠️ **필수**: 이름 뒤에 항상 조사를 자연스럽게 붙일 것!
✅ 좋은 예:
  - "막순이가 마당에 나왔다" (O)
  - "막순이의 얼굴에 미소가" (O)
  - "철수는 그날 밤 집을 나섰다" (O)
  - "영희에게 편지를 전했다" (O)
  
❌ 나쁜 예:
  - "막순 마당에 나왔다" (X) → "막순이가"로 수정
  - "막순의 얼굴에" (X) → "막순이의"로 수정
  - "철수 그날 밤" (X) → "철수는"으로 수정

**규칙**: 
- 주어 역할: "이름 + 이/가/은/는"
- 소유격: "이름 + 의" → "이름이의"가 자연스러우면 사용, 아니면 "이름의"
- 목적어: "이름 + 을/를/에게"
- 문장 흐름이 자연스럽고 부드럽게 읽히도록!

:: 댄 하몬 스토리 서클 (Dan Harmon's Story Circle) 적용 ::
**8단계 구조로 완벽한 이야기 설계:**

1. **YOU (일상)** - 주인공의 평범한 일상 소개
   → 조선시대 배경, 인물의 일상적 모습
   → "${topic}"와 관련된 안정된 상태

2. **NEED (욕구)** - 무언가 필요하거나 원하는 것 발생
   → 호기심, 야망, 문제 인식
   → "${topic}"의 핵심 갈등 씨앗

3. **GO (출발)** - 익숙한 세계를 떠남
   → 새로운 상황에 뛰어듦
   → 결정적 행동 시작

4. **SEARCH (탐색)** - 낯선 세계에서 목표 추구
   → 어려움과 도전에 직면
   → 긴장감 최고조

5. **FIND (발견)** - 원하던 것을 얻음
   → 해결책 발견 또는 목표 달성
   → 하지만 대가가...

6. **TAKE (대가)** - 얻은 것의 대가를 치룸
   → 예상치 못한 결과
   → 위기와 깨달음

7. **RETURN (귀환)** - 원래 세계로 돌아옴
   → 변화된 모습으로 복귀
   → 갈등 해결

8. **CHANGE (변화)** - 성장하고 변화한 주인공
   → 교훈과 깨달음
   → "${topic}"의 의미 완성

:: 대본 작성 원칙 ::
- 각 단계마다 **명확한 전환점** 필요
- 주인공의 **내적 변화**에 집중
- **반전**은 5단계(FIND)나 6단계(TAKE)에서
- 8단계에서 **감동적 결말과 교훈** 제시

:: 길이 ::
${targetLength}

:: 최종 체크리스트 ::
✓ 제목("${topic}")과 내용이 100% 일치하는가?
✓ 댄 하몬 스토리 서클 8단계가 명확히 구현되었는가?
✓ 주인공의 변화와 성장이 드러나는가?
✓ 각 전환점이 자연스럽고 설득력 있는가?
✓ 조선시대 야담 스타일인가?
✓ 호기심과 몰입을 유도하는가?
✓ 5~6단계에 강력한 반전이 있는가?
✓ 8단계에서 감동적 결말과 교훈을 제시하는가?

이제 창작 시작!`,
      config: {
        temperature: 0.85,
        topP: 0.95
      }
    });

    return response.text || "야담 대본을 생성하지 못했습니다.";
  } catch (error: any) {
    console.error("Gemini Yadam Error:", error);
    const errorMsg = error?.message || "알 수 없는 오류";
    throw new Error(`야담 대본 작성 실패: ${errorMsg}. API 키가 올바른지 확인하세요.`);
  }
};

// 4. PD 페르소나 - 대본 분석 (냉철하고 비판적)
export const analyzeScriptAsPD = async (script: string, apiKey: string): Promise<ScriptAnalysis> => {
  try {
    console.log('PD 분석 시작...');
    const ai = getAI(apiKey);
    console.log('AI 인스턴스 생성 완료');
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `:: Role Definition ::
너는 지금부터 구독자 100만 명을 보유한 유튜브 채널의 '메인 PD'이자 '시나리오 작가'야.
냉철하고 비판적인 시각으로 대본의 치명적 약점을 찾아내는 것이 너의 역할이다.
타협 없이, 직설적으로, 시청자 입장에서 평가해야 한다.

:: Task ::
내가 입력한 유튜브 롱폼 대본을 분석해서, 시청자 이탈이 발생할 수 있는 치명적인 약점을 찾아내고 수정안을 제안해.

## 대본 원문:
"""
${script.substring(0, 5000)}
"""

:: Analysis Criteria ::
1. [후킹 점수]: 초반 30초 안에 시청자의 호기심을 자극하는지 (10점 만점 평가)
   - 3초 안에 시선을 잡는가?
   - 왜 봐야 하는지 명확한가?
   - 클릭 후 이탈하지 않고 계속 보게 만드는가?

2. [논리적 허점]: 주장에 대한 근거가 부족하거나 비약이 심한 구간 지적
   - 설득력 없는 주장
   - 인과관계 비약
   - 맥락 없는 전개

3. [지루함 경보]: 문장이 너무 길거나 불필요한 서론이 길어지는 '이탈 위험 구간' 식별
   - 장황한 설명
   - 중복되는 내용
   - 템포가 느려지는 구간

:: Output Format ::
- 총평: 직설적이고 냉정한 한 줄 평 (변명 여지 없이)
- 후킹 점수: 0-10점 + 구체적 이유
- 논리적 허점: 문제 구간 원문 → 문제점 → 수정안
- 지루함 경보: 이탈 위험 구간 → 왜 지루한지
- 액션 플랜: 이 영상을 살리기 위해 당장 고쳐야 할 1가지 (우선순위 최상위)

**중요**: 
- 칭찬보다는 개선점에 집중하라
- 100만 구독자 채널 기준에서 평가하라
- 수정 제안은 구체적인 문장으로 제시하라
- 약점이 발견된 문장 원문을 정확히 인용하라`,
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

    console.log('API 응답 받음:', response);
    if (response.text) {
      console.log('응답 텍스트 파싱 시도...');
      const parsed = JSON.parse(response.text);
      console.log('파싱 완료:', parsed);
      return parsed as ScriptAnalysis;
    }
    throw new Error("분석 결과를 파싱할 수 없습니다.");
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    console.error("에러 상세:", error.message, error.stack);
    const errorMsg = error?.message || error?.toString() || "알 수 없는 오류";
    throw new Error(`대본 분석 중 오류가 발생했습니다: ${errorMsg}\n\nAPI 키를 확인하거나 잠시 후 다시 시도해주세요.`);
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

// 9-1. YouTube 영상 설명(디스크립션) 생성
export const generateVideoDescription = async (script: string, title: string, apiKey: string): Promise<string> => {
  try {
    const ai = getAI(apiKey);
    const scriptSummary = script.length > 3000 ? script.substring(0, 3000) + '...' : script;
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `다음 조선시대 야담 대본과 제목을 바탕으로 YouTube 영상 설명(디스크립션)을 작성해줘.

# 제목
"${title}"

# 대본 내용
"""
${scriptSummary}
"""

## YouTube 디스크립션 작성 가이드:

**1. 인트로 (2-3줄)**
- 시청자의 호기심을 자극하는 짧은 요약
- "이 영상에서는..." 형식 사용
- 핵심 키워드 자연스럽게 포함

**2. 본문 요약 (3-5줄)**
- 대본의 주요 내용 간략 설명
- 등장인물, 사건, 결말 힌트
- 역사적 배경이나 교훈 언급

**3. 타임스탬프 (챕터 구분)**
- 00:00 인트로
- 00:30 [주요 사건 1]
- 02:00 [주요 사건 2]
- 04:00 반전
- 06:00 결말과 교훈
(대본 분량에 따라 적절히 조정)

**4. 해시태그 (5-10개)**
#조선시대 #야담 #한국역사 #실화 #스토리텔링 등

**5. 채널 소개 & CTA**
- 구독 & 알림 설정 요청
- 관련 영상 링크
- 채널 소개 한 줄

## 작성 원칙:
- SEO 최적화 (키워드 자연스럽게 배치)
- 읽기 쉽게 줄바꿈 활용
- 이모지 적절히 사용
- 스포일러 주의 (결말은 암시만)
- 친근하고 흥미로운 톤

완성된 디스크립션만 출력하세요.`,
      config: {
        temperature: 0.8,
        topP: 0.9
      }
    });

    return response.text?.trim() || "조선시대 야담 이야기입니다.";
  } catch (error) {
    console.error("Gemini Description Error:", error);
    throw new Error("영상 설명 생성 중 오류가 발생했습니다.");
  }
};

// 10. PD 분석 결과 기반 대본 개선 (안정화 버전)
export const improveScriptWithAnalysis = async (
  originalScript: string,
  analysis: ScriptAnalysis,
  apiKey: string
): Promise<string> => {
  try {
    // API 키 검증
    if (!apiKey || !apiKey.trim()) {
      throw new Error("API 키가 필요합니다.");
    }

    // 대본 검증
    if (!originalScript || originalScript.length < 500) {
      throw new Error("개선할 대본이 너무 짧거나 없습니다.");
    }

    // 분석 결과 검증
    if (!analysis) {
      throw new Error("분석 결과가 없습니다. PD 분석을 먼저 실행해주세요.");
    }

    const ai = getAI(apiKey);
    
    // 논리적 허점을 상세하게 정리
    const flawsSummary = analysis.logicalFlaws.length > 0
      ? analysis.logicalFlaws.map((f, i) => 
          `[허점 ${i + 1}]\n` +
          `원문: "${f.original}"\n` +
          `문제점: ${f.issue}\n` +
          `수정안: ${f.suggestion}\n`
        ).join('\n')
      : '논리적 문제 발견되지 않음 - 그대로 유지';
    
    // 지루함 경보 구간 정리
    const boringSummary = analysis.boringParts.length > 0
      ? analysis.boringParts.map((b, i) => 
          `[이탈위험 ${i + 1}] "${b.original}"\n` +
          `이유: ${b.reason}\n`
        ).join('\n')
      : '지루한 구간 발견되지 않음 - 템포 양호';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `당신은 100만 구독자 유튜브 채널의 메인 시나리오 작가입니다.
PD의 냉정한 피드백을 100% 반영하여 대본을 완벽하게 개선해야 합니다.

━━━━━━━━━━━━━━━━━━━━━━
📜 원본 대본
━━━━━━━━━━━━━━━━━━━━━━
${originalScript.substring(0, 8000)}

━━━━━━━━━━━━━━━━━━━━━━
📊 PD 분석 결과 (반드시 반영)
━━━━━━━━━━━━━━━━━━━━━━

🎯 후킹 점수: ${analysis.hookingScore}/10
💬 PD 코멘트: ${analysis.hookingComment}

⚠️ 논리적 허점 (${analysis.logicalFlaws.length}개):
${flawsSummary}

😴 지루함 경보 구간 (${analysis.boringParts.length}개):
${boringSummary}

💡 PD 총평:
${analysis.overallComment}

🚨 최우선 액션 플랜:
${analysis.actionPlan}

━━━━━━━━━━━━━━━━━━━━━━
✍️ 개선 미션
━━━━━━━━━━━━━━━━━━━━━━

위 PD 분석을 100% 반영하여 대본을 완전히 재작성하세요.

### 필수 개선 사항:

1. **후킹 강화** (목표: ${Math.min(10, analysis.hookingScore + 2)}점 이상)
   - 첫 10초를 가장 극적이고 충격적으로
   - "왜 이 영상을 봐야 하는가?" 명확히 제시
   ${analysis.hookingScore < 7 ? '   🚨 후킹 점수 낮음! 도입부 전면 재작성 필수!' : ''}

2. **논리적 허점 완벽 보완**
   ${analysis.logicalFlaws.length > 0 ? `   - 위의 ${analysis.logicalFlaws.length}개 허점을 PD 수정안대로 정확히 수정
   - 인과관계 명확화, 비약 제거
   🚨 각 허점 위치를 찾아 반드시 수정!` : '   - 논리는 양호, 현 수준 유지'}

3. **템포 개선 - 지루함 제거**
   ${analysis.boringParts.length > 0 ? `   - 지루함 경보 ${analysis.boringParts.length}개 구간 전면 개선
   - 간결하게 압축 또는 극적으로 재구성
   - 불필요한 설명 삭제
   🚨 지루한 부분은 과감히 삭제!` : '   - 템포는 양호, 현 수준 유지'}

4. **댄 하몬 스토리 서클 강화**
   1) YOU: 평범한 일상
   2) NEED: 문제/욕구 발생
   3) GO: 새로운 세계로
   4) SEARCH: 시련과 탐색
   5) FIND: 결정적 발견 (강력한 반전!)
   6) TAKE: 대가를 치르고 획득
   7) RETURN: 원래 세계로 귀환
   8) CHANGE: 성장한 모습

5. **조선시대 야담 스타일 유지**
   - 생동감 있는 구전 화법
   - 자연스러운 이름 표현 ("막순이가", "철수는")
   - 통쾌한 반전과 교훈

6. **PD 액션 플랜 최우선 실행**
   "${analysis.actionPlan}"
   ☝️ 이것을 제일 먼저 해결!

### 재작성 원칙:
✅ 원본의 주제와 핵심 메시지 유지
✅ PD 지적 사항 100% 반영 (타협 없음)
✅ 전체 흐름과 몰입도 극대화
✅ 길이: 6,000-10,000자 (원본과 유사)

### 출력 형식:
⚠️ 중요: 개선된 완전한 대본만 출력하세요.
설명, 주석, 분석 내용 등은 절대 포함하지 마세요.
대본 자체만 순수하게 출력!`,
      config: {
        temperature: 0.85,
        topP: 0.95,
        maxOutputTokens: 8192,
        stopSequences: []
      }
    });

    // 응답 검증
    if (!response || !response.text) {
      throw new Error("AI로부터 응답을 받지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해주세요.");
    }

    const improved = response.text.trim();
    
    // 결과 검증
    if (!improved) {
      throw new Error("빈 응답을 받았습니다. 다시 시도해주세요.");
    }
    
    if (improved.length < 2000) {
      throw new Error(`개선된 대본이 너무 짧습니다 (${improved.length}자). 최소 2000자 이상 필요합니다.`);
    }

    // 메타 텍스트 제거 (AI가 설명을 추가한 경우)
    const cleanedScript = improved
      .replace(/^##.*$/gm, '') // 제목 제거
      .replace(/^\*\*.*\*\*$/gm, '') // 볼드 제목 제거
      .replace(/^===+$/gm, '') // 구분선 제거
      .replace(/^---+$/gm, '') // 구분선 제거
      .replace(/^\[.*개선.*\].*$/gm, '') // [개선됨] 같은 태그 제거
      .replace(/^\(.*수정.*\).*$/gm, '') // (수정) 같은 주석 제거
      .trim();

    if (cleanedScript.length < 2000) {
      throw new Error("정제 후 대본이 너무 짧습니다. 다시 시도해주세요.");
    }

    return cleanedScript;

  } catch (error) {
    console.error("Script Improvement Error:", error);
    
    // 에러 메시지 명확화
    if (error instanceof Error) {
      if (error.message.includes("API")) {
        throw new Error(`API 오류: ${error.message}`);
      } else if (error.message.includes("네트워크")) {
        throw new Error("네트워크 연결을 확인해주세요.");
      } else if (error.message.includes("너무 짧")) {
        throw error; // 이미 명확한 메시지
      } else {
        throw new Error(`대본 개선 실패: ${error.message}`);
      }
    }
    
    throw new Error("알 수 없는 오류가 발생했습니다. 다시 시도해주세요.");
  }
};

// 대본 상세 분석 함수
export const analyzeScriptDetailed = async (
  script: string,
  apiKey: string
): Promise<DetailedScriptAnalysis> => {
  try {
    const ai = getAI(apiKey);
    const trimmedScript = script.length > 8000 
      ? script.substring(0, 8000) + '...\n(이하 생략)'
      : script;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `너는 전문 대본 분석가야. 아래 대본을 상세히 분석하고 개선점을 제시해줘.

대본:
"""
${trimmedScript}
"""

다음 항목들을 상세히 분석해줘:

1. 구조 분석 (Structure Analysis):
- 인트로 유무와 품질
- 본론의 전개 방식
- 결론/마무리 유무와 효과성
- 전체 구조 점수 (0-10)
- 구조 개선 피드백

2. 흐름 분석 (Flow Analysis):
- 전개 속도 평가 (빠름/적절/느림)
- 장면 전환의 자연스러움
- 흐름 점수 (0-10)
- 개선 제안 (3가지)

3. 콘텐츠 품질 (Content Quality):
- 명확성 점수 (0-10): 내용이 명확한가?
- 흥미도 점수 (0-10): 재미있는가?
- 독창성 점수 (0-10): 독특한가?
- 강점 3가지
- 약점 3가지

4. 기술적 문제점 (Technical Issues):
- 구체적인 문제점들 (라인 번호 포함 가능)
- 각 문제의 심각도 (high/medium/low)
- 수정 제안

5. 종합 평가:
- 전체적인 평가
- 개선 우선순위 (1-3개)

JSON 형식으로 응답해줘.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            structureAnalysis: {
              type: Type.OBJECT,
              properties: {
                hasIntro: { type: Type.BOOLEAN },
                hasBody: { type: Type.BOOLEAN },
                hasConclusion: { type: Type.BOOLEAN },
                structureScore: { type: Type.NUMBER },
                structureFeedback: { type: Type.STRING }
              },
              required: ["hasIntro", "hasBody", "hasConclusion", "structureScore", "structureFeedback"]
            },
            flowAnalysis: {
              type: Type.OBJECT,
              properties: {
                flowScore: { type: Type.NUMBER },
                pacing: { type: Type.STRING },
                transitionQuality: { type: Type.STRING },
                improvements: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["flowScore", "pacing", "transitionQuality", "improvements"]
            },
            contentQuality: {
              type: Type.OBJECT,
              properties: {
                clarityScore: { type: Type.NUMBER },
                engagementScore: { type: Type.NUMBER },
                originalityScore: { type: Type.NUMBER },
                strengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                weaknesses: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["clarityScore", "engagementScore", "originalityScore", "strengths", "weaknesses"]
            },
            technicalIssues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  issue: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                },
                required: ["issue", "severity", "suggestion"]
              }
            },
            overallSummary: { type: Type.STRING },
            improvementPriorities: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: [
            "structureAnalysis",
            "flowAnalysis",
            "contentQuality",
            "technicalIssues",
            "overallSummary",
            "improvementPriorities"
          ]
        }
      }
    });

    if (response.text) {
      const analysis = JSON.parse(response.text);
      return analysis as DetailedScriptAnalysis;
    }

    throw new Error("분석 결과를 받지 못했습니다.");
  } catch (error: any) {
    console.error("Detailed Analysis Error:", error);
    throw new Error(`대본 분석 실패: ${error.message || '알 수 없는 오류'}`);
  }
};

// 대본 수정 제안 생성 함수
export const generateScriptRevision = async (
  script: string,
  analysis: DetailedScriptAnalysis | null,
  apiKey: string
): Promise<ScriptRevision> => {
  try {
    const ai = getAI(apiKey);
    const trimmedScript = script.length > 8000 
      ? script.substring(0, 8000) + '...\n(이하 생략)'
      : script;

    const analysisContext = analysis 
      ? `\n\n분석 결과를 참고하여 수정하세요:
- 구조 점수: ${analysis.structureAnalysis.structureScore}/10
- 흐름 점수: ${analysis.flowAnalysis.flowScore}/10
- 명확성: ${analysis.contentQuality.clarityScore}/10
- 흥미도: ${analysis.contentQuality.engagementScore}/10
- 개선 우선순위: ${analysis.improvementPriorities.join(', ')}
- 주요 약점: ${analysis.contentQuality.weaknesses.join(', ')}`
      : '';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `너는 전문 대본 수정 전문가야. 아래 대본을 분석 결과를 바탕으로 개선해줘.

원본 대본:
"""
${trimmedScript}
"""
${analysisContext}

개선 작업:
1. 구조적 문제 해결 (인트로, 본론, 결론)
2. 흐름 개선 (장면 전환, 전개 속도)
3. 내용 강화 (명확성, 흥미도 향상)
4. 기술적 문제 수정

수정된 대본과 함께 변경 사항을 상세히 설명해줘.

JSON 형식:
{
  "original": "원본 대본 (요약)",
  "revised": "수정된 대본 (전체)",
  "changes": [
    {
      "type": "structure" | "flow" | "content" | "technical",
      "original": "수정 전 부분",
      "revised": "수정 후 부분",
      "reason": "수정 이유"
    }
  ],
  "summary": "전체 수정 요약"
}`,
      config: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 8192
      }
    });

    if (response.text) {
      // JSON 파싱 시도
      try {
        const revision = JSON.parse(response.text);
        return revision as ScriptRevision;
      } catch {
        // JSON 파싱 실패 시 텍스트를 구조화
        return {
          original: trimmedScript,
          revised: response.text,
          changes: [{
            type: 'content',
            original: '전체',
            revised: '개선됨',
            reason: '전체적인 품질 향상'
          }],
          summary: '대본이 개선되었습니다.'
        };
      }
    }

    throw new Error("수정 제안을 받지 못했습니다.");
  } catch (error: any) {
    console.error("Script Revision Error:", error);
    throw new Error(`대본 수정 실패: ${error.message || '알 수 없는 오류'}`);
  }
};

// 외부 분석 텍스트 기반 대본 수정
export const reviseScriptWithExternalAnalysis = async (
  script: string,
  externalAnalysis: string,
  apiKey: string
): Promise<ScriptRevision> => {
  try {
    const ai = getAI(apiKey);
    const trimmedScript = script.length > 8000 
      ? script.substring(0, 8000) + '...\n(이하 생략)'
      : script;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `너는 전문 대본 수정 전문가야. 아래 대본을 외부 분석 내용을 바탕으로 개선해줘.

원본 대본:
"""
${trimmedScript}
"""

외부 분석 내용 (이 내용을 참고하여 수정):
"""
${externalAnalysis}
"""

위 분석 내용이 지적한 모든 문제점을 해결하고, 제안사항을 반영하여 대본을 개선해줘.

개선 작업:
1. 분석에서 지적된 구조적 문제 해결
2. 제안된 흐름 개선 사항 반영
3. 명확성과 흥미도를 높이는 내용 수정
4. 기술적 문제 해결

수정된 대본과 함께 변경 사항을 상세히 설명해줘.

JSON 형식:
{
  "original": "원본 대본 (요약)",
  "revised": "수정된 대본 (전체)",
  "changes": [
    {
      "type": "structure" | "flow" | "content" | "technical",
      "original": "수정 전 부분",
      "revised": "수정 후 부분",
      "reason": "수정 이유"
    }
  ],
  "summary": "전체 수정 요약"
}`,
      config: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 8192
      }
    });

    if (response.text) {
      try {
        const revision = JSON.parse(response.text);
        return revision as ScriptRevision;
      } catch {
        // JSON 파싱 실패 시 텍스트를 구조화
        return {
          original: trimmedScript,
          revised: response.text,
          changes: [{
            type: 'content',
            original: '전체',
            revised: '개선됨',
            reason: '외부 분석 기반 전체적인 품질 향상'
          }],
          summary: '외부 분석 내용을 반영하여 대본이 개선되었습니다.'
        };
      }
    }

    throw new Error("수정 제안을 받지 못했습니다.");
  } catch (error: any) {
    console.error("External Analysis Revision Error:", error);
    throw new Error(`대본 수정 실패: ${error.message || '알 수 없는 오류'}`);
  }
};

