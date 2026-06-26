'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SettingsModal from './SettingsModal';

// ── Tech term corrections for voice mishearings ──
const TECH_CORRECTIONS: [RegExp, string][] = [
  [/\bnaka\b/gi, 'Kafka'], [/\bnauka\b/gi, 'Kafka'],
  [/\bcuber nettis\b/gi, 'Kubernetes'], [/\bcuber netes\b/gi, 'Kubernetes'],
  [/\belastic search\b/gi, 'Elasticsearch'],
  [/\bspring boot\b/gi, 'Spring Boot'],
  [/\bmicro services\b/gi, 'microservices'], [/\bmicro service\b/gi, 'microservice'],
  [/\bpost gress\b/gi, 'PostgreSQL'], [/\bpost grays\b/gi, 'PostgreSQL'], [/\bpost grass\b/gi, 'PostgreSQL'],
  [/\bno sql\b/gi, 'NoSQL'], [/\bmongo db\b/gi, 'MongoDB'],
  [/\bjava script\b/gi, 'JavaScript'], [/\btype script\b/gi, 'TypeScript'],
  [/\bfast api\b/gi, 'FastAPI'], [/\bfast a p i\b/gi, 'FastAPI'],
  [/\bgit hub\b/gi, 'GitHub'], [/\bci cd\b/gi, 'CI/CD'],
  [/\bagent pulse\b/gi, 'AgentPulse'], [/\bstar method\b/gi, 'STAR method'],
];

function correctTranscript(text: string): string {
  let r = text;
  for (const [p, s] of TECH_CORRECTIONS) r = r.replace(p, s);
  return r;
}

// ── System prompts ──

const COACH_SYSTEM = `You are Parakeet — Anup Verma's personal AI interview coach. Give brutally honest, hyper-specific coaching.

ANUP'S PROFILE:
- Technical Lead, 11+ years | Wipro → MGM Resorts (Sep 2023–present): MCP servers on 200+ microservices (−40% boilerplate, −25% MTTR)
- Capgemini → BMW (2021–2023): Led PQM app, Java 17, Kafka, Elasticsearch
- TCS → Maersk (2019–2021): Legacy modernization, GSIS system
- HCL → Air Canada (2015–2019): PNR servicing, high-load aviation systems
- Open Source: AgentPulse (PyPI) — LLM proxy/schema drift; MCP Chatbot RAG System
- Skills: Java 21, Python, Spring Boot, FastAPI, Kafka, Elasticsearch, PostgreSQL, MCP, RAG, Docker, Grafana
- Target: Staff/Principal/AI Engineer. ₹40–60 LPA India or $180k–$220k+ global

SPEECH-TO-TEXT: May have mishearings — "Naka"=Kafka, "Cuber nettis"=Kubernetes. Always infer correct tech term.

RULES:
- SHORT answers for mobile: bullet points, max 150 words
- Reference Anup's REAL projects and numbers always
- After answering, suggest ONE next drill
- For mock interview: ask ONE question, wait, give bullet feedback + model answer
- His MCP/AgentPulse work is a MASSIVE differentiator — always remind him to lead with it

Start: "What are we drilling? (1) Mock Interview (2) STAR Stories (3) System Design (4) Salary Negotiation (5) Other"`;

