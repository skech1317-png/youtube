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
  generateThumbnails,
  improveScriptWithAnalysis
} from './services/geminiService';
import { generateChannelPlan } from './services/planningService';

const App: React.FC = () => {
  // State
  const [session, setSession] = useState<ScriptSession>(INITIAL_SESSION);
  const [loading, setLoading] = useState<'IDLE' | 'SUGGESTING' | 'GENERATING' | 'ANALYZING' | 'IMPROVING' | 'SHORTS' | 'IMAGE_PROMPTS' | 'TITLE' | 'THUMBNAILS' | 'PLANNING'>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [scriptType, setScriptType] = useState<'NORMAL' | 'YADAM'>('YADAM'); // 기본값을 야담으로

  // Persistence: Load
  useEffect(() => {
    const saved = localStorage.getItem('mvp_script_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 이전 버전 호환성을 위해 새 필드 추가
        setSession({
          ...INITIAL_SESSION,
          ...parsed,
          apiKey: parsed.apiKey ?? '',
          isEditMode: parsed.isEditMode ?? false,
          generatedScripts: parsed.generatedScripts ?? [],
          history: parsed.history ?? [],
          analysis: parsed.analysis ?? null,
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

  // Persistence: Save
  useEffect(() => {
    localStorage.setItem('mvp_script_session', JSON.stringify(session));
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
    if (!session.apiKey.trim()) {
      setErrorMsg("API 키를 먼저 입력해주세요.");
      return;
    }
    
    setLoading('SUGGESTING');
    setErrorMsg(null);
    
    try {
      const topics = await suggestTopicsFromScript(session.originalScript, session.apiKey);
      setSession(prev => ({ 
        ...prev, 
        suggestedTopics: topics,
        selectedTopic: null,    // Reset selection
        generatedNewScript: null // Reset result
      }));
    } catch (e) {
      setErrorMsg("주제 추천 실패: AI 연결 상태를 확인해주세요.");
    } finally {
      setLoading('IDLE');
    }
  };

  // Handler: Step 2 - Generate Script
  const handleGenerateScript = async (topic: string) => {
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
    } catch (e) {
      setErrorMsg("대본 생성 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading('IDLE');
    }
  };

  // PD 분석 실행
  const handleAnalyze = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("분석할 대본이 없습니다. 먼저 대본을 생성해주세요.");
      return;
    }

    setLoading('ANALYZING');
    setErrorMsg(null);

    try {
      const analysis = await analyzeScriptAsPD(session.generatedNewScript, session.apiKey);
      setSession(prev => ({ ...prev, analysis }));
    } catch (e) {
      setErrorMsg("분석 실패: 잠시 후 다시 시도해주세요.");
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

    setLoading('IMPROVING');
    setErrorMsg(null);

    try {
      const improvedScript = await improveScriptWithAnalysis(
        session.generatedNewScript,
        session.analysis,
        session.apiKey
      );
      
      setSession(prev => ({ 
        ...prev, 
        generatedNewScript: improvedScript,
      }));

      // 개선된 대본을 히스토리에 추가
      if (session.selectedTopic) {
        saveToHistory(session.selectedTopic + ' (PD분석 개선)', improvedScript, true);
      }

      alert('PD 분석을 반영하여 대본이 개선되었습니다!');
    } catch (e) {
      setErrorMsg("대본 개선 실패: 잠시 후 다시 시도해주세요.");
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

  // 썸네일 프롬프트 생성
  const handleGenerateThumbnails = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("먼저 대본을 생성해주세요.");
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
  const handleGenerateImagePrompts = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("먼저 대본을 생성해주세요.");
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
      alert(`${prompts.length}개의 이미지 프롬프트가 생성되었습니다!`);
    } catch (e) {
      setErrorMsg("이미지 프롬프트 생성 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading('IDLE');
    }
  };

  // 채널 기획서 생성
  const handleGeneratePlan = async () => {
    if (!session.generatedNewScript) {
      setErrorMsg("기획서를 만들 대본이 없습니다.");
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
      localStorage.removeItem('mvp_script_session');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center py-8 px-4 font-sans">
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
          
          {/* API 키 입력 */}
          <section className="bg-yellow-50 p-5 rounded-lg border-2 border-yellow-300 mb-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">🔑</span>
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Gemini API 키 설정 (필수)
                </label>
                <input
                  type="password"
                  placeholder="여기에 Gemini API 키를 입력하세요"
                  value={session.apiKey}
                  onChange={(e) => setSession(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full p-3 border-2 border-yellow-400 rounded-lg focus:border-yellow-600 focus:ring-2 focus:ring-yellow-200 transition-all font-mono text-sm"
                />
                <p className="text-xs text-gray-600 mt-2">
                  💡 API 키는 브라우저에만 저장되며 외부로 전송되지 않습니다. 
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1 font-semibold">
                    무료 API 키 발급받기 →
                  </a>
                </p>
              </div>
            </div>
          </section>

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
                {loading === 'SUGGESTING' ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>대본 분석 중...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 DNA 분석 시작</span>
                    <span className="text-2xl">→</span>
                  </>
                )}
              </button>
            </div>
            {errorMsg && <p className="text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-lg border border-red-200">{errorMsg}</p>}
          </section>

          {/* 고정 버튼 바 - 항상 표시 */}
          <section className="bg-white p-4 rounded-xl border-2 border-gray-300 shadow-md sticky top-4 z-10">
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={handleCopy}
                disabled={!session.generatedNewScript}
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                📋 복사
              </button>
              <button
                onClick={handleDownload}
                disabled={!session.generatedNewScript}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                💾 다운로드
              </button>
              <button
                onClick={toggleEditMode}
                disabled={!session.generatedNewScript}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {session.isEditMode ? '📝 수정 중' : '✏️ 편집'}
              </button>
              {session.isEditMode && (
                <button
                  onClick={saveEditedScript}
                  className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
                >
                  ✅ 저장
                </button>
              )}
              <button
                onClick={handleGenerateImagePrompts}
                disabled={loading === 'IMAGE_PROMPTS' || !session.generatedNewScript}
                className="text-xs bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading === 'IMAGE_PROMPTS' ? '⏳ 분석중' : '👥 등장인물'}
              </button>
              <button
                onClick={handleGenerateTitle}
                disabled={loading === 'TITLE' || !session.generatedNewScript}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading === 'TITLE' ? '⏳ 생성중' : '📝 제목'}
              </button>
              <button
                onClick={handleGenerateThumbnails}
                disabled={loading === 'THUMBNAILS' || !session.generatedNewScript}
                className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading === 'THUMBNAILS' ? '⏳ 생성중' : '🖼️ 썸네일'}
              </button>
              <button
                onClick={handleAnalyze}
                disabled={loading === 'ANALYZING' || !session.generatedNewScript}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading === 'ANALYZING' ? '🔍 분석중' : '🎬 PD분석'}
              </button>
              <button
                onClick={handleGeneratePlan}
                disabled={loading === 'PLANNING' || !session.generatedNewScript}
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading === 'PLANNING' ? '⏳ 기획중' : '📋 기획서'}
              </button>
            </div>
            {!session.generatedNewScript && (
              <p className="text-xs text-gray-500 text-center mt-2">💡 대본을 생성하면 버튼들이 활성화됩니다</p>
            )}
          </section>

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
                      {loading === 'GENERATING' && session.selectedTopic === topic ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 border-3 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-green-700 font-medium">대본 작성 중...</span>
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
                <p className="text-2xl font-bold text-gray-800">{session.videoTitle}</p>
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

          {/* PD 분석 결과 */}
          {session.analysis && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in bg-red-50 p-6 rounded-lg border-2 border-red-200">
              <h2 className="text-lg font-bold text-red-800 mb-4">🎬 메인 PD 분석 결과</h2>
              
              {/* 총평 */}
              <div className="bg-white p-4 rounded-lg mb-4 border-l-4 border-red-600">
                <h3 className="font-bold text-sm text-gray-700 mb-2">💬 총평 (직설적)</h3>
                <p className="text-gray-800 font-medium">{session.analysis.overallComment}</p>
              </div>

              {/* 후킹 점수 */}
              <div className="bg-white p-4 rounded-lg mb-4">
                <h3 className="font-bold text-sm text-gray-700 mb-2">🎣 후킹 점수</h3>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-blue-600">{session.analysis.hookingScore}/10</div>
                  <p className="text-gray-700">{session.analysis.hookingComment}</p>
                </div>
              </div>

              {/* 논리적 허점 */}
              {session.analysis.logicalFlaws.length > 0 && (
                <div className="bg-white p-4 rounded-lg mb-4">
                  <h3 className="font-bold text-sm text-gray-700 mb-3">⚠️ 논리적 허점 ({session.analysis.logicalFlaws.length}개)</h3>
                  <div className="space-y-3">
                    {session.analysis.logicalFlaws.map((flaw, idx) => (
                      <div key={idx} className="border-l-4 border-yellow-500 pl-3">
                        <p className="text-xs text-gray-500 mb-1">원문:</p>
                        <p className="text-sm text-gray-700 mb-2 italic">"{flaw.original}"</p>
                        <p className="text-xs text-red-600 font-bold mb-1">문제점: {flaw.issue}</p>
                        <p className="text-xs text-green-700">✅ 수정안:</p>
                        <p className="text-sm text-green-800 font-medium">"{flaw.suggestion}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 지루함 경보 */}
              {session.analysis.boringParts.length > 0 && (
                <div className="bg-white p-4 rounded-lg mb-4">
                  <h3 className="font-bold text-sm text-gray-700 mb-3">😴 지루함 경보 ({session.analysis.boringParts.length}개)</h3>
                  <div className="space-y-2">
                    {session.analysis.boringParts.map((part, idx) => (
                      <div key={idx} className="border-l-4 border-orange-400 pl-3 bg-orange-50 p-2 rounded">
                        <p className="text-sm text-gray-700 italic mb-1">"{part.original}"</p>
                        <p className="text-xs text-orange-700 font-bold">⚡ 이유: {part.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 액션 플랜 */}
              <div className="bg-red-600 text-white p-4 rounded-lg">
                <h3 className="font-bold text-sm mb-2">🚨 당장 고쳐야 할 1가지</h3>
                <p className="font-medium text-lg">{session.analysis.actionPlan}</p>
              </div>

              {/* 대본 개선 버튼 */}
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleImproveScript}
                  disabled={loading === 'IMPROVING'}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                >
                  {loading === 'IMPROVING' ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⚙️</span> 대본 개선중...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      🔧 PD 분석 반영하여 대본 개선하기
                    </span>
                  )}
                </button>
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