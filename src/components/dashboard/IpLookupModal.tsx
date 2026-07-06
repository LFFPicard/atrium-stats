'use client';

import { useEffect, useState } from 'react';
import type { GeoInfo } from '@/lib/sentinel/geo';

export default function IpLookupModal({ ip, onClose }: { ip: string; onClose: () => void }) {
  const [geo, setGeo] = useState<GeoInfo | null | undefined>(undefined); // undefined = still loading
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGeo(undefined);
    setError(false);

    fetch(`/api/sentinel/geo/${encodeURIComponent(ip)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setGeo(null);
          return;
        }
        if (!res.ok) {
          setError(true);
          return;
        }
        setGeo(await res.json());
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ip]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-(--color-border) bg-(--color-surface) p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-(--color-text)">{ip}</h3>
          <button onClick={onClose} className="text-(--color-text-muted) hover:text-(--color-text)" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {geo === undefined && <p className="text-sm text-(--color-text-muted)">Looking up…</p>}
        {error && <p className="text-sm text-(--color-text-muted)">Couldn&apos;t reach Sentinel to look this up.</p>}
        {geo === null && !error && (
          <p className="text-sm text-(--color-text-muted)">
            Not looked up yet — Sentinel caches geolocation the first time a session comes from this IP.
          </p>
        )}
        {geo &&
          (geo.isPrivate ? (
            <p className="text-sm text-(--color-text-muted)">Private/LAN address — no external geolocation.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {([
                ['Country', geo.country],
                ['Region', geo.region],
                ['City', geo.city],
                ['ISP', geo.isp],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-(--color-text-muted)">{label}</dt>
                  <dd className="text-(--color-text) text-right">{value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          ))}
      </div>
    </div>
  );
}
