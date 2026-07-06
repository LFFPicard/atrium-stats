'use client';

import { useState } from 'react';

const COLORS = ['bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-orange-600', 'bg-pink-600', 'bg-cyan-600'];

// Plex user avatars are served directly from Plex's own CDN (an absolute URL already
// present on the Sentinel user record) — unlike media posters, there's no token/URL to hide,
// so these are hotlinked directly rather than going through the artwork proxy.
export default function UserAvatar({
  thumb,
  username,
  className = 'w-8 h-8 text-sm',
}: {
  thumb?: string | null;
  username: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (thumb && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumb}
        alt={username}
        className={`${className} rounded-full object-cover shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }

  const color = COLORS[username.charCodeAt(0) % COLORS.length];
  return (
    <div className={`${className} ${color} rounded-full flex items-center justify-center font-semibold text-white shrink-0 select-none`}>
      {username[0]?.toUpperCase() ?? '?'}
    </div>
  );
}
