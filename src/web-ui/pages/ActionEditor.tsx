import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, X } from 'lucide-react';
import { api } from '../api';
import type { ActionType, HttpMethod, TrackerAction } from '../types';

const EMPTY: TrackerAction = { id: '', type: 'webhook', method: 'POST', url: '' };

export default function ActionEditor({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams();
  const existing = useQuery({
    queryKey: ['action', id],
    queryFn: () => api.actions.get(id!),
    enabled: mode === 'edit' && !!id,
  });

  if (mode === 'edit' && !existing.data) {
    return <div className="empty"><div className="spinner" /></div>;
  }
  return <ActionEditorInner mode={mode} initial={existing.data ?? EMPTY} />;
}

function ActionEditorInner({ mode, initial }: { mode: 'new' | 'edit'; initial: TrackerAction }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<TrackerAction>(initial);
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(() =>
    Object.entries(initial.headers ?? {}).map(([key, value]) => ({ key, value })),
  );
  const [error, setError] = useState<string | null>(null);

  const headersObj = () => {
    const obj: Record<string, string> = {};
    for (const { key, value } of headers) {
      if (key.trim()) obj[key.trim()] = value;
    }
    return Object.keys(obj).length ? obj : undefined;
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: TrackerAction = { ...draft, headers: headersObj() };
      if (mode === 'new') return api.actions.create(payload);
      return api.actions.update(payload.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions'] });
      qc.invalidateQueries({ queryKey: ['action', draft.id] });
      navigate('/actions');
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => api.actions.remove(draft.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions'] });
      navigate('/actions');
    },
  });

  const isHttp = draft.type === 'webhook' || draft.type === 'api-request';

  return (
    <>
      <div className="page-header">
        <div>
          <NavLink to="/actions" className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}>
            <ArrowLeft size={13} /> All actions
          </NavLink>
          <h2>{mode === 'new' ? 'New action' : draft.id || 'Action'}</h2>
        </div>
        <div className="actions">
          {mode === 'edit' && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (confirm(`Delete action '${draft.id}'?`)) remove.mutate();
              }}
              disabled={remove.isPending}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setError(null);
              save.mutate();
            }}
            disabled={save.isPending}
          >
            {save.isPending ? <span className="spinner" /> : <Save size={14} />}
            {mode === 'new' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="banner">{error}</div>}

      <div className="stack">
        <section className="card">
          <div className="card-title">General</div>
          <div className="stack">
            <div className="row">
              <div className="field">
                <label>Action ID</label>
                <input
                  className="input mono"
                  value={draft.id}
                  disabled={mode === 'edit'}
                  onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                  placeholder="action-send-webhook"
                />
              </div>
              <div className="field" style={{ maxWidth: 200 }}>
                <label>Type</label>
                <select
                  className="select"
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as ActionType })}
                >
                  <option value="webhook">webhook</option>
                  <option value="api-request">api-request</option>
                  <option value="log">log</option>
                  <option value="script">script</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {isHttp && (
          <section className="card">
            <div className="card-title">HTTP request</div>
            <div className="stack">
              <div className="row">
                <div className="field" style={{ maxWidth: 160 }}>
                  <label>Method</label>
                  <select
                    className="select"
                    value={draft.method ?? 'POST'}
                    onChange={(e) => setDraft({ ...draft, method: e.target.value as HttpMethod })}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label>Endpoint URL</label>
                  <input
                    className="input mono"
                    value={draft.url ?? ''}
                    onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                    placeholder="https://example.com/webhook"
                  />
                </div>
              </div>

              <div>
                <div className="card-title" style={{ marginBottom: 8 }}>Headers</div>
                <div className="repeater">
                  {headers.map((h, i) => (
                    <div key={i} className="repeater-row">
                      <input
                        className="input mono"
                        value={h.key}
                        placeholder="Header-Name"
                        onChange={(e) => {
                          const next = [...headers];
                          next[i] = { ...next[i], key: e.target.value };
                          setHeaders(next);
                        }}
                      />
                      <input
                        className="input mono"
                        value={h.value}
                        placeholder="value"
                        onChange={(e) => {
                          const next = [...headers];
                          next[i] = { ...next[i], value: e.target.value };
                          setHeaders(next);
                        }}
                      />
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                        aria-label="Remove header"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="repeater-add"
                    onClick={() => setHeaders([...headers, { key: '', value: '' }])}
                  >
                    <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Add header
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {draft.type === 'log' && (
          <div className="banner info">
            A <code>log</code> action writes the triggering event to the server log. No extra
            configuration needed.
          </div>
        )}
        {draft.type === 'script' && (
          <div className="banner info">
            <code>script</code> actions are accepted by the schema but are not executed in the PoC.
          </div>
        )}
      </div>
    </>
  );
}
