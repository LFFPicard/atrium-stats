import { sentinelFetch } from './client';

export type HistoryEntry = {
  id: number;
  startedAt: number;
  stoppedAt: number | null;
  duration: number | null;
  progress: number | null;
  complete: boolean;
  platform: string | null;
  player: string | null;
  ipAddress: string | null;
  transcodeDecision: string | null;
  user: {
    id: number;
    username: string;
    displayName: string | null;
    thumb: string | null;
  } | null;
  media: {
    id: number;
    type: string;
    title: string;
    grandparentTitle: string | null;
    parentTitle: string | null;
    year: number | null;
    thumb: string | null;
  } | null;
};

export type HistoryQuery = {
  userId?: number;
  from?: number;
  to?: number;
  year?: number;
  limit?: number;
  offset?: number;
  complete?: boolean;
};

export type HistoryResult = {
  history: HistoryEntry[];
  pagination: { limit: number; offset: number; returned: number };
};

export async function getHistory(query: HistoryQuery = {}): Promise<HistoryResult> {
  const params = new URLSearchParams();
  if (query.userId !== undefined) params.set('user_id', String(query.userId));
  if (query.from !== undefined) params.set('from', String(query.from));
  if (query.to !== undefined) params.set('to', String(query.to));
  if (query.year !== undefined) params.set('year', String(query.year));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));
  if (query.complete !== undefined) params.set('complete', String(query.complete));

  const qs = params.toString();
  return sentinelFetch<HistoryResult>(`/history${qs ? `?${qs}` : ''}`);
}
