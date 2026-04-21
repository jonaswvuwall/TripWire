import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { ChevronRight, Link2, Plus, Zap } from 'lucide-react';
import { api } from '../api';

export default function Actions() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['actions'],
    queryFn: api.actions.list,
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Actions</h2>
          <div className="sub">Reusable side-effects that rules can trigger.</div>
        </div>
        <div className="actions">
          <NavLink to="/actions/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> New action
          </NavLink>
        </div>
      </div>

      {isLoading && <div className="card"><div className="spinner" /></div>}
      {isError && <div className="banner">Failed to load actions.</div>}

      {!isLoading && data && data.length === 0 && (
        <div className="card">
          <div className="empty">
            <div className="icon"><Zap size={20} /></div>
            <div className="title">No actions yet</div>
            <div>Create an action to fire on rule triggers.</div>
            <NavLink to="/actions/new" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
              <Plus size={14} /> New action
            </NavLink>
          </div>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th style={{ width: 40 }} aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>
                    <NavLink
                      to={`/actions/${encodeURIComponent(a.id)}`}
                      style={{ display: 'block', textDecoration: 'none', fontWeight: 500 }}
                      className="mono"
                    >
                      {a.id}
                    </NavLink>
                  </td>
                  <td><span className={'badge ' + typeClass(a.type)}>{a.type}</span></td>
                  <td className="mono muted">{a.method ?? '—'}</td>
                  <td>
                    {a.url ? (
                      <span className="url-chip truncate" title={a.url}>
                        <Link2 size={12} />
                        {a.url}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <NavLink
                      to={`/actions/${encodeURIComponent(a.id)}`}
                      className="btn btn-ghost btn-icon"
                      aria-label="Edit action"
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

function typeClass(t: string) {
  switch (t) {
    case 'webhook': return 'accent';
    case 'api-request': return 'info';
    case 'log': return '';
    case 'script': return 'warn';
    default: return '';
  }
}
