'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SettingsModal from './SettingsModal';

// ── Voice transcript correction — fixes common speech-to-text mishearings of tech terms ──
const TECH_CORRECTIONS: [RegExp, string][] = [
  [/\bnaka\b/gi, 'Kafka'],
  [/\bnauka\b/gi, 'Kafka'],
  [/\bkafka\b/gi, 'Kafka'],
  [/\bcuber nettis\b/gi, 'Kubernetes'],
  [/\bcuber netes\b/gi, 'Kubernetes'],
  [/\bcubernetes\b/gi, 'Kubernetes'],
  [/\bkubernetes\b/gi, 'Kubernetes'],
  [/\belastic search\b/gi, 'Elasticsearch'],
  [/\belasticsearch\b/gi, 'Elasticsearch'],
  [/\bspring boot\b/gi, 'Spring Boot'],
  [/\bmicro services\b/gi, 'microservices'],
  [/\bmicro service\b/gi, 'microservice'],
  [/\bpost gress\b/gi, 'PostgreSQL'],
  [/\bpost grays\b/gi, 'PostgreSQL'],
  [/\bpostgres\b/gi, 'PostgreSQL'],
  [/\bpost grass\b/gi, 'PostgreSQL'],
  [/\bsql\b/gi, 'SQL'],
  [/\bno sql\b/gi, 'NoSQL'],
  [/\bmongo db\b/gi, 'MongoDB'],
  [/\bmongodb\b/gi, 'MongoDB'],
  [/\bredis\b/gi, 'Redis'],
  [/\bdocker\b/gi, 'Docker'],
  [/\bgrafana\b/gi, 'Grafana'],
  [/\bprometheus\b/gi, 'Prometheus'],
  [/\bjava script\b/gi, 'JavaScript'],
  [/\btype script\b/gi, 'TypeScript'],
  [/\bfast api\b/gi, 'FastAPI'],
  [/\bfast a p i\b/gi, 'FastAPI'],
  [/\bgit hub\b/gi, 'GitHub'],
  [/\bci cd\b/gi, 'CI/CD'],
  [/\bapi\b/gi, 'API'],
  [/\bllm\b/gi, 'LLM'],
  [/\brag\b/gi, 'RAG'],
  [/\bmcp\b/gi, 'MCP'],
  [/\baws\b/gi, 'AWS'],
  [/\bgcp\b/gi, 'GCP'],
  [/\bagent pulse\b/gi, 'AgentPulse'],
  [/\bsupabase\b/gi, 'Supabase'],
  [/\bmaven\b/gi, 'Maven'],
  [/\bfaang\b/gi, 'FAANG'],
  [/\bstar method\b/gi, 'STAR method'],
];

function correctTranscript(text: string): string {
  let result = text;
  for (const [pattern, replacement] of TECH_CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

const ANUP_SYSTEM = `You are Parakeet — Anup Verma's personal AI interview coach. You know his full career history and give hyper-specific, actionable coaching.

ANUP'S PROFILE:
- Technical Lead, 11+ years experience
- Current: Wipro → MGM Resorts (Sep 2023–present): Integrated MCP servers across 200+ microservices (−40% boilerplate), Java Common Module (−25% MTTR), Grafana automation
- Capgemini → BMW (2021–2023): Led PQM app, Java 17, Kafka, Elasticsearch, cross-functional team
- TCS → Maersk (2019–2021): Modernized GSIS legacy system, shipping schedule accuracy
- HCL → Air Canada (2015–2019): PNR servicing, flight rebooking, high-load aviation systems
- Open Source: AgentPulse (PyPI) — LLM proxy for schema drift, AsyncGroq, FastAPI, Supabase; MCP Chatbot RAG System
- Skills: Java v21, Python, Spring Boot, FastAPI, Kafka, Elasticsearch, PostgreSQL, MCP, RAG, LLM APIs, Docker, Grafana
- Target: Staff/Principal/AI Engineer at FAANG-adjacent or AI startup. ₹40–60 LPA+ India or $180k–$220k+ global

SPEECH-TO-TEXT NOTE: Input may have mishearings. "Naka" = Kafka. "Cuber nettis" = Kubernetes. "Post gress" = PostgreSQL. Always infer the correct technical term and answer that.

COACHING RULES:
- MOBILE FORMAT: Keep answers SHORT. Use bullet points. Max 150 words unless doing a full mock interview.
- Be brutally honest — no fake praise
- Always reference Anup's REAL projects and numbers
- After answering, suggest ONE specific next drill as a short follow-up line
- For mock interview questions: ask ONE question, wait for answer, then give bullet feedback + model answer
- Salary: target ₹40-60 LPA in India, $180k-$220k globally — coach aggressively
- His MCP/AgentPulse work is a MASSIVE differentiator — remind him to lead with it

Start fresh sessions: "What are we drilling? (1) Mock Interview (2) STAR Stories (3) System Design (4) Salary Negotiation (5) Other topic"`;

const QUICK_PROMPTS = [
  { emoji: '🎯', label: 'Mock Interview', prompt: 'Start a mock Staff Engineer technical interview — ask me the first question' },
  { emoji: '💬', label: 'About Yourself', prompt: 'Coach my "Tell me about yourself" — give me the exact script' },
  { emoji: '⭐', label: 'STAR: MGM/MCP', prompt: 'Give me a STAR answer for my MCP integration work at MGM — make it interview-ready' },
  { emoji: '💰', label: 'Salary Strategy', prompt: 'What salary should I ask for and what exact words do I say to negotiate?' },
];

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

async function callGroq(
  apiKey: string,
  history: HistoryItem[],
  currentMessage: string,
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      ...history
        .filter((m) => m.content && !m.content.startsWith('⚠️'))
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: currentMessage },
    ],
    max_tokens: 1024,
    temperature: 0.75,
    stream: true,
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const text: string = json?.choices?.[0]?.delta?.content ?? '';
        if (text) {
          fullText += text;
          onChunk(fullText);
        }
      } catch {
        // partial chunk
      }
    }
  }

  return fullText;
}

