'use client';

import { useState } from 'react';

export default function ShareButton({ year }: { year: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function handleShare() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/wrapped/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });
      if (!res.ok) throw new Error('request failed');
      const data = (await res.json()) as { url: string };
      setUrl(data.url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the field is still
      // focus-and-select-able for a manual copy.
    }
  }

  if (url) {
    return (
      <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="bg-transparent text-sm text-white/90 w-56 outline-none"
        />
        <button onClick={handleCopy} className="text-xs font-medium bg-white text-black rounded px-2 py-1 shrink-0 hover:opacity-90">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleShare}
        disabled={loading}
        className="bg-white text-black font-medium rounded-lg px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? 'Creating link…' : 'Share my Wrapped'}
      </button>
      {error && <p className="text-xs text-red-300">Couldn&apos;t create a share link — try again.</p>}
    </div>
  );
}
