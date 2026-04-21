import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Radar,
  Zap,
  ScrollText,
  BookOpen,
  Plus,
} from 'lucide-react';
import { api } from '../api';

export default function Layout() {
  const trackers = useQuery({ queryKey: ['trackers'], queryFn: api.trackers.list });
  const actions = useQuery({ queryKey: ['actions'], queryFn: api.actions.list });
  const logs = useQuery({
    queryKey: ['logs', { level: 'EVT', limit: 1 }],
    queryFn: () => api.logs.list({ level: 'EVT', limit: 1 }),
    refetchInterval: 5000,
  });

  const location = useLocation();
  const isApiDown = trackers.isError || actions.isError;

  const { title, crumbs, topbarActions } = buildHeader(location.pathname);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <svg width="16" height="16" viewBox="0 0 48 46" fill="currentColor" aria-hidden="true">
              <path d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" />
            </svg>
          </span>
          <span className="brand-name">TripWire</span>
          <span className="brand-tag">PoC</span>
        </div>

        <nav className="nav">
          <span className="nav-label">Workspace</span>
          <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>
          <NavLink to="/trackers" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <Radar size={16} /> Trackers
            {trackers.data && <span className="nav-count">{trackers.data.length}</span>}
          </NavLink>
          <NavLink to="/actions" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <Zap size={16} /> Actions
            {actions.data && <span className="nav-count">{actions.data.length}</span>}
          </NavLink>
          <NavLink to="/logs" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <ScrollText size={16} /> Event log
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          {isApiDown ? (
            <>
              <span className="badge err"><span className="dot" /> api offline</span>
            </>
          ) : (
            <>
              <span className="live-dot" />
              <span>Worker polling • {logs.data?.[0] ? 'last event just now' : 'idle'}</span>
            </>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="crumbs">{crumbs}</div>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">{topbarActions}</div>
        </header>
        <div className="page">
          {isApiDown && (
            <div className="banner">
              <span>Can't reach the API at <code>/api</code>. Start it with <code>dotnet run</code> in <code>src/web-api</code>.</span>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function buildHeader(path: string): { title: string; crumbs: React.ReactNode; topbarActions: React.ReactNode } {
  if (path === '/') {
    return {
      title: 'Overview',
      crumbs: <span>Workspace</span>,
      topbarActions: (
        <a
          className="btn btn-ghost"
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          title="Repository"
        >
          <BookOpen size={14} /> Docs
        </a>
      ),
    };
  }
  if (path.startsWith('/trackers/new')) {
    return { title: 'New tracker', crumbs: <><NavLink to="/trackers">Trackers</NavLink><span>›</span><span>New</span></>, topbarActions: null };
  }
  if (path.startsWith('/trackers/')) {
    const id = decodeURIComponent(path.split('/')[2] ?? '');
    return {
      title: id || 'Tracker',
      crumbs: <><NavLink to="/trackers">Trackers</NavLink><span>›</span><span className="mono">{id}</span></>,
      topbarActions: null,
    };
  }
  if (path === '/trackers') {
    return {
      title: 'Trackers',
      crumbs: <span>Workspace</span>,
      topbarActions: (
        <NavLink to="/trackers/new" className="btn btn-primary btn-sm">
          <Plus size={14} /> New tracker
        </NavLink>
      ),
    };
  }
  if (path.startsWith('/actions/new')) {
    return { title: 'New action', crumbs: <><NavLink to="/actions">Actions</NavLink><span>›</span><span>New</span></>, topbarActions: null };
  }
  if (path.startsWith('/actions/')) {
    const id = decodeURIComponent(path.split('/')[2] ?? '');
    return {
      title: id || 'Action',
      crumbs: <><NavLink to="/actions">Actions</NavLink><span>›</span><span className="mono">{id}</span></>,
      topbarActions: null,
    };
  }
  if (path === '/actions') {
    return {
      title: 'Actions',
      crumbs: <span>Workspace</span>,
      topbarActions: (
        <NavLink to="/actions/new" className="btn btn-primary btn-sm">
          <Plus size={14} /> New action
        </NavLink>
      ),
    };
  }
  if (path === '/logs') {
    return {
      title: 'Event log',
      crumbs: <span>Workspace</span>,
      topbarActions: null,
    };
  }
  return { title: '', crumbs: null, topbarActions: null };
}