const INTERVIEW_SYSTEM = `You are Parakeet — a LIVE interview copilot for Anup Verma. The interviewer is speaking. Generate INSTANT talking points for Anup to use RIGHT NOW.

ANUP'S BACKGROUND:
- Technical Lead, 11+ years | Current: Wipro → MGM Resorts: MCP integration across 200+ microservices (−40% boilerplate, −25% MTTR), Grafana automation
- Capgemini → BMW: Led PQM app, Java 17, Kafka, Elasticsearch, cross-functional team
- TCS → Maersk: Legacy GSIS modernization, shipping system accuracy
- HCL → Air Canada: PNR servicing, high-load aviation systems
- Open Source: AgentPulse (PyPI) — LLM proxy, schema drift solution; MCP Chatbot RAG System
- Skills: Java 21, Python, Spring Boot, FastAPI, Kafka, Elasticsearch, PostgreSQL, MCP, RAG, LLM APIs, Docker, Grafana
- Target: Staff/Principal/AI Engineer. ₹40–60 LPA India or $180k–$220k global

SPEECH-TO-TEXT CORRECTION: "Naka"=Kafka, "Cuber nettis"=Kubernetes, "Post gress"=PostgreSQL etc. Always infer correct tech term.

LIVE COPILOT RULES — CRITICAL:
1. Output ONLY bullet points — max 4 bullets, max 12 words each
2. These are SPOKEN talking points Anup will say out loud RIGHT NOW
3. Start with his strongest relevant experience for this question
4. Always include a specific number/metric if relevant (40%, 25%, 200+, 11 years)
5. If it's small talk or not a question, output: "💬 Small talk — just be natural"
6. If unclear/mishear, output: "🎤 Didn't catch that — keep listening"
7. NO intros, NO "Here are your talking points", NO explanations — JUST the bullets

Example output for "Tell me about yourself":
• 11 years backend engineering → Technical Lead at MGM Resorts via Wipro
• Led MCP integration: 200+ microservices, 40% less boilerplate
• Built AgentPulse — open-source LLM proxy on PyPI (schema drift solution)
• Targeting Staff/AI Engineering roles where I own AI infra at scale`;

const COACH_QUICK_PROMPTS = [
  { emoji: '🎯', label: 'Mock Interview', prompt: 'Start a mock Staff Engineer technical interview — ask me the first question' },
  { emoji: '💬', label: 'About Yourself', prompt: 'Coach my "Tell me about yourself" — give me the exact script to say' },
  { emoji: '⭐', label: 'STAR: MGM/MCP', prompt: 'Give me a STAR answer for my MCP integration work at MGM — make it interview-ready' },
  { emoji: '💰', label: 'Salary Strategy', prompt: 'What salary should I ask for and what exact words do I use to negotiate?' },
];

interface HistoryItem { role: 'user' | 'assistant'; content: string; }

async function callGroq(
  apiKey: string,
  history: HistoryItem[],
  currentMessage: string,
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.filter(m => m.content && !m.content.startsWith('⚠️')).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: currentMessage },
      ],
      max_tokens: 512,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const d = line.slice(6).trim();
      if (!d || d === '[DONE]') continue;
      try {
        const text: string = JSON.parse(d)?.choices?.[0]?.delta?.content ?? '';
        if (text) { full += text; onChunk(full); }
      } catch { /* partial */ }
    }
  }
  return full;
}

type AppMode = 'coach' | 'interview';

