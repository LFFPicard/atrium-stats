'use client';

import { useEffect, useRef, useState } from 'react';
import Poster from '@/components/ui/Poster';
import type { LiveEvent, LiveSession } from '@/lib/sentinel/live';

function formatTitle(media: LiveSession['media']): string {
  if (!media) return 'Unknown';
  if (media.type === 'episode') {
    return [media.grandparentTitle, media.parentTitle, media.title].filter(Boolean).join(' · ');
  }
  return media.year ? `${media.title} (${media.year})` : media.title;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function transcodeBadgeClass(decision: string | null): string {
  switch (decision) {
    case 'transcode':
      return 'bg-amber-500/20 text-amber-400';
    case 'copy':
      return 'bg-sky-500/20 text-sky-400';
    default:
      return 'bg-emerald-500/20 text-emerald-400';
  }
}

// Consumes the same-origin SSE bridge at /api/sentinel/live — never connects to Sentinel's
// WebSocket directly (that requires the read key as a query param). See
// lib/sentinel/liveBroadcast.ts and app/api/sentinel/live/route.ts.
export default function LiveActivity() {
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource('/api/sentinel/live');
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as LiveEvent;
        if (event.event !== 'heartbeat') {
          setSessions(event.sessions);
        }
      } catch {
        // Malformed frame — ignore rather than crash the view.
      }
    };

    return () => source.close();
  }, []);

  if (sessions === null) {
    return (
      <div className="text-sm text-(--color-text-muted)">
        {connected ? 'Waiting for activity…' : 'Connecting…'}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-8 text-center text-sm text-(--color-text-muted)">
        Nothing playing right now.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {sessions.map((session) => {
        const progress = session.media?.duration
          ? Math.min(100, ((session.viewOffset ?? 0) / session.media.duration) * 100)
          : null;

        return (
          <div key={session.sessionKey} className="flex gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
            <Poster
              ratingKey={session.media?.ratingKey}
              alt={session.media?.title ?? 'Poster'}
              className="w-16 h-24 rounded-md object-cover shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col">
              <p className="text-sm font-medium text-(--color-text) truncate">{formatTitle(session.media)}</p>
              <p className="text-xs text-(--color-text-muted) truncate mt-0.5">
                {session.user?.displayName ?? session.user?.username ?? 'Unknown user'}
                {session.player ? ` · ${session.player}` : ''}
              </p>

              <div className="flex-1" />

              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${transcodeBadgeClass(session.transcodeDecision)}`}
                >
                  {session.transcodeDecision ?? 'direct'}
                </span>
                <span className="text-[10px] text-(--color-text-muted)">
                  {session.state === 'paused' ? 'Paused' : 'Playing'}
                </span>
              </div>

              {progress !== null && (
                <div className="mt-1.5">
                  <div className="h-1 rounded-full bg-(--color-border) overflow-hidden">
                    <div className="h-full bg-(--color-accent)" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-(--color-text-muted) mt-1">
                    <span>{formatDuration(session.viewOffset ?? 0)}</span>
                    <span>{formatDuration(session.media!.duration!)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
