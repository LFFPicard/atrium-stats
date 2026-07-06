import ShareButton from '../ShareButton';

export default function OutroSlide({ year, showShare }: { year: number; showShare: boolean }) {
  return (
    <div className="text-center max-w-sm flex flex-col items-center">
      <p className="text-sm uppercase tracking-widest text-white/60 mb-4">That&apos;s a wrap</p>
      <p className="text-2xl font-bold mb-6">See you next year, {year + 1}.</p>
      {showShare && (
        // pointer-events-auto — the parent slide wrapper is pointer-events-none for the
        // Stories-style tap navigation; the share button needs real clicks.
        <div className="pointer-events-auto">
          <ShareButton year={year} />
        </div>
      )}
    </div>
  );
}
