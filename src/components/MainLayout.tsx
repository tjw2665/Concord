import { useState, useCallback } from 'react';
import { ResizeHandle } from './ResizeHandle';

const MIN_LEFT = 180;
const MAX_LEFT = 400;
const DEFAULT_LEFT = 240;
const MIN_RIGHT = 200;
const MAX_RIGHT = 400;
const DEFAULT_RIGHT = 288;

interface MainLayoutProps {
  leftBar: React.ReactNode;
  center: React.ReactNode;
  rightSidebar: React.ReactNode;
  /** Whether to show the right sidebar */
  showRightSidebar?: boolean;
}

export function MainLayout({
  leftBar,
  center,
  rightSidebar,
  showRightSidebar = true,
}: MainLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.min(MAX_LEFT, Math.max(MIN_LEFT, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, w - delta)));
  }, []);

  return (
    <div className="flex h-full min-w-0 overflow-hidden">
      {/* Left bar */}
      <div
        className="flex-shrink-0 flex flex-col overflow-hidden bg-concord-bg-tertiary border-r border-[var(--border)]"
        style={{ width: leftWidth }}
      >
        {leftBar}
      </div>

      <ResizeHandle direction="horizontal" onResize={handleLeftResize} />

      {/* Center content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">{center}</div>

      {/* Right sidebar */}
      {showRightSidebar && (
        <>
          <ResizeHandle direction="horizontal" onResize={handleRightResize} />
          <div
            className="flex-shrink-0 flex flex-col overflow-hidden border-l border-[var(--border)]"
            style={{ width: rightWidth }}
          >
            {rightSidebar}
          </div>
        </>
      )}
    </div>
  );
}
