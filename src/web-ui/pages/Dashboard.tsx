import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { Activity, AlertTriangle, Radar, Zap, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { LogItem } from '../components/LogItem';

export default function Dashboard() {
  const trackers = useQuery({ queryKey: ['trackers'], queryFn: api.trackers.list });
  const actions = useQuery({ queryKey: ['actions'], queryFn: api.actions.list });
  const logs = useQuery({
    queryKey: ['logs', { limit: 200 }],
    queryFn: () => api.logs.list({ limit: 200 }),
    refetchInterval: 4000,
  });

  const now = Date.now();
  const last24h = (logs.data ?? []).filter(
    (l) => now - new Date(l.timestamp).getTime() < 24 * 3600 * 1000,
  );
  const events24h = last24h.filter((l) => l.level === 'EVT').length;
  const errors24h = last24h.filter((l) => l.level === 'ERR').length;
  const recent = (logs.data ?? []).slice(0, 8);

  const byTracker = new Map<string, number>();
  (logs.data ?? []).forEach((l) => {
    const id = l.context?.trackerId;
    if (!id) return;
    if (l.level === 'EVT') byTracker.set(id, (byTracker.get(id) ?? 0) + 1);
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Overview</h2>
          <div className="sub">Live state of your trackers, actions, and events.</div>
        </div>
      </div>

      <div className="stats">
        <StatCard label="Trackers" value={trackers.data?.length ?? 0} icon={<Radar size={16} />} />
        <StatCard label="Actions" value={actions.data?.length ?? 0} icon={<Zap size={16} />} />
        <StatCard label="Events · 24h" value={events24h} icon={<Activity size={16} />} />
        <StatCard
          label="Errors · 24h"
          value={errors24h}
          icon={<AlertTriangle size={16} />}
          tone={errors24h > 0 ? 'err' : undefined}
        />
      </div>

      <div className="split">
        <div className="card" style={{ padding: 0 }}>
          <div className="card-title" style={{ padding: '18px 20px 12px', marginBottom: 0 }}>
            <Activity size={14} />
            Recent events
            <div className="spacer" />
            <NavLink to="/logs" className="btn btn-ghost btn-sm">
              View all <ArrowRight size={13} />
            </NavLink>
          </div>
          <div>
            {logs.isLoading && <div className="empty"><div className="spinner" /></div>}
            {!logs.isLoading && recent.length === 0 && (
              <div className="empty">
                <div className="icon"><Activity size={18} /></div>
                <div className="title">No events yet</div>
                <div>Add a tracker to start collecting events.</div>
              </div>
            )}
            {recent.map((e, i) => <LogItem key={i} entry={e} />)}
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <Radar size={14} />
            Tracker activity
          </div>
          {trackers.isLoading && <div className="spinner" />}
          {!trackers.isLoading && (trackers.data?.length ?? 0) === 0 && (
            <div className="empty">
              <div className="icon"><Radar size={18} /></div>
              <div className="title">No trackers configured</div>
              <NavLink to="/trackers/new" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
                Create your first tracker
              </NavLink>
            </div>
          )}
          <div className="stack" style={{ gap: 10 }}>
            {trackers.data?.map((t) => {
              const count = byTracker.get(t.id) ?? 0;
              return (
                <NavLink
                  key={t.id}
                  to={`/trackers/${encodeURIComponent(t.id)}`}
                  className="card hover"
                  style={{ padding: 14, display: 'block', textDecoration: 'none' }}
                >
                  <div className="hstack" style={{ gap: 12 }}>
                    <span className="live-dot" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{t.name || t.id}</div>
                      <div className="url-chip truncate" title={t.url} style={{ marginTop: 4 }}>
                        {t.url}
                      </div>
                    </div>
                    <div className="right">
                      <span className="badge accent"><span className="dot" /> {count} evt</span>
                      <div className="xs muted mt-sm">
                        every {t.intervalSeconds}s · {t.rules.length} rule{t.rules.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'err';
}) {
  return (
    <div className="card stat">
      <div className="stat-icon" style={tone === 'err' ? { color: 'var(--err)' } : undefined}>
        {icon}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone === 'err' && value > 0 ? { color: 'var(--err)' } : undefined}>
        {value}
      </div>
    </div>
  );
}
