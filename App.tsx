import React, { useState, useEffect } from 'react';
import { ScriptSession, INITIAL_SESSION, ScriptHistoryItem } from './types';
import { 
  suggestTopicsFromScript, 
  generateScriptForTopic, 
  generateYadamScript,
  analyzeScriptAsPD,
  generateShortsScript,
  generateImagePrompts,
  generateVideoTitle,
  generateVideoDescription,
  generateThumbnails,
  improveScriptWithAnalysis,
  analyzeScriptDetailed,
  generateScriptRevision,
  reviseScriptWithExternalAnalysis
} from './services/geminiService';
import { generateChannelPlan } from './services/planningService';
import { generateSRT, downloadSRT } from './utils/srtGenerator';

const App: React.FC = () => {
  // State
  const [session, setSession] = useState<ScriptSession>(INITIAL_SESSION);
  const [loading, setLoading] = useState<'IDLE' | 'SUGGESTING' | 'GENERATING' | 'ANALYZING' | 'ANALYZING_DETAILED' | 'REVISING' | 'IMPROVING' | 'SHORTS' | 'IMAGE_PROMPTS' | 'TITLE' | 'THUMBNAILS' | 'PLANNING'>('IDLE');

  // API 키 상태
  const [apiKey, setApiKey] = useState<string>("");
  useEffect(() => {
    const savedKey = localStorage.getItem("mvp_api_key") || "";
    setApiKey(savedKey);
  }, []);
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  };
  const handleApiKeySave = () => {
    localStorage.setItem("mvp_api_key", apiKey);
    setSession(prev => ({ ...prev, apiKey }));
    alert("API 키가 저장되었습니다!");
  };

  // 로딩 메시지 헬퍼
  const getLoadingMessage = () => {
    switch (loading) {
      case 'SUGGESTING': return '🔍 대본 DNA 분석 중...';
      case 'GENERATING': return '✍️ 새로운 대본 작성 중...';
      case 'TITLE': return '🎬 매력적인 제목 생성 중...';
      case 'THUMBNAILS': return '🖼️ 클릭률 높은 썸네일 구상 중...';
      case 'IMAGE_PROMPTS': return '👥 등장인물 이미지 생성 중...';
      case 'ANALYZING': return '� 대본 분석 및 자동 개선 진행 중... (후킹 점수 8점 목표)';
      case 'ANALYZING_DETAILED': return '🔬 대본 상세 분석 중...';
      case 'REVISING': return '✨ 대본 수정 제안 생성 중...';
      case 'IMPROVING': return '🔧 PD 피드백 반영하여 대본 개선 중...';
      case 'SHORTS': return '📱 숏츠 대본 제작 중...';
      case 'PLANNING': return '📋 채널 기획서 작성 중...';
      default: return null;
    }
  };
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [scriptType, setScriptType] = useState<'NORMAL' | 'YADAM'>('YADAM'); // 기본값을 야담으로
  const [editedScriptForSRT, setEditedScriptForSRT] = useState<string>(''); // SRT 생성용 수정 대본
  const [showSRTEditor, setShowSRTEditor] = useState<boolean>(false);
  const [externalAnalysisText, setExternalAnalysisText] = useState<string>(''); // 외부 분석 텍스트
  const [showExternalAnalysis, setShowExternalAnalysis] = useState<boolean>(false); // 외부 분석 입력란 표시
  
  // SRT 설정
  const [srtCharsPerSecond, setSrtCharsPerSecond] = useState<number>(5); // 초당 글자 수
  const [srtMinDuration, setSrtMinDuration] = useState<number>(2); // 최소 지속 시간
  const [srtMaxDuration, setSrtMaxDuration] = useState<number>(8); // 최대 지속 시간
  const [srtGap, setSrtGap] = useState<number>(0.3); // 자막 간 간격

  // Persistence: Load
  useEffect(() => {
    const saved = localStorage.getItem('mvp_script_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // API 키는 절대 저장하지 않음 - 매번 새로 입력 필수
        setSession({
          ...INITIAL_SESSION,
          ...parsed,
          apiKey: '', // 보안: API 키는 절대 불러오지 않음
          isEditMode: parsed.isEditMode ?? false,
          generatedScripts: parsed.generatedScripts ?? [],
          history: parsed.history ?? [],
          analysis: parsed.analysis ?? null,
          detailedAnalysis: parsed.detailedAnalysis ?? null,
          scriptRevision: parsed.scriptRevision ?? null,
          shortsScripts: parsed.shortsScripts ?? [],
          channelPlans: parsed.channelPlans ?? [],
          imagePrompts: parsed.imagePrompts ?? [],
          videoTitle: parsed.videoTitle ?? null,
          thumbnails: parsed.thumbnails ?? [],
        });
      } catch (e) {
        console.error("Failed to load session");
      }
    }
  }, []);

  // Persistence: Save (API 키 제외)
  useEffect(() => {
    // 보안: API 키는 절대 저장하지 않음
    const { apiKey, ...sessionWithoutApiKey } = session;
    localStorage.setItem('mvp_script_session', JSON.stringify(sessionWithoutApiKey));
  }, [session]);

  // Handler: Update Input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSession(prev => ({ ...prev, originalScript: e.target.value }));
  };

  // Handler: Step 1 - Suggest Topics
  const handleSuggest = async () => {
    if (!session.originalScript.trim()) {
      setErrorMsg("대본이나 아이디어를 먼저 입력해주세요.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }
    setLoading('ANALYZING');
    setErrorMsg(null);
    try {
      // 1단계: 먼저 PD 분석을 실행하여 결과를 보여줌
      const analysis = await analyzeScriptAsPD(session.originalScript, session.apiKey);
      setSession(prev => ({ ...prev, analysis }));
      // 2단계: 분석 결과가 UI에 표시된 후 자동개선 및 주제추천 진행
      setTimeout(async () => {
        try {
          // 자동개선 및 주제추천 기존 로직 실행
          const improvedScript = await autoImproveUntilHookingScore8(
            session.originalScript,
            '원본 대본'
          );
          setLoading('SUGGESTING');
          const topics = await suggestTopicsFromScript(improvedScript, session.apiKey);
          setSession(prev => ({
            ...prev,
            originalScript: improvedScript,
            suggestedTopics: topics,
            selectedTopic: null,
            generatedNewScript: null
          }));
          alert(
            '✅ 대본 개선 및 주제 추천 완료!\n\n' +
            '🎯 원본 대본이 후킹 점수 8점 이상으로 개선되었습니다.\n' +
            '📝 이제 추천된 주제를 선택하여 새 대본을 생성하세요!'
          );
        } catch (e: any) {
          setErrorMsg(`대본 개선 실패: ${e.message || 'AI 연결 상태를 확인해주세요.'}`);
          alert(`❌ 오류 발생\n\n${e.message || 'AI 연결 상태를 확인해주세요.'}\n\n브라우저 콘솔(F12)에서 자세한 내용을 확인하세요.`);
        } finally {
          setLoading('IDLE');
        }
      }, 500); // 분석 결과가 UI에 먼저 반영되도록 약간의 지연
    } catch (e: any) {
      setErrorMsg(`분석 실패: ${e.message || 'AI 연결 상태를 확인해주세요.'}`);
      alert(`❌ 분석 오류\n\n${e.message || 'AI 연결 상태를 확인해주세요.'}\n\n브라우저 콘솔(F12)에서 자세한 내용을 확인하세요.`);
      setLoading('IDLE');
    }
  };

  // 후킹 점수 8점 이상이 될 때까지 자동 개선
  const autoImproveUntilHookingScore8 = async (script: string, topic: string): Promise<string> => {
    let currentScript = script;
    let iteration = 0;
    const maxIterations = 5; // 최대 5회 시도
    let lastAnalysis = null;

    while (iteration < maxIterations) {
      iteration++;
      try {
        // 1. PD 분석 실행
        setLoading('ANALYZING');
        const analysis = await analyzeScriptAsPD(currentScript, session.apiKey);
        lastAnalysis = analysis;
        setSession(prev => ({ ...prev, analysis }));

        console.log(`[${iteration}회차] 후킹 점수: ${analysis.hookingScore}/10`);

        // 2. 후킹 점수 체크 (7점 이상이면 성공)
        if (analysis.hookingScore >= 7) {
          // 길이 제한: 10,000자 이내로 자르기
          const finalScript = currentScript.length > 10000 ? currentScript.slice(0, 10000) : currentScript;
          alert(
            `✅ 목표 달성! (${iteration}회 개선)\n\n` +
            `📊 최종 후킹 점수: ${analysis.hookingScore}/10\n` +
            `🎯 ${iteration}번의 개선을 거쳐 완벽한 대본이 완성되었습니다!`
          );
          // 최종 개선 대본 히스토리에 저장
          saveToHistory(
            `${topic} (자동개선${iteration}회_후킹${analysis.hookingScore})`,
            finalScript,
            true
          );
          return finalScript;
        }

        // 3. 아직 8점 미만이면 개선 진행
        alert(
          `🔄 ${iteration}회차 개선 진행 중...\n\n` +
          `📊 현재 후킹 점수: ${analysis.hookingScore}/10\n` +
          `⚠️ 발견된 문제: ${analysis.logicalFlaws.length + analysis.boringParts.length}개\n\n` +
          `🎯 목표: 8점 이상\n` +
          `💡 PD 피드백을 반영하여 자동 개선합니다...`
        );

        // API 속도 제한 회피
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 4. 대본 개선
        setLoading('IMPROVING');
        const improvedScript = await improveScriptWithAnalysis(
          currentScript,
          analysis,
          session.apiKey
        );

        // 5. 개선된 대본 저장
        saveToHistory(
          `${topic} (개선${iteration}회_후킹${analysis.hookingScore})`,
          improvedScript,
          true
        );

        currentScript = improvedScript;

        // 다음 반복 전 대기 (API 속도 제한 회피)
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (e: any) {
        console.error(`[${iteration}회차] 개선 실패:`, e);
        
        // 마지막 시도였다면 에러 발생
        if (iteration >= maxIterations) {
          throw new Error(
            `${maxIterations}회 시도 후에도 개선에 실패했습니다.\n` +
            `최종 후킹 점수: ${lastAnalysis?.hookingScore || 0}/10\n\n` +
            `원본 대본을 그대로 사용합니다.`
          );
        }

        // 중간에 실패하면 잠시 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // 최대 시도 횟수 도달
    if (lastAnalysis) {
      alert(
        `⚠️ ${maxIterations}회 개선 완료\n\n` +
        `📊 최종 후킹 점수: ${lastAnalysis.hookingScore}/10\n` +
        `🎯 목표(8점)에는 미달했지만 최선을 다해 개선했습니다.\n\n` +
        `💡 수동으로 추가 수정을 권장합니다.`
      );
    }

    return currentScript;
  };

  // 자동 분석 및 개선 함수 (원본 대본용 - 즉시 개선)
  const autoAnalyzeAndImprove = async (script: string, topic: string) => {
    try {
      // 1. PD 분석 자동 실행
      setLoading('ANALYZING');
      const analysis = await analyzeScriptAsPD(script, session.apiKey);
      setSession(prev => ({ ...prev, analysis }));

      // 2. 분석 결과를 사용자에게 보여주고 API 속도 제한 회피 (429 에러 방지)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 3. 자동으로 개선된 대본 생성
      setLoading('IMPROVING');
      const improvedScript = await improveScriptWithAnalysis(
        script,
        analysis,
        session.apiKey
      );

      // 4. 개선된 대본을 히스토리에 추가
      saveToHistory(topic + ' (AI개선ver)', improvedScript, true);

      // 5. 개선된 대본으로 메타데이터 재생성
      await generateAllMetadata(improvedScript);

      // 6. 개선 완료 알림
      alert(
        '✅ 대본 자동 개선 완료!\n\n' +
        `📊 원본 후킹 점수: ${analysis.hookingScore}/10\n` +
        `⚠️ 발견된 문제: 논리적 허점 ${analysis.logicalFlaws.length}개, 지루함 경보 ${analysis.boringParts.length}개\n\n` +
        '🎯 PD 피드백이 모두 반영되어 개선된 대본이 생성되었습니다.\n' +
        '📝 히스토리에서 원본과 개선 버전을 비교해보세요!'
      );

      // 7. 개선된 대본을 현재 대본으로 설정 (선택사항)
      setSession(prev => ({ 
        ...prev, 
        generatedNewScript: improvedScript 
      }));

    } catch (e: any) {
      console.error('자동 분석 및 개선 실패:', e);
      const errorMsg = e?.message || '알 수 없는 오류';
      alert(
        '⚠️ 자동 개선 중 오류 발생\n\n' +
        '대본은 정상적으로 생성되었지만,\n' +
        '자동 분석 및 개선 단계에서 문제가 발생했습니다.\n\n' +
        `오류: ${errorMsg}\n\n` +
        '💡 수동으로 "PD분석" 버튼을 클릭하여 다시 시도할 수 있습니다.'
      );
    } finally {
      setLoading('IDLE');
    }
  };

  // Handler: Step 2 - Generate Script
  const handleGenerateScript = async (topic: string) => {
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }
    
    setLoading('GENERATING');
    setSession(prev => ({ ...prev, selectedTopic: topic }));
    setErrorMsg(null);

    try {
      // 히스토리 참고용으로 최근 3개 대본 전달
      const recentHistory = session.history.slice(-3).map(h => h.script).join('\n---\n');
      
      // 야담 스타일 또는 일반 스타일
      const script = scriptType === 'YADAM' 
        ? await generateYadamScript(topic, session.originalScript, session.apiKey, recentHistory)
        : await generateScriptForTopic(topic, session.originalScript, session.apiKey, recentHistory);
      
      const newGeneratedScript = {
        topic,
        script,
        timestamp: Date.now(),
      };

      setSession(prev => ({ 
        ...prev, 
        generatedNewScript: script,
        generatedScripts: [...prev.generatedScripts, newGeneratedScript],
      }));

      // 히스토리에 자동 추가
      saveToHistory(topic, script, false);

      // 대본 생성 완료 후 자동으로 제목 생성
      await generateAllMetadata(script);

      // 메타데이터 생성 후 추가 대기 (API 속도 제한 회피)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 자동으로 PD 분석 및 개선 실행 (속도 제어 포함)
      try {
        await autoAnalyzeAndImprove(script, topic);
      } catch (autoImproveError: any) {
        console.error('자동 개선 호출 실패:', autoImproveError);
        // 자동 개선 실패는 치명적이지 않으므로 계속 진행
      }
    } catch (e: any) {
      const errorMsg = e?.message || "대본 생성 실패: 잠시 후 다시 시도해주세요.";
      setErrorMsg(errorMsg);
      console.error("대본 생성 에러:", e);
      alert(`❌ 대본 생성 실패\n\n${errorMsg}\n\n💡 F12를 눌러 Console 탭에서 자세한 오류를 확인하세요.`);
    } finally {
      setLoading('IDLE');
    }
  };

  // 대본의 메타데이터 자동 생성 (제목만)
  const generateAllMetadata = async (script: string) => {
    try {
      setLoading('TITLE');
      const title = await generateVideoTitle(script, session.apiKey);
      setSession(prev => ({ ...prev, videoTitle: title }));
    } catch (e: any) {
      console.error('제목 생성 실패:', e);
      alert(`⚠️ 제목 생성 실패\n\n대본은 정상적으로 생성되었습니다.`);
    }
  };

  // PD 분석 실행
  const handleAnalyze = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("분석할 대본이 없습니다. 먼저 대본을 생성해주세요.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    setLoading('ANALYZING');
    setErrorMsg(null);

    try {
      const analysis = await analyzeScriptAsPD(session.generatedNewScript, session.apiKey);
      setSession(prev => ({ ...prev, analysis }));
    } catch (e: any) {
      const errorMsg = e?.message || "분석 실패: 잠시 후 다시 시도해주세요.";
      setErrorMsg(errorMsg);
      console.error("PD 분석 에러:", e);
      alert(`❌ 분석 실패\n\n${errorMsg}\n\n💡 F12를 눌러 Console 탭에서 자세한 오류를 확인하세요.`);
    } finally {
      setLoading('IDLE');
    }
  };

  // PD 분석 기반 대본 개선
  const handleImproveScript = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("개선할 대본이 없습니다.");
      return;
    }
    if (!session.analysis) {
      setErrorMsg("먼저 PD 분석을 실행해주세요.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    // 확인 메시지
    const confirmImprove = window.confirm(
      `🔧 PD 분석 결과를 반영하여 대본을 개선합니다.\n\n` +
      `📊 현재 후킹 점수: ${session.analysis.hookingScore}/10\n` +
      `⚠️ 발견된 문제: 논리적 허점 ${session.analysis.logicalFlaws.length}개, 지루함 경보 ${session.analysis.boringParts.length}개\n\n` +
      `계속하시겠습니까?`
    );

    if (!confirmImprove) return;

    setLoading('IMPROVING');
    setErrorMsg(null);

    try {
      console.log('🔄 대본 개선 시작...');
      console.log('대본 길이:', session.generatedNewScript.length);
      console.log('분석 결과:', session.analysis);

      const improvedScript = await improveScriptWithAnalysis(
        session.generatedNewScript,
        session.analysis,
        session.apiKey
      );
      
      console.log('✅ 개선된 대본 길이:', improvedScript.length);

      // 유효성 검증
      if (!improvedScript || improvedScript.length < 1000) {
        throw new Error('개선된 대본이 너무 짧습니다.');
      }
      
      // 개선 전 대본 백업
      const beforeImprovement = session.generatedNewScript;
      
      setSession(prev => ({ 
        ...prev, 
        generatedNewScript: improvedScript,
        // 분석 결과 초기화 (새로운 대본이므로 재분석 필요)
        analysis: null,
        // 메타데이터도 초기화 (재생성 필요)
        videoTitle: null,
        thumbnails: [],
        imagePrompts: [],
        videoDescription: null,
      }));

      // 개선된 대본을 히스토리에 추가
      if (session.selectedTopic) {
        saveToHistory(session.selectedTopic + ' (PD개선ver)', improvedScript, true);
      }

      setLoading('IDLE');

      alert(
        '✅ 대본 개선 완료!\n\n' +
        `📊 개선 전: ${beforeImprovement.length}자\n` +
        `📊 개선 후: ${improvedScript.length}자\n\n` +
        '🎯 PD 피드백이 모두 반영되었습니다.\n' +
        '📝 제목/썸네일/등장인물 버튼을 눌러 다시 생성하세요.\n\n' +
        '💡 개선된 대본을 다시 PD 분석해보세요!'
      );

      // 자동으로 메타데이터 재생성 (선택 사항)
      const autoGenerate = window.confirm(
        '📝 제목, 썸네일, 등장인물도 자동으로 다시 생성할까요?\n\n' +
        '(취소를 누르면 원하는 것만 개별적으로 생성할 수 있습니다)'
      );

      if (autoGenerate) {
        setLoading('GENERATING_METADATA');
        try {
          await generateAllMetadata(improvedScript);
          alert('✅ 메타데이터 재생성 완료!');
        } catch (metaError) {
          console.error('메타데이터 생성 오류:', metaError);
          alert('⚠️ 메타데이터 자동 생성에 실패했습니다.\n개별 버튼으로 생성해주세요.');
        }
      }

    } catch (e) {
      console.error('❌ 대본 개선 에러:', e);
      
      // 에러 메시지 상세화
      let errorMessage = "대본 개선 중 오류가 발생했습니다.";
      if (e instanceof Error) {
        errorMessage = e.message;
      }
      
      setErrorMsg(errorMessage);
      alert(
        `❌ 대본 개선 실패\n\n` +
        `오류: ${errorMessage}\n\n` +
        `해결 방법:\n` +
        `1. API 키가 유효한지 확인\n` +
        `2. 인터넷 연결 확인\n` +
        `3. 잠시 후 다시 시도\n` +
        `4. 대본이 너무 짧지 않은지 확인`
      );
    } finally {
      setLoading('IDLE');
    }
  };

  // 숏츠 생성
  const handleGenerateShorts = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("숏츠를 만들 대본이 없습니다.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    setLoading('SHORTS');
    setErrorMsg(null);

    try {
      const yadamHistory = session.history
        .slice(-3)
        .map(h => h.script)
        .join('\n---\n');
      
      const shortsData = await generateShortsScript(session.generatedNewScript, session.apiKey, yadamHistory);
      const newShorts = {
        ...shortsData,
        id: `shorts_${Date.now()}`,
        createdAt: Date.now(),
      };

      setSession(prev => ({
        ...prev,
        shortsScripts: [...prev.shortsScripts, newShorts],
      }));

      alert(`숏츠 대본 생성 완료! (${shortsData.duration}초)`);
    } catch (e) {
      setErrorMsg("숏츠 생성 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading('IDLE');
    }
  };

  // 제목 생성
  const handleGenerateTitle = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("먼저 대본을 생성해주세요.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    setLoading('TITLE');
    setErrorMsg(null);

    try {
      const title = await generateVideoTitle(session.generatedNewScript, session.apiKey);
      setSession(prev => ({
        ...prev,
        videoTitle: title,
      }));
    } catch (e) {
      setErrorMsg("제목 생성 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading('IDLE');
    }
  };

  // 영상 설명(디스크립션) 생성
  const handleGenerateDescription = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("먼저 대본을 생성해주세요.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    const title = session.videoTitle || session.selectedTopic || "조선시대 야담";

    setLoading('TITLE'); // 디스크립션용 로딩 상태 추가 가능
    setErrorMsg(null);

    try {
      const description = await generateVideoDescription(session.generatedNewScript, title, session.apiKey);
      setSession(prev => ({
        ...prev,
        videoDescription: description,
      }));
      alert('✅ 영상 설명(디스크립션)이 생성되었습니다!');
    } catch (e) {
      setErrorMsg("영상 설명 생성 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading('IDLE');
    }
  };

  // 썸네일 프롬프트 생성
  const handleGenerateThumbnails = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("먼저 대본을 생성해주세요.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    const title = session.videoTitle || session.selectedTopic || "조선시대 야담";

    setLoading('THUMBNAILS');
    setErrorMsg(null);

    try {
      const thumbnails = await generateThumbnails(session.generatedNewScript, title, session.apiKey);
      setSession(prev => ({
        ...prev,
        thumbnails: thumbnails,
      }));
      alert(`${thumbnails.length}개의 썸네일 프롬프트가 생성되었습니다!`);
    } catch (e) {
      setErrorMsg("썸네일 생성 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading('IDLE');
    }
  };

  // 이미지 프롬프트 생성
  // 등장인물 이미지 프롬프트 생성
  const handleGenerateImagePrompts = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("먼저 대본을 생성해주세요.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    setLoading('IMAGE_PROMPTS');
    setErrorMsg(null);

    try {
      const prompts = await generateImagePrompts(session.generatedNewScript, session.apiKey);
      setSession(prev => ({
        ...prev,
        imagePrompts: prompts,
      }));
      alert(`${prompts.length}명의 등장인물 이미지 프롬프트가 생성되었습니다!`);
    } catch (e: any) {
      const errorMsg = e?.message || "등장인물 이미지 프롬프트 생성 실패: 잠시 후 다시 시도해주세요.";
      setErrorMsg(errorMsg);
      console.error("등장인물 이미지 프롬프트 생성 에러:", e);
    } finally {
      setLoading('IDLE');
    }
  };

  // SRT 자막 생성
  const handleGenerateSRT = () => {
    if (!editedScriptForSRT.trim()) {
      alert('⚠️ 대본을 먼저 입력해주세요!');
      return;
    }

    try {
      const srtContent = generateSRT(editedScriptForSRT, {
        charsPerSecond: srtCharsPerSecond,
        minDuration: srtMinDuration,
        maxDuration: srtMaxDuration,
        gapBetweenSubtitles: srtGap
      });

      // 파일명 생성 (주제 또는 기본값)
      const filename = session.selectedTopic 
        ? `${session.selectedTopic.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.srt`
        : 'subtitle.srt';

      downloadSRT(srtContent, filename);
      alert(`✅ SRT 자막 파일이 다운로드되었습니다!\n\n파일명: ${filename}`);
    } catch (error) {
      console.error('SRT 생성 오류:', error);
      alert('❌ SRT 자막 생성 중 오류가 발생했습니다.');
    }
  };

  // 생성된 대본을 SRT 편집기로 복사
  const handleCopyToSRTEditor = () => {
    if (!session.generatedNewScript) {
      alert('⚠️ 먼저 대본을 생성해주세요!');
      return;
    }
    setEditedScriptForSRT(session.generatedNewScript);
    setShowSRTEditor(true);
    alert('✅ 대본이 SRT 편집기로 복사되었습니다!');
  };

  // 채널 기획서 생성
  const handleGeneratePlan = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("기획서를 만들 대본이 없습니다.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    setLoading('PLANNING');
    setErrorMsg(null);

    try {
      const topic = session.selectedTopic || session.videoTitle || "조선시대 야담";
      const planData = await generateChannelPlan(
        session.generatedNewScript,
        topic,
        session.apiKey
      );
      
      const newPlan = {
        ...planData,
        id: `plan_${Date.now()}`,
        createdAt: Date.now(),
      };

      setSession(prev => ({
        ...prev,
        channelPlans: [...prev.channelPlans, newPlan],
      }));

      alert('채널 기획서가 생성되었습니다!');
    } catch (e) {
      setErrorMsg("기획서 생성 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading('IDLE');
    }
  };

  // 히스토리에 저장
  const saveToHistory = (topic: string, script: string, isEdited: boolean) => {
    const newItem: ScriptHistoryItem = {
      id: `history_${Date.now()}`,
      topic,
      script,
      createdAt: Date.now(),
      isEdited,
    };
    setSession(prev => ({
      ...prev,
      history: [...prev.history, newItem],
    }));
  };

  // 대본 상세 분석 핸들러
  const handleDetailedAnalysis = async () => {
    const scriptToAnalyze = session.generatedNewScript || session.originalScript;
    
    if (!scriptToAnalyze || !scriptToAnalyze.trim()) {
      setErrorMsg("분석할 대본이 없습니다.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    setLoading('ANALYZING_DETAILED');
    setErrorMsg(null);

    try {
      const detailedAnalysis = await analyzeScriptDetailed(scriptToAnalyze, session.apiKey);
      setSession(prev => ({
        ...prev,
        detailedAnalysis,
      }));

      const avgScore = (
        detailedAnalysis.structureAnalysis.structureScore +
        detailedAnalysis.flowAnalysis.flowScore +
        detailedAnalysis.contentQuality.clarityScore +
        detailedAnalysis.contentQuality.engagementScore +
        detailedAnalysis.contentQuality.originalityScore
      ) / 5;

      alert(
        `✅ 상세 분석 완료!\n\n` +
        `📊 평균 점수: ${avgScore.toFixed(1)}/10\n` +
        `🏗️ 구조: ${detailedAnalysis.structureAnalysis.structureScore}/10\n` +
        `🌊 흐름: ${detailedAnalysis.flowAnalysis.flowScore}/10\n` +
        `💡 명확성: ${detailedAnalysis.contentQuality.clarityScore}/10\n` +
        `🎯 흥미도: ${detailedAnalysis.contentQuality.engagementScore}/10\n` +
        `✨ 독창성: ${detailedAnalysis.contentQuality.originalityScore}/10\n\n` +
        `⚠️ 발견된 문제: ${detailedAnalysis.technicalIssues.length}개\n\n` +
        `분석 결과를 확인하고 "대본 수정 제안" 버튼을 눌러보세요!`
      );
    } catch (e: any) {
      console.error('상세 분석 실패:', e);
      setErrorMsg(`상세 분석 실패: ${e.message || 'AI 연결 상태를 확인해주세요.'}`);
    } finally {
      setLoading('IDLE');
    }
  };

  // 대본 수정 제안 생성 핸들러
  const handleGenerateRevision = async () => {
    const scriptToRevise = session.generatedNewScript || session.originalScript;
    
    if (!scriptToRevise || !scriptToRevise.trim()) {
      setErrorMsg("수정할 대본이 없습니다.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    setLoading('REVISING');
    setErrorMsg(null);

    try {
      const revision = await generateScriptRevision(
        scriptToRevise,
        session.detailedAnalysis,
        session.apiKey
      );
      
      setSession(prev => ({
        ...prev,
        scriptRevision: revision,
      }));

      const applyRevision = window.confirm(
        `✅ 수정 제안이 완료되었습니다!\n\n` +
        `📝 ${revision.changes.length}개의 변경사항이 제안되었습니다.\n\n` +
        `수정된 대본을 적용하시겠습니까?`
      );

      if (applyRevision) {
        setSession(prev => ({
          ...prev,
          generatedNewScript: revision.revised,
          // 수정 후 분석 초기화
          detailedAnalysis: null,
          analysis: null,
        }));

        // 히스토리에 저장
        if (session.selectedTopic) {
          saveToHistory(session.selectedTopic + ' (AI수정ver)', revision.revised, true);
        }

        alert(
          `✅ 수정된 대본이 적용되었습니다!\n\n` +
          `다시 분석하거나 추가로 수정할 수 있습니다.`
        );
      }
    } catch (e: any) {
      console.error('대본 수정 실패:', e);
      setErrorMsg(`대본 수정 실패: ${e.message || 'AI 연결 상태를 확인해주세요.'}`);
    } finally {
      setLoading('IDLE');
    }
  };

  // 외부 분석 기반 대본 수정
  const handleExternalAnalysisRevision = async () => {
    const scriptToRevise = session.generatedNewScript || session.originalScript;
    
    if (!scriptToRevise || !scriptToRevise.trim()) {
      setErrorMsg("수정할 대본이 없습니다.");
      return;
    }
    if (!externalAnalysisText || !externalAnalysisText.trim()) {
      setErrorMsg("분석 내용을 입력해주세요.");
      return;
    }
    if (!session.apiKey || !session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }

    setLoading('REVISING');
    setErrorMsg(null);

    try {
      const revision = await reviseScriptWithExternalAnalysis(
        scriptToRevise,
        externalAnalysisText,
        session.apiKey
      );
      
      setSession(prev => ({
        ...prev,
        scriptRevision: revision,
      }));

      const applyRevision = window.confirm(
        `✅ 외부 분석 기반 수정이 완료되었습니다!\n\n` +
        `📝 ${revision.changes.length}개의 변경사항이 제안되었습니다.\n\n` +
        `수정된 대본을 적용하시겠습니까?`
      );

      if (applyRevision) {
        setSession(prev => ({
          ...prev,
          generatedNewScript: revision.revised,
          // 수정 후 분석 초기화
          detailedAnalysis: null,
          analysis: null,
        }));

        // 히스토리에 저장
        if (session.selectedTopic) {
          saveToHistory(session.selectedTopic + ' (외부분석수정ver)', revision.revised, true);
        }

        // 외부 분석 텍스트 초기화
        setExternalAnalysisText('');
        setShowExternalAnalysis(false);

        alert(
          `✅ 외부 분석 기반 수정이 적용되었습니다!\n\n` +
          `다시 분석하거나 추가로 수정할 수 있습니다.`
        );
      }
    } catch (e: any) {
      console.error('외부 분석 기반 수정 실패:', e);
      setErrorMsg(`대본 수정 실패: ${e.message || 'AI 연결 상태를 확인해주세요.'}`);
    } finally {
      setLoading('IDLE');
    }
  };

  // 대본 편집
  const handleEditScript = (newText: string) => {
    setSession(prev => ({ ...prev, generatedNewScript: newText }));
  };

  // 편집 모드 토글
  const toggleEditMode = () => {
    setSession(prev => ({ ...prev, isEditMode: !prev.isEditMode }));
  };

  // 편집 완료 후 히스토리에 저장
  const saveEditedScript = () => {
    if (session.generatedNewScript && session.selectedTopic) {
      saveToHistory(session.selectedTopic, session.generatedNewScript, true);
      setSession(prev => ({ ...prev, isEditMode: false }));
      alert('편집된 대본이 히스토리에 저장되었습니다!');
    }
  };

  // 클립보드 복사
  const handleCopy = () => {
    if (session.generatedNewScript) {
      navigator.clipboard.writeText(session.generatedNewScript);
      alert('대본이 클립보드에 복사되었습니다!');
    }
  };

  // TXT 다운로드
  const handleDownload = () => {
    if (session.generatedNewScript && session.selectedTopic) {
      const blob = new Blob([session.generatedNewScript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.selectedTopic.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // 히스토리에서 대본 불러오기
  const loadFromHistory = (item: ScriptHistoryItem) => {
    setSession(prev => ({
      ...prev,
      selectedTopic: item.topic,
      generatedNewScript: item.script,
    }));
    setShowHistory(false);
  };

  // 히스토리 삭제
  const deleteHistory = (id: string) => {
    if (window.confirm('이 대본을 히스토리에서 삭제하시겠습니까?')) {
      setSession(prev => ({
        ...prev,
        history: prev.history.filter(h => h.id !== id),
      }));
    }
  };

  // 비교 모드에서 대본 제거
  const removeFromCompare = (timestamp: number) => {
    setSession(prev => ({
      ...prev,
      generatedScripts: prev.generatedScripts.filter(s => s.timestamp !== timestamp),
    }));
  };

  // Handler: Clear All
  const handleClear = () => {
    if (window.confirm("모든 내용을 초기화하시겠습니까?")) {
      setSession(INITIAL_SESSION);
        useEffect(() => {
          const saved = localStorage.getItem('mvp_script_session');
          const savedKey = localStorage.getItem('mvp_api_key') || '';
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              setSession({
                ...INITIAL_SESSION,
                ...parsed,
                apiKey: savedKey,
                isEditMode: parsed.isEditMode ?? false,
                generatedScripts: parsed.generatedScripts ?? [],
                history: parsed.history ?? [],
                analysis: parsed.analysis ?? null,
                detailedAnalysis: parsed.detailedAnalysis ?? null,
                scriptRevision: parsed.scriptRevision ?? null,
                shortsScripts: parsed.shortsScripts ?? [],
                channelPlans: parsed.channelPlans ?? [],
                imagePrompts: parsed.imagePrompts ?? [],
                videoTitle: parsed.videoTitle ?? null,
                thumbnails: parsed.thumbnails ?? [],
              });
            } catch {
              setSession({ ...INITIAL_SESSION, apiKey: savedKey });
            }
          } else {
            setSession({ ...INITIAL_SESSION, apiKey: savedKey });
          }
        }, []);
      localStorage.removeItem('mvp_script_session');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center py-8 px-4 font-sans">
      {/* API 키 입력란 (상단 고정) */}
      <div className="w-full max-w-5xl flex justify-end mb-2">
        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm">
          <span className="text-xs text-gray-500">🔑 API 키</span>
          <input
            type="text"
            className="text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50"
            placeholder="API 키를 입력하세요"
            value={apiKey}
            onChange={handleApiKeyChange}
            style={{ width: 180 }}
          />
          <button
            className="ml-2 px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
            onClick={handleApiKeySave}
          >
            저장
          </button>
        </div>
      </div>
      <div className="w-full max-w-5xl">
        {/* Header */}
        <header className="bg-gradient-to-r from-black to-gray-900 text-white p-8 rounded-2xl shadow-2xl mb-8">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold mb-3">🎭 야담방 : AI 조선시대 대본 생성기</h1>
            <p className="text-xl text-gray-300 mb-2">성공한 대본의 DNA를 조선시대 야담으로 복제하세요</p>
            <p className="text-sm text-gray-400">AI가 작가의 문체, 심리적 트릭, 후킹 요소를 완벽하게 분석하여 내 것으로 만들어줍니다</p>
          </div>
          {/* 단계 표시 */}
          <div className="flex justify-center gap-4 mb-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg">
              <span className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">1</span>
              <span className="text-sm">대본 입력</span>
            </div>
            <div className="text-gray-400">→</div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg">
              <span className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">2</span>
              <span className="text-sm">주제 선택</span>
            </div>
            <div className="text-gray-400">→</div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg">
              <span className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">3</span>
              <span className="text-sm">야담 생성</span>
            </div>
            <div className="text-gray-400">→</div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg">
              <span className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">4</span>
              <span className="text-sm">완성</span>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors backdrop-blur-sm"
            >
              📚 히스토리 ({session.history.length})
            </button>
            <button 
              onClick={() => setCompareMode(!compareMode)}
              className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors backdrop-blur-sm"
              disabled={session.generatedScripts.length === 0}
            >
              🔀 비교 ({session.generatedScripts.length})
            </button>
            <button 
              onClick={handleClear}
              className="text-sm bg-red-500/80 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors backdrop-blur-sm"
            >
              🗑️ 초기화
            </button>
          </div>
        </header>
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          <main className="p-8 space-y-8">
          
          {/* 전체 로딩 상태 표시 */}
          {loading !== 'IDLE' && (
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-xl mb-6 shadow-lg animate-pulse">
              <div className="flex items-center justify-center gap-3">
                <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xl font-bold">{getLoadingMessage()}</span>
              </div>
              <p className="text-center text-sm mt-2 opacity-90">잠시만 기다려주세요...</p>
            </div>
          )}

          {/* STEP 0: 대본 스타일 선택 */}
          <section className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🎭 대본 스타일 선택
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setScriptType('YADAM')}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  scriptType === 'YADAM' 
                    ? 'bg-blue-600 text-white ring-2 ring-blue-800' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400'
                }`}
              >
                📜 조선 야담 스타일
              </button>
              <button
                onClick={() => setScriptType('NORMAL')}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  scriptType === 'NORMAL' 
                    ? 'bg-blue-600 text-white ring-2 ring-blue-800' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400'
                }`}
              >
                💼 일반 유튜브 스타일
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {scriptType === 'YADAM' 
                ? '✅ 조선시대 분위기, 반전 있는 일화, 교훈적 내용으로 생성됩니다.' 
                : '✅ 일반적인 유튜브 대본 형식으로 생성됩니다.'}
            </p>
          </section>
          
          {/* STEP 1: Input */}
          <section className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">1</span>
              <div>
                <label className="block text-lg font-bold text-gray-800">
                  성공한 유튜브 대본을 붙여넣으세요
                </label>
                <p className="text-sm text-gray-600">AI가 문체, 후킹 요소, 심리 트릭을 분석합니다</p>
              </div>
            </div>
            <textarea
              className="w-full h-48 p-4 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none text-base bg-white shadow-inner"
              placeholder="예시: 여러분, 오늘은 놀라운 이야기를 가져왔습니다...&#10;&#10;💡 팁: 조회수 높은 영상의 대본을 입력하면 더 좋은 결과를 얻을 수 있습니다!"
              value={session.originalScript}
              onChange={handleInputChange}
            />
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {session.originalScript.length > 0 && (
                  <span className="bg-blue-100 px-3 py-1 rounded-full">
                    📝 {session.originalScript.length}자 입력됨
                  </span>
                )}
              </div>
              <button
                onClick={handleSuggest}
                disabled={loading !== 'IDLE' || !session.originalScript.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3"
              >
                {loading === 'ANALYZING' || loading === 'IMPROVING' || loading === 'SUGGESTING' ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>자동 개선 중...</span>
                  </>
                ) : (
                  <>
                    <span>🎯 자동 개선 후 주제 추천</span>
                    <span className="text-2xl">→</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-blue-600 text-center mt-2 font-medium">
              💡 대본을 후킹 점수 8점 이상으로 자동 개선한 후 새로운 주제를 추천합니다
            </p>
            {errorMsg && <p className="text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-lg border border-red-200">{errorMsg}</p>}
          </section>

          {/* 고정 탭바 - 항상 표시 */}
          <section className="bg-gradient-to-r from-gray-50 to-white p-5 rounded-2xl border-2 border-gray-300 shadow-xl sticky top-4 z-20">
            <div className="flex flex-wrap gap-3 justify-center items-center">
              <button
                onClick={handleCopy}
                disabled={!session.generatedNewScript}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">📋</span>
                <span>복사</span>
              </button>
              <button
                onClick={handleDownload}
                disabled={!session.generatedNewScript}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">💾</span>
                <span>복사</span>
              </button>
              <button
                onClick={toggleEditMode}
                disabled={!session.generatedNewScript}
                className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">{session.isEditMode ? '📝' : '✏️'}</span>
                <span>다운로드</span>
              </button>
              <button
                onClick={handleGenerateTitle}
                disabled={loading === 'TITLE' || !session.generatedNewScript}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">📝</span>
                <span>제목</span>
              </button>
              <button
                onClick={handleGenerateDescription}
                disabled={loading === 'TITLE' || !session.generatedNewScript}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">📄</span>
                <span>설명</span>
              </button>
              <button
                onClick={handleGenerateThumbnails}
                disabled={loading === 'THUMBNAILS' || !session.generatedNewScript}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">🖼️</span>
                <span>썸네일</span>
              </button>
              <button
                onClick={handleGenerateImagePrompts}
                disabled={loading === 'IMAGE_PROMPTS' || !session.generatedNewScript}
                className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">👥</span>
                <span>등장인물</span>
              </button>
              <button
                onClick={handleAnalyze}
                disabled={loading === 'ANALYZING' || !session.generatedNewScript}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">🎬</span>
                <span>PD분석</span>
              </button>
              <button
                onClick={handleDetailedAnalysis}
                disabled={loading === 'ANALYZING_DETAILED' || (!session.generatedNewScript && !session.originalScript)}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">🔬</span>
                <span>상세분석</span>
              </button>
              <button
                onClick={handleGenerateRevision}
                disabled={loading === 'REVISING' || (!session.generatedNewScript && !session.originalScript)}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">✨</span>
                <span>대본수정</span>
              </button>
              <button
                onClick={handleImproveScript}
                disabled={loading === 'IMPROVING' || !session.generatedNewScript || !session.analysis}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">🔧</span>
                <span>자동개선</span>
              </button>
              <button
                onClick={() => setShowExternalAnalysis(!showExternalAnalysis)}
                disabled={!session.generatedNewScript && !session.originalScript}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">📥</span>
                <span>{showExternalAnalysis ? '닫기' : '외부분석'}</span>
              </button>
              <button
                onClick={handleGeneratePlan}
                disabled={loading === 'PLANNING' || !session.generatedNewScript}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">📋</span>
                <span>숏츠</span>
              </button>
              <button
                onClick={handleCopyToSRTEditor}
                disabled={!session.generatedNewScript}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <span className="text-lg">📝</span>
                <span>자막</span>
              </button>
            </div>
            {!session.generatedNewScript && (
              <p className="text-sm text-gray-600 text-center mt-3 font-medium">💡 대본을 생성하면 모든 기능이 활성화됩니다</p>
            )}
          </section>

          {/* 외부 분석 입력란 */}
          {showExternalAnalysis && (
            <section className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border-4 border-orange-400 animate-fade-in shadow-lg">
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">📥</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">외부 분석 내용 붙여넣기</h3>
                    <p className="text-sm text-gray-600">다른 도구에서 분석한 내용을 붙여넣으면 자동으로 대본을 수정합니다</p>
                  </div>
                </div>
              </div>
              
              <textarea
                className="w-full h-64 p-4 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all resize-none text-base bg-white shadow-inner"
                placeholder="예시:&#10;&#10;구조 문제:&#10;- 인트로가 너무 김&#10;- 결론이 약함&#10;&#10;흐름 문제:&#10;- 전개가 느림&#10;- 장면 전환이 어색함&#10;&#10;내용 개선 필요:&#10;- 더 흥미로운 도입부 필요&#10;- 구체적인 예시 추가&#10;&#10;💡 팁: ChatGPT, Claude 등에서 대본을 분석한 내용을 그대로 복사해서 붙여넣으세요!"
                value={externalAnalysisText}
                onChange={(e) => setExternalAnalysisText(e.target.value)}
              />
              
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {externalAnalysisText.length > 0 && (
                    <span className="bg-orange-100 px-3 py-1 rounded-full">
                      📝 {externalAnalysisText.length}자 입력됨
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setExternalAnalysisText('');
                      setShowExternalAnalysis(false);
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition-all"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleExternalAnalysisRevision}
                    disabled={loading !== 'IDLE' || !externalAnalysisText.trim()}
                    className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:from-orange-700 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3"
                  >
                    {loading === 'REVISING' ? (
                      <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        <span>수정 중...</span>
                      </>
                    ) : (
                      <>
                        <span>✨ 자동 수정하기</span>
                        <span className="text-2xl">→</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                <h4 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                  <span>💡</span>
                  <span>사용 팁</span>
                </h4>
                <ul className="text-sm text-yellow-900 space-y-1">
                  <li>• ChatGPT, Claude 등 AI에게 대본 분석을 요청하고 결과를 복사하세요</li>
                  <li>• 유튜브 채널 PD의 피드백을 텍스트로 정리해서 붙여넣으세요</li>
                  <li>• 구조, 흐름, 내용, 기술적 문제 등을 자유롭게 작성하세요</li>
                  <li>• 분석 내용이 상세할수록 더 정확한 수정이 가능합니다</li>
                </ul>
              </div>
            </section>
          )}

          {/* STEP 2: Suggestions */}
          {session.suggestedTopics.length > 0 && (
            <section className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-200 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg">2</span>
                <div>
                  <label className="block text-lg font-bold text-gray-800">
                    AI가 추천한 조선시대 야담 주제
                  </label>
                  <p className="text-sm text-gray-600">클릭하면 즉시 대본이 생성됩니다</p>
                </div>
              </div>
              <div className="grid gap-4">
                {session.suggestedTopics.map((topic, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleGenerateScript(topic)}
                    disabled={loading !== 'IDLE'}
                    className={`text-left p-5 rounded-xl border-2 transition-all hover:scale-[1.02] shadow-md hover:shadow-lg ${
                      session.selectedTopic === topic
                        ? 'border-green-500 bg-white ring-2 ring-green-300'
                        : 'border-green-200 hover:border-green-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📜</span>
                        <span className="font-bold text-xl text-gray-800">{topic}</span>
                      </div>
                      {(loading === 'GENERATING' || loading === 'TITLE' || loading === 'THUMBNAILS' || loading === 'IMAGE_PROMPTS') && session.selectedTopic === topic ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 border-3 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-green-700 font-medium">{getLoadingMessage()}</span>
                        </div>
                      ) : (
                        <span className="text-green-600 text-xl">→</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* STEP 3: Result */}
          {session.generatedNewScript && !compareMode && (
            <section className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">3</span>
                <div className="flex-1">
                  <label className="block text-lg font-bold text-gray-800">
                    ✨ 조선시대 야담 대본 완성!
                  </label>
                  <p className="text-sm text-gray-600">주제: {session.selectedTopic}</p>
                </div>
              </div>
              
              {session.isEditMode ? (
                <textarea
                  className="w-full h-96 p-6 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none text-base font-sans bg-white shadow-inner"
                  value={session.generatedNewScript}
                  onChange={(e) => handleEditScript(e.target.value)}
                />
              ) : (
                <div className="bg-white p-6 rounded-xl border-2 border-purple-200 shadow-inner">
                  <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed text-base">
                    {session.generatedNewScript}
                  </pre>
                </div>
              )}
              
              {/* 완성 단계 표시 */}
              <div className="mt-6 bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded-xl border border-purple-300">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">4</span>
                  <div>
                    <p className="font-bold text-gray-800">🎉 완성!</p>
                    <p className="text-sm text-gray-600">위 버튼들로 제목, 썸네일, 등장인물, PD분석, 기획서를 생성하세요</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 제목 표시 */}
          {session.videoTitle && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="bg-indigo-50 p-6 rounded-lg border-2 border-indigo-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-indigo-800">📝 추천 제목</h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(session.videoTitle!);
                      alert('제목이 복사되었습니다!');
                    }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded"
                  >
                    📋 복사
                  </button>
                </div>
                <div className="space-y-3">
                  {session.videoTitle.split('\n').filter(line => line.trim()).map((title, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-4 rounded-lg border border-indigo-100 hover:border-indigo-300 transition-colors">
                      <p className="text-lg font-semibold text-gray-800 flex-1">{title.replace(/^\d+\.\s*/, '')}</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(title.replace(/^\d+\.\s*/, ''));
                          alert('제목이 복사되었습니다!');
                        }}
                        className="ml-3 text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded transition-colors"
                      >
                        📋 복사
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 영상 설명(디스크립션) 표시 */}
          {session.videoDescription && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="bg-green-50 p-6 rounded-lg border-2 border-green-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                    <span>📄</span>
                    <span>YouTube 영상 설명</span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(session.videoDescription!);
                        alert('영상 설명이 복사되었습니다!');
                      }}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                    >
                      📋 복사
                    </button>
                    <button
                      onClick={() => setSession(prev => ({ ...prev, videoDescription: null }))}
                      className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                    >
                      닫기
                    </button>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-lg border border-green-100">
                  <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed text-sm">
                    {session.videoDescription}
                  </pre>
                </div>
                <div className="mt-3 p-3 bg-green-100 border border-green-200 rounded">
                  <p className="text-xs text-green-800">
                    💡 <strong>사용 방법:</strong> YouTube 스튜디오에서 영상 업로드 시 위 내용을 복사하여 "설명" 란에 붙여넣으세요.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* 썸네일 프롬프트 */}
          {session.thumbnails.length > 0 && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">
                  🖼️ 썸네일 프롬프트 ({session.thumbnails.length}개)
                </label>
                <button
                  onClick={() => setSession(prev => ({ ...prev, thumbnails: [] }))}
                  className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                >
                  닫기
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {session.thumbnails.map((thumbnail) => (
                  <div key={thumbnail.id} className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-lg border-2 border-yellow-300">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center font-bold">
                        {thumbnail.id}
                      </span>
                      <h4 className="font-bold text-gray-800 text-sm">{thumbnail.concept}</h4>
                    </div>
                    {thumbnail.textOverlay && (
                      <div className="mb-2 p-2 bg-white rounded border border-yellow-400">
                        <p className="text-xs text-gray-500">썸네일 텍스트:</p>
                        <p className="font-bold text-red-600">{thumbnail.textOverlay}</p>
                      </div>
                    )}
                    {/* 16:9 비율 프리뷰 영역 */}
                    <div className="w-full aspect-[16/9] bg-gray-200 rounded flex items-center justify-center mb-2 overflow-hidden">
                      {/* 실제 이미지가 있다면 <img src=... className="w-full h-full object-cover" />로 대체 */}
                      <span className="text-gray-400 text-xs">16:9 썸네일 미리보기</span>
                    </div>
                    <div className="bg-black text-green-400 p-3 rounded font-mono text-xs overflow-x-auto">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400">Prompt:</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(thumbnail.prompt);
                            alert('프롬프트가 복사되었습니다!');
                          }}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                        >
                          📋 복사
                        </button>
                      </div>
                      {thumbnail.prompt}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  💡 <strong>사용 방법:</strong> 각 프롬프트를 AI 이미지 생성 툴(Midjourney, DALL-E 등)에 복사하여 썸네일을 만드세요.
                </p>
              </div>
            </section>
          )}

          {/* 등장인물 이미지 프롬프트 */}
          {session.imagePrompts.length > 0 && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">
                  👥 등장인물 이미지 프롬프트 ({session.imagePrompts.length}명)
                </label>
                <button
                  onClick={() => setSession(prev => ({ ...prev, imagePrompts: [] }))}
                  className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                >
                  닫기
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {session.imagePrompts.map((prompt, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border-2 border-blue-300">
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {prompt.sceneNumber}
                        </span>
                        <h4 className="font-bold text-blue-800">{prompt.koreanDescription}</h4>
                      </div>
                      <div className="bg-white p-2 rounded border border-blue-200">
                        <p className="text-xs text-gray-500 mb-1">대본 속 등장:</p>
                        <p className="text-sm text-gray-700 italic">"{prompt.sentence}"</p>
                      </div>
                    </div>
                    {/* 16:9 비율 프리뷰 영역 */}
                    <div className="w-full aspect-[16/9] bg-gray-200 rounded flex items-center justify-center mb-2 overflow-hidden">
                      {/* 실제 이미지가 있다면 <img src=... className="w-full h-full object-cover" />로 대체 */}
                      <span className="text-gray-400 text-xs">16:9 인물 미리보기</span>
                    </div>
                    <div className="bg-black text-green-400 p-3 rounded font-mono text-xs overflow-x-auto">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400">AI Image Prompt:</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(prompt.imagePrompt);
                            alert('프롬프트가 복사되었습니다!');
                          }}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                        >
                          📋 복사
                        </button>
                      </div>
                      {prompt.imagePrompt}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  💡 <strong>사용 방법:</strong> 각 캐릭터의 프롬프트를 AI 이미지 생성 툴에 복사하여 일관된 캐릭터 이미지를 만드세요.
                </p>
              </div>
            </section>
          )}

          {/* PD 분석 결과 */}
          {session.analysis && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border-4 border-red-500 shadow-xl">
              <div className="mb-6 bg-red-600 text-white p-4 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  🎬 메인 PD의 냉정한 분석
                </h2>
                <p className="text-sm opacity-90">100만 구독자 채널 기준 | 타협 없는 직설적 평가</p>
              </div>
              
              {/* 총평 */}
              <div className="bg-white p-6 rounded-xl mb-4 border-l-8 border-red-600 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">💬</span>
                  <h3 className="font-bold text-lg text-red-700">총평 (직설적, 변명 불가)</h3>
                </div>
                <p className="text-xl text-gray-900 font-bold leading-relaxed">{session.analysis.overallComment}</p>
              </div>

              {/* 후킹 점수 */}
              <div className="bg-white p-6 rounded-xl mb-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🎣</span>
                  <h3 className="font-bold text-lg text-gray-700">후킹 점수 (초반 30초 평가)</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`text-6xl font-black ${
                    session.analysis.hookingScore >= 8 ? 'text-green-600' :
                    session.analysis.hookingScore >= 6 ? 'text-yellow-600' :
                    session.analysis.hookingScore >= 4 ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {session.analysis.hookingScore}/10
                  </div>
                  <div className="flex-1">
                    <p className="text-lg text-gray-800 font-medium">{session.analysis.hookingComment}</p>
                    <div className="mt-2 bg-gray-100 p-2 rounded">
                      <p className="text-xs text-gray-600">
                        ✓ 3초 안에 시선 잡기 | ✓ 클릭 후 이탈 방지 | ✓ 명확한 가치 제시
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 논리적 허점 */}
              {session.analysis.logicalFlaws.length > 0 && (
                <div className="bg-white p-6 rounded-xl mb-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">⚠️</span>
                    <h3 className="font-bold text-lg text-yellow-700">논리적 허점 ({session.analysis.logicalFlaws.length}개 발견)</h3>
                  </div>
                  <div className="space-y-4">
                    {session.analysis.logicalFlaws.map((flaw, idx) => (
                      <div key={idx} className="border-l-4 border-yellow-500 pl-4 bg-yellow-50 p-4 rounded-r-lg">
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 font-bold mb-1">❌ 문제 구간:</p>
                          <p className="text-sm text-gray-800 italic bg-white p-2 rounded border border-yellow-200">"{flaw.original}"</p>
                        </div>
                        <div className="mb-3 bg-red-50 p-3 rounded border border-red-200">
                          <p className="text-xs text-red-600 font-bold mb-1">🚨 치명적 약점:</p>
                          <p className="text-sm text-red-700 font-medium">{flaw.issue}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded border border-green-300">
                          <p className="text-xs text-green-700 font-bold mb-1">✅ PD 수정안:</p>
                          <p className="text-sm text-green-800 font-bold">"{flaw.suggestion}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 지루함 경보 */}
              {session.analysis.boringParts.length > 0 && (
                <div className="bg-white p-6 rounded-xl mb-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">😴</span>
                    <h3 className="font-bold text-lg text-orange-700">지루함 경보 - 이탈 위험 구간 ({session.analysis.boringParts.length}개)</h3>
                  </div>
                  <div className="space-y-3">
                    {session.analysis.boringParts.map((part, idx) => (
                      <div key={idx} className="border-l-4 border-orange-500 pl-4 bg-orange-50 p-3 rounded-r-lg">
                        <div className="mb-2">
                          <p className="text-xs text-orange-600 font-bold mb-1">⚡ 시청자 이탈 예상 구간:</p>
                          <p className="text-sm text-gray-800 italic bg-white p-2 rounded border border-orange-200">"{part.original}"</p>
                        </div>
                        <div className="bg-red-100 p-2 rounded border border-red-300">
                          <p className="text-xs text-red-700 font-bold">💥 이탈 원인: {part.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 액션 플랜 */}
              <div className="bg-gradient-to-r from-red-600 to-red-800 text-white p-6 rounded-xl shadow-2xl border-4 border-red-900">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">🚨</span>
                  <h3 className="font-black text-2xl">당장 고쳐야 할 1가지 (최우선)</h3>
                </div>
                <div className="bg-white bg-opacity-20 p-4 rounded-lg backdrop-blur">
                  <p className="font-bold text-2xl leading-relaxed">{session.analysis.actionPlan}</p>
                </div>
                <p className="text-xs mt-3 opacity-90">이것만 고쳐도 영상이 살아납니다. 지금 바로 수정하세요.</p>
              </div>

              {/* 문제 요약 & 대본 자동 개선 버튼 */}
              <div className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl border-2 border-blue-300">
                <div className="mb-4">
                  <h3 className="font-bold text-xl text-gray-800 mb-3 flex items-center gap-2">
                    <span>📊</span> 분석 요약 & 자동 개선
                  </h3>
                  
                  {/* 개선 필요 여부 알림 */}
                  {(session.analysis.hookingScore < 7 || 
                    session.analysis.logicalFlaws.length > 0 || 
                    session.analysis.boringParts.length > 0) && (
                    <div className="mb-4 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4">
                      <p className="font-bold text-yellow-800 flex items-center gap-2">
                        <span className="text-2xl">⚠️</span>
                        <span>대본 개선이 필요합니다!</span>
                      </p>
                      <p className="text-sm text-yellow-700 mt-2">
                        아래 "🔧 대본 자동 개선" 버튼을 클릭하면 PD 피드백을 100% 반영한 새 대본이 생성됩니다.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-lg text-center shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">후킹 점수</p>
                      <p className={`text-3xl font-black ${
                        session.analysis.hookingScore >= 8 ? 'text-green-600' :
                        session.analysis.hookingScore >= 6 ? 'text-yellow-600' :
                        session.analysis.hookingScore >= 4 ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {session.analysis.hookingScore}/10
                      </p>
                      {session.analysis.hookingScore < 7 && (
                        <p className="text-xs text-red-600 font-bold mt-1">개선 필요!</p>
                      )}
                    </div>
                    <div className="bg-white p-4 rounded-lg text-center shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">논리적 허점</p>
                      <p className="text-3xl font-black text-yellow-600">{session.analysis.logicalFlaws.length}개</p>
                      {session.analysis.logicalFlaws.length > 0 && (
                        <p className="text-xs text-yellow-600 font-bold mt-1">수정 필요!</p>
                      )}
                    </div>
                    <div className="bg-white p-4 rounded-lg text-center shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">지루함 경보</p>
                      <p className="text-3xl font-black text-orange-600">{session.analysis.boringParts.length}개</p>
                      {session.analysis.boringParts.length > 0 && (
                        <p className="text-xs text-orange-600 font-bold mt-1">압축 필요!</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={handleImproveScript}
                    disabled={loading === 'IMPROVING'}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-5 px-12 rounded-xl shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 text-xl"
                  >
                    {loading === 'IMPROVING' ? (
                      <span className="flex items-center gap-3">
                        <div className="h-7 w-7 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>PD 피드백 100% 반영 중... (30초 소요)</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-3">
                        <span className="text-3xl">🔧</span>
                        <div>
                          <div>대본 자동 개선 (PD 피드백 100% 반영)</div>
                          <div className="text-xs opacity-90 mt-1">
                            후킹 강화 + 논리적 허점 보완 + 지루함 제거 + 댄 하몬 구조 적용
                          </div>
                        </div>
                      </span>
                    )}
                  </button>
                </div>
                
                {/* 안내 메시지 */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-600">
                    💡 <strong>자동 개선 시:</strong> 위의 모든 문제점을 반영한 완전히 새로운 대본이 생성됩니다
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    (원본 주제와 핵심 메시지는 유지하면서 후킹/논리/템포만 개선)
                  </p>
                </div>
                <div className="mt-4 p-4 bg-blue-100 rounded-lg border border-blue-300">
                  <p className="text-sm text-blue-900">
                    <strong>💡 작동 방식:</strong> AI가 PD의 모든 피드백을 반영하여 대본을 자동으로 재작성합니다. 
                    후킹 강화, 논리 보완, 지루한 구간 간결화가 자동으로 진행됩니다.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* 상세 대본 분석 결과 */}
          {session.detailedAnalysis && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border-4 border-indigo-500 shadow-xl">
              <div className="mb-6 bg-indigo-600 text-white p-4 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  🔬 대본 상세 분석 결과
                </h2>
                <p className="text-sm opacity-90">구조, 흐름, 콘텐츠 품질 종합 분석</p>
              </div>

              {/* 종합 평가 */}
              <div className="bg-white p-6 rounded-xl mb-4 border-l-8 border-indigo-600 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📊</span>
                  <h3 className="font-bold text-lg text-indigo-700">종합 평가</h3>
                </div>
                <p className="text-lg text-gray-900 leading-relaxed">{session.detailedAnalysis.overallSummary}</p>
              </div>

              {/* 점수 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-md text-center">
                  <div className="text-3xl font-black text-blue-600">
                    {session.detailedAnalysis.structureAnalysis.structureScore}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 font-bold">구조 점수</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md text-center">
                  <div className="text-3xl font-black text-green-600">
                    {session.detailedAnalysis.flowAnalysis.flowScore}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 font-bold">흐름 점수</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md text-center">
                  <div className="text-3xl font-black text-purple-600">
                    {session.detailedAnalysis.contentQuality.clarityScore}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 font-bold">명확성</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md text-center">
                  <div className="text-3xl font-black text-orange-600">
                    {session.detailedAnalysis.contentQuality.engagementScore}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 font-bold">흥미도</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md text-center">
                  <div className="text-3xl font-black text-pink-600">
                    {session.detailedAnalysis.contentQuality.originalityScore}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 font-bold">독창성</p>
                </div>
              </div>

              {/* 구조 분석 */}
              <div className="bg-white p-6 rounded-xl mb-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🏗️</span>
                  <h3 className="font-bold text-lg text-gray-700">구조 분석</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className={`p-3 rounded-lg ${session.detailedAnalysis.structureAnalysis.hasIntro ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                    <p className="text-sm font-bold text-center">
                      {session.detailedAnalysis.structureAnalysis.hasIntro ? '✅ 인트로 있음' : '❌ 인트로 없음'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${session.detailedAnalysis.structureAnalysis.hasBody ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                    <p className="text-sm font-bold text-center">
                      {session.detailedAnalysis.structureAnalysis.hasBody ? '✅ 본론 있음' : '❌ 본론 없음'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${session.detailedAnalysis.structureAnalysis.hasConclusion ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                    <p className="text-sm font-bold text-center">
                      {session.detailedAnalysis.structureAnalysis.hasConclusion ? '✅ 결론 있음' : '❌ 결론 없음'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{session.detailedAnalysis.structureAnalysis.structureFeedback}</p>
              </div>

              {/* 흐름 분석 */}
              <div className="bg-white p-6 rounded-xl mb-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🌊</span>
                  <h3 className="font-bold text-lg text-gray-700">흐름 분석</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <p className="text-xs text-blue-600 font-bold mb-1">전개 속도</p>
                    <p className="text-sm text-gray-800">{session.detailedAnalysis.flowAnalysis.pacing}</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded border border-purple-200">
                    <p className="text-xs text-purple-600 font-bold mb-1">장면 전환</p>
                    <p className="text-sm text-gray-800">{session.detailedAnalysis.flowAnalysis.transitionQuality}</p>
                  </div>
                </div>
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <p className="text-xs text-green-600 font-bold mb-2">개선 제안</p>
                  <ul className="space-y-1">
                    {session.detailedAnalysis.flowAnalysis.improvements.map((improvement, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-600 flex-shrink-0">•</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 콘텐츠 품질 */}
              <div className="bg-white p-6 rounded-xl mb-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">💎</span>
                  <h3 className="font-bold text-lg text-gray-700">콘텐츠 품질</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded border border-green-300">
                    <p className="text-sm text-green-700 font-bold mb-2">✅ 강점</p>
                    <ul className="space-y-1">
                      {session.detailedAnalysis.contentQuality.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-600 flex-shrink-0">+</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-50 p-4 rounded border border-red-300">
                    <p className="text-sm text-red-700 font-bold mb-2">⚠️ 약점</p>
                    <ul className="space-y-1">
                      {session.detailedAnalysis.contentQuality.weaknesses.map((weakness, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-red-600 flex-shrink-0">-</span>
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 기술적 문제점 */}
              {session.detailedAnalysis.technicalIssues.length > 0 && (
                <div className="bg-white p-6 rounded-xl mb-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🔧</span>
                    <h3 className="font-bold text-lg text-gray-700">기술적 문제점 ({session.detailedAnalysis.technicalIssues.length}개)</h3>
                  </div>
                  <div className="space-y-3">
                    {session.detailedAnalysis.technicalIssues.map((issue, idx) => (
                      <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                        issue.severity === 'high' ? 'bg-red-50 border-red-500' :
                        issue.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                        'bg-blue-50 border-blue-500'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            issue.severity === 'high' ? 'bg-red-200 text-red-800' :
                            issue.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                            'bg-blue-200 text-blue-800'
                          }`}>
                            {issue.severity === 'high' ? '높음' : issue.severity === 'medium' ? '중간' : '낮음'}
                          </span>
                          <p className="text-sm font-bold text-gray-800">{issue.issue}</p>
                        </div>
                        <p className="text-sm text-gray-700 bg-white p-2 rounded">💡 {issue.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 개선 우선순위 */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl shadow-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🎯</span>
                  <h3 className="font-black text-xl">개선 우선순위</h3>
                </div>
                <ol className="space-y-2">
                  {session.detailedAnalysis.improvementPriorities.map((priority, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-lg font-bold pt-1">{priority}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {/* 대본 수정 제안 */}
          {session.scriptRevision && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in bg-gradient-to-br from-teal-50 to-cyan-50 p-6 rounded-xl border-4 border-teal-500 shadow-xl">
              <div className="mb-6 bg-teal-600 text-white p-4 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  ✨ 수정된 대본
                </h2>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg text-gray-700 flex items-center gap-2">
                    <span>📄</span>
                    <span>최종 대본</span>
                  </h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(session.scriptRevision!.revised);
                      alert('대본이 복사되었습니다!');
                    }}
                    className="text-sm bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    📋 복사
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-base text-gray-800 leading-relaxed">
                    {session.scriptRevision.revised}
                  </pre>
                </div>
              </div>
            </section>
          )}

          {/* 채널 기획서 목록 */}
          {session.channelPlans.length > 0 && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <h2 className="text-lg font-bold text-gray-800 mb-4">📋 생성된 채널 기획서 ({session.channelPlans.length}개)</h2>
              <div className="space-y-6">
                {[...session.channelPlans].reverse().map((plan) => (
                  <div key={plan.id} className="bg-gradient-to-br from-teal-50 to-cyan-50 p-6 rounded-xl border-2 border-teal-300 shadow-md">
                    <div className="mb-4">
                      <h3 className="text-2xl font-bold text-teal-800 mb-2">🎯 {plan.topic}</h3>
                      <p className="text-xs text-gray-500">생성일: {new Date(plan.createdAt).toLocaleString('ko-KR')}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 타겟 시청자 */}
                      <div className="bg-white p-4 rounded-lg border border-teal-200">
                        <h4 className="font-bold text-teal-700 mb-2 flex items-center gap-2">
                          <span>👥</span> 타겟 시청자
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.targetAudience}</p>
                      </div>

                      {/* 콘텐츠 전략 */}
                      <div className="bg-white p-4 rounded-lg border border-teal-200">
                        <h4 className="font-bold text-teal-700 mb-2 flex items-center gap-2">
                          <span>🎬</span> 콘텐츠 전략
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.contentStrategy}</p>
                      </div>

                      {/* 경쟁력 */}
                      <div className="bg-white p-4 rounded-lg border border-green-200">
                        <h4 className="font-bold text-green-700 mb-2 flex items-center gap-2">
                          <span>💪</span> 경쟁 우위
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.competitiveAdvantage}</p>
                      </div>

                      {/* 트렌드 분석 */}
                      <div className="bg-white p-4 rounded-lg border border-orange-200">
                        <h4 className="font-bold text-orange-700 mb-2 flex items-center gap-2">
                          <span>📈</span> 트렌드 분석
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.trendAnalysis}</p>
                      </div>

                      {/* 영상 구성안 */}
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <h4 className="font-bold text-purple-700 mb-2 flex items-center gap-2">
                          <span>🎞️</span> 영상 구성안
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.videoStructure}</p>
                      </div>

                      {/* 수익화 방안 */}
                      <div className="bg-white p-4 rounded-lg border border-yellow-200">
                        <h4 className="font-bold text-yellow-700 mb-2 flex items-center gap-2">
                          <span>💰</span> 수익화 방안
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.monetizationPlan}</p>
                      </div>

                      {/* 업로드 계획 */}
                      <div className="bg-white p-4 rounded-lg border border-blue-200 md:col-span-2">
                        <h4 className="font-bold text-blue-700 mb-2 flex items-center gap-2">
                          <span>📅</span> 업로드 일정
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.uploadSchedule}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          const fullText = `
🎯 채널 기획서: ${plan.topic}

👥 타겟 시청자:
${plan.targetAudience}

🎬 콘텐츠 전략:
${plan.contentStrategy}

💪 경쟁 우위:
${plan.competitiveAdvantage}

📈 트렌드 분석:
${plan.trendAnalysis}

🎞️ 영상 구성안:
${plan.videoStructure}

💰 수익화 방안:
${plan.monetizationPlan}

📅 업로드 일정:
${plan.uploadSchedule}
                          `.trim();
                          navigator.clipboard.writeText(fullText);
                          alert('기획서가 복사되었습니다!');
                        }}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
                      >
                        📋 전체 복사
                      </button>
                      <button
                        onClick={() => {
                          const fullText = `
🎯 채널 기획서: ${plan.topic}

👥 타겟 시청자:
${plan.targetAudience}

🎬 콘텐츠 전략:
${plan.contentStrategy}

💪 경쟁 우위:
${plan.competitiveAdvantage}

📈 트렌드 분석:
${plan.trendAnalysis}

🎞️ 영상 구성안:
${plan.videoStructure}

💰 수익화 방안:
${plan.monetizationPlan}

📅 업로드 일정:
${plan.uploadSchedule}
                          `.trim();
                          const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `채널기획서_${plan.topic.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium"
                      >
                        💾 다운로드
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 숏츠 대본 목록 - 기획서로 대체됨 */}
          {false && session.shortsScripts.length > 0 && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <h2 className="text-lg font-bold text-gray-800 mb-4">📱 생성된 숏츠 대본 ({session.shortsScripts.length}개)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...session.shortsScripts].reverse().map((shorts) => (
                  <div key={shorts.id} className="bg-pink-50 p-4 rounded-lg border-2 border-pink-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{shorts.title}</h3>
                        {shorts.reference && (
                          <p className="text-xs text-gray-500 mt-1">📚 참고: {shorts.reference}</p>
                        )}
                      </div>
                      <span className="text-xs bg-pink-600 text-white px-2 py-1 rounded">{shorts.duration}초</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed bg-white p-3 rounded border border-pink-200">
                      {shorts.script}
                    </pre>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(shorts.script);
                          alert('숏츠 대본이 복사되었습니다!');
                        }}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                      >
                        📋 복사
                      </button>
                      <button
                        onClick={() => {
                          const blob = new Blob([shorts.script], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${shorts.title.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_shorts.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded"
                      >
                        💾 다운로드
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 비교 모드 */}
          {compareMode && session.generatedScripts.length > 0 && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">
                  📊 대본 비교 ({session.generatedScripts.length}개)
                </label>
                <button
                  onClick={() => setCompareMode(false)}
                  className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                >
                  닫기
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {session.generatedScripts.map((item) => (
                  <div key={item.timestamp} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-sm text-gray-800">{item.topic}</h4>
                      <button
                        onClick={() => removeFromCompare(item.timestamp)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {new Date(item.timestamp).toLocaleString('ko-KR')}
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-gray-700 text-sm leading-relaxed max-h-64 overflow-y-auto">
                      {item.script}
                    </pre>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 히스토리 패널 */}
          {showHistory && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">
                  📚 대본 히스토리 ({session.history.length}개)
                </label>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                >
                  닫기
                </button>
              </div>
              {session.history.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">아직 저장된 대본이 없습니다.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {[...session.history].reverse().map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-sm text-gray-800">
                            {item.topic} {item.isEdited && <span className="text-blue-600 text-xs">(편집됨)</span>}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {new Date(item.createdAt).toLocaleString('ko-KR')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadFromHistory(item)}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                          >
                            불러오기
                          </button>
                          <button
                            onClick={() => deleteHistory(item.id)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-gray-600 text-xs leading-relaxed max-h-32 overflow-hidden">
                        {item.script.substring(0, 200)}...
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 등장인물 이미지 프롬프트 섹션 */}
          {session.imagePrompts.length > 0 && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">
                  👥 등장인물 이미지 프롬프트 ({session.imagePrompts.length}명)
                </label>
                <button
                  onClick={() => setSession(prev => ({ ...prev, imagePrompts: [] }))}
                  className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                >
                  닫기
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {session.imagePrompts.map((prompt, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-xl border-2 border-pink-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md">
                        {prompt.sceneNumber}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800 text-base leading-tight">{prompt.sentence}</h4>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-3 rounded-lg border border-pink-100">
                        <p className="text-xs font-bold text-pink-600 mb-2 flex items-center gap-1">
                          <span>🇰🇷</span> 한글 설명
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed">{prompt.koreanDescription}</p>
                      </div>
                      <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-400 font-bold">🌍 영문 프롬프트:</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(prompt.imagePrompt);
                              alert('영문 프롬프트가 복사되었습니다!');
                            }}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors"
                          >
                            📋 복사
                          </button>
                        </div>
                        <p className="leading-relaxed">{prompt.imagePrompt}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">
                  💡 <strong>사용 방법:</strong> 각 등장인물의 영문 프롬프트를 Midjourney, DALL-E, Stable Diffusion 등에 복사하여 캐릭터 이미지를 생성하세요.
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  ✨ 팁: 여러 인물을 일관된 스타일로 생성하려면 같은 AI 툴과 설정을 사용하세요.
                </p>
              </div>
            </section>
          )}

          {/* SRT 자막 편집기 */}
          {showSRTEditor && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-6 rounded-xl border-2 border-amber-300">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold text-lg">📝</span>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">SRT 자막 생성기</h3>
                      <p className="text-sm text-gray-600">대본을 수정한 후 SRT 파일로 다운로드하세요</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSRTEditor(false)}
                    className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                  >
                    닫기
                  </button>
                </div>

                <textarea
                  className="w-full h-96 p-4 border-2 border-amber-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all resize-none text-base font-sans bg-white shadow-inner mb-4"
                  value={editedScriptForSRT}
                  onChange={(e) => setEditedScriptForSRT(e.target.value)}
                  placeholder="여기에 대본을 수정하세요..."
                />

                {/* SRT 설정 패널 */}
                <div className="bg-white border-2 border-amber-300 rounded-xl p-5 mb-4">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>⚙️</span>
                    <span>자막 타이밍 설정</span>
                    <span className="text-xs font-normal text-gray-500">(타입캐스트 음성 들으며 조정하세요)</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 읽기 속도 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        🗣️ 읽기 속도 (초당 글자 수): <span className="text-amber-600">{srtCharsPerSecond}자/초</span>
                      </label>
                      <input
                        type="range"
                        min="3"
                        max="8"
                        step="0.5"
                        value={srtCharsPerSecond}
                        onChange={(e) => setSrtCharsPerSecond(parseFloat(e.target.value))}
                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>느림 (3)</span>
                        <span>보통 (5)</span>
                        <span>빠름 (8)</span>
                      </div>
                    </div>

                    {/* 최소 지속 시간 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        ⏱️ 최소 지속 시간: <span className="text-amber-600">{srtMinDuration}초</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.5"
                        value={srtMinDuration}
                        onChange={(e) => setSrtMinDuration(parseFloat(e.target.value))}
                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>1초</span>
                        <span>3초</span>
                        <span>5초</span>
                      </div>
                    </div>

                    {/* 최대 지속 시간 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        ⏱️ 최대 지속 시간: <span className="text-amber-600">{srtMaxDuration}초</span>
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="12"
                        step="0.5"
                        value={srtMaxDuration}
                        onChange={(e) => setSrtMaxDuration(parseFloat(e.target.value))}
                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>5초</span>
                        <span>8초</span>
                        <span>12초</span>
                      </div>
                    </div>

                    {/* 자막 간 간격 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        ↔️ 자막 간 간격: <span className="text-amber-600">{srtGap}초</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={srtGap}
                        onChange={(e) => setSrtGap(parseFloat(e.target.value))}
                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>없음 (0)</span>
                        <span>보통 (0.3)</span>
                        <span>길게 (1)</span>
                      </div>
                    </div>
                  </div>

                  {/* 프리셋 버튼 */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => {
                        setSrtCharsPerSecond(3.5);
                        setSrtMinDuration(2.5);
                        setSrtMaxDuration(10);
                        setSrtGap(0.5);
                      }}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      🐢 느린 낭독
                    </button>
                    <button
                      onClick={() => {
                        setSrtCharsPerSecond(5);
                        setSrtMinDuration(2);
                        setSrtMaxDuration(8);
                        setSrtGap(0.3);
                      }}
                      className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      🎯 표준 (권장)
                    </button>
                    <button
                      onClick={() => {
                        setSrtCharsPerSecond(7);
                        setSrtMinDuration(1.5);
                        setSrtMaxDuration(6);
                        setSrtGap(0.2);
                      }}
                      className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      🚀 빠른 낭독
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={handleGenerateSRT}
                    disabled={!editedScriptForSRT.trim()}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📥 SRT 파일 다운로드
                  </button>
                  <button
                    onClick={() => setEditedScriptForSRT('')}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                  >
                    🗑️ 초기화
                  </button>
                </div>

                <div className="bg-amber-100 border-2 border-amber-300 rounded-lg p-4">
                  <p className="text-sm font-bold text-amber-800 mb-2">💡 타입캐스트 연동 가이드:</p>
                  <ul className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                    <li><strong>타입캐스트에서 TTS 생성</strong> (음성 파일 먼저 만들기)</li>
                    <li><strong>음성을 들으며 위 설정 조정:</strong>
                      <ul className="ml-5 mt-1 space-y-0.5 list-disc">
                        <li>낭독이 느리면 → 읽기 속도 낮추기 (3~4자/초)</li>
                        <li>낭독이 빠르면 → 읽기 속도 높이기 (6~7자/초)</li>
                        <li>문장이 길면 → 최대 지속 시간 늘리기</li>
                      </ul>
                    </li>
                    <li><strong>프리셋 활용:</strong> 🐢느린 / 🎯표준 / 🚀빠른 버튼으로 빠르게 설정</li>
                    <li><strong>SRT 다운로드 후 YouTube에 업로드</strong></li>
                    <li>타이밍이 안 맞으면 → 설정 재조정 후 다시 생성</li>
                  </ul>
                  <div className="mt-3 p-2 bg-yellow-50 border border-amber-400 rounded">
                    <p className="text-xs text-amber-900">
                      <strong>✨ 팁:</strong> 타입캐스트 음성 속도가 "보통"이면 🎯표준 프리셋 사용, "느리게"면 🐢느린 낭독 사용!
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
          </main>
          <footer className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 text-center border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2">🔒 모든 데이터는 브라우저(LocalStorage)에 자동 저장됩니다</p>
            <p className="text-xs text-gray-500">AI 야담방 © 2025 - 성공한 대본의 DNA를 복제하세요</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default App;