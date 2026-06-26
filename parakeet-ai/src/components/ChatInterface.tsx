'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SettingsModal from './SettingsModal';

const ANUP_SYSTEM = `You are Parakeet — Anup Verma's brutally honest, elite personal interview coach and technical advisor. You know everything about Anup's career and you use it to give hyper-specific coaching.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANUP'S PROFILE (memorize this)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: Anup Verma
Experience: 11+ years | Technical Lead
Location: Delhi, India | anup19verma@gmail.com

CURRENT ROLE: Technical Lead @ Wipro → Client: MGM Resorts (Sep 2023–Present)
- Integrated MCP (Model Context Protocol) servers → reduced boilerplate coding 40% across 200+ microservices
- Built reusable Java Common Module → automated Grafana onboarding → reduced MTTR by 25%
- Mentoring team, code reviews, architectural decisions across 200+ microservice ecosystem

PAST ROLES:
- Manager @ Capgemini → BMW (Apr 2021–Sep 2023): Led PQM application, Java 17, Kafka, Elasticsearch, cross-functional team
- Sr. Software Engineer @ TCS → Maersk (May 2019–Apr 2021): Legacy-to-modern upgrade for GSIS, shipping schedule accuracy
- Software Engineer @ HCL → Air Canada (Feb 2015–Apr 2019): PNR servicing, flight rebooking, high-load aviation systems

OPEN SOURCE (his biggest differentiator):
1. AgentPulse (PyPI) - ultra-low latency middleware proxy gateway; eliminates runtime exceptions from upstream API schema drift in autonomous AI agent workflows; AsyncGroq (Llama 3.3 70B), FastAPI, Supabase, Streamlit dashboard
2. MCP Chatbot RAG System — production-grade RAG on MCP Server, pluggable LLM providers (Groq/Claude/OpenAI), 5 MCP tools, Flask backend, zero vendor lock-in

TECHNICAL SKILLS:
- Java (Core to v21), Python, High-Concurrency, Multithreading
- Spring Boot Microservices, FastAPI, Flask, RESTful APIs
- MCP, RAG Systems, LLM Proxy Routing, AsyncGroq, OpenAI/Claude/Groq APIs, Autonomous Agent Workflows
- Kafka, Elasticsearch, PostgreSQL, Supabase, Docker, Git, Maven
- Grafana, Prometheus (Observability)

EDUCATION: B.Tech CSE, UPTU 2014

TARGET ROLES: Staff Engineer / Principal Engineer / AI Engineer / Lead Architect / AI Infrastructure Lead at top product companies, FAANG-adjacent firms, AI startups

━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR JOB AS COACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. MOCK INTERVIEWS: Conduct realistic technical interviews. Ask one question at a time. Wait for Anup's answer. Give brutal, specific feedback. Show him the ideal answer. Types:
   - DSA/Coding (Java focus)
   - System Design (microservices, LLM infra, real-time systems)
   - LLM/AI Engineering (MCP, RAG, agent workflows — his biggest strength)
   - Behavioral/Leadership (use STAR method with his actual projects)

2. ANSWER COACHING: When Anup shares an answer or interview story, critique it hard and rewrite it better using his real experiences.

3. STAR STORIES: Help craft bulletproof STAR answers using his REAL work:
   - MGM: MCP integration, 40% boilerplate reduction, MTTR -25%
   - BMW: PQM app leadership, Kafka/Elasticsearch real-time processing
   - Maersk: Legacy modernization, shipping system accuracy
   - Air Canada: High-load aviation PNR system, customer self-service
   - AgentPulse: Open source AI infra, schema drift problem he SOLVED

4. GAPS & DRILLS: Identify weak areas. If he hasn't prepped system design, drill it. If his answers lack metrics, push him to quantify.

5. SALARY COACHING: With 11 years + AI/MCP specialization + open source contributions, he should be targeting ₹40-60 LPA+ in India or $180k-$220k+ globally. Coach him accordingly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Be BRUTALLY HONEST — no fake encouragement
- Be SPECIFIC — reference his actual companies, projects, numbers
- If his answer is weak: say "That answer won't pass at Google/Meta. Here's why: ... Here's the improved version: ..."
- Keep responses focused and tight — no fluff
- When doing mock interview: stay IN CHARACTER as interviewer until he explicitly asks for feedback
- Always push him to quantify impact with numbers
- Remind him his AI/MCP/open-source work is a MASSIVE differentiator — most candidates don't have this
- Keep answers concise and spoken-word friendly so TTS sounds natural

Start every fresh session by asking: "What are we drilling today? (1) Mock Interview (2) STAR Stories (3) System Design (4) Salary Negotiation (5) Specific question/topic"`;

