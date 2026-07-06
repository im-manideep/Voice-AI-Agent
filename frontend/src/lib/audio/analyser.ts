// Mic capture + AnalyserNode. Created ONLY on user gesture (Start a session).
// Idempotent singleton — safe under React 19 StrictMode double-mounts.

let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let stream: MediaStream | null = null
let timeData: Uint8Array<ArrayBuffer> | null = null

export async function initMic(): Promise<void> {
  if (analyser && stream?.active) return
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  })
  ctx = ctx ?? new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  const source = ctx.createMediaStreamSource(stream)
  analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.6
  source.connect(analyser)
  timeData = new Uint8Array(analyser.fftSize)
}

export function isMicReady(): boolean {
  return !!analyser && !!stream?.active
}

/** 0..~1 RMS of the mic signal right now. */
export function getRms(): number {
  if (!analyser || !timeData) return 0
  analyser.getByteTimeDomainData(timeData)
  let sum = 0
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / timeData.length)
}

/** Mute = disable the track (visible, reversible; keeps permission). */
export function setMicEnabled(enabled: boolean): void {
  stream?.getAudioTracks().forEach((t) => (t.enabled = enabled))
}

export function stopMic(): void {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  analyser = null
}
