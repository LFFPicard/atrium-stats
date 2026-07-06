'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import BlurredBackdrop from './BlurredBackdrop';

export type Slide = {
  content: React.ReactNode;
  /** Poster/art ratingKey for the ambient blurred background, or null/undefined for none. */
  backdropRatingKey?: string | null;
};

// Stories-style navigation: left third of the screen goes back, right two-thirds advance —
// full-bleed tap zones sit behind the slide content (z-10 vs z-20) and the slide content
// itself is pointer-events-none so clicks fall through to the zones EXCEPT on the specific
// interactive elements a slide opts back in with `pointer-events-auto` (see OutroSlide's
// ShareButton wrapper) — otherwise a full-bleed slide would swallow every click itself.
//
// The backdrop is rendered here as a sibling of the animated slide content, not nested
// inside it — Framer Motion applies a CSS transform to animated elements, which makes them
// a containing block for any `fixed`-positioned descendant, breaking true full-viewport
// backdrop coverage if it were nested inside the animated wrapper.
export default function SlideShow({ slides, exitHref }: { slides: Slide[]; exitHref: string }) {
  const [index, setIndex] = useState(0);
  const total = slides.length;

  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const goPrev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev]);

  const current = slides[index];

  return (
    <div className="fixed inset-0 bg-(--color-bg) text-(--color-text) overflow-hidden select-none">
      <BlurredBackdrop ratingKey={current?.backdropRatingKey} />

      <div className="absolute top-0 inset-x-0 z-30 flex gap-1.5 p-4">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`flex-1 h-1 rounded-full transition-colors ${i <= index ? 'bg-white' : 'bg-white/20'}`}
          />
        ))}
      </div>

      <Link href={exitHref} aria-label="Close" className="absolute top-4 right-4 z-30 text-white/80 hover:text-white p-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </Link>

      <button aria-label="Previous slide" onClick={goPrev} className="absolute inset-y-0 left-0 w-1/3 z-10" />
      <button aria-label="Next slide" onClick={goNext} className="absolute inset-y-0 right-0 w-2/3 z-10" />

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center p-8 z-20 pointer-events-none"
        >
          {current?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
