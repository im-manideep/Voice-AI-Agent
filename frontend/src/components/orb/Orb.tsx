import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioBus } from '../../lib/audio/audioBus'
import {
  haloFragmentShader,
  haloVertexShader,
  orbFragmentShader,
  orbVertexShader,
} from './orbShaders'
import type { VoiceStatus } from '../../store/voiceStore'

interface Look {
  colorA: THREE.Color
  colorB: THREE.Color
  displace: number
  gain: number
  speed: number
  noiseScale: number
  brightness: number
}

// Distinct personality per voice state. Colors are tuned for the WHITE page:
// a dark glassy body with saturated teal/violet rims reads like polished
// marble on paper. Displacement is kept low: ripple, not blob.
const LOOKS: Record<VoiceStatus, Look> = {
  idle: {
    colorA: new THREE.Color('#0d9488'),
    colorB: new THREE.Color('#6d28d9'),
    displace: 0.05,
    gain: 0.3,
    speed: 0.14,
    noiseScale: 1.9,
    brightness: 0.85,
  },
  listening: {
    colorA: new THREE.Color('#14b8a6'), // vivid teal — their voice
    colorB: new THREE.Color('#0f766e'),
    displace: 0.08,
    gain: 0.62,
    speed: 0.42,
    noiseScale: 2.5,
    brightness: 1.25,
  },
  thinking: {
    colorA: new THREE.Color('#7c3aed'),
    colorB: new THREE.Color('#4c1d95'),
    displace: 0.04,
    gain: 0.18,
    speed: 0.22,
    noiseScale: 1.5,
    brightness: 0.95,
  },
  speaking: {
    colorA: new THREE.Color('#8b5cf6'), // warm violet — the coach's voice
    colorB: new THREE.Color('#0d9488'),
    displace: 0.07,
    gain: 0.52,
    speed: 0.32,
    noiseScale: 2.2,
    brightness: 1.35,
  },
}

const DEEP = new THREE.Color('#1e1b4b') // the dark glassy body (indigo-950)

export function Orb() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const halo = useRef<THREE.ShaderMaterial>(null)
  const time = useRef(0)
  const speed = useRef(LOOKS.idle.speed)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uDisplace: { value: LOOKS.idle.displace },
      uGain: { value: LOOKS.idle.gain },
      uNoiseScale: { value: LOOKS.idle.noiseScale },
      uBrightness: { value: LOOKS.idle.brightness },
      uColorA: { value: LOOKS.idle.colorA.clone() },
      uColorB: { value: LOOKS.idle.colorB.clone() },
      uColorDeep: { value: DEEP.clone() },
    }),
    [],
  )

  const haloUniforms = useMemo(
    () => ({
      uColorA: { value: LOOKS.idle.colorA.clone() },
      uColorB: { value: LOOKS.idle.colorB.clone() },
      uStrength: { value: 0.35 },
    }),
    [],
  )

  useFrame((state, delta) => {
    if (!material.current) return
    const u = material.current.uniforms
    const look = LOOKS[audioBus.mode] ?? LOOKS.idle

    // Ease every parameter toward the current look — never snap.
    const k = Math.min(1, delta * 4)
    speed.current += (look.speed - speed.current) * k
    time.current += delta * speed.current
    u.uTime.value = time.current
    u.uDisplace.value += (look.displace - u.uDisplace.value) * k
    u.uGain.value += (look.gain - u.uGain.value) * k
    u.uNoiseScale.value += (look.noiseScale - u.uNoiseScale.value) * k
    u.uBrightness.value += (look.brightness - u.uBrightness.value) * k
    ;(u.uColorA.value as THREE.Color).lerp(look.colorA, k)
    ;(u.uColorB.value as THREE.Color).lerp(look.colorB, k)

    // Live audio while listening/speaking; a slow breath otherwise.
    const breathing = (Math.sin(state.clock.elapsedTime * 1.1) * 0.5 + 0.5) * 0.28
    const target =
      audioBus.mode === 'listening' || audioBus.mode === 'speaking' ? audioBus.level : breathing
    u.uLevel.value += (target - u.uLevel.value) * 0.25

    if (halo.current) {
      const h = halo.current.uniforms
      ;(h.uColorA.value as THREE.Color).lerp(look.colorA, k)
      ;(h.uColorB.value as THREE.Color).lerp(look.colorB, k)
      h.uStrength.value +=
        (look.brightness * 0.28 + u.uLevel.value * 0.3 - h.uStrength.value) * k
    }
  })

  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[1, 48]} />
        <shaderMaterial
          ref={material}
          vertexShader={orbVertexShader}
          fragmentShader={orbFragmentShader}
          uniforms={uniforms}
        />
      </mesh>
      {/* Atmospheric halo just past the silhouette. Normal (alpha) blending —
          additive glow disappears against a white page. */}
      <mesh scale={1.22}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          ref={halo}
          vertexShader={haloVertexShader}
          fragmentShader={haloFragmentShader}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}
