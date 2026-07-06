import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioBus } from '../../lib/audio/audioBus'
import { orbFragmentShader, orbVertexShader } from './orbShaders'
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
const LOOKS: Record<VoiceStatus, Look> = {
  idle: {
    colorA: new THREE.Color('#2dd4bf'),
    colorB: new THREE.Color('#8b7cf6'),
    displace: 0.1,
    gain: 0.3,
    speed: 0.16,
    noiseScale: 1.6,
    brightness: 0.55,
  },
  listening: {
    colorA: new THREE.Color('#eafffb'), // cool white-teal — their voice
    colorB: new THREE.Color('#2dd4bf'),
    displace: 0.13,
    gain: 0.95,
    speed: 0.4,
    noiseScale: 2.2,
    brightness: 0.95,
  },
  thinking: {
    colorA: new THREE.Color('#8b7cf6'),
    colorB: new THREE.Color('#3d3282'),
    displace: 0.07,
    gain: 0.2,
    speed: 0.24,
    noiseScale: 1.3,
    brightness: 0.65,
  },
  speaking: {
    colorA: new THREE.Color('#b9a5ff'), // warmer violet — the coach's voice
    colorB: new THREE.Color('#2dd4bf'),
    displace: 0.12,
    gain: 0.8,
    speed: 0.34,
    noiseScale: 1.9,
    brightness: 1.0,
  },
}

export function Orb() {
  const material = useRef<THREE.ShaderMaterial>(null)
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
  })

  return (
    <mesh>
      <icosahedronGeometry args={[1, 48]} />
      <shaderMaterial
        ref={material}
        vertexShader={orbVertexShader}
        fragmentShader={orbFragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}
