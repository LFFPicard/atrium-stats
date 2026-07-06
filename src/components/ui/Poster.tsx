'use client';

import { useState } from 'react';

// All artwork goes through /api/sentinel/artwork/:ratingKey (never a raw Plex URL — see
// ATRIUM_STATS.md's Known Gotchas). Falls back to a plain placeholder if there's no
// ratingKey, no cached image, or the fetch fails.
export default function Poster({
  ratingKey,
  type = 'thumb',
  alt,
  className = '',
}: {
  ratingKey: string | null | undefined;
  type?: 'thumb' | 'art';
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!ratingKey || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-(--color-surface) text-(--color-text-muted) ${className}`}
        aria-label={alt}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-1/3 h-1/3">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/sentinel/artwork/${ratingKey}?type=${type}`}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
