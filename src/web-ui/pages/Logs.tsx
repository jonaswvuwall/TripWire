import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Play, RefreshCw, ScrollText, Trash2 } from 'lucide-react';
import { api } from '../api';
import { LogItem } from '../components/LogItem';

const LEVELS = ['', 'EVT', 'INFO', 'WARN', 'ERR', 'DEBUG'] as const;

export default function Logs() {
  const qc = useQueryClient();
  const [trackerId, setTrackerId] = useState('');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('');
  const [search, setSearch] = useState('');
  const [live, setLive] = useState(true);

  const trackers = useQuery({ queryKey: ['trackers'], queryFn: api.trackers.list });
  const logs = useQuery({
    queryKey: ['logs', { trackerId, level, limit: 500 }],
    queryFn: () =>
      api.logs.list({ trackerId: trackerId || undefined, level: level || undefined, limit: 500 }),
    refetchInterval: live ? 3000 : false,
  });

  const clear = useMutation({
    mutationFn: api.logs.clear,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logs'] }),
  });

  const filtered = useMemo(() => {
    if (!logs.data) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return logs.data;
    return logs.data.filter(
      (e) =>
        e.message.toLowerCase().includes(needle) ||
        e.context?.trackerId?.toLowerCase().includes(needle) ||
        e.context?.selector?.toLowerCase().includes(needle),
    );
  }, [logs.data, search]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Event log</h2>
          <div className="sub">Newest first · ring-buffered at 10,000 entries.</div>
        </div>
        <div className="actions">
          <button
            className={'btn btn-sm ' + (live ? '' : 'btn-ghost')}
            onClick={() => setLive((v) => !v)}
            title={live ? 'Pause live updates' : 'Resume live updates'}
          >
            {live ? (
              <>
                <span className="live-dot" /> Live
              </>
            ) : (
              <>
                <Play size={13} /> Paused
              </>
            )}
          </button>
          <button className="btn btn-sm" onClick={() => logs.refetch()}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (confirm('Clear all log entries?')) clear.mutate();
            }}
            disabled={clear.isPending || (logs.data?.length ?? 0) === 0}
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      <div className="filters">
        <select
          className="select"
          value={trackerId}
          onChange={(e) => setTrackerId(e.target.value)}
        >
          <option value="">All trackers</option>
          {trackers.data?.map((t) => (
            <option key={t.id} value={t.id}>{t.id}</option>
          ))}
        </select>
        <select
          className="select"
          value={level}
          onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])}
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l || 'All levels'}</option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Search message, selector, tracker…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240 }}
        />
        {!live && logs.isFetching && <span className="spinner" />}
      </div>

      <div className="table-wrap">
        {logs.isLoading && (
          <div className="empty"><div className="spinner" /></div>
        )}
        {!logs.isLoading && filtered.length === 0 && (
          <div className="empty">
            <div className="icon"><ScrollText size={20} /></div>
            <div className="title">No log entries match</div>
            <div>Adjust filters or wait for the worker to poll.</div>
          </div>
        )}
        {filtered.map((e, i) => (
          <LogItem key={`${e.timestamp}-${i}`} entry={e} />
        ))}
      </div>
    </>
  );
}
