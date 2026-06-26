'use client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function MessageBubble({
  message,
}: {
  message: Message;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex message-enter ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mr-2 mt-1 text-sm">
          🦜
        </div>
      )}
      <div
        className={`max-w-[78%] px-4 py-3 ${
          isUser
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl rounded-br-md text-white'
            : 'glass rounded-3xl rounded-bl-md text-white/90'
        }`}
      >
        {message.content ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        ) : (
          <div className="flex gap-1 items-center py-0.5">
            <div className="typing-dot w-2 h-2 rounded-full bg-white/50" />
            <div className="typing-dot w-2 h-2 rounded-full bg-white/50" />
            <div className="typing-dot w-2 h-2 rounded-full bg-white/50" />
          </div>
        )}
      </div>
    </div>
  );
}
