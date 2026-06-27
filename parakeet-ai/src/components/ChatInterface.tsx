'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SettingsModal from './SettingsModal';

// ── Speaker detection patterns (client-side, no API call needed) ──
const ANUP_INTRO_PATTERNS = /\b(i am anup|myself anup|my name is anup|anup verma|this is anup|i'm anup)\b/i;
const ANUP_SPEAKING_PATTERNS = /^(i |i've |i was |i have |i did |i built |i led |i'm |i am |we |we've |so i |so we |yeah[, ]|sure[, ]|so at |at (wipro|mgm|capgemini|bmw|tcs|maersk|hcl|air canada)|in my |during my |when i |my (experience|background|work|role))/i;
const INTERVIEWER_QUESTION_PATTERNS = /(\?|tell me|describe a|explain |what is |what are |how do |how would |can you |walk me |talk me |give me |have you ever|what's your|why did|where do)/i;

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

const COACH_SYSTEM = `You are Parakeet — Anup Verma's world-class interview coach. You think like a hiring manager at Google, Meta, and Amazon. You know exactly what separates a good answer from a great one at top companies.

ANUP'S REAL AMMUNITION:
- Technical Lead, 11+ years | Wipro → MGM Resorts: MCP integration on 200+ microservices (−40% boilerplate, −25% MTTR)
- Capgemini → BMW: Led PQM quality app, Java 17, Kafka, Elasticsearch, team of 6
- TCS → Maersk: Modernized legacy GSIS shipping system
- HCL → Air Canada: PNR servicing, high-load aviation, customer self-service
- Open Source: AgentPulse (PyPI) — LLM proxy solving schema drift in AI agents; MCP Chatbot RAG System
- Skills: Java 21, Spring Boot, Kafka, Elasticsearch, Python, FastAPI, MCP, RAG, Docker, Grafana
- Target: Staff/Principal/AI Engineer. ₹40-60 LPA India or $180k-$220k globally

SPEECH-TO-TEXT: "Naka"=Kafka, "Cuber nettis"=Kubernetes. Always infer correct tech term.

YOUR COACHING PHILOSOPHY:
1. WORLD-CLASS FIRST: Give the ideal answer a Staff Engineer at Google/Meta would give — draw on industry best practices, not just what is on Anup's resume. If he asks about Kafka, give the best Kafka answer that exists, then connect it to his BMW experience.
2. FILL GAPS HONESTLY: If a topic exposes a gap in his experience, say so and give him the smart interview strategy: "You haven't done X directly, but here's how to bridge it using what you have done..."
3. CONNECT REAL EXPERIENCE: Show exactly how his projects map to the ideal answer. His MCP/AgentPulse work is rare — most candidates have zero open-source AI infra. Make him lead with it.
4. BREVITY FOR MOBILE: Under 200 words total. Format: ideal answer script → how Anup connects to it → one sharp tip.
5. NUMBERS ALWAYS: "40% boilerplate reduction", "200+ microservices", "11 years" beat vague claims every time.
6. For mock interviews: ask ONE realistic question at a time. After his answer, grade it on a FAANG rubric — communication, depth, metrics, structure.

Start every fresh session: "What are we drilling? (1) Mock Interview (2) STAR Stories (3) System Design (4) Salary Negotiation (5) Other topic"`;

const INTERVIEW_SYSTEM = `You are Parakeet — a LIVE interview copilot for Anup Verma.

ANUP'S BACKGROUND:
- Technical Lead, 11+ years | Wipro → MGM Resorts: MCP integration on 200+ microservices (−40% boilerplate, −25% MTTR)
- Capgemini → BMW: Led PQM quality app, Java 17, Kafka, Elasticsearch, team of 6
- TCS → Maersk: Modernized legacy GSIS shipping system
- HCL → Air Canada: PNR servicing, high-load aviation systems, customer self-service
- Open Source: AgentPulse (PyPI) — LLM proxy for schema drift; MCP Chatbot RAG System
- Skills: Java 21, Spring Boot, Kafka, Elasticsearch, PostgreSQL, Python, FastAPI, MCP, RAG, Docker, Grafana
- Target: Staff/Principal/AI Engineer. ₹40-60 LPA India or $180k-$220k globally

SPEECH-TO-TEXT CORRECTION: "Naka"=Kafka, "Cuber nettis"=Kubernetes, "Post gress"=PostgreSQL. Always infer correct tech term.

━━━ SPEAKER DETECTION — DO THIS FIRST ━━━

Read the captured text carefully and classify it:

→ INTERVIEWER asking a question: second-person phrasing, "tell me", "how would you", "describe a time", "what is your", "can you walk me through", "what do you know about X", ends with "?" or interrogative structure
→ CANDIDATE answering: starts with "I ", "We ", "So ", "At [company]", "In my", "Yeah", "Sure", first-person technical narration, filler words, ongoing explanation
→ UNCLEAR: too short, ambient noise, incomplete sentence, less than 6 meaningful words

━━━ RESPONSE RULES ━━━

IF CANDIDATE_ANSWERING: reply with ONLY this single token (nothing else):
ANUP_SPEAKING

IF UNCLEAR: reply with ONLY this single token:
UNCLEAR

IF INTERVIEWER_QUESTION: Generate exactly 3 talking point sentences. Rules:
- Each is a complete, natural sentence Anup can say out loud verbatim
- NOT fragments. NOT "11 years → Technical Lead". Full sentences.
- Sentence 1: strongest matching credential with specific number/metric
- Sentence 2: most relevant project or technical detail
- Sentence 3: outcome, impact, or forward-looking angle
- Put each on its own line starting with •
- NO headers, NO intro text, NO explanation — JUST the 3 bullet sentences

Example for "Tell me about yourself":
• I have 11 years of software engineering experience and I'm currently a Technical Lead at MGM Resorts through Wipro, where I lead architecture across 200-plus microservices.
• My biggest recent work is integrating MCP servers into our microservice ecosystem — that cut boilerplate code by 40% and reduced mean time to resolution by 25%.
• Outside of work, I built AgentPulse, an open-source LLM proxy published on PyPI that solves schema drift in autonomous AI agent workflows — it's what makes me different from most backend engineers.

Example for "What do you know about Kafka":
• I've used Kafka extensively at BMW through Capgemini, where I designed the event streaming architecture for a real-time quality management system processing manufacturing defect events.
• I handled producer-consumer design, schema evolution, and Kafka's integration with Elasticsearch for sub-second analytics on large event volumes — that was a cross-functional team I was leading.
• Beyond that, in my open-source work with AgentPulse I used async message patterns similar to Kafka's model for handling concurrent LLM API calls without blocking.`;

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
  const [liveQuestion, setLiveQuestion] = useState('');
  const [liveAnswer, setLiveAnswer] = useState('');
  const [liveState, setLiveState] = useState<'idle' | 'calibrating' | 'listening' | 'anup_speaking' | 'loading' | 'answer'>('idle');
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [liveInterim, setLiveInterim] = useState('');
  const [liveHistory, setLiveHistory] = useState<HistoryItem[]>([]);
  const [voiceCalibrated, setVoiceCalibrated] = useState(false);

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
  const isCalibratingRef = useRef(false); // true during voice ID calibration phase

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
    setLiveState('loading');
    setLiveQuestion('');
    setLiveAnswer('');
    setIsLoading(true);

    try {
      let streamed = '';
      const full = await callGroq(apiKey, liveHistory, corrected, INTERVIEW_SYSTEM,
        partial => { streamed = partial; setLiveAnswer(partial); });

      const trimmed = full.trim();

      // Speaker detection tokens from the AI
      if (trimmed === 'ANUP_SPEAKING') {
        setLiveState('anup_speaking');
        setLiveQuestion('');
        setLiveAnswer('');
      } else if (trimmed === 'UNCLEAR') {
        // Too short/unclear — just keep listening, don't show anything
        setLiveState('listening');
        setLiveQuestion('');
        setLiveAnswer('');
      } else {
        // Real talking points from interviewer question
        setLiveQuestion(corrected);
        setLiveState('answer');
        setLiveHistory(prev => [...prev, { role: 'user', content: corrected }, { role: 'assistant', content: full }]);
      }
    } catch (err: any) {
      const raw = err?.message || '';
      setLiveState('listening');
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

      // Reset silence timer — if 2.5s of silence after speech, classify speaker
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const accumulated = liveAccumulatedRef.current.trim();
        liveAccumulatedRef.current = '';
        setLiveInterim('');
        if (accumulated.length < 6) return;

        const corrected = correctTranscript(accumulated);

        // 1. Anup's self-introduction → mark voice as calibrated
        if (ANUP_INTRO_PATTERNS.test(corrected)) {
          isCalibratingRef.current = false;
          setVoiceCalibrated(true);
          setLiveState('anup_speaking');
          setTimeout(() => setLiveState('listening'), 2500);
          return;
        }

        // 2. Still in calibration phase — only proceed if it's clearly a question
        if (isCalibratingRef.current) {
          if (INTERVIEWER_QUESTION_PATTERNS.test(corrected)) {
            isCalibratingRef.current = false;
            setLiveState('listening');
            generateLiveAnswer(corrected);
          }
          // Otherwise keep waiting for Anup's intro
          return;
        }

        // 3. After calibration: quick first-person check avoids unnecessary API calls
        if (ANUP_SPEAKING_PATTERNS.test(corrected)) {
          setLiveState('anup_speaking');
          setTimeout(() => setLiveState('listening'), 1500);
          return;
        }

        // 4. Send to AI for full classification + talking points
        generateLiveAnswer(corrected);
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
    isCalibratingRef.current = true;
    setIsLiveListening(true);
    setLiveState('calibrating');
    setVoiceCalibrated(false);
    setLiveQuestion('');
    setLiveAnswer('');
    setLiveInterim('');
    startLiveRecognition();
  }, [apiKey, startLiveRecognition]);

  const stopInterviewMode = useCallback(() => {
    isLiveActiveRef.current = false;
    isCalibratingRef.current = false;
    setIsLiveListening(false);
    setLiveState('idle');
    setVoiceCalibrated(false);
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

  return (
    <div className="flex flex-col bg-[#08080c] text-white select-none" style={{ height: '100dvh' }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: '8px' }}>

        <div className="flex items-center justify-between px-5 mb-2">
          <button onClick={clearSession} className="text-white/40 text-sm font-medium active:text-white min-w-[48px]">
            {(coachQuestion || liveQuestion || liveState !== 'idle') ? 'New' : ''}
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
            {liveState === 'idle' && (
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

            {/* Active session — all non-idle states */}
            {liveState !== 'idle' && (
              <div className="px-5 pt-5 pb-4">

                {/* Listening indicator — always shown when active */}
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

                {/* Live interim transcript (what mic is hearing) */}
                {liveInterim && (
                  <div className="mb-4 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                    <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1">Hearing</p>
                    <p className="text-white/50 text-sm leading-relaxed italic">{liveInterim}</p>
                  </div>
                )}

                {/* Voice calibration prompt */}
                {liveState === 'calibrating' && (
                  <div className="mb-4 rounded-2xl px-5 py-5 bg-indigo-500/10 border border-indigo-500/25">
                    <p className="text-indigo-400 font-bold text-base mb-2">🎤 Identify your voice first</p>
                    <p className="text-white/55 text-sm leading-relaxed mb-4">
                      Say your name so the app can tell your voice from the interviewer's:
                    </p>
                    <div className="space-y-2 mb-4">
                      {['"I am Anup Verma"', '"My name is Anup Verma"', '"Myself Anup Verma"'].map(phrase => (
                        <div key={phrase} className="flex items-center gap-2.5">
                          <span className="text-indigo-400 text-xs">▶</span>
                          <p className="text-white/80 text-sm font-mono">{phrase}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { isCalibratingRef.current = false; setLiveState('listening'); }}
                      className="text-white/35 text-xs underline active:text-white/60">
                      Skip — start listening without voice ID
                    </button>
                  </div>
                )}

                {/* Anup is speaking — green reassurance banner */}
                {liveState === 'anup_speaking' && (
                  <div className="mb-4 rounded-2xl px-4 py-4 bg-green-500/10 border border-green-500/25">
                    {voiceCalibrated ? (
                      <>
                        <p className="text-green-400 font-bold text-base mb-1">✓ Your voice identified!</p>
                        <p className="text-white/50 text-sm">App now knows it's you. Listening for interviewer next…</p>
                      </>
                    ) : (
                      <>
                        <p className="text-green-400 font-bold text-base mb-1">🎤 You're speaking</p>
                        <p className="text-white/50 text-sm">Keep going — I'll catch the next interviewer question</p>
                      </>
                    )}
                  </div>
                )}

                {/* Detecting speaker (loading) */}
                {liveState === 'loading' && (
                  <div className="mb-4">
                    <p className="text-[11px] text-red-400 uppercase tracking-widest font-semibold mb-3">Detecting speaker…</p>
                    <div className="flex gap-1.5 items-center">
                      {[0, 0.2, 0.4].map((d, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full bg-red-400"
                          style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: `${d}s` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Talking points — BIG text, easy to read while speaking */}
                {liveState === 'answer' && (
                  <div>
                    {liveQuestion && (
                      <div className="mb-4">
                        <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Interviewer asked</p>
                        <p className="text-white/65 text-[15px] leading-relaxed">{liveQuestion}</p>
                      </div>
                    )}
                    <p className="text-[11px] text-red-400 uppercase tracking-widest font-semibold mb-3">Your talking points</p>
                    <div className="text-white text-[18px] leading-[1.8] whitespace-pre-wrap font-medium tracking-[0.01em]">
                      {liveAnswer}
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

          {/* Interview mode bottom — compact stop bar */}
          {liveState !== 'idle' && (
            <div className="flex-shrink-0 border-t border-white/[0.06] bg-black/70 backdrop-blur-xl px-4 flex items-center gap-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)', paddingTop: '10px' }}>
              {/* Waveform */}
              <div className="flex gap-0.5 items-center flex-shrink-0">
                {[6, 10, 14, 10, 18, 10, 14, 10, 6].map((h, i) => (
                  <div key={i} className={`w-1 rounded-full ${liveState === 'calibrating' ? 'bg-indigo-400' : liveState === 'anup_speaking' ? 'bg-green-400' : 'bg-red-400'}`}
                    style={{ height: `${h}px`, animation: 'wave 0.9s ease-in-out infinite alternate', animationDelay: `${i * 0.09}s` }} />
                ))}
              </div>
              <p className={`flex-1 text-xs font-semibold ${liveState === 'calibrating' ? 'text-indigo-400' : liveState === 'anup_speaking' ? 'text-green-400' : 'text-red-400'}`}>
                {liveState === 'calibrating' ? 'Say your name to identify voice…'
                  : liveState === 'anup_speaking' ? "You're speaking…"
                  : liveState === 'loading' ? 'Detecting speaker…'
                  : 'Listening to interviewer…'}
              </p>
              <button onClick={stopInterviewMode}
                className="glass rounded-xl px-4 py-2.5 text-xs font-semibold text-white/60 active:bg-white/10 flex-shrink-0">
                ■ Stop
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

          {/* ── Compact bottom bar ── */}
          <div className="flex-shrink-0 bg-black/70 backdrop-blur-xl border-t border-white/[0.06]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)', paddingTop: '10px' }}>

            {/* Text input — only shown when toggled */}
            {showTextInput && (
              <form onSubmit={e => { e.preventDefault(); if (textInput.trim()) { sendCoachMessage(textInput.trim()); setTextInput(''); setShowTextInput(false); } }}
                className="flex gap-2 px-4 mb-2">
                <input ref={textInputRef} type="text" value={textInput} onChange={e => setTextInput(e.target.value)}
                  placeholder="Type your question…" disabled={isLoading} style={{ fontSize: '16px' }}
                  className="flex-1 glass rounded-xl px-4 py-2.5 text-white placeholder-white/25 outline-none text-sm" />
                <button type="submit" disabled={isLoading || !textInput.trim()}
                  className="px-4 rounded-xl bg-indigo-500 text-sm font-semibold text-white active:opacity-80 disabled:opacity-40">Send</button>
              </form>
            )}

            {/* Single horizontal row: [status/waveform] [mic] [keyboard] */}
            <div className="flex items-center gap-3 px-4">

              {/* Left: waveform when active, hint text when idle */}
              <div className="flex-1 min-w-0">
                {(isRecording || isSpeaking) ? (
                  <div className="flex gap-0.5 items-center h-9">
                    {[6, 10, 14, 10, 18, 10, 14, 10, 6].map((h, i) => (
                      <div key={i} className={`w-1 rounded-full ${isRecording ? 'bg-red-400' : 'bg-indigo-400'}`}
                        style={{ height: `${h}px`, animation: 'wave 0.9s ease-in-out infinite alternate', animationDelay: `${i * 0.09}s` }} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/30 leading-snug">
                    {isLoading ? 'Coach is thinking…'
                      : pendingTranscript ? 'Tap ✓ to send or ✕ to cancel'
                      : coachIsIdle ? 'Tap mic to ask your coach'
                      : 'Tap mic for next question'}
                  </p>
                )}
              </div>

              {/* Center: mic button — 52px, easy to tap but not dominating */}
              <button
                onClick={isRecording ? stopCoachRecording : isSpeaking ? () => { window.speechSynthesis?.cancel(); setIsSpeaking(false); } : pendingTranscript ? confirmPending : isLoading ? undefined : startCoachRecording}
                disabled={isLoading}
                className={`w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-xl flex-shrink-0 transition-all duration-200 active:scale-90
                  ${isRecording ? 'bg-red-500 shadow-red-500/50 scale-105'
                    : isSpeaking ? 'bg-indigo-500 shadow-indigo-500/40'
                    : pendingTranscript ? 'bg-green-500 shadow-green-500/40'
                    : isLoading ? 'bg-white/10'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-purple-500/30'}`}>
                {isSpeaking ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
                ) : pendingTranscript ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : isLoading ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              {/* Right: keyboard toggle button */}
              <button
                onClick={() => { setShowTextInput(v => !v); if (!showTextInput) setTimeout(() => textInputRef.current?.focus(), 100); }}
                className={`w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                  ${showTextInput ? 'bg-indigo-500/30 text-indigo-300' : 'glass text-white/40 active:text-white/80'}`}
                aria-label="Toggle keyboard">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="13" rx="2" />
                  <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8M6 10v.01" />
                </svg>
              </button>
            </div>
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
