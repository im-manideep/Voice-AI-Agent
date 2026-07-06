import { motion, useReducedMotion } from 'motion/react'
import { Mic, Sparkles, TrendingUp } from 'lucide-react'

const STEPS = [
  {
    icon: Mic,
    title: 'Speak',
    body: 'The coach asks one question at a time. You answer out loud — it listens and streams your words live.',
  },
  {
    icon: Sparkles,
    title: 'Get graded',
    body: 'Your answer is checked against real study notes. Feedback is specific: what you nailed, and the fact you missed.',
  },
  {
    icon: TrendingUp,
    title: 'It adapts',
    body: 'Miss a topic and it returns within three questions. Nail two in a row and the difficulty climbs.',
  },
]

export function HowItWorks() {
  const reduced = useReducedMotion()
  return (
    <section id="how" className="relative z-10 mx-auto max-w-5xl px-5 pb-28 pt-10 sm:px-8">
      <h2 className="font-display mb-10 text-4xl text-ink sm:text-5xl">How it works</h2>
      <div className="grid gap-5 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="glass p-6"
          >
            <s.icon className="mb-4 h-6 w-6 text-aurora" aria-hidden />
            <h3 className="mb-2 text-xl text-ink">{s.title}</h3>
            <p className="text-[15px] leading-relaxed text-mist">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
