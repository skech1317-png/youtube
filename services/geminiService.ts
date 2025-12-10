import { GoogleGenAI, Type } from "@google/genai";
import { ScriptAnalysis, ShortsScript } from "../types";

const MODEL_NAME = 'gemini-1.5-flash';

// API 키를 받아서 AI 인스턴스 생성하는 헬퍼 함수
const getAI = (apiKey: string) => new GoogleGenAI({ apiKey });

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
    throw new Error(`주제 추천 중 오류: ${error.message || '알 수 없는 오류'}`);
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

:: 대본 구조 ::
[도입] - "${topic}"를 언급하며 호기심 자극
[전개] - "${topic}"의 핵심 사건 전개 (구체적 상황, 인물, 갈등)
[절정] - "${topic}"의 클라이막스 (반전/충격)
[마무리] - "${topic}"의 결말과 교훈

:: 길이 ::
${targetLength}

:: 최종 체크리스트 ::
✓ 제목("${topic}")과 내용이 100% 일치하는가?
✓ 주제를 직접적으로 다루고 있는가?
✓ 조선시대 야담 스타일인가?
✓ 호기심과 몰입을 유도하는가?

이제 창작 시작!`,
      config: {
        temperature: 0.85,
        topP: 0.95
      }
    });

    return response.text || "야담 대본을 생성하지 못했습니다.";
  } catch (error) {
    console.error("Gemini Yadam Error:", error);
    throw new Error("야담 대본 작성 중 오류가 발생했습니다.");
  }
};

// 4. PD 페르소나 - 대본 분석 (냉철하고 비판적)
export const analyzeScriptAsPD = async (script: string, apiKey: string): Promise<ScriptAnalysis> => {
  try {
    const ai = getAI(apiKey);
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

**중요**: 칭찬보다는 개선점에 집중하라. 100만 구독자 채널 기준에서 평가하라.`,
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
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
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

// 10. PD 분석 결과 기반 대본 개선 (강화된 버전)
export const improveScriptWithAnalysis = async (
  originalScript: string,
  analysis: ScriptAnalysis,
  apiKey: string
): Promise<string> => {
  try {
    const ai = getAI(apiKey);
    
    // 논리적 허점을 상세하게 정리
    const flawsSummary = analysis.logicalFlaws.length > 0
      ? analysis.logicalFlaws.map((f, i) => 
          `[허점 ${i + 1}]\n` +
          `원문: "${f.original}"\n` +
          `문제점: ${f.issue}\n` +
          `수정안: ${f.suggestion}\n`
        ).join('\n')
      : '발견되지 않음';
    
    // 지루함 경보 구간 정리
    const boringSummary = analysis.boringParts.length > 0
      ? analysis.boringParts.map((b, i) => 
          `[이탈위험 ${i + 1}] "${b.original}"\n` +
          `이유: ${b.reason}\n`
        ).join('\n')
      : '발견되지 않음';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `:: Role ::
너는 100만 구독자 유튜브 채널의 메인 시나리오 작가야.
PD의 냉정한 피드백을 100% 반영하여 대본을 완벽하게 개선해야 한다.

:: 원본 대본 ::
"""
${originalScript}
"""

:: PD 분석 결과 (반드시 반영) ::

📊 후킹 점수: ${analysis.hookingScore}/10
💬 PD 코멘트: ${analysis.hookingComment}

⚠️ 논리적 허점 (${analysis.logicalFlaws.length}개):
${flawsSummary}

😴 지루함 경보 구간 (${analysis.boringParts.length}개):
${boringSummary}

💬 PD 총평:
${analysis.overallComment}

🚨 최우선 액션 플랜:
${analysis.actionPlan}

:: Task - 대본 개선 ::

위 PD 분석을 **100% 반영**하여 대본을 완전히 재작성해줘.

## 필수 개선 사항:

1. **후킹 강화** (목표: ${Math.min(10, analysis.hookingScore + 3)}점 이상)
   - 첫 3초: 충격적인 질문이나 사건으로 시작
   - 초반 30초: 왜 봐야 하는지 명확히 제시
   - 클릭 후 이탈 방지 장치 추가

2. **논리적 허점 100% 보완**
   - 위에 나열된 모든 허점을 PD 수정안대로 수정
   - 인과관계 명확히, 비약 제거
   - 근거와 설득력 강화

3. **템포 조절 - 지루함 제거**
   - 지루함 경보 구간을 간결하게 압축
   - 불필요한 서론 삭제
   - 짧고 강렬한 문장으로 변경

4. **조선시대 야담 스타일 유지**
   - 생생한 일화, 구전 화법
   - 통쾌한 반전과 교훈

5. **길이 유지**
   - 8,000-10,000자 (원본과 유사한 길이)

## 중요 지침:
- PD가 지적한 문제를 **모두** 해결할 것
- 단순 수정이 아닌 **완전히 재작성**
- 개선 전보다 **명백히 나아진** 대본이어야 함

개선된 대본만 출력해줘.`,
      config: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    });

    if (response.text) {
      const improved = response.text.trim();
      if (improved.length < 3000) {
        throw new Error("개선된 대본이 너무 짧습니다. 다시 시도해주세요.");
      }
      return improved;
    }
    throw new Error("대본 개선 결과를 받을 수 없습니다.");
  } catch (error) {
    console.error("Script Improvement Error:", error);
    throw new Error("대본 개선 중 오류가 발생했습니다.");
  }
};

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
