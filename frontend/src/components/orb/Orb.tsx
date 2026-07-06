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

// Distinct personality per voice state — colors stay in the aurora family.
// Displacement is kept low: the orb should ripple, not turn into a blob.
const LOOKS: Record<VoiceStatus, Look> = {
  idle: {
    colorA: new THREE.Color('#2dd4bf'),
    colorB: new THREE.Color('#8b7cf6'),
    displace: 0.05,
    gain: 0.3,
    speed: 0.14,
    noiseScale: 1.9,
    brightness: 0.8,
  },
  listening: {
    colorA: new THREE.Color('#8ffff0'), // cool white-teal — their voice
    colorB: new THREE.Color('#2dd4bf'),
    displace: 0.08,
    gain: 0.62,
    speed: 0.42,
    noiseScale: 2.5,
    brightness: 1.2,
  },
  thinking: {
    colorA: new THREE.Color('#a78bfa'),
    colorB: new THREE.Color('#6d5bd0'),
    displace: 0.04,
    gain: 0.18,
    speed: 0.22,
    noiseScale: 1.5,
    brightness: 0.9,
  },
  speaking: {
    colorA: new THREE.Color('#c7b7ff'), // warmer violet — the coach's voice
    colorB: new THREE.Color('#2dd4bf'),
    displace: 0.07,
    gain: 0.52,
    speed: 0.32,
    noiseScale: 2.2,
    brightness: 1.3,
  },
}

const DEEP = new THREE.Color('#14102a') // the dark glassy body

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
      {/* Atmospheric halo — additive glow just past the silhouette. */}
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
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
