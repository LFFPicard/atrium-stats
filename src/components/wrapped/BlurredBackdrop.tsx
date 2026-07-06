'use client';

// Ambient background art behind a slide — via the artwork proxy, never a raw Plex URL.
// Silently disappears (falls back to the plain theme background) if the item has no
// background art cached, or the fetch fails.
export default function BlurredBackdrop({ ratingKey }: { ratingKey: string | null | undefined }) {
  if (!ratingKey) return null;

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/sentinel/artwork/${ratingKey}?type=art`}
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover blur-2xl scale-110 opacity-40"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-(--color-bg)/60 via-(--color-bg)/85 to-(--color-bg)" />
    </div>
  );
}
