export type RuleType = 'threshold' | 'contains' | 'changed';
export type Operator = '>' | '<' | '>=' | '<=' | '==' | '!=';
export type ActionType = 'api-request' | 'log' | 'script';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type LogLevel = 'EVT' | 'INFO' | 'WARN' | 'ERR' | 'DEBUG';

export interface Selector {
  name: string;
  element: string;
}

export interface Rule {
  selectorNames: string[];
  type: RuleType;
  operator?: Operator;
  value?: string | number | boolean | null;
  triggerAction?: string;
  message?: string;
}

export interface Tracker {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  selectors: Selector[];
  rules: Rule[];
}

export interface TrackerAction {
  id: string;
  type: ActionType;
  method?: HttpMethod;
  url?: string;
  headers?: Record<string, string>;
}

export interface LogContext {
  trackerId?: string;
  selector?: string;
  ruleType?: string;
  previousValue?: unknown;
  currentValue?: unknown;
  triggeredAction?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}
