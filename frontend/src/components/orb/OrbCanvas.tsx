import { Component, Suspense, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Orb } from './Orb'
import { StaticOrb } from './StaticOrb'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'
import { useVoiceStore } from '../../store/voiceStore'

class CanvasErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export function OrbCanvas({ className = '' }: { className?: string }) {
  const reducedMotion = usePrefersReducedMotion()
  const [crashed, setCrashed] = useState(false)
  const hasWebgl = useMemo(webglAvailable, [])
  const thinking = useVoiceStore((s) => s.status === 'thinking')

  if (reducedMotion || !hasWebgl || crashed) {
    return <StaticOrb className={className} />
  }

  return (
    <div className={className} aria-hidden>
      <CanvasErrorBoundary fallback={<StaticOrb className="h-full w-full" />}>
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [0, 0, 3.1], fov: 45 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', () => setCrashed(true))
          }}
        >
          <Suspense fallback={null}>
            <Orb />
            {thinking && (
              // Particles drifting inward while the coach thinks.
              <Sparkles count={90} scale={3.4} size={2.2} speed={0.35} color="#8b7cf6" opacity={0.7} />
            )}
            <EffectComposer>
              <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.25} luminanceSmoothing={0.3} />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  )
}
