'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import MessageBubble, { Message } from './MessageBubble';
import VoiceButton from './VoiceButton';
import SettingsModal from './SettingsModal';

const DEFAULT_SYSTEM = `You are Parakeet, a friendly, witty, and intelligent personal AI assistant.
Keep responses concise and conversational — think texting a smart friend, not reading a manual.
For complex topics, be clear and structured but still brief. Use line breaks for readability.
If asked who you are, say you're Parakeet, a personal AI assistant.`;

const QUICK_PROMPTS = [
  'What can you do?',
  'Tell me a joke 😄',
  'Explain something simply',
  'Help me brainstorm',
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('parakeet_api_key') || '';
    const savedPrompt = localStorage.getItem('parakeet_system_prompt') || '';
    const savedSpeak = localStorage.getItem('parakeet_auto_speak') !== 'false';
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
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.name.includes('Samantha')) ||
        voices.find((v) => v.lang.startsWith('en'));
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
        setError('Add your free Google AI API key in Settings to start chatting.');
        setShowSettings(true);
        return;
      }

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };
      const assistantId = `a-${Date.now()}`;
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      // capture current messages BEFORE state update (for history)
      const prevMessages = messages;

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setTranscript('');
      setIsLoading(true);

      try {
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: systemPrompt?.trim() || DEFAULT_SYSTEM,
        });

        // Build conversation history (all previous messages)
        const history = prevMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const chat = model.startChat({
          history,
          generationConfig: { maxOutputTokens: 1024 },
        });

        const result = await chat.sendMessageStream(trimmed);

        let fullText = '';
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullText += chunkText;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
          );
        }

        if (fullText) speakText(fullText);
      } catch (err: any) {
        const msg =
          err?.message?.includes('API_KEY') || err?.message?.includes('API key')
            ? 'Invalid API key. Please check your key in Settings.'
            : err?.message || 'Something went wrong. Please try again.';
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: `⚠️ ${msg}` } : m))
        );
        if (msg.includes('key')) setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, systemPrompt, apiKey, speakText]
  );

  const startRecording = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input requires Safari on iOS 15+ or Chrome on desktop.');
      return;
    }
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
        recognition.stop();
        sendMessage(final);
      } else {
        setTranscript(interim);
      }
    };
    recognition.onerror = () => { setIsRecording(false); setTranscript(''); };
    recognition.onend = () => setIsRecording(false);

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

  const clearChat = useCallback(() => {
    if (messages.length === 0) return;
    setMessages([]);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, [messages.length]);

  return (
    <div className="flex flex-col bg-[#08080c] text-white" style={{ height: '100dvh' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pb-3 bg-black/70 backdrop-blur-xl border-b border-white/[0.06] z-10 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button
          onClick={clearChat}
          className="text-white/40 text-sm font-medium active:text-white/80 transition-colors min-w-[44px] text-left"
        >
          {messages.length > 0 ? 'Clear' : ''}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight">🦜 Parakeet</span>
          {(isLoading || isSpeaking) && (
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          )}
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="text-white/40 active:text-white/80 transition-colors min-w-[44px] flex justify-end"
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ WebkitOverflowScrolling: 'touch' } as any}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full gap-6 text-center py-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30 text-5xl">
              🦜
            </div>
            <div>
              <h1 className="text-3xl font-bold gradient-text mb-2">Parakeet AI</h1>
              <p className="text-white/40 text-sm max-w-[260px] mx-auto leading-relaxed">
                Your personal AI assistant. Tap the mic to speak or type a message.
              </p>
            </div>
            {error && (
              <div className="glass rounded-2xl p-4 text-sm text-orange-300 max-w-xs text-left">
                ⚠️ {error}
                <button onClick={() => setShowSettings(true)} className="block mt-2 text-indigo-400 underline">
                  Open Settings →
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="glass rounded-2xl p-3 text-xs text-white/60 active:bg-white/10 transition-colors text-left leading-relaxed"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {transcript && (
        <div className="px-5 py-2 text-white/50 text-sm italic border-t border-white/[0.06] bg-black/50 flex-shrink-0">
          {transcript}
        </div>
      )}

      {isSpeaking && (
        <div className="px-4 pb-1 flex-shrink-0">
          <button
            onClick={stopSpeaking}
            className="w-full glass rounded-2xl py-2.5 px-4 flex items-center gap-3 text-sm text-white/60 active:bg-white/10"
          >
            <div className="flex gap-0.5 items-center">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="wave-bar w-1 bg-indigo-400 rounded-full" style={{ animationDelay: `${(i - 1) * 0.12}s` }} />
              ))}
            </div>
            <span>Speaking… tap to stop</span>
          </button>
        </div>
      )}

      {/* Input bar */}
      <div
        className="flex-shrink-0 px-4 pt-3 bg-black/70 backdrop-blur-xl border-t border-white/[0.06]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-3">
          <div className="flex-1 glass rounded-2xl flex items-center px-4 py-3 min-h-[48px]">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Parakeet…"
              disabled={isLoading || isRecording}
              style={{ fontSize: '16px' }}
              className="flex-1 bg-transparent text-white placeholder-white/25 outline-none text-base"
            />
            {input.trim() && (
              <button
                type="submit"
                disabled={isLoading}
                className="ml-2 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center active:opacity-80 transition-opacity flex-shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
          <VoiceButton isRecording={isRecording} isLoading={isLoading} onStart={startRecording} onStop={stopRecording} />
        </form>
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
