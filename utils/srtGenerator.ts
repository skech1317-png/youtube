// SRT 자막 생성 유틸리티

export interface SubtitleSegment {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

/**
 * 초를 SRT 시간 형식으로 변환 (HH:MM:SS,mmm)
 */
export const formatSRTTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
};

/**
 * 대본을 문장 단위로 분리
 */
export const splitIntoSentences = (script: string): string[] => {
  // 문장 부호로 분리 (마침표, 물음표, 느낌표 뒤에 공백이 있는 경우)
  const sentences = script
    .split(/([.!?]+\s+)/)
    .reduce((acc: string[], curr, idx, arr) => {
      if (idx % 2 === 0 && curr.trim()) {
        const sentence = curr + (arr[idx + 1] || '');
        acc.push(sentence.trim());
      }
      return acc;
    }, []);

  // 빈 문장 제거 및 너무 긴 문장은 쉼표로 추가 분리
  const result: string[] = [];
  sentences.forEach(sentence => {
    if (sentence.length > 100) {
      // 100자 이상이면 쉼표로 분리
      const parts = sentence.split(/,\s+/);
      parts.forEach((part, idx) => {
        if (idx < parts.length - 1) {
          result.push(part + ',');
        } else {
          result.push(part);
        }
      });
    } else {
      result.push(sentence);
    }
  });

  return result.filter(s => s.trim().length > 0);
};

/**
 * 문장 길이 기반 예상 읽기 시간 계산 (초)
 */
export const estimateReadingTime = (text: string): number => {
  const charCount = text.length;
  // 한국어: 평균 분당 300자 = 초당 5자
  const baseTime = charCount / 5;
  // 최소 2초, 최대 8초
  return Math.max(2, Math.min(8, baseTime));
};

/**
 * 대본을 SRT 자막으로 변환
 */
export const generateSRT = (
  script: string,
  options: {
    charsPerSecond?: number; // 초당 글자 수 (기본: 5)
    minDuration?: number; // 최소 자막 지속 시간 (초, 기본: 2)
    maxDuration?: number; // 최대 자막 지속 시간 (초, 기본: 8)
    gapBetweenSubtitles?: number; // 자막 간 간격 (초, 기본: 0.3)
  } = {}
): string => {
  const {
    charsPerSecond = 5,
    minDuration = 2,
    maxDuration = 8,
    gapBetweenSubtitles = 0.3
  } = options;

  const sentences = splitIntoSentences(script);
  const segments: SubtitleSegment[] = [];
  
  let currentTime = 0;

  sentences.forEach((sentence, index) => {
    const charCount = sentence.length;
    const duration = Math.max(
      minDuration,
      Math.min(maxDuration, charCount / charsPerSecond)
    );

    const startTime = formatSRTTime(currentTime);
    const endTime = formatSRTTime(currentTime + duration);

    segments.push({
      index: index + 1,
      startTime,
      endTime,
      text: sentence.trim()
    });

    currentTime += duration + gapBetweenSubtitles;
  });

  // SRT 형식으로 변환
  return segments
    .map(segment => {
      return `${segment.index}\n${segment.startTime} --> ${segment.endTime}\n${segment.text}\n`;
    })
    .join('\n');
};

/**
 * SRT 파일 다운로드
 */
export const downloadSRT = (srtContent: string, filename: string = 'subtitle.srt') => {
  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
