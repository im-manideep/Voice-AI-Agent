// Fixed background ambience: two soft aurora pools + a vignette. Pure
// gradients (no animation) — depth without costing a single frame.

export function Ambience() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
      <div
        className="absolute -left-[20%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full"
        style={{ background: 'radial-gradient(circle, rgb(45 212 191 / 0.10), transparent 62%)' }}
      />
      <div
        className="absolute -bottom-[30%] -right-[18%] h-[80vmax] w-[80vmax] rounded-full"
        style={{ background: 'radial-gradient(circle, rgb(139 124 246 / 0.12), transparent 62%)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 42%, transparent 50%, rgb(7 8 15 / 0.9))' }}
      />
    </div>
  )
}
