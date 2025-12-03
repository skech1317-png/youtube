import React, { useState, useEffect } from 'react';
import { ScriptSession, INITIAL_SESSION } from './types';
import { suggestTopicsFromScript, generateScriptForTopic } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [session, setSession] = useState<ScriptSession>(INITIAL_SESSION);
  const [loading, setLoading] = useState<'IDLE' | 'SUGGESTING' | 'GENERATING'>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Persistence: Load
  useEffect(() => {
    const saved = localStorage.getItem('mvp_script_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
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
      const script = await generateScriptForTopic(topic, session.originalScript);
      setSession(prev => ({ ...prev, generatedNewScript: script }));
    } catch (e) {
      setErrorMsg("대본 생성 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading('IDLE');
    }
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
          <button 
            onClick={handleClear}
            className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-gray-300 transition-colors"
          >
            초기화
          </button>
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
          {session.generatedNewScript && (
            <section className="border-t border-gray-100 pt-6 animate-fade-in">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-bold text-gray-700">
                  3. 생성된 새 대본
                </label>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  주제: {session.selectedTopic}
                </span>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-inner">
                <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed text-base">
                  {session.generatedNewScript}
                </pre>
              </div>
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