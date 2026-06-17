import type { Song, EffectConfig } from '../types'
import { EQ_FREQUENCIES } from '../constants'
import { clamp, lerp } from '../utils'

export class AudioEngine {
  private audioContext: AudioContext | null = null
  private sourceNode: AudioBufferSourceNode | null = null
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private eqFilters: BiquadFilterNode[] = []
  private effectNodes: Map<string, AudioNode> = new Map()
  private convolverNode: ConvolverNode | null = null
  private compressorNode: DynamicsCompressorNode | null = null
  private stereoPannerNode: StereoPannerNode | null = null
  private currentSong: Song | null = null
  private audioBuffer: AudioBuffer | null = null
  private isPlaying = false
  private startTime = 0
  private pauseTime = 0
  private volume = 0.7
  private muted = false
  private onTimeUpdate?: (time: number) => void
  private onEnded?: () => void
  private animationFrameId: number | null = null
  private targetEqBands: number[] = new Array(10).fill(0)
  private currentEqBands: number[] = new Array(10).fill(0)
  private eqSmoothing = 0.1
  private fileUrl: string | null = null

  constructor() {
    this.initAudioContext()
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.gainNode = this.audioContext.createGain()
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 2048

      this.createEQFilters()
      this.createEffectNodes()
      this.connectGraph()

      this.gainNode.gain.value = this.muted ? 0 : this.volume
    } catch (err) {
      console.error('Failed to initialize AudioContext:', err)
    }
  }

  private createEQFilters() {
    if (!this.audioContext) return

    this.eqFilters = EQ_FREQUENCIES.map((freq, index) => {
      const filter = this.audioContext!.createBiquadFilter()
      filter.type = index === 0 ? 'lowshelf' :
                    index === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking'
      filter.frequency.value = freq
      filter.Q.value = 1
      filter.gain.value = 0
      return filter
    })
  }

  private createEffectNodes() {
    if (!this.audioContext) return

    this.convolverNode = this.audioContext.createConvolver()
    this.createReverbImpulse(2, 2)

    this.compressorNode = this.audioContext.createDynamicsCompressor()

    if (this.audioContext.createStereoPanner) {
      this.stereoPannerNode = this.audioContext.createStereoPanner()
    }
  }

  private createReverbImpulse(decay: number, wet: number) {
    if (!this.audioContext || !this.convolverNode) return

    const sampleRate = this.audioContext.sampleRate
    const length = sampleRate * decay
    const impulse = this.audioContext.createBuffer(2, length, sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const envelope = Math.pow(1 - i / length, wet)
        channelData[i] = (Math.random() * 2 - 1) * envelope * 0.1
      }
    }

    this.convolverNode.buffer = impulse
  }

  private connectGraph() {
    if (!this.audioContext || !this.gainNode || !this.analyserNode) return

    if (this.sourceNode) {
      this.sourceNode.disconnect()
    }

    let current: AudioNode = this.gainNode

    for (let i = 0; i < this.eqFilters.length; i++) {
      current.connect(this.eqFilters[i])
      current = this.eqFilters[i]
    }

    current.connect(this.analyserNode)
    this.analyserNode.connect(this.audioContext.destination)
  }

  private reconnectWithEffects(effects: EffectConfig[]) {
    if (!this.audioContext || !this.gainNode) return

    const activeEffects = effects
      .filter(e => e.enabled)
      .sort((a, b) => a.order - b.order)

    for (let i = this.eqFilters.length - 1; i >= 0; i--) {
      try { this.eqFilters[i].disconnect() } catch {}
    }

    let current: AudioNode = this.gainNode
    for (let i = 0; i < this.eqFilters.length; i++) {
      current.connect(this.eqFilters[i])
      current = this.eqFilters[i]
    }

    for (const effect of activeEffects) {
      const node = this.effectNodes.get(effect.type)
      if (node) {
        current.connect(node)
        current = node
      }
    }

    if (this.analyserNode) {
      current.connect(this.analyserNode)
      this.analyserNode.connect(this.audioContext.destination)
    }
  }

  async loadSong(song: Song, file: File | null): Promise<void> {
    if (!this.audioContext) {
      this.initAudioContext()
    }

    if (!this.audioContext) {
      throw new Error('AudioContext not available')
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    this.stop()
    this.currentSong = song

    if (file) {
      if (this.fileUrl) {
        URL.revokeObjectURL(this.fileUrl)
      }
      this.fileUrl = URL.createObjectURL(file)

      try {
        const arrayBuffer = await file.arrayBuffer()
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0))
      } catch (err) {
        console.warn('decodeAudioData failed, falling back to HTMLAudioElement', err)
        this.audioBuffer = null
      }
    }
  }

  play(offset?: number): void {
    if (!this.audioContext || !this.currentSong) return

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    if (this.audioBuffer) {
      this.playFromBuffer(offset)
    } else {
      this.playFromFileUrl(offset)
    }
  }

  private playFromBuffer(offset?: number): void {
    if (!this.audioContext || !this.audioBuffer || !this.gainNode) return

    this.stop()

    this.sourceNode = this.audioContext.createBufferSource()
    this.sourceNode.buffer = this.audioBuffer
    this.sourceNode.connect(this.gainNode)

    const startTime = offset || this.pauseTime || 0
    this.sourceNode.start(0, startTime)
    this.startTime = this.audioContext.currentTime - startTime
    this.isPlaying = true

    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false
        this.onEnded?.()
      }
    }

    this.startTimeUpdate()
  }

  private playFromFileUrl(offset?: number): void {
    if (!this.fileUrl || !this.audioContext) return
  }

  pause(): void {
    if (!this.isPlaying || !this.audioContext) return

    if (this.sourceNode) {
      this.pauseTime = this.audioContext.currentTime - this.startTime
      this.sourceNode.stop()
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    this.isPlaying = false
    this.stopTimeUpdate()
  }

  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop()
      } catch {}
      this.sourceNode.disconnect()
      this.sourceNode = null
    }
    this.isPlaying = false
    this.pauseTime = 0
    this.stopTimeUpdate()
  }

  seek(time: number): void {
    if (!this.audioBuffer && !this.fileUrl) return

    const wasPlaying = this.isPlaying
    this.pauseTime = clamp(time, 0, this.getDuration())

    if (wasPlaying) {
      this.play(this.pauseTime)
    }
  }

  private startTimeUpdate(): void {
    const update = () => {
      if (this.isPlaying && this.audioContext) {
        const currentTime = this.audioContext.currentTime - this.startTime
        this.onTimeUpdate?.(currentTime)
      }
      this.animationFrameId = requestAnimationFrame(update)
    }
    this.animationFrameId = requestAnimationFrame(update)
  }

  private stopTimeUpdate(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  getCurrentTime(): number {
    if (!this.isPlaying || !this.audioContext) {
      return this.pauseTime || 0
    }
    return this.audioContext.currentTime - this.startTime
  }

  getDuration(): number {
    if (this.audioBuffer) {
      return this.audioBuffer.duration
    }
    return this.currentSong?.duration || 0
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1)
    if (this.gainNode && !this.muted) {
      this.gainNode.gain.setTargetAtTime(this.volume, this.audioContext?.currentTime || 0, 0.01)
    }
  }

  getVolume(): number {
    return this.volume
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.gainNode) {
      const targetValue = muted ? 0 : this.volume
      this.gainNode.gain.setTargetAtTime(targetValue, this.audioContext?.currentTime || 0, 0.05)
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  setEqBands(bands: number[], smooth: boolean = true): void {
    this.targetEqBands = [...bands]
    if (!smooth) {
      this.currentEqBands = [...bands]
      this.applyEqBands()
    } else {
      this.smoothEqTransition()
    }
  }

  private smoothEqTransition(): void {
    const animate = () => {
      let allDone = true
      for (let i = 0; i < 10; i++) {
        const diff = this.targetEqBands[i] - this.currentEqBands[i]
        if (Math.abs(diff) > 0.01) {
          this.currentEqBands[i] = lerp(this.currentEqBands[i], this.targetEqBands[i], this.eqSmoothing)
          allDone = false
        } else {
          this.currentEqBands[i] = this.targetEqBands[i]
        }
      }
      this.applyEqBands()
      if (!allDone) {
        requestAnimationFrame(animate)
      }
    }
    animate()
  }

  private applyEqBands(): void {
    for (let i = 0; i < this.eqFilters.length && i < this.currentEqBands.length; i++) {
      this.eqFilters[i].gain.value = this.currentEqBands[i]
    }
  }

  setEqBand(index: number, gain: number): void {
    if (index >= 0 && index < this.eqFilters.length) {
      this.targetEqBands[index] = clamp(gain, -12, 12)
      this.smoothEqTransition()
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  setEffects(effects: EffectConfig[]): void {
    this.reconnectWithEffects(effects)
  }

  setReverbParams(decay: number, wet: number): void {
    this.createReverbImpulse(decay, wet)
  }

  setCompressorParams(threshold: number, ratio: number, attack: number, release: number): void {
    if (this.compressorNode) {
      this.compressorNode.threshold.value = threshold
      this.compressorNode.ratio.value = ratio
      this.compressorNode.attack.value = attack
      this.compressorNode.release.value = release
    }
  }

  setStereoWidth(width: number): void {
    if (this.stereoPannerNode) {
      this.stereoPannerNode.pan.value = clamp(width, -1, 1)
    }
  }

  setOnTimeUpdate(callback: (time: number) => void): void {
    this.onTimeUpdate = callback
  }

  setOnEnded(callback: () => void): void {
    this.onEnded = callback
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  getCurrentSong(): Song | null {
    return this.currentSong
  }

  async resumeContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  destroy(): void {
    this.stop()
    if (this.fileUrl) {
      URL.revokeObjectURL(this.fileUrl)
      this.fileUrl = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0)
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount)
    this.analyserNode.getByteFrequencyData(dataArray)
    return dataArray
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0)
    const dataArray = new Uint8Array(this.analyserNode.fftSize)
    this.analyserNode.getByteTimeDomainData(dataArray)
    return dataArray
  }
}

let audioEngineInstance: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!audioEngineInstance) {
    audioEngineInstance = new AudioEngine()
  }
  return audioEngineInstance
}
