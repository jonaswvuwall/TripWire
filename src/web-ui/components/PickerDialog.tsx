import { useEffect, useRef, useState } from 'react';
import { Link2, MousePointerClick, X } from 'lucide-react';

export interface PickEvent {
  selector: string;
  text?: string;
}

export function PickerDialog({
  url,
  onPick,
  onClose,
}: {
  url: string;
  onPick: (picked: PickEvent) => void;
  onClose: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState<PickEvent[]>([]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; selector?: string; text?: string };
      if (!data || !data.type || !data.type.startsWith('tripwire:')) return;
      if (data.type === 'tripwire:ready') setReady(true);
      if (data.type === 'tripwire:cancel') onClose();
      if (data.type === 'tripwire:picked' && data.selector) {
        const pick: PickEvent = { selector: data.selector, text: data.text };
        setCaptured((c) => [pick, ...c].slice(0, 8));
        onPick(pick);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPick, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
            {ready ? (
              <span className="badge ok"><span className="live-dot" /> ready</span>
            ) : (
              <span className="badge"><span className="spinner" style={{ width: 10, height: 10 }} /> loading</span>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close picker">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="picker-body">
          <div className="picker-stage">
            {!ready && (
              <div className="modal-loading">
                <div className="spinner" />
                <div>Fetching page…</div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              title="element-picker"
              src={`/api/preview?url=${encodeURIComponent(url)}`}
              sandbox="allow-scripts"
              className="picker-iframe"
            />
          </div>
          <aside className="picker-side">
            <div className="card-title" style={{ marginBottom: 10 }}>
              Recently captured
            </div>
            {captured.length === 0 && (
              <div className="muted xs">
                Hover over any element in the preview. Click to capture its CSS selector —
                it will be added as a new selector in your tracker.
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
