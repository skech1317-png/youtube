import { GoogleGenAI, Type } from "@google/genai";
import { ChannelPlan } from "../types";

const MODEL_NAME = 'gemini-2.0-flash-exp';

// API 키를 받아서 AI 인스턴스 생성
const getAI = (apiKey: string) => new GoogleGenAI({ apiKey });

// 유튜브 채널 기획서 생성
export const generateChannelPlan = async (
  script: string,
  topic: string,
  apiKey: string
): Promise<Omit<ChannelPlan, 'id' | 'createdAt'>> => {
  try {
    const ai = getAI(apiKey);
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `너는 유튜브 채널 기획 전문가야. 아래 조선시대 야담 대본과 주제를 분석하여 떡상할 수 있는 채널 기획서를 만들어줘.

대본:
"""
${script.substring(0, 2000)}
"""

주제: "${topic}"

## 기획서 작성 가이드:

### 1. 타겟 시청자 분석
- 최근 1개월 내 떡상한 유사 콘텐츠 분석
- 20-40대 직장인, 학생 타겟
- 재미 + 교훈을 원하는 시청자

### 2. 콘텐츠 전략
- **형식**: 롱폼 (10-20분)
- **스타일**: 재미있는 스토리텔링 + 교훈적 메시지
- **톤앤매너**: 친근하지만 격조있는 조선시대 화법
- **차별화**: AI 기반 자동 대본 생성 (최신 트렌드 반영)

### 3. 경쟁 채널 분석
- 떡상한 주제를 분석하여 경쟁력 확보
- 트렌드를 벗어나지 않으면서도 독창적인 해석
- **핵심 강점**: 빠른 제작 속도 + 트렌드 민감성 + AI 기술

### 4. 트렌드 분석
- 최근 1개월 떡상 키워드
- 조회수 높은 야담/역사 콘텐츠 패턴
- 시청자 댓글 분석 (니즈 파악)

### 5. 영상 구성안
- 0:00-1:00 인트로 (후킹 멘트)
- 1:00-8:00 본 이야기 (기승전결)
- 8:00-10:00 교훈 및 현대적 해석
- 10:00-10:30 아웃트로 (구독 유도)

### 6. 수익화 방안
- 광고 수익 (조회수 기반)
- 채널 멤버십 (프리미엄 콘텐츠)
- 제휴 마케팅 (역사 서적, 강의)

### 7. 업로드 계획
- 주 2-3회 업로드
- 최적 시간대: 저녁 7-9시
- 시리즈물 기획 (연관 야담 연속 업로드)

JSON 형식으로 응답해줘:
{
  "topic": "주제",
  "targetAudience": "타겟 시청자 상세 설명",
  "contentStrategy": "콘텐츠 전략",
  "competitiveAdvantage": "경쟁 채널 대비 강점 (AI 기술 활용 강조)",
  "trendAnalysis": "최근 떡상 트렌드 분석",
  "videoStructure": "영상 구성안 (타임라인 포함)",
  "monetizationPlan": "수익화 방안",
  "uploadSchedule": "업로드 일정 및 전략"
}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            targetAudience: { type: Type.STRING },
            contentStrategy: { type: Type.STRING },
            competitiveAdvantage: { type: Type.STRING },
            trendAnalysis: { type: Type.STRING },
            videoStructure: { type: Type.STRING },
            monetizationPlan: { type: Type.STRING },
            uploadSchedule: { type: Type.STRING }
          },
          required: [
            "topic",
            "targetAudience",
            "contentStrategy",
            "competitiveAdvantage",
            "trendAnalysis",
            "videoStructure",
            "monetizationPlan",
            "uploadSchedule"
          ]
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return {
        topic: parsed.topic,
        targetAudience: parsed.targetAudience,
        contentStrategy: parsed.contentStrategy,
        competitiveAdvantage: parsed.competitiveAdvantage,
        trendAnalysis: parsed.trendAnalysis,
        videoStructure: parsed.videoStructure,
        monetizationPlan: parsed.monetizationPlan,
        uploadSchedule: parsed.uploadSchedule
      };
    }
    throw new Error("기획서를 파싱할 수 없습니다.");
  } catch (error) {
    console.error("Gemini Planning Error:", error);
    throw new Error("채널 기획서 생성 중 오류가 발생했습니다.");
  }
};
