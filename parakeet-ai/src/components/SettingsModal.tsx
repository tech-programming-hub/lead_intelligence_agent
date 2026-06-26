'use client';

import { useState } from 'react';

interface Props {
  apiKey: string;
  systemPrompt: string;
  autoSpeak: boolean;
  onClose: () => void;
  onSave: (key: string, prompt: string, speak: boolean) => void;
}

export default function SettingsModal({ apiKey, systemPrompt, autoSpeak, onClose, onSave }: Props) {
  const [key, setKey] = useState(apiKey);
  const [prompt, setPrompt] = useState(systemPrompt);
  const [speak, setSpeak] = useState(autoSpeak);

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-[#111116] border-t border-white/10 rounded-t-3xl px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-6 space-y-5">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Settings</h2>
          <button onClick={onClose} className="text-white/50 active:text-white p-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Free API Key notice */}
        <div className="glass rounded-2xl p-3 flex gap-3 items-start">
          <span className="text-green-400 text-lg">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-400">100% Free — No credit card</p>
            <p className="text-xs text-white/50 mt-0.5">
              Get a free Google AI key at{' '}
              <span className="text-indigo-400">aistudio.google.com/app/apikey</span>
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Google AI API Key (Free)
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza..."
            style={{ fontSize: '16px' }}
            className="w-full glass rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
          />
          <p className="text-xs text-white/30">
            Stored only on this device. Never sent anywhere except Google AI.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Custom Personality
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="You are a helpful assistant named Parakeet..."
            rows={3}
            style={{ fontSize: '16px' }}
            className="w-full glass rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium">Auto-speak responses</p>
            <p className="text-xs text-white/40 mt-0.5">Read answers aloud automatically</p>
          </div>
          <button
            onClick={() => setSpeak(!speak)}
            className={`w-12 h-7 rounded-full transition-colors duration-200 flex items-center px-1 ${speak ? 'bg-indigo-500' : 'bg-white/20'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${speak ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <button
          onClick={() => onSave(key, prompt, speak)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 font-semibold text-white active:opacity-80 transition-opacity shadow-lg shadow-purple-500/20"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
