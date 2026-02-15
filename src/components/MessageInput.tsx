import { useState, useRef, useEffect } from 'react';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div className="p-4 border-t border-[var(--border)]">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Connect to relay first..." : "Type a message... (Enter to send)"}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg bg-concord-bg-secondary px-4 py-2.5 text-concord-text-primary placeholder-concord-text-secondary border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-concord-accent min-h-[40px] max-h-[120px]"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="px-4 py-2.5 rounded-lg bg-concord-accent hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
