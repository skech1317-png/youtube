import React, { useState, useEffect } from 'react';
import { ScriptSession, INITIAL_SESSION, ScriptHistoryItem } from './types';
import { suggestTopicsFromScript, generateScriptForTopic } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [session, setSession] = useState<ScriptSession>(INITIAL_SESSION);
  const [loading, setLoading] = useState<'IDLE' | 'SUGGESTING' | 'GENERATING'>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<boolean>(false);

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
          isEditMode: parsed.isEditMode ?? false,
          generatedScripts: parsed.generatedScripts ?? [],
          history: parsed.history ?? [],
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
    
    setLoading('SUGGESTING');
    setErrorMsg(null);
    
    try {
      const topics = await suggestTopicsFromScript(session.originalScript);
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
      const script = await generateScriptForTopic(topic, session.originalScript, recentHistory);
      
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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4 font-sans">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
        
        {/* Header */}
        <header className="bg-black text-white p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">AI YouTube Script Maker</h1>
            <p className="text-gray-400 text-sm mt-1">대본 입력 → 주제 추천 → 새 대본 생성</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-300 transition-colors"
            >
              📚 히스토리 ({session.history.length})
            </button>
            <button 
              onClick={() => setCompareMode(!compareMode)}
              className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-300 transition-colors"
              disabled={session.generatedScripts.length === 0}
            >
              🔀 비교 ({session.generatedScripts.length})
            </button>
            <button 
              onClick={handleClear}
              className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-300 transition-colors"
            >
              초기화
            </button>
          </div>
        </header>

        <main className="p-6 space-y-8">
          
          {/* STEP 1: Input */}
          <section>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              1. 기존 대본 또는 아이디어 입력
            </label>
            <textarea
              className="w-full h-40 p-4 border-2 border-gray-200 rounded-lg focus:border-black focus:ring-0 transition-colors resize-none text-base"
              placeholder="여기에 대본 초안이나 아이디어를 자유롭게 적어주세요..."
              value={session.originalScript}
              onChange={handleInputChange}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleSuggest}
                disabled={loading !== 'IDLE' || !session.originalScript.trim()}
                className="bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {loading === 'SUGGESTING' ? (
                  <span className="animate-pulse">분석 중...</span>
                ) : (
                  <>
                    <span>새로운 주제 추천받기</span>
                    <span>↓</span>
                  </>
                )}
              </button>
            </div>
            {errorMsg && <p className="text-red-500 text-sm mt-2 text-right">{errorMsg}</p>}
          </section>

          {/* STEP 2: Suggestions */}
          {session.suggestedTopics.length > 0 && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <label className="block text-sm font-bold text-gray-700 mb-3">
                2. 추천 주제 선택 (클릭하여 대본 생성)
              </label>
              <div className="grid gap-3 sm:grid-cols-1">
                {session.suggestedTopics.map((topic, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleGenerateScript(topic)}
                    disabled={loading !== 'IDLE'}
                    className={`text-left p-4 rounded-lg border-2 transition-all hover:scale-[1.01] ${
                      session.selectedTopic === topic
                        ? 'border-black bg-gray-50 ring-1 ring-black'
                        : 'border-gray-200 hover:border-gray-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-lg text-gray-800">{topic}</span>
                      {loading === 'GENERATING' && session.selectedTopic === topic && (
                        <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* STEP 3: Result */}
          {session.generatedNewScript && !compareMode && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-bold text-gray-700">
                  3. 생성된 새 대본
                </label>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    주제: {session.selectedTopic}
                  </span>
                  <button
                    onClick={toggleEditMode}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
                  >
                    {session.isEditMode ? '📝 편집 중' : '✏️ 편집'}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors"
                  >
                    📋 복사
                  </button>
                  <button
                    onClick={handleDownload}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition-colors"
                  >
                    💾 다운로드
                  </button>
                  {session.isEditMode && (
                    <button
                      onClick={saveEditedScript}
                      className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded transition-colors"
                    >
                      ✅ 저장
                    </button>
                  )}
                </div>
              </div>
              {session.isEditMode ? (
                <textarea
                  className="w-full h-96 p-6 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors resize-none text-base font-sans"
                  value={session.generatedNewScript}
                  onChange={(e) => handleEditScript(e.target.value)}
                />
              ) : (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-inner">
                  <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed text-base">
                    {session.generatedNewScript}
                  </pre>
                </div>
              )}
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
        </main>

        <footer className="bg-gray-50 p-4 text-center text-xs text-gray-400 border-t border-gray-100">
          모든 데이터는 브라우저(LocalStorage)에 자동 저장됩니다.
        </footer>
      </div>
    </div>
  );
};

export default App;