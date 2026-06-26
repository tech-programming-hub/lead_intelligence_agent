# 🦜 Parakeet AI — Personal iPhone AI Assistant

A Claude-powered AI voice assistant that runs as a **Progressive Web App (PWA)** on your iPhone. Add it to your home screen and it feels like a native app.

## Features

- **Voice input** — tap the mic and speak; Parakeet transcribes and responds
- **Streaming responses** — words appear in real-time as Claude generates them
- **Voice output** — responses are read aloud automatically (toggle in Settings)
- **Conversation history** — full multi-turn context within a session
- **Custom personality** — set your own system prompt in Settings
- **Offline shell** — app shell cached via service worker
- **iPhone-native feel** — respects notch/Dynamic Island, safe areas, no zoom

## Deploy in 5 Minutes (Vercel)

### 1. Get your Anthropic API key
Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create new key.

### 2. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Import the `tech-programming-hub/lead_intelligence_agent` repo
2. **Set Root Directory to `parakeet-ai`** in Project Settings
3. Add environment variable: `ANTHROPIC_API_KEY` = your key
4. Click Deploy

### 3. Install on iPhone

1. Open the Vercel URL in **Safari** on your iPhone
2. Tap the **Share** button (📤)
3. Tap **"Add to Home Screen"**
4. Tap **"Add"**

You now have a native-feeling Parakeet AI app on your iPhone!

## Alternative: Enter API Key in the App

If you prefer not to set the env var:
1. Open the deployed app
2. Tap **⚙️ Settings** (top right)
3. Paste your Anthropic API key
4. Tap **Save Settings**

The key is stored locally on your device only.

## Run Locally

```bash
cd parakeet-ai
npm install
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | Anthropic Claude (claude-haiku-4-5) |
| Voice In | Web Speech API (webkitSpeechRecognition) |
| Voice Out | SpeechSynthesis API |
| Offline | Service Worker + Cache API |
| Deploy | Vercel (free tier) |

## iOS Voice Notes

- Voice input uses `webkitSpeechRecognition` — works in **Safari iOS 15+**
- On first mic tap, Safari will ask for microphone permission — tap **Allow**
- Voice output (text-to-speech) works in all modern Safari versions
- Chrome on iOS does NOT support SpeechRecognition; use Safari

## Adding Icons

Place PNG icons in `public/icons/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `apple-touch-icon.png` (180×180)

Generate them free at [favicon.io](https://favicon.io/emoji-favicons/parrot) using the parrot emoji.

## Customization

Edit the default personality in `src/app/api/chat/route.ts` — the `DEFAULT_SYSTEM` constant.

Or set a custom personality per-device in Settings without touching code.
