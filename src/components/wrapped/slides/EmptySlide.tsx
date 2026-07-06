export default function EmptySlide({ title, message }: { title: string; message: string }) {
  return (
    <div className="text-center max-w-sm">
      <p className="text-sm uppercase tracking-widest text-white/60 mb-3">{title}</p>
      <p className="text-lg text-white/80">{message}</p>
    </div>
  );
}
