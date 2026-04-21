import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Link2, MousePointerClick, RefreshCw, X } from 'lucide-react';

export interface PickEvent {
  selector: string;
  text?: string;
}

type LoadState = 'loading' | 'ready' | 'error';
const TIMEOUT_MS = 30_000;

export function PickerDialog({
  url,
  onPick,
  onClose,
}: {
  url: string;
  onPick: (picked: PickEvent) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>('loading');
  const [elapsed, setElapsed] = useState(0);
  const [captured, setCaptured] = useState<PickEvent[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // elapsed counter + timeout while loading
  useEffect(() => {
    if (state !== 'loading') return;
    const t0 = Date.now();
    setElapsed(0);
    const interval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    const timeout = window.setTimeout(() => setState('error'), TIMEOUT_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [state, reloadKey]);

  // postMessage from the picker script (picks + ready + cancel)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== 'object' || typeof (data as { type?: unknown }).type !== 'string') return;
      const msg = data as { type: string; selector?: string; text?: string };
      if (!msg.type.startsWith('tripwire:')) return;
      if (msg.type === 'tripwire:ready') setState('ready');
      if (msg.type === 'tripwire:cancel') onClose();
      if (msg.type === 'tripwire:picked' && msg.selector) {
        const pick: PickEvent = { selector: msg.selector, text: msg.text };
        setCaptured((c) => [pick, ...c].slice(0, 8));
        onPick(pick);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPick, onClose]);

  // ESC closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleReload = () => {
    setState('loading');
    setReloadKey((k) => k + 1);
  };

  const iframeSrc = `/api/preview?url=${encodeURIComponent(url)}&_r=${reloadKey}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel picker-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="modal-title">
              <MousePointerClick size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              Pick an element
            </div>
            <div className="modal-sub hstack" style={{ gap: 6 }}>
              <Link2 size={11} />
              <span className="mono truncate">{url}</span>
            </div>
          </div>
          <div className="hstack" style={{ gap: 8 }}>
            {state === 'ready' && (
              <span className="badge ok">
                <span className="live-dot" /> ready
              </span>
            )}
            {state === 'loading' && (
              <span className="badge">
                <span className="spinner" style={{ width: 10, height: 10 }} /> loading · {elapsed}s
              </span>
            )}
            {state === 'error' && <span className="badge err">timeout</span>}
            <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close picker">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="picker-body">
          <div className="picker-stage">
            {state === 'loading' && (
              <div className="modal-loading">
                <div className="spinner" />
                <div>Fetching page…</div>
                <div className="xs muted" style={{ marginTop: 4 }}>
                  Elapsed {elapsed}s · server is downloading the page and stripping its scripts.
                </div>
                <div className="xs muted" style={{ marginTop: 2 }}>
                  Heavy sites can take 10–20s.
                </div>
              </div>
            )}
            {state === 'error' && (
              <div className="modal-loading" style={{ gap: 14 }}>
                <div style={{ fontWeight: 500, color: 'var(--text)' }}>Preview didn't load in {TIMEOUT_MS / 1000}s</div>
                <div className="xs muted" style={{ textAlign: 'center', maxWidth: 360 }}>
                  The site might be slow, block bot requests, or be unreachable from the backend.
                  Try reloading, or open the URL in a new tab to confirm it works.
                </div>
                <div className="hstack" style={{ gap: 8 }}>
                  <button className="btn btn-sm" onClick={handleReload}>
                    <RefreshCw size={12} /> Retry
                  </button>
                  <a className="btn btn-sm" target="_blank" rel="noreferrer" href={url}>
                    <ExternalLink size={12} /> Open in new tab
                  </a>
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              key={reloadKey}
              title="element-picker"
              src={iframeSrc}
              sandbox="allow-scripts"
              className="picker-iframe"
              onLoad={() => setState((s) => (s === 'error' ? s : 'ready'))}
            />
          </div>
          <aside className="picker-side">
            <div className="card-title" style={{ marginBottom: 10 }}>
              Recently captured
            </div>
            {captured.length === 0 && (
              <div className="muted xs">
                Hover over any element in the preview. Click to capture its CSS selector — it
                will be added as a new selector in your tracker.
              </div>
            )}
            <div className="stack" style={{ gap: 8 }}>
              {captured.map((c, i) => (
                <div key={i} className="card" style={{ padding: 10 }}>
                  <code className="mono xs" style={{ display: 'block', wordBreak: 'break-all' }}>
                    {c.selector}
                  </code>
                  {c.text && (
                    <div className="xs muted truncate mt-sm" title={c.text}>
                      “{c.text}”
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="divider" />
            <div className="xs muted">
              <b style={{ color: 'var(--text-2)' }}>Tip:</b> Press <kbd className="kbd">ESC</kbd> to close.
              The page's own scripts are disabled, so links and buttons won't navigate.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
