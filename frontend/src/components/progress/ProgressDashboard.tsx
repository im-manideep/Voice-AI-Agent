import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useSessionStore } from '../../store/sessionStore'
import type { TopicProgress, TurnRow } from '../../lib/api'

const VERDICT_STYLE: Record<string, string> = {
  correct: 'bg-aurora/15 text-aurora border-aurora/40',
  partial: 'bg-nebula/15 text-nebula border-nebula/40',
  incorrect: 'bg-ember/15 text-ember border-ember/40',
  'n/a': 'bg-black/5 text-mist border-black/15',
}

function TopicCard({ t, index }: { t: TopicProgress; index: number }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      className={`glass p-5 ${t.seen ? '' : 'opacity-55'}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] text-ink">{t.label}</h3>
        <span className="shrink-0 text-[12px] text-mist">level {t.difficulty}</span>
      </div>

      {/* Mastery bar 0-5 */}
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/8">
        <motion.div
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${(t.mastery / 5) * 100}%` }}
          transition={{ duration: 0.7, delay: 0.2 + index * 0.06, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #2dd4bf, #8b7cf6)' }}
        />
      </div>

      <div className="flex gap-4 text-[12px] text-mist">
        <span>
          mastery <span className="text-ink">{t.mastery}/5</span>
        </span>
        <span>
          streak <span className="text-ink">{t.streak}</span>
        </span>
        <span>
          misses <span className={t.miss_count ? 'text-ember' : 'text-ink'}>{t.miss_count}</span>
        </span>
      </div>
    </motion.div>
  )
}

function HistoryItem({ h }: { h: TurnRow }) {
  const verdict = h.verdict ?? 'n/a'
  return (
    <div className="glass p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${VERDICT_STYLE[verdict] ?? VERDICT_STYLE['n/a']}`}>
          {verdict === 'incorrect' ? 'missed' : verdict === 'n/a' ? 'lesson' : verdict}
        </span>
        <span className="text-[12px] text-mist">
          Q{h.turn} · level {h.difficulty}
          {h.revisit && <span className="text-aurora"> · revisit</span>}
        </span>
      </div>
      <p className="mb-1 text-[14px] text-ink">{h.question}</p>
      {h.answer && <p className="mb-1 text-[13px] italic text-mist">you said: “{h.answer}”</p>}
      {h.feedback && !h.feedback.startsWith('(forced') && (
        <p className="text-[13px] text-mist">{h.feedback}</p>
      )}
    </div>
  )
}

function StatTile({ value, label, index }: { value: string; label: string; index: number }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
      className="glass px-5 py-4"
    >
      <p className="font-display text-4xl text-ink">{value}</p>
      <p className="mt-1 text-[12px] uppercase tracking-[0.15em] text-mist">{label}</p>
    </motion.div>
  )
}

export function ProgressDashboard() {
  const progress = useSessionStore((s) => s.progress)

  if (!progress) {
    return (
      <main className="flex h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display mb-3 text-5xl text-ink">Nothing here yet.</h1>
        <p className="mb-8 max-w-md text-mist">
          Progress appears as you practice — every topic tracks its own mastery, streak and misses.
        </p>
        <Link to="/session" className="pill-solid px-8 py-3 text-lg">
          Start a session
        </Link>
      </main>
    )
  }

  const seen = [...progress.topics].sort((a, b) => Number(b.seen) - Number(a.seen))

  const graded = progress.history.filter((h) => h.verdict && h.verdict !== 'n/a')
  const correct = graded.filter((h) => h.verdict === 'correct').length
  const lessons = progress.history.filter((h) => h.verdict === 'n/a').length
  const accuracy = graded.length ? Math.round((correct / graded.length) * 100) : 0

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-28 sm:px-8">
      <div className="mb-8 flex items-end justify-between">
        <h1 className="font-display text-5xl text-ink">Progress</h1>
        <Link to="/session" className="pill text-[14px]">
          Practice again
        </Link>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile value={String(graded.length)} label="answered" index={0} />
        <StatTile value={String(correct)} label="correct" index={1} />
        <StatTile value={`${accuracy}%`} label="accuracy" index={2} />
        <StatTile value={String(lessons)} label="mini-lessons" index={3} />
      </div>

      <div className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seen.map((t, i) => (
          <TopicCard key={t.topic} t={t} index={i} />
        ))}
      </div>

      {progress.history.length > 0 && (
        <>
          <h2 className="font-display mb-6 text-3xl text-ink">This session</h2>
          <div className="flex flex-col gap-3">
            {[...progress.history].reverse().map((h, i) => (
              // Index key: explain turns share a turn number with the question
              // they interrupted, so h.turn is not unique.
              <HistoryItem key={i} h={h} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
