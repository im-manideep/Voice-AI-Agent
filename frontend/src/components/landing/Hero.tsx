import { useNavigate } from 'react-router-dom'
import { VideoBackground } from './VideoBackground'

export function Hero() {
  const navigate = useNavigate()

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <VideoBackground />

      <div
        className="relative z-10 flex flex-col items-center justify-center px-6 pb-40 text-center"
        style={{ paddingTop: 'calc(8rem - 75px)' }}
      >
        <h1
          className="font-display animate-fade-rise mt-24 max-w-7xl text-5xl font-normal text-ink sm:text-7xl md:text-8xl"
          style={{ lineHeight: 0.95, letterSpacing: '-2.46px' }}
        >
          Beyond <em className="text-mist">silence,</em>
          <br />
          we learn <em className="text-mist">out loud.</em>
        </h1>

        <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed text-mist sm:text-lg">
          A voice coach for AI-engineering interviews. It asks, hears your answer, corrects what
          you missed, and adapts to how you&rsquo;re doing. Through the noise, a calm place for
          deep practice and pure recall.
        </p>

        <button
          type="button"
          onClick={() => navigate('/session')}
          className="animate-fade-rise-delay-2 mt-12 rounded-full bg-ink px-14 py-5 text-base text-paper transition-transform duration-200 hover:scale-[1.03]"
        >
          Begin session
        </button>
      </div>
    </section>
  )
}
