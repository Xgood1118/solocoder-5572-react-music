import type { Song, EffectConfig } from '../types'
import { EQ_FREQUENCIES } from '../constants'
import { clamp, lerp } from '../utils'

export class AudioEngine {
  private audioContext: AudioContext | null = null
  private audioElement: HTMLAudioElement | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private eqFilters: BiquadFilterNode[] = []
  private convolverNode: ConvolverNode | null = null
  private compressorNode: DynamicsCompressorNode | null = null
  private stereoPannerNode: StereoPannerNode | null = null
  private currentSong: Song | null = null
  private isPlaying = false
  private volume = 0.7
  private muted = false
  private onTimeUpdate?: (time: number) => void
  private onEnded?: () => void
  private onLoadedMetadata?: (duration: number) => void
  private animationFrameId: number | null = null
  private targetEqBands: number[] = new Array(10).fill(0)
  private currentEqBands: number[] = new Array(10).fill(0)
  private eqSmoothing = 0.08
  private isInitialized = false
  private effectsEnabled: Set<string> = new Set()

  constructor() {
    this.audioElement = new Audio()
    this.audioElement.crossOrigin = 'anonymous'
    this.audioElement.preload = 'auto'

    this.audioElement.addEventListener('timeupdate', () => {
      if (this.audioElement) {
        this.onTimeUpdate?.(this.audioElement.currentTime)
      }
    })

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false
      this.onEnded?.()
    })

    this.audioElement.addEventListener('loadedmetadata', () => {
      if (this.audioElement) {
        this.onLoadedMetadata?.(this.audioElement.duration)
      }
    })

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true
      this.startSmoothEq()
    })

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false
    })
  }

  private async ensureAudioContext(): Promise<void> {
    if (this.isInitialized && this.audioContext) return

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement!)
      this.gainNode = this.audioContext.createGain()
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 2048
      this.analyserNode.smoothingTimeConstant = 0.8

      this.createEQFilters()
      this.createEffectNodes()
      this.connectGraph()

      this.gainNode.gain.value = this.muted ? 0 : this.volume
      this.isInitialized = true
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
      filter.Q.value = 1.4
      filter.gain.value = 0
      return filter
    })
  }

  private createEffectNodes() {
    if (!this.audioContext) return

    this.convolverNode = this.audioContext.createConvolver()
    this.createReverbImpulse(2, 0.3)

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
        const envelope = Math.pow(1 - i / length, wet * 2)
        channelData[i] = (Math.random() * 2 - 1) * envelope * 0.15
      }
    }

    this.convolverNode.buffer = impulse
  }

  private connectGraph() {
    if (!this.audioContext || !this.sourceNode || !this.gainNode || !this.analyserNode) return

    let current: AudioNode = this.sourceNode

    current.connect(this.gainNode)
    current = this.gainNode

    for (let i = 0; i < this.eqFilters.length; i++) {
      current.connect(this.eqFilters[i])
      current = this.eqFilters[i]
    }

    if (this.effectsEnabled.has('compressor') && this.compressorNode) {
      current.connect(this.compressorNode)
      current = this.compressorNode
    }

    if (this.effectsEnabled.has('reverb') && this.convolverNode) {
      const dryGain = this.audioContext.createGain()
      const wetGain = this.audioContext.createGain()
      dryGain.gain.value = 0.7
      wetGain.gain.value = 0.3
      current.connect(dryGain)
      current.connect(this.convolverNode)
      this.convolverNode.connect(wetGain)
      dryGain.connect(this.analyserNode)
      wetGain.connect(this.analyserNode)
      this.analyserNode.connect(this.audioContext.destination)
      return
    }

    if (this.effectsEnabled.has('stereo') && this.stereoPannerNode) {
      current.connect(this.stereoPannerNode)
      current = this.stereoPannerNode
    }

    current.connect(this.analyserNode)
    this.analyserNode.connect(this.audioContext.destination)
  }

  private reconnectGraph() {
    if (!this.audioContext || !this.sourceNode || !this.gainNode) return

    try {
      for (let i = 0; i < this.eqFilters.length; i++) {
        this.eqFilters[i].disconnect()
      }
      if (this.compressorNode) this.compressorNode.disconnect()
      if (this.convolverNode) this.convolverNode.disconnect()
      if (this.stereoPannerNode) this.stereoPannerNode.disconnect()
      if (this.analyserNode) this.analyserNode.disconnect()
      this.gainNode.disconnect()

      let current: AudioNode = this.sourceNode
      current.connect(this.gainNode)
      current = this.gainNode

      for (let i = 0; i < this.eqFilters.length; i++) {
        current.connect(this.eqFilters[i])
        current = this.eqFilters[i]
      }

      if (this.effectsEnabled.has('compressor') && this.compressorNode) {
        current.connect(this.compressorNode)
        current = this.compressorNode
      }

      if (this.effectsEnabled.has('stereo') && this.stereoPannerNode) {
        current.connect(this.stereoPannerNode)
        current = this.stereoPannerNode
      }

      if (this.effectsEnabled.has('reverb') && this.convolverNode && this.analyserNode) {
        const dryGain = this.audioContext.createGain()
        const wetGain = this.audioContext.createGain()
        dryGain.gain.value = 0.7
        wetGain.gain.value = 0.3

        const splitter = current
        splitter.connect(dryGain)
        splitter.connect(this.convolverNode)
        this.convolverNode.connect(wetGain)

        dryGain.connect(this.analyserNode)
        wetGain.connect(this.analyserNode)
        this.analyserNode.connect(this.audioContext.destination)
      } else {
        current.connect(this.analyserNode!)
        this.analyserNode!.connect(this.audioContext.destination)
      }
    } catch (err) {
      console.warn('Reconnect graph failed:', err)
    }
  }

  async loadSong(song: Song, file?: File, blobUrl?: string): Promise<void> {
    if (!this.audioElement) {
      this.audioElement = new Audio()
    }

    this.currentSong = song

    if (file) {
      const url = URL.createObjectURL(file)
      this.audioElement.src = url
    } else if (blobUrl) {
      this.audioElement.src = blobUrl
    } else {
      throw new Error('No audio source provided')
    }

    try {
      await this.audioElement.load()
    } catch (err) {
      console.warn('Audio load warning:', err)
    }
  }

  async play(offset?: number): Promise<void> {
    if (!this.audioElement) return

    await this.ensureAudioContext()

    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume()
    }

    if (offset !== undefined && this.audioElement) {
      try {
        this.audioElement.currentTime = offset
      } catch {}
    }

    try {
      await this.audioElement.play()
      this.isPlaying = true
      this.startSmoothEq()
    } catch (err) {
      console.error('Play failed:', err)
      throw err
    }
  }

  pause(): void {
    if (!this.audioElement) return
    this.audioElement.pause()
    this.isPlaying = false
  }

  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.currentTime = 0
    }
    this.isPlaying = false
  }

  seek(time: number): void {
    if (!this.audioElement) return
    try {
      this.audioElement.currentTime = clamp(time, 0, this.getDuration())
    } catch (err) {
      console.warn('Seek failed:', err)
    }
  }

  private startSmoothEq(): void {
    if (this.animationFrameId) return

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

      for (let i = 0; i < this.eqFilters.length && i < this.currentEqBands.length; i++) {
        if (this.eqFilters[i]) {
          this.eqFilters[i].gain.value = this.currentEqBands[i]
        }
      }

      if (!allDone || this.isPlaying) {
        this.animationFrameId = requestAnimationFrame(animate)
      } else {
        this.animationFrameId = null
      }
    }

    this.animationFrameId = requestAnimationFrame(animate)
  }

  getCurrentTime(): number {
    return this.audioElement?.currentTime || 0
  }

  getDuration(): number {
    return this.audioElement?.duration || this.currentSong?.duration || 0
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1)
    if (this.gainNode && !this.muted) {
      this.gainNode.gain.setTargetAtTime(this.volume, this.audioContext?.currentTime || 0, 0.02)
    }
    if (this.audioElement) {
      this.audioElement.volume = this.volume
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
    if (this.audioElement) {
      this.audioElement.muted = muted
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  setEqBands(bands: number[], smooth: boolean = true): void {
    this.targetEqBands = [...bands]
    if (!smooth) {
      this.currentEqBands = [...bands]
      for (let i = 0; i < this.eqFilters.length && i < this.currentEqBands.length; i++) {
        if (this.eqFilters[i]) {
          this.eqFilters[i].gain.value = this.currentEqBands[i]
        }
      }
    } else {
      this.startSmoothEq()
    }
  }

  setEqBand(index: number, gain: number): void {
    if (index >= 0 && index < 10) {
      this.targetEqBands[index] = clamp(gain, -12, 12)
      this.startSmoothEq()
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  setEffects(effects: EffectConfig[]): void {
    this.effectsEnabled.clear()
    for (const effect of effects) {
      if (effect.enabled) {
        this.effectsEnabled.add(effect.type)
      }
    }

    if (this.isInitialized) {
      this.reconnectGraph()
    }
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

  setOnLoadedMetadata(callback: (duration: number) => void): void {
    this.onLoadedMetadata = callback
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
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.src = ''
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
    if (this.audioContext) {
      this.audioContext.close()
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

  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement
  }
}

let audioEngineInstance: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!audioEngineInstance) {
    audioEngineInstance = new AudioEngine()
  }
  return audioEngineInstance
}
