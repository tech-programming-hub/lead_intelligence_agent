'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble, { Message } from './MessageBubble';
import VoiceButton from './VoiceButton';
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

Start every fresh session by asking: "What are we drilling today? (1) Mock Interview (2) STAR Stories (3) System Design (4) Salary Negotiation (5) Specific question/topic"`;

const QUICK_PROMPTS = [
  '🎯 Mock interview: System Design',
  '💬 "Tell me about yourself"',
  '⭐ STAR story for MGM/MCP work',
  '💰 Salary negotiation strategy',
];

async function callGemini(
  apiKey: string,
  messages: Message[],
  currentMessage: string,
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const contents = [
    ...messages
      .filter((m) => m.content && !m.content.startsWith('⚠️'))
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    { role: 'user', parts: [{ text: currentMessage }] },
  ];

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.9 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey.trim()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

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
        const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text) {
          fullText += text;
          onChunk(fullText);
        }
      } catch {
        // partial JSON — skip
      }
    }
  }

  return fullText;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('parakeet_api_key') || '';
    const savedPrompt = localStorage.getItem('parakeet_system_prompt') || '';
    const savedSpeak = localStorage.getItem('parakeet_auto_speak') === 'true';
    setApiKey(savedKey);
    setSystemPrompt(savedPrompt);
    setAutoSpeak(savedSpeak);
    if (!savedKey) setTimeout(() => setShowSettings(true), 600);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speakText = useCallback(
    (text: string) => {
      if (!autoSpeak || typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
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

      if (!apiKey) {
        setError('Add your free Google AI API key in Settings.');
        setShowSettings(true);
        return;
      }

      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed, timestamp: new Date() };
      const assistantId = `a-${Date.now()}`;
      const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: new Date() };

      const prevMessages = messages;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setTranscript('');
      setIsLoading(true);

      try {
        const fullText = await callGemini(
          apiKey,
          prevMessages,
          trimmed,
          systemPrompt?.trim() || ANUP_SYSTEM,
          (partial) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: partial } : m)));
          }
        );
        if (fullText) speakText(fullText);
      } catch (err: any) {
        const msg = err?.message?.includes('API_KEY') || err?.message?.includes('API key')
          ? 'Invalid API key. Please check Settings.'
          : err?.message || 'Something went wrong.';
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `⚠️ ${msg}` } : m)));
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, systemPrompt, apiKey, speakText]
  );

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice requires Safari on iOS 15+'); return; }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t; else interim += t;
      }
      if (final) { setIsRecording(false); recognition.stop(); sendMessage(final); }
      else setTranscript(interim);
    };
    recognition.onerror = () => { setIsRecording(false); setTranscript(''); };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [sendMessage]);

  const stopRecording = useCallback(() => { recognitionRef.current?.stop(); setIsRecording(false); setTranscript(''); }, []);
  const stopSpeaking = useCallback(() => { window.speechSynthesis?.cancel(); setIsSpeaking(false); }, []);
  const clearChat = useCallback(() => {
    if (!messages.length) return;
    setMessages([]);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, [messages.length]);

  return (
    <div className="flex flex-col bg-[#08080c] text-white" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-3 bg-black/70 backdrop-blur-xl border-b border-white/[0.06] z-10 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <button onClick={clearChat} className="text-white/40 text-sm font-medium active:text-white/80 min-w-[44px] text-left">
          {messages.length > 0 ? 'Clear' : ''}
        </button>
        <div className="flex flex-col items-center">
          <span className="text-base font-bold tracking-tight">🦜 Parakeet</span>
          <span className="text-[10px] text-indigo-400 font-medium tracking-wider">INTERVIEW COACH</span>
        </div>
        <button onClick={() => setShowSettings(true)} className="text-white/40 active:text-white/80 min-w-[44px] flex justify-end" aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ WebkitOverflowScrolling: 'touch' } as any}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full gap-5 text-center py-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30 text-4xl">
              🦜
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text mb-1">Parakeet AI</h1>
              <p className="text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-2">Your Personal Interview Coach</p>
              <p className="text-white/40 text-sm max-w-[270px] mx-auto leading-relaxed">
                I know your full resume — 11 years, MGM, BMW, Maersk, Air Canada, AgentPulse. Let's get you that dream job.
              </p>
            </div>
            {error && (
              <div className="glass rounded-2xl p-4 text-sm text-orange-300 max-w-xs text-left">
                ⚠️ {error}
                <button onClick={() => setShowSettings(true)} className="block mt-2 text-indigo-400 underline">Open Settings →</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {QUICK_PROMPTS.map((p) => (
                <button key={p} onClick={() => sendMessage(p)}
                  className="glass rounded-2xl p-3 text-xs text-white/70 active:bg-white/10 transition-colors text-left leading-relaxed font-medium">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
        <div ref={messagesEndRef} />
      </div>

      {transcript && (
        <div className="px-5 py-2 text-white/50 text-sm italic border-t border-white/[0.06] bg-black/50 flex-shrink-0">{transcript}</div>
      )}

      {isSpeaking && (
        <div className="px-4 pb-1 flex-shrink-0">
          <button onClick={stopSpeaking} className="w-full glass rounded-2xl py-2.5 px-4 flex items-center gap-3 text-sm text-white/60 active:bg-white/10">
            <div className="flex gap-0.5 items-center">
              {[1,2,3,4,5].map((i) => <div key={i} className="wave-bar w-1 bg-indigo-400 rounded-full" style={{ animationDelay: `${(i-1)*0.12}s` }} />)}
            </div>
            <span>Speaking… tap to stop</span>
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex-shrink-0 px-4 pt-3 bg-black/70 backdrop-blur-xl border-t border-white/[0.06]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-3">
          <div className="flex-1 glass rounded-2xl flex items-center px-4 py-3 min-h-[48px]">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your coach anything…" disabled={isLoading || isRecording}
              style={{ fontSize: '16px' }}
              className="flex-1 bg-transparent text-white placeholder-white/25 outline-none text-base" />
            {input.trim() && (
              <button type="submit" disabled={isLoading}
                className="ml-2 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center active:opacity-80 flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
          <VoiceButton isRecording={isRecording} isLoading={isLoading} onStart={startRecording} onStop={stopRecording} />
        </form>
      </div>

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
