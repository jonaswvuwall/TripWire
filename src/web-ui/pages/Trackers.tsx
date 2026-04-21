import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { ChevronRight, Link2, Radar, Plus } from 'lucide-react';
import { api } from '../api';

export default function Trackers() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['trackers'],
    queryFn: api.trackers.list,
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Trackers</h2>
          <div className="sub">Pages the worker watches and the rules it evaluates.</div>
        </div>
        <div className="actions">
          <NavLink to="/trackers/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> New tracker
          </NavLink>
        </div>
      </div>

      {isLoading && <div className="card"><div className="spinner" /></div>}
      {isError && <div className="banner">Failed to load trackers.</div>}

      {!isLoading && data && data.length === 0 && (
        <div className="card">
          <div className="empty">
            <div className="icon"><Radar size={20} /></div>
            <div className="title">No trackers yet</div>
            <div>Create a tracker to start watching a page.</div>
            <NavLink to="/trackers/new" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
              <Plus size={14} /> New tracker
            </NavLink>
          </div>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Interval</th>
                <th>Selectors</th>
                <th>Rules</th>
                <th style={{ width: 40 }} aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id}>
                  <td>
                    <NavLink
                      to={`/trackers/${encodeURIComponent(t.id)}`}
                      style={{ display: 'block', textDecoration: 'none' }}
                    >
                      <div style={{ fontWeight: 500 }}>{t.name || '—'}</div>
                      <div className="mono xs muted">{t.id}</div>
                    </NavLink>
                  </td>
                  <td>
                    <span className="url-chip truncate" title={t.url}>
                      <Link2 size={12} />
                      {t.url}
                    </span>
                  </td>
                  <td className="mono">{t.intervalSeconds}s</td>
                  <td>{t.selectors.length}</td>
                  <td>{t.rules.length}</td>
                  <td>
                    <NavLink
                      to={`/trackers/${encodeURIComponent(t.id)}`}
                      className="btn btn-ghost btn-icon"
                      aria-label="Edit tracker"
                    >
                      <ChevronRight size={14} />
                    </NavLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
