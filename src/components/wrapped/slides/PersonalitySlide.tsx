import type { Personality } from '@/lib/stats/personality';

export default function PersonalitySlide({ personality }: { personality: Personality }) {
  return (
    <div className="text-center max-w-sm">
      <p className="text-sm uppercase tracking-widest text-white/60 mb-4">Your Viewing Personality</p>
      <p className="text-4xl font-bold mb-3">{personality.type}</p>
      <p className="text-white/70">{personality.description}</p>
    </div>
  );
}
