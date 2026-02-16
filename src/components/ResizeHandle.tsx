import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

/** A draggable handle for resizing panels */
export function ResizeHandle({ direction, onResize, className = '' }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<number>(0);
  const valueRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
      valueRef.current = 0;
    },
    [direction]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const current = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = current - startRef.current;
      startRef.current = current;
      valueRef.current += delta;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, onResize]);

  const isHorizontal = direction === 'horizontal';
  const hitArea = isHorizontal ? 'w-1' : 'h-1';
  const cursor = isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize';

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center group ${cursor} ${className}`}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation={direction}
    >
      <div
        className={`${hitArea} hover:bg-concord-accent/30 transition-colors flex items-center justify-center ${
          isDragging ? 'bg-concord-accent/50' : ''
        }`}
      >
        <div
          className={`bg-concord-text-secondary/40 group-hover:bg-concord-accent rounded-full ${
            isHorizontal ? 'w-0.5 h-8' : 'h-0.5 w-8'
          }`}
        />
      </div>
    </div>
  );
}