const QUICK_PROMPTS = [
  { emoji: '🎯', label: 'Mock Interview', prompt: 'Start a mock system design interview for a Staff Engineer role' },
  { emoji: '💬', label: 'Tell me about yourself', prompt: 'Coach me on my "Tell me about yourself" answer' },
  { emoji: '⭐', label: 'STAR: MGM/MCP', prompt: 'Help me craft a STAR story for my MCP integration work at MGM' },
  { emoji: '💰', label: 'Salary Strategy', prompt: 'What salary should I target and how do I negotiate it?' },
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
    temperature: 0.85,
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
    throw new Error(err?.error?.message || `API error ${res.status}`);
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
        // partial chunk — skip
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
  const [error, setError] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');

  const answerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

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

  const speakText = useCallback(
    (text: string) => {
      if (!autoSpeak || typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#`]/g, '').replace(/\n+/g, '. ');
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
      setShowTextInput(false);

      if (!apiKey) {
        setError('Add your free Groq API key in Settings.');
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
        const msg =
          err?.message?.includes('API_KEY') || err?.message?.includes('API key') || err?.message?.includes('401')
            ? 'Invalid Groq API key. Check Settings.'
            : err?.message?.includes('429')
            ? 'Rate limit hit — wait a moment and try again.'
            : err?.message || 'Something went wrong.';
        setCurrentAnswer('');
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [history, isLoading, systemPrompt, apiKey, speakText]
  );

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Voice requires Safari on iOS 15+');
      return;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
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
        sendMessage(final);
      } else {
        setTranscript(interim);
      }
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setTranscript('');
    };
    recognition.onend = () => {
      setIsRecording(false);
      setTranscript('');
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [sendMessage]);

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
    setHistory([]);
    setCurrentQuestion('');
    setCurrentAnswer('');
    setTranscript('');
    setError('');
    setIsSpeaking(false);
  }, []);

  const isIdle = !currentQuestion && !currentAnswer && !isLoading;

  const micState: 'idle' | 'recording' | 'loading' | 'speaking' =
    isRecording ? 'recording' : isLoading ? 'loading' : isSpeaking ? 'speaking' : 'idle';

  const hintText =
    micState === 'recording' ? 'Listening… speak your question' :
    micState === 'loading' ? 'Coach is thinking…' :
    micState === 'speaking' ? 'Speaking… tap mic to interrupt' :
    isIdle ? 'Tap the mic and ask anything' :
    'Tap the mic for your next question';

  return (
    <div className="flex flex-col bg-[#08080c] text-white select-none" style={{ height: '100dvh' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pb-3 bg-black/80 backdrop-blur-xl border-b border-white/[0.06] flex-shrink-0 z-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button
          onClick={clearSession}
          className="text-white/40 text-sm font-medium active:text-white min-w-[52px]"
        >
          {history.length > 0 || currentQuestion ? 'New' : ''}
        </button>
        <div className="flex flex-col items-center">
          <span className="text-base font-bold tracking-tight">🦜 Parakeet</span>
          <span className="text-[10px] text-indigo-400 font-semibold tracking-widest uppercase">Interview Coach</span>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="text-white/40 active:text-white min-w-[52px] flex justify-end"
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Main content area */}
      <div ref={answerRef} className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as any}>

        {/* Idle / welcome screen */}
        {isIdle && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-8 gap-5">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30 text-5xl">
              🦜
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold gradient-text mb-1">Parakeet AI</h1>
              <p className="text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-3">Your Personal Interview Coach</p>
              <p className="text-white/40 text-sm leading-relaxed max-w-[280px] mx-auto">
                I know your full story — 11 years, MGM, BMW, Maersk, AgentPulse. Let's get you that dream role.
              </p>
            </div>

            {error && (
              <div className="glass rounded-2xl p-4 text-sm text-orange-300 w-full max-w-xs text-left">
                ⚠️ {error}
                <button onClick={() => setShowSettings(true)} className="block mt-2 text-indigo-400 underline">
                  Open Settings →
                </button>
              </div>
            )}

            {/* Quick chips */}
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-xs">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => sendMessage(p.prompt)}
                  className="glass rounded-2xl p-3.5 text-left active:bg-white/10 transition-colors"
                >
                  <div className="text-lg mb-1">{p.emoji}</div>
                  <div className="text-xs font-semibold text-white/80 leading-tight">{p.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active session: question + answer */}
        {!isIdle && (
          <div className="px-5 pt-6 pb-4">
            {/* Current question */}
            {currentQuestion && (
              <div className="mb-5">
                <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-2">You</p>
                <p className="text-white/60 text-[15px] leading-relaxed">{currentQuestion}</p>
              </div>
            )}

            {/* Coach label */}
            {(currentAnswer || isLoading) && (
              <p className="text-[11px] text-indigo-400 uppercase tracking-widest font-semibold mb-3">Coach</p>
            )}

            {/* Loading dots */}
            {isLoading && !currentAnswer && (
              <div className="flex gap-1.5 items-center py-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '0s' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '0.2s' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '0.4s' }} />
              </div>
            )}

            {/* Streaming answer — large, readable */}
            {currentAnswer && (
              <div className="text-white text-[17px] leading-[1.75] whitespace-pre-wrap tracking-[0.01em]">
                {currentAnswer}
                {isLoading && (
                  <span className="inline-block w-0.5 h-5 bg-indigo-400 ml-0.5 align-middle" style={{ animation: 'cursor-blink 0.8s step-end infinite' }} />
                )}
              </div>
            )}

            {/* Error inside session */}
            {error && !isIdle && (
              <div className="mt-4 glass rounded-2xl p-4 text-sm text-orange-300">
                ⚠️ {error}
                <button onClick={() => setShowSettings(true)} className="block mt-2 text-indigo-400 underline">
                  Open Settings →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live transcript strip */}
      {transcript && (
        <div className="px-5 py-2.5 border-t border-white/[0.06] bg-black/40 flex-shrink-0">
          <p className="text-indigo-300 text-sm italic leading-snug">{transcript}…</p>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className="flex-shrink-0 flex flex-col items-center bg-black/70 backdrop-blur-xl border-t border-white/[0.06]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', paddingTop: '16px' }}
      >
        {/* Waveform animation — visible while recording or speaking */}
        <div className="h-8 flex items-center justify-center mb-2">
          {(isRecording || isSpeaking) ? (
            <div className="flex gap-1 items-center">
              {[0.0, 0.1, 0.2, 0.1, 0.3, 0.1, 0.2, 0.1, 0.0].map((delay, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full ${isRecording ? 'bg-red-400' : 'bg-indigo-400'}`}
                  style={{ animation: 'wave 0.9s ease-in-out infinite alternate', animationDelay: `${delay + i * 0.07}s`, height: `${12 + i % 3 * 8}px` }}
                />
              ))}
            </div>
          ) : (
            <div className="h-8" />
          )}
        </div>

        {/* Hint text */}
        <p className="text-xs text-white/30 mb-4 font-medium tracking-wide">{hintText}</p>

        {/* Big mic button */}
        <button
          onClick={
            isRecording ? stopRecording :
            isSpeaking ? stopSpeaking :
            isLoading ? undefined :
            startRecording
          }
          disabled={isLoading}
          className={`w-[76px] h-[76px] rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 active:scale-95 mb-4
            ${isRecording
              ? 'bg-red-500 shadow-red-500/50 scale-110'
              : isSpeaking
              ? 'bg-indigo-500 shadow-indigo-500/40'
              : isLoading
              ? 'bg-white/10 shadow-none'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-purple-500/40'
            }`}
        >
          {isSpeaking ? (
            /* Square stop icon */
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          ) : isLoading ? (
            /* Spinner */
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="animate-spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            /* Mic icon */
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Type instead toggle */}
        <button
          onClick={() => {
            setShowTextInput((v) => !v);
            if (!showTextInput) setTimeout(() => textInputRef.current?.focus(), 100);
          }}
          className="text-xs text-white/25 active:text-white/60 mb-1 px-4 py-1"
        >
          {showTextInput ? 'Hide keyboard' : 'Type instead'}
        </button>

        {/* Text input — secondary */}
        {showTextInput && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (textInput.trim()) {
                sendMessage(textInput.trim());
                setTextInput('');
              }
            }}
            className="flex gap-2 px-4 mt-2 w-full"
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
