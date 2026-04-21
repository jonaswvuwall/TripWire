import type { LogEntry } from '../types';

export function LogItem({ entry }: { entry: LogEntry }) {
  const ts = new Date(entry.timestamp);
  const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = ts.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const lvlClass = levelClass(entry.level);

  return (
    <div className={'log-entry' + (entry.level === 'DEBUG' ? ' dim' : '')}>
      <div className="ts">
        {time}
        <br />
        <span style={{ opacity: 0.7 }}>{date}</span>
      </div>
      <div className="lvl">
        <span className={`badge ${lvlClass}`}>{entry.level}</span>
      </div>
      <div>
        <div className="msg">{entry.message}</div>
        {entry.context && Object.values(entry.context).some((v) => v !== undefined && v !== null) && (
          <div className="ctx">
            {entry.context.trackerId && <span><b>tracker</b> {entry.context.trackerId}</span>}
            {entry.context.selector && <span><b>selector</b> {entry.context.selector}</span>}
            {entry.context.ruleType && <span><b>rule</b> {entry.context.ruleType}</span>}
            {(entry.context.previousValue !== undefined && entry.context.previousValue !== null) && (
              <span><b>prev</b> {String(entry.context.previousValue)}</span>
            )}
            {(entry.context.currentValue !== undefined && entry.context.currentValue !== null) && (
              <span><b>curr</b> {String(entry.context.currentValue)}</span>
            )}
            {entry.context.triggeredAction && <span><b>action</b> {entry.context.triggeredAction}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function levelClass(level: string) {
  switch (level) {
    case 'EVT': return 'accent';
    case 'ERR': return 'err';
    case 'WARN': return 'warn';
    case 'INFO': return 'info';
    default: return '';
  }
}
