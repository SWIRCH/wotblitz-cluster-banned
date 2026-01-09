export type PingInfo = {
  last: number | null;
  avg: number | null;
  attempts: number;
  successes: number;
  lossPercent: number;
  status: string;
  lastError?: string;
};

export type PingMap = Record<string, PingInfo>;
