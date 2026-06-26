'use client';

interface Props {
  isRecording: boolean;
  isLoading: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function VoiceButton({ isRecording, isLoading, onStart, onStop }: Props) {
  return (
    <button
      type="button"
      onClick={isRecording ? onStop : onStart}
      disabled={isLoading}
      aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
      className={`relative w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
        isRecording
          ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/40'
          : isLoading
          ? 'bg-white/10 opacity-40'
          : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/30 active:scale-95'
      }`}
    >
      {isRecording && (
        <span className="pulse-ring absolute inset-0 rounded-full bg-red-500" />
      )}
      {isRecording ? (
        <div className="flex gap-0.5 items-center relative z-10">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="wave-bar w-1 bg-white rounded-full"
              style={{ animationDelay: `${(i - 1) * 0.12}s` }}
            />
          ))}
        </div>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M12 14a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4zm-2 2.93A7 7 0 0 1 5 10a1 1 0 0 0-2 0 9 9 0 0 0 8 8.94V21H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.06A9 9 0 0 0 21 10a1 1 0 0 0-2 0 7 7 0 0 1-9 6.93z" />
        </svg>
      )}
    </button>
  );
}
