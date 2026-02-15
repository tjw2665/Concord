import { useRef, useEffect } from 'react';
import { useMessageStore } from '../stores/messageStore';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface MessageListProps {
  channelId: string;
  /** The sidecar PeerId of this instance — used to identify "my" messages. */
  myPeerId?: string;
}

export function MessageList({ channelId, myPeerId }: MessageListProps) {
  const messages = useMessageStore((s) => s.getMessages(channelId));
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="text-concord-text-secondary text-lg mb-2">No messages yet</div>
          <p className="text-concord-text-secondary/80 text-sm max-w-md mx-auto">
            Connect to a peer and send a message. It will appear in both apps.
          </p>
        </div>
      )}
      {messages.map((msg) => {
        const isMe = !!myPeerId && msg.authorId === myPeerId;
        return (
          <div
            key={msg.id}
            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 ${
                isMe
                  ? 'bg-concord-accent text-white'
                  : 'bg-concord-bg-secondary text-concord-text-primary'
              }`}
            >
              {!isMe && (
                <div className="text-xs text-concord-text-secondary mb-0.5">
                  {msg.authorId.slice(0, 12)}...
                </div>
              )}
              <div className="break-words">{msg.content}</div>
              <div
                className={`text-xs mt-1 ${
                  isMe ? 'text-white/80' : 'text-concord-text-secondary'
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