export default function ChatInterface() {
  const [mode, setMode] = useState<AppMode>('coach');

  // Coach mode state
  const [coachHistory, setCoachHistory] = useState<HistoryItem[]>([]);
  const [coachQuestion, setCoachQuestion] = useState('');
  const [coachAnswer, setCoachAnswer] = useState('');

  // Interview mode state
  const [liveQuestion, setLiveQuestion] = useState('');   // what the interviewer said
  const [liveAnswer, setLiveAnswer] = useState('');        // talking points for Anup
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [liveInterim, setLiveInterim] = useState('');      // real-time transcript
  const [liveHistory, setLiveHistory] = useState<HistoryItem[]>([]);

  // Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);  // coach mode mic
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [transcript, setTranscript] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [error, setError] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');

  const answerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const liveRecognitionRef = useRef<any>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveAccumulatedRef = useRef('');
  const isLiveActiveRef = useRef(false);  // tracks if interview mode should keep running

  useEffect(() => {
    const savedKey = localStorage.getItem('parakeet_api_key') || '';
    const savedPrompt = localStorage.getItem('parakeet_system_prompt') || '';
    const savedSpeak = localStorage.getItem('parakeet_auto_speak');
    setApiKey(savedKey);
    setSystemPrompt(savedPrompt);
    setAutoSpeak(savedSpeak === 'true');
    if (!savedKey) setTimeout(() => setShowSettings(true), 600);
  }, []);

  useEffect(() => {
    answerRef.current?.scrollTo({ top: answerRef.current.scrollHeight, behavior: 'smooth' });
  }, [coachAnswer, liveAnswer]);

  useEffect(() => () => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  // ─── COACH MODE ────────────────────────────────────────────────────────────

  const speakText = useCallback((text: string) => {
    if (!autoSpeak || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`•]/g, '').replace(/\n+/g, '. '));
    u.rate = 1.05;
    const v = window.speechSynthesis.getVoices();
    const pref = v.find(x => x.name.includes('Samantha')) || v.find(x => x.lang.startsWith('en'));
    if (pref) u.voice = pref;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [autoSpeak]);

  const sendCoachMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;
    setError('');
    setPendingTranscript('');
    setShowTextInput(false);

    if (!apiKey) { setError('Add your Groq API key in Settings'); setShowSettings(true); return; }

    setCoachQuestion(trimmed);
    setCoachAnswer('');
    setIsLoading(true);

    try {
      const full = await callGroq(apiKey, coachHistory, trimmed, systemPrompt?.trim() || COACH_SYSTEM,
        partial => setCoachAnswer(partial));
      setCoachHistory(prev => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: full }]);
      if (full) speakText(full);
    } catch (err: any) {
      const raw = err?.message || '';
      setCoachAnswer('');
      setError(raw.includes('401') ? '❌ Invalid Groq key — check Settings'
        : raw.includes('429') ? '⏱ Rate limit — wait a moment'
        : raw.includes('503') ? '🔄 Groq busy — try again'
        : `❌ ${raw || 'Something went wrong'}`);
    } finally {
      setIsLoading(false);
    }
  }, [coachHistory, isLoading, systemPrompt, apiKey, speakText]);

  const cancelPending = useCallback(() => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    setPendingTranscript('');
  }, []);

  const confirmPending = useCallback(() => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    const t = pendingTranscript;
    setPendingTranscript('');
    if (t) sendCoachMessage(t);
  }, [pendingTranscript, sendCoachMessage]);

  const startCoachRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('Voice requires Safari iOS 15+ or Chrome'); return; }
    window.speechSynthesis?.cancel(); setIsSpeaking(false); cancelPending();

    const r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = 'en-US';
    r.onstart = () => setIsRecording(true);
    r.onresult = (ev: any) => {
      let interim = '', final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t; else interim += t;
      }
      if (final) {
        setIsRecording(false); setTranscript(''); r.stop();
        const corrected = correctTranscript(final.trim());
        setPendingTranscript(corrected);
        pendingTimerRef.current = setTimeout(() => { setPendingTranscript(''); sendCoachMessage(corrected); }, 2500);
      } else setTranscript(correctTranscript(interim));
    };
    r.onerror = (e: any) => { setIsRecording(false); setTranscript(''); if (e.error !== 'no-speech') setError(`Mic: ${e.error}`); };
    r.onend = () => { setIsRecording(false); setTranscript(''); };
    recognitionRef.current = r;
    r.start();
  }, [sendCoachMessage, cancelPending]);

  const stopCoachRecording = useCallback(() => { recognitionRef.current?.stop(); setIsRecording(false); setTranscript(''); }, []);

  // ─── INTERVIEW MODE ─────────────────────────────────────────────────────────

  const generateLiveAnswer = useCallback(async (question: string) => {
    if (!question.trim() || !apiKey || isLoading) return;
    const corrected = correctTranscript(question.trim());
    setLiveQuestion(corrected);
    setLiveAnswer('');
    setIsLoading(true);

    try {
      const full = await callGroq(apiKey, liveHistory, corrected, INTERVIEW_SYSTEM,
        partial => setLiveAnswer(partial));
      setLiveHistory(prev => [...prev, { role: 'user', content: corrected }, { role: 'assistant', content: full }]);
    } catch (err: any) {
      const raw = err?.message || '';
      setError(raw.includes('401') ? '❌ Invalid Groq key — check Settings'
        : raw.includes('429') ? '⏱ Rate limit — wait a second'
        : `❌ ${raw || 'API error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, isLoading, liveHistory]);

  const startLiveRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onstart = () => setIsLiveListening(true);

    r.onresult = (ev: any) => {
      let newFinal = '';
      let interim = '';

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) newFinal += t + ' ';
        else interim += t;
      }

      if (newFinal) {
        liveAccumulatedRef.current += newFinal;
      }
      setLiveInterim(correctTranscript((liveAccumulatedRef.current + interim).trim()));

      // Reset silence timer — if 2.5s of silence after speech, fire question
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const accumulated = liveAccumulatedRef.current.trim();
        if (accumulated.length > 8) {  // ignore very short fragments
          liveAccumulatedRef.current = '';
          setLiveInterim('');
          generateLiveAnswer(accumulated);
        } else {
          liveAccumulatedRef.current = '';
          setLiveInterim('');
        }
      }, 2500);
    };

    r.onerror = (e: any) => {
      if (e.error === 'no-speech') return; // normal during silence
      if (e.error === 'aborted') return;
      setError(`Mic error: ${e.error}`);
    };

    r.onend = () => {
      // Auto-restart if interview mode is still active
      if (isLiveActiveRef.current) {
        setTimeout(() => {
          if (isLiveActiveRef.current) startLiveRecognition();
        }, 300);
      } else {
        setIsLiveListening(false);
      }
    };

    liveRecognitionRef.current = r;
    try { r.start(); } catch { /* already started */ }
  }, [generateLiveAnswer]);

  const startInterviewMode = useCallback(() => {
    if (!apiKey) { setError('Add your Groq API key in Settings first'); setShowSettings(true); return; }
    setError('');
    liveAccumulatedRef.current = '';
    isLiveActiveRef.current = true;
    setIsLiveListening(true);
    setLiveQuestion('');
    setLiveAnswer('');
    setLiveInterim('');
    startLiveRecognition();
  }, [apiKey, startLiveRecognition]);

  const stopInterviewMode = useCallback(() => {
    isLiveActiveRef.current = false;
    setIsLiveListening(false);
    liveAccumulatedRef.current = '';
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    try { liveRecognitionRef.current?.stop(); } catch { /* ok */ }
    setLiveInterim('');
  }, []);

  // Stop interview mode when switching away
  const switchMode = useCallback((newMode: AppMode) => {
    if (mode === 'interview') stopInterviewMode();
    if (mode === 'coach') { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); }
    setError('');
    setMode(newMode);
  }, [mode, stopInterviewMode]);

  const clearSession = useCallback(() => {
    window.speechSynthesis?.cancel();
    cancelPending();
    if (mode === 'interview') stopInterviewMode();
    setCoachHistory([]); setCoachQuestion(''); setCoachAnswer('');
    setLiveHistory([]); setLiveQuestion(''); setLiveAnswer('');
    setTranscript(''); setError(''); setIsSpeaking(false);
  }, [mode, cancelPending, stopInterviewMode]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  const coachIsIdle = !coachQuestion && !coachAnswer && !isLoading && !pendingTranscript;
  const liveIsIdle = !liveQuestion && !liveAnswer && !isLoading;

  return (
    <div className="flex flex-col bg-[#08080c] text-white select-none" style={{ height: '100dvh' }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: '8px' }}>

        <div className="flex items-center justify-between px-5 mb-2">
          <button onClick={clearSession} className="text-white/40 text-sm font-medium active:text-white min-w-[48px]">
            {(coachQuestion || liveQuestion || isLiveListening) ? 'New' : ''}
          </button>
          <div className="flex flex-col items-center">
            <span className="text-base font-bold tracking-tight">🦜 Parakeet</span>
          </div>
          <button onClick={() => setShowSettings(true)} className="text-white/40 active:text-white min-w-[48px] flex justify-end" aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Mode switcher tabs */}
        <div className="flex mx-5 bg-white/[0.06] rounded-xl p-1 gap-1">
          {(['coach', 'interview'] as AppMode[]).map((m) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-200
                ${mode === m ? (m === 'interview' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30')
                  : 'text-white/40 active:text-white/70'}`}>
              {m === 'coach' ? '🎓 Coach Mode' : '🔴 Live Interview'}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════ INTERVIEW MODE ══════════════════════ */}
      {mode === 'interview' && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Content */}
          <div ref={answerRef} className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as any}>

            {/* Idle / setup screen */}
            {liveIsIdle && !isLiveListening && (
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-8 gap-5">
                <div className="text-5xl">🎙️</div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white mb-2">Live Interview Mode</h2>
                  <p className="text-white/50 text-sm leading-relaxed max-w-[290px]">
                    Place your phone on the desk. It listens to the interviewer and shows you talking points automatically — no tapping needed.
                  </p>
                </div>

                {/* Setup instructions */}
                <div className="glass rounded-2xl p-4 w-full max-w-xs space-y-3">
                  <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Setup</p>
                  {[
                    ['1', 'Join your interview (Zoom/Meet/Teams)'],
                    ['2', 'Set laptop to speakerphone'],
                    ['3', 'Place phone face-up near laptop'],
                    ['4', 'Tap Start — app listens to interviewer'],
                    ['5', 'Talking points appear automatically'],
                  ].map(([n, t]) => (
                    <div key={n} className="flex gap-3 items-start">
                      <span className="w-5 h-5 rounded-full bg-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
                      <p className="text-sm text-white/70 leading-snug">{t}</p>
                    </div>
                  ))}
                </div>

                {error && <p className="text-orange-300 text-sm text-center">{error}</p>}

                <button onClick={startInterviewMode}
                  className="w-full max-w-xs py-4 rounded-2xl bg-red-500 font-bold text-white text-base active:opacity-80 shadow-xl shadow-red-500/30">
                  🔴 Start Listening
                </button>
              </div>
            )}

            {/* Active listening / answer display */}
            {(isLiveListening || liveQuestion || liveAnswer) && (
              <div className="px-5 pt-5 pb-4">

                {/* Listening indicator */}
                {isLiveListening && (
                  <div className="flex items-center gap-3 mb-4 glass rounded-2xl px-4 py-3">
                    <div className="flex gap-1 items-center">
                      {[14, 22, 18, 28, 18, 22, 14].map((h, i) => (
                        <div key={i} className="w-1 rounded-full bg-red-400"
                          style={{ height: `${h}px`, animation: 'wave 0.9s ease-in-out infinite alternate', animationDelay: `${i * 0.09}s` }} />
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Listening to interviewer</p>
                      <p className="text-xs text-white/40">Talking points appear automatically</p>
                    </div>
                    <button onClick={stopInterviewMode} className="ml-auto text-white/30 active:text-white/80">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Live interim transcript (what mic is hearing) */}
                {liveInterim && (
                  <div className="mb-4 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                    <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1">Hearing</p>
                    <p className="text-white/50 text-sm leading-relaxed italic">{liveInterim}</p>
                  </div>
                )}

                {/* Question that was detected */}
                {liveQuestion && (
                  <div className="mb-4">
                    <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Interviewer asked</p>
                    <p className="text-white/65 text-[15px] leading-relaxed">{liveQuestion}</p>
                  </div>
                )}

                {/* Loading dots */}
                {isLoading && !liveAnswer && (
                  <div className="mb-4">
                    <p className="text-[11px] text-red-400 uppercase tracking-widest font-semibold mb-3">Generating talking points</p>
                    <div className="flex gap-1.5 items-center">
                      {[0, 0.2, 0.4].map((d, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full bg-red-400"
                          style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: `${d}s` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Talking points — BIG, easy to read while speaking */}
                {liveAnswer && (
                  <div>
                    <p className="text-[11px] text-red-400 uppercase tracking-widest font-semibold mb-3">
                      Your talking points
                    </p>
                    <div className="text-white text-[18px] leading-[1.8] whitespace-pre-wrap font-medium tracking-[0.01em]">
                      {liveAnswer}
                      {isLoading && (
                        <span className="inline-block w-0.5 h-5 bg-red-400 ml-0.5 align-middle"
                          style={{ animation: 'cursor-blink 0.8s step-end infinite' }} />
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-4 glass rounded-2xl p-4">
                    <p className="text-sm text-orange-300">{error}</p>
                    {error.includes('key') && (
                      <button onClick={() => setShowSettings(true)} className="mt-2 text-indigo-400 text-sm underline block">Open Settings →</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interview mode bottom — just stop button */}
          {isLiveListening && (
            <div className="flex-shrink-0 border-t border-white/[0.06] bg-black/70 backdrop-blur-xl px-5"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', paddingTop: '16px' }}>
              <button onClick={stopInterviewMode}
                className="w-full py-4 rounded-2xl bg-white/[0.07] border border-white/[0.12] font-semibold text-white/60 active:bg-white/10 text-sm">
                ■ Stop Listening
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ COACH MODE ══════════════════════ */}
      {mode === 'coach' && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Content */}
          <div ref={answerRef} className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as any}>

            {/* Idle screen */}
            {coachIsIdle && (
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-8 gap-5">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30 text-4xl">🦜</div>
                <div className="text-center">
                  <h1 className="text-xl font-bold gradient-text mb-1">Interview Coach</h1>
                  <p className="text-white/40 text-sm leading-relaxed max-w-[270px] mx-auto">
                    Practice your answers, drill STAR stories, or prep for a specific company.
                  </p>
                </div>
                {error && (
                  <div className="glass rounded-2xl p-4 w-full max-w-xs">
                    <p className="text-sm text-orange-300">{error}</p>
                    <button onClick={() => setShowSettings(true)} className="mt-2 text-indigo-400 text-sm underline">Open Settings →</button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5 w-full max-w-xs">
                  {COACH_QUICK_PROMPTS.map(p => (
                    <button key={p.label} onClick={() => sendCoachMessage(p.prompt)}
                      className="glass rounded-2xl p-3.5 text-left active:bg-white/10">
                      <div className="text-xl mb-1.5">{p.emoji}</div>
                      <div className="text-xs font-semibold text-white/80 leading-tight">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active session */}
            {!coachIsIdle && (
              <div className="px-5 pt-6 pb-4">
                {coachQuestion && (
                  <div className="mb-5">
                    <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-2">You</p>
                    <p className="text-white/55 text-[15px] leading-relaxed">{coachQuestion}</p>
                  </div>
                )}
                {(coachAnswer || isLoading) && (
                  <p className="text-[11px] text-indigo-400 uppercase tracking-widest font-semibold mb-3">Coach</p>
                )}
                {isLoading && !coachAnswer && (
                  <div className="flex gap-1.5 items-center py-2">
                    {[0, 0.2, 0.4].map((d, i) => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-400"
                        style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: `${d}s` }} />
                    ))}
                  </div>
                )}
                {coachAnswer && (
                  <div className="text-white text-[17px] leading-[1.75] whitespace-pre-wrap">
                    {coachAnswer}
                    {isLoading && (
                      <span className="inline-block w-0.5 h-5 bg-indigo-400 ml-0.5 align-middle"
                        style={{ animation: 'cursor-blink 0.8s step-end infinite' }} />
                    )}
                  </div>
                )}
                {error && (
                  <div className="mt-4 glass rounded-2xl p-4">
                    <p className="text-sm text-orange-300">{error}</p>
                    {error.includes('key') && <button onClick={() => setShowSettings(true)} className="mt-2 text-indigo-400 text-sm underline block">Open Settings →</button>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Transcript strips */}
          {transcript && (
            <div className="px-5 py-2.5 border-t border-white/[0.06] bg-black/50 flex-shrink-0">
              <p className="text-indigo-300 text-sm italic">{transcript}…</p>
            </div>
          )}

          {pendingTranscript && (
            <div className="px-4 py-3 border-t border-white/[0.06] bg-indigo-950/70 flex-shrink-0">
              <p className="text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5">Heard:</p>
              <p className="text-white text-sm font-medium mb-3">"{pendingTranscript}"</p>
              <div className="flex gap-2">
                <button onClick={confirmPending} className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-sm font-semibold text-white active:opacity-80">✓ Send</button>
                <button onClick={cancelPending} className="flex-1 py-2.5 rounded-xl glass text-sm font-medium text-white/60 active:bg-white/10">✕ Cancel</button>
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div className="flex-shrink-0 flex flex-col items-center bg-black/70 backdrop-blur-xl border-t border-white/[0.06]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', paddingTop: '14px' }}>

            <div className="h-7 flex items-center justify-center mb-2">
              {(isRecording || isSpeaking) ? (
                <div className="flex gap-1 items-center">
                  {[12, 20, 28, 20, 32, 20, 28, 20, 12].map((h, i) => (
                    <div key={i} className={`w-1.5 rounded-full ${isRecording ? 'bg-red-400' : 'bg-indigo-400'}`}
                      style={{ height: `${h}px`, animation: 'wave 0.9s ease-in-out infinite alternate', animationDelay: `${i * 0.09}s` }} />
                  ))}
                </div>
              ) : <div className="h-7" />}
            </div>

            <p className="text-xs text-white/30 mb-3.5 font-medium tracking-wide text-center px-4">
              {isRecording ? 'Listening… speak now' : isLoading ? 'Coach is thinking…' : isSpeaking ? 'Speaking — tap to stop' : pendingTranscript ? 'Tap ✓ to send or ✕ to cancel' : coachIsIdle ? 'Tap mic and ask your coach' : 'Tap mic for next question'}
            </p>

            <button
              onClick={isRecording ? stopCoachRecording : isSpeaking ? () => { window.speechSynthesis?.cancel(); setIsSpeaking(false); } : pendingTranscript ? confirmPending : isLoading ? undefined : startCoachRecording}
              disabled={isLoading}
              className={`w-[76px] h-[76px] rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 active:scale-95 mb-3
                ${isRecording ? 'bg-red-500 shadow-red-500/50 scale-110'
                  : isSpeaking ? 'bg-indigo-500 shadow-indigo-500/40'
                  : pendingTranscript ? 'bg-green-500 shadow-green-500/40'
                  : isLoading ? 'bg-white/10'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-purple-500/40'}`}>
              {isSpeaking ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
              ) : pendingTranscript ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : isLoading ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
              ) : (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>

            <button onClick={() => { setShowTextInput(v => !v); if (!showTextInput) setTimeout(() => textInputRef.current?.focus(), 100); }}
              className="text-xs text-white/25 active:text-white/60 px-4 py-1 mb-1">
              {showTextInput ? 'Hide keyboard' : 'Type instead'}
            </button>

            {showTextInput && (
              <form onSubmit={e => { e.preventDefault(); if (textInput.trim()) { sendCoachMessage(textInput.trim()); setTextInput(''); } }}
                className="flex gap-2 px-4 mt-1.5 w-full">
                <input ref={textInputRef} type="text" value={textInput} onChange={e => setTextInput(e.target.value)}
                  placeholder="Type your question…" disabled={isLoading} style={{ fontSize: '16px' }}
                  className="flex-1 glass rounded-xl px-4 py-2.5 text-white placeholder-white/25 outline-none text-sm" />
                <button type="submit" disabled={isLoading || !textInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-500 text-sm font-semibold text-white active:opacity-80 disabled:opacity-40">Send</button>
              </form>
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal apiKey={apiKey} systemPrompt={systemPrompt} autoSpeak={autoSpeak}
          onClose={() => setShowSettings(false)}
          onSave={(k, p, s) => {
            setApiKey(k); setSystemPrompt(p); setAutoSpeak(s);
            localStorage.setItem('parakeet_api_key', k);
            localStorage.setItem('parakeet_system_prompt', p);
            localStorage.setItem('parakeet_auto_speak', s.toString());
            setShowSettings(false);
            if (error && k) setError('');
          }} />
      )}
    </div>
  );
}
