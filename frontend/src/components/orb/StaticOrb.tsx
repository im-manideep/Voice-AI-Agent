// Fallback orb: prefers-reduced-motion, no WebGL, or a canvas crash.
// Pure CSS — a gradient disc with a gentle opacity pulse (or none at all
// under reduced motion; see index.css).

export function StaticOrb({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden>
      <div className="static-orb h-full w-full" />
    </div>
  )
}
