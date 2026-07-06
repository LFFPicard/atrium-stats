export default function IntroSlide({ year, username }: { year: number; username: string }) {
  return (
    <div className="text-center max-w-md">
      <p className="text-sm uppercase tracking-widest text-white/60 mb-3">Atrium Stats Wrapped</p>
      <h1 className="text-6xl font-bold mb-3">{year}</h1>
      <p className="text-lg text-white/80">{username}&apos;s year in review</p>
    </div>
  );
}
