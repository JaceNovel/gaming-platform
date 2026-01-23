export default function SkeletonLine({ width = "100%" }: { width?: string }) {
  return (
    <div
      className="h-3 rounded-full bg-white/10 overflow-hidden relative"
      style={{ width }}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/5 via-white/15 to-white/5" />
    </div>
  );
}
