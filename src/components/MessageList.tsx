import { useRef, useEffect } from 'react';
import { useMessageStore } from '../stores/messageStore';
import { getPublicKey } from '../services/identity';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface MessageListProps {
  channelId: string;
}

export function MessageList({ channelId }: MessageListProps) {
  const messages = useMessageStore((s) => s.getMessages(channelId));
  const myKey = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      myKey.current = getPublicKey();
    } catch {
      myKey.current = null;
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="text-ass-text-secondary text-lg mb-2">No messages yet</div>
          <p className="text-ass-text-secondary/80 text-sm max-w-md mx-auto">
            Connect another tab (see instructions above), then send a message. It will appear in both tabs.
          </p>
        </div>
      )}
      {messages.map((msg) => {
        const isMe = myKey.current === msg.authorId;
        return (
          <div
            key={msg.id}
            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 ${
                isMe
                  ? 'bg-ass-accent text-white'
                  : 'bg-ass-bg-secondary text-ass-text-primary'
              }`}
            >
              {!isMe && (
                <div className="text-xs text-ass-text-secondary mb-0.5">
                  {msg.authorId.slice(0, 12)}...
                </div>
              )}
              <div className="break-words">{msg.content}</div>
              <div
                className={`text-xs mt-1 ${
                  isMe ? 'text-white/80' : 'text-ass-text-secondary'
                }`}
              >
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
