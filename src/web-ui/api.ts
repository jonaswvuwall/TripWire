import type { LogEntry, Tracker, TrackerAction } from './types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  trackers: {
    list: () => request<Tracker[]>('/trackers'),
    get: (id: string) => request<Tracker>(`/trackers/${encodeURIComponent(id)}`),
    create: (tracker: Tracker) =>
      request<Tracker>('/trackers', { method: 'POST', body: JSON.stringify(tracker) }),
    update: (id: string, tracker: Tracker) =>
      request<Tracker>(`/trackers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(tracker),
      }),
    remove: (id: string) =>
      request<void>(`/trackers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  actions: {
    list: () => request<TrackerAction[]>('/actions'),
    get: (id: string) => request<TrackerAction>(`/actions/${encodeURIComponent(id)}`),
    create: (action: TrackerAction) =>
      request<TrackerAction>('/actions', { method: 'POST', body: JSON.stringify(action) }),
    update: (id: string, action: TrackerAction) =>
      request<TrackerAction>(`/actions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(action),
      }),
    remove: (id: string) =>
      request<void>(`/actions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  logs: {
    list: (params?: { trackerId?: string; level?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.trackerId) q.set('trackerId', params.trackerId);
      if (params?.level) q.set('level', params.level);
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return request<LogEntry[]>(`/logs${qs ? `?${qs}` : ''}`);
    },
    clear: () => request<void>('/logs', { method: 'DELETE' }),
  },
};
