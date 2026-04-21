import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import { ArrowLeft, MousePointerClick, Plus, Save, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { PickerDialog, type PickEvent } from '../components/PickerDialog';
import type { Rule, RuleType, Selector, Tracker } from '../types';

const EMPTY_TRACKER: Tracker = {
  id: '',
  name: '',
  url: '',
  intervalSeconds: 60,
  selectors: [],
  rules: [],
};

export default function TrackerEditor({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const existing = useQuery({
    queryKey: ['tracker', id],
    queryFn: () => api.trackers.get(id!),
    enabled: mode === 'edit' && !!id,
  });

  const actions = useQuery({ queryKey: ['actions'], queryFn: api.actions.list });

  const [draft, setDraft] = useState<Tracker>(EMPTY_TRACKER);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<number | null>(null);

  useEffect(() => {
    if (mode === 'edit' && existing.data) setDraft(existing.data);
  }, [mode, existing.data]);

  const save = useMutation({
    mutationFn: async (t: Tracker) => {
      if (mode === 'new') return api.trackers.create(t);
      return api.trackers.update(t.id, t);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trackers'] });
      qc.invalidateQueries({ queryKey: ['tracker', draft.id] });
      navigate('/trackers');
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => api.trackers.remove(draft.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trackers'] });
      navigate('/trackers');
    },
  });

  const updateSelector = (i: number, next: Partial<Selector>) => {
    const arr = [...draft.selectors];
    arr[i] = { ...arr[i], ...next };
    setDraft({ ...draft, selectors: arr });
  };
  const addSelector = () =>
    setDraft({ ...draft, selectors: [...draft.selectors, { name: '', element: '' }] });
  const removeSelector = (i: number) =>
    setDraft({ ...draft, selectors: draft.selectors.filter((_, idx) => idx !== i) });

  const suggestName = (sel: string, text?: string) => {
    if (text) {
      const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24);
      if (slug) return slug;
    }
    const tag = sel.match(/^[a-z0-9]+/i)?.[0] ?? 'selector';
    let n = 1;
    while (draft.selectors.some((s) => s.name === `${tag}-${n}`)) n++;
    return `${tag}-${n}`;
  };

  const handlePick = (picked: PickEvent) => {
    if (pickerTarget !== null) {
      updateSelector(pickerTarget, { element: picked.selector });
      setPickerTarget(null);
      setPickerOpen(false);
      return;
    }
    setDraft((d) => ({
      ...d,
      selectors: [...d.selectors, { name: suggestName(picked.selector, picked.text), element: picked.selector }],
    }));
  };

  const updateRule = (i: number, next: Partial<Rule>) => {
    const arr = [...draft.rules];
    arr[i] = { ...arr[i], ...next };
    setDraft({ ...draft, rules: arr });
  };
  const addRule = () =>
    setDraft({
      ...draft,
      rules: [
        ...draft.rules,
        { selectorNames: [], type: 'threshold', operator: '>', value: 0, triggerAction: '', message: '' },
      ],
    });
  const removeRule = (i: number) =>
    setDraft({ ...draft, rules: draft.rules.filter((_, idx) => idx !== i) });

  return (
    <>
      <div className="page-header">
        <div>
          <NavLink to="/trackers" className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}>
            <ArrowLeft size={13} /> All trackers
          </NavLink>
          <h2>{mode === 'new' ? 'New tracker' : draft.name || draft.id || 'Tracker'}</h2>
          {mode === 'edit' && <div className="sub mono">{draft.id}</div>}
        </div>
        <div className="actions">
          {mode === 'edit' && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (confirm(`Delete tracker '${draft.id}'?`)) remove.mutate();
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
              save.mutate(draft);
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
                <label>Tracker ID</label>
                <input
                  className="input mono"
                  value={draft.id}
                  disabled={mode === 'edit'}
                  onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                  placeholder="product-price-tracker"
                />
                <div className="hint">
                  {mode === 'edit' ? 'Readonly — used as the stable key.' : 'Used as the stable key. Lowercase kebab-case recommended.'}
                </div>
              </div>
              <div className="field">
                <label>Display name</label>
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Product price watch"
                />
              </div>
            </div>
            <div className="row">
              <div className="field" style={{ flex: 2 }}>
                <label>URL</label>
                <input
                  className="input mono"
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  placeholder="https://example.com/product/123"
                />
              </div>
              <div className="field" style={{ maxWidth: 160 }}>
                <label>Interval (s)</label>
                <input
                  className="input mono"
                  type="number"
                  min={1}
                  value={draft.intervalSeconds}
                  onChange={(e) => setDraft({ ...draft, intervalSeconds: Number(e.target.value) || 1 })}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-title">
            Selectors
            <div className="spacer" />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                if (!draft.url.trim()) {
                  setError('Set the tracker URL before picking an element.');
                  return;
                }
                setPickerTarget(null);
                setPickerOpen(true);
              }}
            >
              <MousePointerClick size={13} /> Pick from page
            </button>
          </div>
          <div className="repeater">
            {draft.selectors.map((s, i) => (
              <div key={i} className="repeater-row">
                <input
                  className="input"
                  value={s.name}
                  placeholder="name (e.g. price)"
                  onChange={(e) => updateSelector(i, { name: e.target.value })}
                />
                <input
                  className="input mono"
                  value={s.element}
                  placeholder="CSS selector (e.g. .product-price)"
                  onChange={(e) => updateSelector(i, { element: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  title="Pick element from the page"
                  onClick={() => {
                    if (!draft.url.trim()) {
                      setError('Set the tracker URL before picking an element.');
                      return;
                    }
                    setPickerTarget(i);
                    setPickerOpen(true);
                  }}
                >
                  <MousePointerClick size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => removeSelector(i)}
                  aria-label="Remove selector"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {draft.selectors.length === 0 && (
              <div className="muted xs">
                No selectors yet — click <b style={{ color: 'var(--text-2)' }}>Pick from page</b> to
                capture one visually, or add a manual row.
              </div>
            )}
            <button className="repeater-add" onClick={addSelector}>
              <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Add selector manually
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-title">Rules</div>
          {draft.rules.length === 0 && (
            <div className="muted xs" style={{ marginBottom: 10 }}>
              No rules yet — add a rule to decide when to trigger actions.
            </div>
          )}
          {draft.rules.map((r, i) => (
            <RuleBlock
              key={i}
              rule={r}
              index={i}
              selectors={draft.selectors}
              actionIds={actions.data?.map((a) => a.id) ?? []}
              onChange={(next) => updateRule(i, next)}
              onRemove={() => removeRule(i)}
            />
          ))}
          <button className="repeater-add" onClick={addRule} style={{ marginTop: 10 }}>
            <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Add rule
          </button>
        </section>
      </div>

      {pickerOpen && (
        <PickerDialog
          url={draft.url}
          onPick={handlePick}
          onClose={() => {
            setPickerOpen(false);
            setPickerTarget(null);
          }}
        />
      )}
    </>
  );
}

function RuleBlock({
  rule,
  index,
  selectors,
  actionIds,
  onChange,
  onRemove,
}: {
  rule: Rule;
  index: number;
  selectors: Selector[];
  actionIds: string[];
  onChange: (next: Partial<Rule>) => void;
  onRemove: () => void;
}) {
  const selectorNames = selectors.map((s) => s.name).filter(Boolean);

  const toggleSelector = (name: string) => {
    const s = new Set(rule.selectorNames);
    if (s.has(name)) s.delete(name);
    else s.add(name);
    onChange({ selectorNames: Array.from(s) });
  };

  return (
    <div className="rule-card">
      <div className="rule-head">
        <span>Rule #{index + 1}</span>
        <span className="badge accent">{rule.type}</span>
        <div className="spacer" />
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onRemove} aria-label="Remove rule">
          <X size={13} />
        </button>
      </div>

      <div className="stack">
        <div className="row">
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Type</label>
            <select
              className="select"
              value={rule.type}
              onChange={(e) => onChange({ type: e.target.value as RuleType })}
            >
              <option value="threshold">threshold</option>
              <option value="contains">contains</option>
              <option value="changed">changed</option>
            </select>
          </div>
          {rule.type === 'threshold' && (
            <>
              <div className="field" style={{ maxWidth: 120 }}>
                <label>Operator</label>
                <select
                  className="select"
                  value={rule.operator ?? '>'}
                  onChange={(e) => onChange({ operator: e.target.value as Rule['operator'] })}
                >
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<=">&lt;=</option>
                  <option value="==">==</option>
                  <option value="!=">!=</option>
                </select>
              </div>
              <div className="field" style={{ maxWidth: 160 }}>
                <label>Value</label>
                <input
                  className="input mono"
                  type="number"
                  value={rule.value as number | undefined ?? ''}
                  onChange={(e) =>
                    onChange({ value: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
              </div>
            </>
          )}
          {rule.type === 'contains' && (
            <div className="field">
              <label>Value (substring)</label>
              <input
                className="input"
                value={String(rule.value ?? '')}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder="e.g. Verfügbar"
              />
            </div>
          )}
        </div>

        <div className="field">
          <label>Selectors</label>
          <div className="hstack" style={{ flexWrap: 'wrap', gap: 6 }}>
            {selectorNames.length === 0 && (
              <span className="muted xs">Add selectors first to target them.</span>
            )}
            {selectorNames.map((n) => {
              const active = rule.selectorNames.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  className={'badge ' + (active ? 'accent' : '')}
                  style={{ cursor: 'pointer', border: active ? undefined : '1px solid var(--border-strong)' }}
                  onClick={() => toggleSelector(n)}
                >
                  {active && <span className="dot" />}
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Trigger action</label>
            <select
              className="select"
              value={rule.triggerAction ?? ''}
              onChange={(e) => onChange({ triggerAction: e.target.value || undefined })}
            >
              <option value="">— none —</option>
              {actionIds.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label>Message</label>
            <input
              className="input"
              value={rule.message ?? ''}
              onChange={(e) => onChange({ message: e.target.value })}
              placeholder="e.g. Price above threshold"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