export default function ChatInterface() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [transcript, setTranscript] = useState('');
  // pendingTranscript = voice recognized text waiting for 2.5s confirm before auto-send
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [error, setError] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');

  const answerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('parakeet_api_key') || '';
    const savedPrompt = localStorage.getItem('parakeet_system_prompt') || '';
    const savedSpeak = localStorage.getItem('parakeet_auto_speak');
    setApiKey(savedKey);
    setSystemPrompt(savedPrompt);
    setAutoSpeak(savedSpeak === null ? true : savedSpeak === 'true');
    if (!savedKey) setTimeout(() => setShowSettings(true), 600);
  }, []);

  useEffect(() => {
    if (currentAnswer) {
      answerRef.current?.scrollTo({ top: answerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [currentAnswer]);

  // Cleanup pending timer on unmount
  useEffect(() => () => { if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); }, []);

  const speakText = useCallback(
    (text: string) => {
      if (!autoSpeak || typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#`•]/g, '').replace(/\n+/g, '. ');
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.name.includes('Samantha')) || voices.find((v) => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [autoSpeak]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      setError('');
      setPendingTranscript('');
      setShowTextInput(false);

      if (!apiKey) {
        setError('No Groq API key. Open Settings and add your key from console.groq.com');
        setShowSettings(true);
        return;
      }

      setCurrentQuestion(trimmed);
      setCurrentAnswer('');
      setIsLoading(true);

      try {
        const fullText = await callGroq(
          apiKey,
          history,
          trimmed,
          systemPrompt?.trim() || ANUP_SYSTEM,
          (partial) => setCurrentAnswer(partial)
        );

        setHistory((prev) => [
          ...prev,
          { role: 'user', content: trimmed },
          { role: 'assistant', content: fullText },
        ]);

        if (fullText) speakText(fullText);
      } catch (err: any) {
        const raw = err?.message || '';
        const msg =
          raw.includes('401') || raw.includes('API key') || raw.includes('Unauthorized')
            ? '❌ Invalid Groq key — check Settings'
            : raw.includes('429')
            ? '⏱ Rate limit — wait a moment and try again'
            : raw.includes('503') || raw.includes('overloaded')
            ? '🔄 Groq is busy — try again in a few seconds'
            : `❌ ${raw || 'Something went wrong'}`;
        setCurrentAnswer('');
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [history, isLoading, systemPrompt, apiKey, speakText]
  );

  // Cancel the pending auto-send
  const cancelPending = useCallback(() => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    setPendingTranscript('');
  }, []);

  // Confirm the pending transcript immediately (don't wait for timer)
  const confirmPending = useCallback(() => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    const text = pendingTranscript;
    setPendingTranscript('');
    if (text) sendMessage(text);
  }, [pendingTranscript, sendMessage]);

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Voice input requires Safari on iOS 15+ or Chrome on desktop');
      return;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    cancelPending();

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }

      if (final) {
        setIsRecording(false);
        setTranscript('');
        recognition.stop();
        // Correct tech term mishearings, then show 2.5s confirm window
        const corrected = correctTranscript(final.trim());
        setPendingTranscript(corrected);
        pendingTimerRef.current = setTimeout(() => {
          setPendingTranscript('');
          sendMessage(corrected);
        }, 2500);
      } else {
        setTranscript(correctTranscript(interim));
      }
    };

    recognition.onerror = (e: any) => {
      setIsRecording(false);
      setTranscript('');
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`Mic error: ${e.error}`);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      setTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [sendMessage, cancelPending]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setTranscript('');
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const clearSession = useCallback(() => {
    window.speechSynthesis?.cancel();
    cancelPending();
    setHistory([]);
    setCurrentQuestion('');
    setCurrentAnswer('');
    setTranscript('');
    setError('');
    setIsSpeaking(false);
  }, [cancelPending]);

  const isIdle = !currentQuestion && !currentAnswer && !isLoading && !pendingTranscript;

  const micState =
    isRecording ? 'recording' :
    isLoading ? 'loading' :
    isSpeaking ? 'speaking' :
    pendingTranscript ? 'pending' : 'idle';

  const hintText =
    micState === 'recording' ? 'Listening… speak now' :
    micState === 'loading' ? 'Coach is thinking…' :
    micState === 'speaking' ? 'Speaking — tap mic to stop' :
    micState === 'pending' ? 'Tap ✓ to send or ✕ to cancel' :
    isIdle ? 'Tap the mic and ask anything' :
    'Tap mic for next question';

  return (
    <div className="flex flex-col bg-[#08080c] text-white select-none" style={{ height: '100dvh' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 pb-3 bg-black/80 backdrop-blur-xl border-b border-white/[0.06] flex-shrink-0 z-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button onClick={clearSession} className="text-white/40 text-sm font-medium active:text-white min-w-[52px]">
          {history.length > 0 || currentQuestion ? 'New' : ''}
        </button>
        <div className="flex flex-col items-center">
          <span className="text-base font-bold tracking-tight">🦜 Parakeet</span>
          <span className="text-[10px] text-indigo-400 font-semibold tracking-widest uppercase">Interview Coach</span>
        </div>
        <button onClick={() => setShowSettings(true)} className="text-white/40 active:text-white min-w-[52px] flex justify-end" aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* ── Main content ── */}
      <div ref={answerRef} className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as any}>

        {/* Welcome / idle */}
        {isIdle && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-8 gap-5">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30 text-5xl">
              🦜
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold gradient-text mb-1">Parakeet AI</h1>
              <p className="text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-3">Your Personal Interview Coach</p>
              <p className="text-white/40 text-sm leading-relaxed max-w-[280px] mx-auto">
                I know your full story — 11 years, MGM, BMW, Maersk, AgentPulse. Let's crack that dream role.
              </p>
            </div>

            {error && (
              <div className="glass rounded-2xl p-4 w-full max-w-xs">
                <p className="text-sm text-orange-300">{error}</p>
                <button onClick={() => setShowSettings(true)} className="mt-2 text-indigo-400 text-sm underline">
                  Open Settings →
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 w-full max-w-xs">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => sendMessage(p.prompt)}
                  className="glass rounded-2xl p-3.5 text-left active:bg-white/10 transition-colors"
                >
                  <div className="text-xl mb-1.5">{p.emoji}</div>
                  <div className="text-xs font-semibold text-white/80 leading-tight">{p.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active session */}
        {!isIdle && (
          <div className="px-5 pt-6 pb-4">
            {currentQuestion && (
              <div className="mb-5">
                <p className="text-[11px] text-white/28 uppercase tracking-widest font-semibold mb-2">You</p>
                <p className="text-white/55 text-[15px] leading-relaxed">{currentQuestion}</p>
              </div>
            )}

            {(currentAnswer || isLoading) && (
              <p className="text-[11px] text-indigo-400 uppercase tracking-widest font-semibold mb-3">Coach</p>
            )}

            {isLoading && !currentAnswer && (
              <div className="flex gap-1.5 items-center py-2">
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-400"
                    style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: `${d}s` }} />
                ))}
              </div>
            )}

            {currentAnswer && (
              <div className="text-white text-[17px] leading-[1.75] whitespace-pre-wrap tracking-[0.01em]">
                {currentAnswer}
                {isLoading && (
                  <span className="inline-block w-0.5 h-5 bg-indigo-400 ml-0.5 align-middle"
                    style={{ animation: 'cursor-blink 0.8s step-end infinite' }} />
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 glass rounded-2xl p-4">
                <p className="text-sm text-orange-300">{error}</p>
                {error.includes('key') && (
                  <button onClick={() => setShowSettings(true)} className="mt-2 text-indigo-400 text-sm underline block">
                    Open Settings →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Live interim transcript ── */}
      {transcript && (
        <div className="px-5 py-2.5 border-t border-white/[0.06] bg-black/50 flex-shrink-0">
          <p className="text-indigo-300 text-sm italic">{transcript}…</p>
        </div>
      )}

      {/* ── Pending transcript confirm banner ── */}
      {pendingTranscript && (
        <div className="px-4 py-3 border-t border-white/[0.06] bg-indigo-950/70 flex-shrink-0">
          <p className="text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5">Heard:</p>
          <p className="text-white text-sm font-medium mb-3 leading-snug">"{pendingTranscript}"</p>
          <div className="flex gap-2">
            <button
              onClick={confirmPending}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-sm font-semibold text-white active:opacity-80"
            >
              ✓ Send
            </button>
            <button
              onClick={cancelPending}
              className="flex-1 py-2.5 rounded-xl glass text-sm font-medium text-white/60 active:bg-white/10"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom controls ── */}
      <div
        className="flex-shrink-0 flex flex-col items-center bg-black/70 backdrop-blur-xl border-t border-white/[0.06]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', paddingTop: '14px' }}
      >
        {/* Waveform */}
        <div className="h-7 flex items-center justify-center mb-2">
          {(isRecording || isSpeaking) ? (
            <div className="flex gap-1 items-center">
              {[12, 20, 28, 20, 32, 20, 28, 20, 12].map((h, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full ${isRecording ? 'bg-red-400' : 'bg-indigo-400'}`}
                  style={{
                    height: `${h}px`,
                    animation: 'wave 0.9s ease-in-out infinite alternate',
                    animationDelay: `${i * 0.09}s`,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="h-7" />
          )}
        </div>

        {/* Hint */}
        <p className="text-xs text-white/30 mb-3.5 font-medium tracking-wide text-center px-4">{hintText}</p>

        {/* Big mic */}
        <button
          onClick={
            isRecording ? stopRecording :
            isSpeaking ? stopSpeaking :
            pendingTranscript ? confirmPending :
            isLoading ? undefined :
            startRecording
          }
          disabled={isLoading}
          className={`w-[76px] h-[76px] rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 active:scale-95 mb-3
            ${isRecording ? 'bg-red-500 shadow-red-500/50 scale-110'
              : isSpeaking ? 'bg-indigo-500 shadow-indigo-500/40'
              : pendingTranscript ? 'bg-green-500 shadow-green-500/40'
              : isLoading ? 'bg-white/10 shadow-none'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-purple-500/40'}`}
        >
          {isSpeaking ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          ) : pendingTranscript ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : isLoading ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="animate-spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Type instead */}
        <button
          onClick={() => {
            setShowTextInput((v) => !v);
            if (!showTextInput) setTimeout(() => textInputRef.current?.focus(), 100);
          }}
          className="text-xs text-white/25 active:text-white/60 px-4 py-1 mb-1"
        >
          {showTextInput ? 'Hide keyboard' : 'Type instead'}
        </button>

        {showTextInput && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (textInput.trim()) { sendMessage(textInput.trim()); setTextInput(''); }
            }}
            className="flex gap-2 px-4 mt-1.5 w-full"
          >
            <input
              ref={textInputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your question…"
              disabled={isLoading}
              style={{ fontSize: '16px' }}
              className="flex-1 glass rounded-xl px-4 py-2.5 text-white placeholder-white/25 outline-none text-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !textInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-500 text-sm font-semibold text-white active:opacity-80 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          systemPrompt={systemPrompt}
          autoSpeak={autoSpeak}
          onClose={() => setShowSettings(false)}
          onSave={(k, p, s) => {
            setApiKey(k);
            setSystemPrompt(p);
            setAutoSpeak(s);
            localStorage.setItem('parakeet_api_key', k);
            localStorage.setItem('parakeet_system_prompt', p);
            localStorage.setItem('parakeet_auto_speak', s.toString());
            setShowSettings(false);
            if (error && k) setError('');
          }}
        />
      )}
    </div>
  );
}
