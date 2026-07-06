'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import IpLookupModal from './IpLookupModal';
import type { HistoryEntry, HistoryResult } from '@/lib/sentinel/history';

function formatTitle(media: HistoryEntry['media']): string {
  if (!media) return 'Unknown';
  if (media.type === 'episode') {
    return [media.grandparentTitle, media.parentTitle, media.title].filter(Boolean).join(' · ');
  }
  return media.year ? `${media.title} (${media.year})` : media.title;
}

function formatTimestamp(unix: number | null): string {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type UserOption = { id: number; username: string; displayName: string | null };

const LIMIT = 50;

export default function HistoryTable({ initial, users }: { initial: HistoryResult; users: UserOption[] }) {
  const [result, setResult] = useState(initial);
  const [userId, setUserId] = useState('');
  const [complete, setComplete] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ipModal, setIpModal] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  const fetchPage = useCallback(async (nextOffset: number, nextUserId: string, nextComplete: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(nextOffset) });
    if (nextUserId) params.set('user_id', nextUserId);
    if (nextComplete) params.set('complete', nextComplete);

    try {
      const res = await fetch(`/api/sentinel/history?${params}`);
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // `initial` already covers the very first render (offset 0, no filters) — skip
    // re-fetching it, but every subsequent change (including navigating back to offset 0) refetches.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchPage(offset, userId, complete);
  }, [offset, userId, complete, fetchPage]);

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setOffset(0);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={userId}
          onChange={(e) => updateFilter(setUserId, e.target.value)}
          className="bg-(--color-surface) border border-(--color-border) text-(--color-text) text-sm rounded-lg px-3 py-2"
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName ?? u.username}
            </option>
          ))}
        </select>

        <select
          value={complete}
          onChange={(e) => updateFilter(setComplete, e.target.value)}
          className="bg-(--color-surface) border border-(--color-border) text-(--color-text) text-sm rounded-lg px-3 py-2"
        >
          <option value="">All plays</option>
          <option value="true">Completed only</option>
          <option value="false">Incomplete only</option>
        </select>
      </div>

      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-(--color-text-muted) border-b border-(--color-border)">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">IP</th>
              <th className="px-3 py-2 font-medium">Platform</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Stopped</th>
              <th className="px-3 py-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {result.history.map((entry) => {
              const ip = entry.ipAddress;
              return (
                <tr key={entry.id} className="border-b border-(--color-border) last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-(--color-text)">{formatTimestamp(entry.startedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-(--color-text)">
                    {entry.user ? (
                      <Link href={`/dashboard/users/${entry.user.id}`} className="hover:text-(--color-accent)">
                        {entry.user.displayName ?? entry.user.username}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ip ? (
                      <button onClick={() => setIpModal(ip)} className="text-(--color-accent) hover:underline">
                        {ip}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-(--color-text-muted)">{entry.platform ?? '—'}</td>
                  <td className="px-3 py-2 text-(--color-text)">{formatTitle(entry.media)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-(--color-text-muted)">{formatTimestamp(entry.stoppedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-(--color-text-muted)">{formatDuration(entry.duration)}</td>
                </tr>
              );
            })}
            {result.history.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-(--color-text-muted)">
                  No history found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm text-(--color-text-muted)">
        <span>
          {loading ? 'Loading…' : `Showing ${result.pagination.offset + 1}–${result.pagination.offset + result.pagination.returned}`}
        </span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            className="px-3 py-1.5 rounded-lg border border-(--color-border) disabled:opacity-40 hover:bg-(--color-surface)"
          >
            Previous
          </button>
          <button
            disabled={result.pagination.returned < LIMIT || loading}
            onClick={() => setOffset(offset + LIMIT)}
            className="px-3 py-1.5 rounded-lg border border-(--color-border) disabled:opacity-40 hover:bg-(--color-surface)"
          >
            Next
          </button>
        </div>
      </div>

      {ipModal && <IpLookupModal ip={ipModal} onClose={() => setIpModal(null)} />}
    </div>
  );
}
