import { useState, useEffect, useCallback, useRef } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; update: Update }
  | { phase: 'downloading'; progress: number; total: number }
  | { phase: 'installing' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string }
  | { phase: 'up-to-date' };

export function UpdateChecker() {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const isAutoCheckRef = useRef(true);

  const checkForUpdate = useCallback(async (silent = false) => {
    if (!silent) setState({ phase: 'checking' });
    try {
      const update = await check();
      if (update) {
        setState({ phase: 'available', update });
      } else if (!silent) {
        setState({ phase: 'up-to-date' });
        setTimeout(() => setState({ phase: 'idle' }), 4000);
      }
    } catch (e: unknown) {
      if (silent) {
        // Auto-check: fail silently (no release published yet, network down, etc.)
        console.log('[updater] Auto-check failed (silent):', e);
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      setState({ phase: 'error', message: msg });
      setTimeout(() => setState({ phase: 'idle' }), 6000);
    }
  }, []);

  // Auto-check on mount — silent (no UI if it fails or is up-to-date)
  useEffect(() => {
    const timer = setTimeout(() => checkForUpdate(true), 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  const installUpdate = useCallback(async () => {
    if (state.phase !== 'available') return;
    const { update } = state;

    try {
      let downloaded = 0;
      setState({ phase: 'downloading', progress: 0, total: 0 });

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setState({
              phase: 'downloading',
              progress: 0,
              total: event.data.contentLength ?? 0,
            });
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            setState((prev) =>
              prev.phase === 'downloading'
                ? { ...prev, progress: downloaded }
                : prev,
            );
            break;
          case 'Finished':
            setState({ phase: 'ready' });
            break;
        }
      });

      setState({ phase: 'ready' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ phase: 'error', message: msg });
    }
  }, [state]);

  const handleRelaunch = useCallback(async () => {
    await relaunch();
  }, []);

  // Nothing to show
  if (state.phase === 'idle' || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-[var(--border)] bg-concord-bg-secondary shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-concord-bg-tertiary border-b border-[var(--border)]">
        <span className="text-xs font-semibold text-concord-accent-primary uppercase tracking-wide">
          Update
        </span>
        {state.phase !== 'downloading' && state.phase !== 'installing' && (
          <button
            onClick={() => setDismissed(true)}
            className="text-concord-text-secondary hover:text-concord-text-primary text-sm leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-3 space-y-2">
        {state.phase === 'checking' && (
          <p className="text-sm text-concord-text-secondary">
            Checking for updates...
          </p>
        )}

        {state.phase === 'up-to-date' && (
          <p className="text-sm text-green-400">You're on the latest version.</p>
        )}

        {state.phase === 'available' && (
          <>
            <p className="text-sm text-concord-text-primary">
              <span className="font-semibold text-concord-accent-primary">
                v{state.update.version}
              </span>{' '}
              is available.
            </p>
            {state.update.body && (
              <p className="text-xs text-concord-text-secondary line-clamp-3">
                {state.update.body}
              </p>
            )}
            <button
              onClick={installUpdate}
              className="w-full mt-1 px-3 py-1.5 rounded bg-concord-accent-primary text-white text-sm font-medium hover:brightness-110 transition"
            >
              Download & Install
            </button>
          </>
        )}

        {state.phase === 'downloading' && (
          <>
            <p className="text-sm text-concord-text-secondary">Downloading...</p>
            <div className="w-full h-2 rounded bg-concord-bg-primary overflow-hidden">
              <div
                className="h-full bg-concord-accent-primary transition-all"
                style={{
                  width:
                    state.total > 0
                      ? `${Math.min(100, (state.progress / state.total) * 100)}%`
                      : '30%',
                }}
              />
            </div>
            {state.total > 0 && (
              <p className="text-[10px] text-concord-text-secondary text-right">
                {(state.progress / 1024 / 1024).toFixed(1)} /{' '}
                {(state.total / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </>
        )}

        {state.phase === 'ready' && (
          <>
            <p className="text-sm text-green-400">
              Update installed. Restart to apply.
            </p>
            <button
              onClick={handleRelaunch}
              className="w-full mt-1 px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:brightness-110 transition"
            >
              Restart Now
            </button>
          </>
        )}

        {state.phase === 'error' && (
          <p className="text-sm text-red-400">{state.message}</p>
        )}
      </div>
    </div>
  );
}
