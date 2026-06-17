import { useEffect, useRef, useState, useCallback } from 'react'
import type { VisualizerType } from '../types'

interface VisualizerProps {
  audioContext: AudioContext | null
  analyser: AnalyserNode | null
  type: VisualizerType
  beatSync?: boolean
  mouseInteraction?: boolean
  sensitivity?: number
  primaryColor?: string
  isPlaying?: boolean
}

export function Visualizer({
  audioContext,
  analyser,
  type,
  beatSync = true,
  mouseInteraction = true,
  sensitivity = 0.7,
  primaryColor = '#6366f1',
  isPlaying = false
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const mousePos = useRef({ x: 0, y: 0 })
  const particles = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number }>>([])
  const beatIntensity = useRef(0)
  const prevLevel = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser) {
      animationRef.current = requestAnimationFrame(draw)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    const frequencyData = new Uint8Array(analyser.frequencyBinCount)
    const timeData = new Uint8Array(analyser.fftSize)
    analyser.getByteFrequencyData(frequencyData)
    analyser.getByteTimeDomainData(timeData)

    const avgLevel = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length
    const lowFreqLevel = frequencyData.slice(0, frequencyData.length / 4).reduce((a, b) => a + b, 0) / (frequencyData.length / 4)
    
    if (beatSync && isPlaying) {
      const beat = Math.max(0, lowFreqLevel - prevLevel.current) / 255
      beatIntensity.current = Math.min(1, beatIntensity.current * 0.9 + beat * sensitivity * 2)
    } else {
      beatIntensity.current *= 0.95
    }
    prevLevel.current = lowFreqLevel

    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, adjustColor(primaryColor, -20))
    gradient.addColorStop(0.5, primaryColor)
    gradient.addColorStop(1, adjustColor(primaryColor, -40))

    switch (type) {
      case 'spectrum':
        drawSpectrum(ctx, frequencyData, width, height, gradient, beatIntensity.current)
        break
      case 'waveform':
        drawWaveform(ctx, timeData, width, height, primaryColor, beatIntensity.current)
        break
      case 'circular':
        drawCircular(ctx, frequencyData, width, height, gradient, beatIntensity.current, mousePos.current)
        break
      case 'flame':
        drawFlame(ctx, frequencyData, width, height, primaryColor, beatIntensity.current)
        break
      case 'particles':
        drawParticles(ctx, frequencyData, width, height, primaryColor, beatIntensity.current, particles.current)
        break
      case 'starfield':
        drawStarfield(ctx, frequencyData, width, height, primaryColor, beatIntensity.current)
        break
    }

    if (mouseInteraction && particles.current.length > 0) {
      updateParticles(particles.current, width, height)
    }

    animationRef.current = requestAnimationFrame(draw)
  }, [analyser, type, beatSync, mouseInteraction, sensitivity, primaryColor, isPlaying])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }
    }

    resize()
    window.addEventListener('resize', resize)

    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animationRef.current)
  }, [draw])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mousePos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mouseInteraction) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.5
      const speed = 2 + Math.random() * 4
      particles.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 3 + Math.random() * 5
      })
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="visualizer-canvas"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      style={{ cursor: mouseInteraction ? 'pointer' : 'default' }}
      aria-label={`音频可视化 - ${type}`}
      role="img"
    />
  )
}

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
  gradient: CanvasGradient,
  beatIntensity: number
) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.fillRect(0, 0, width, height)

  const barCount = Math.min(128, data.length)
  const barWidth = width / barCount
  const gap = 2

  for (let i = 0; i < barCount; i++) {
    const idx = Math.floor(i * data.length / barCount)
    const value = data[idx]
    const barHeight = (value / 255) * height * 0.85

    const x = i * barWidth
    const y = height - barHeight

    ctx.fillStyle = gradient
    ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight)

    if (beatIntensity > 0.3) {
      ctx.shadowColor = getColorFromGradient(gradient, i / barCount)
      ctx.shadowBlur = beatIntensity * 15
    }
  }
  ctx.shadowBlur = 0
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
  color: string,
  beatIntensity: number
) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.fillRect(0, 0, width, height)

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 2 + beatIntensity * 2

  if (beatIntensity > 0.3) {
    ctx.shadowColor = color
    ctx.shadowBlur = beatIntensity * 20
  }

  const sliceWidth = width / data.length
  let x = 0

  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0
    const y = (v * height) / 2

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }

    x += sliceWidth
  }

  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.globalAlpha = 0.3
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, height / 2)
  let x2 = 0
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0
    const y = (v * height) / 2
    ctx.lineTo(x2, y)
    x2 += sliceWidth
  }
  ctx.lineTo(width, height / 2)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawCircular(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
  gradient: CanvasGradient,
  beatIntensity: number,
  mousePos: { x: number; y: number }
) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.fillRect(0, 0, width, height)

  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) * 0.25
  const bars = 180

  if (beatIntensity > 0.3) {
    ctx.shadowColor = getColorFromGradient(gradient, 0.5)
    ctx.shadowBlur = beatIntensity * 30
  }

  for (let i = 0; i < bars; i++) {
    const idx = Math.floor(i * data.length / bars)
    const value = data[idx]
    const barHeight = (value / 255) * radius * 1.5

    const angle = (i / bars) * Math.PI * 2 - Math.PI / 2

    const x1 = centerX + Math.cos(angle) * radius
    const y1 = centerY + Math.sin(angle) * radius
    const x2 = centerX + Math.cos(angle) * (radius + barHeight)
    const y2 = centerY + Math.sin(angle) * (radius + barHeight)

    ctx.strokeStyle = gradient
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0
}

function drawFlame(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
  color: string,
  beatIntensity: number
) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
  ctx.fillRect(0, 0, width, height)

  const avgLevel = data.reduce((a, b) => a + b, 0) / data.length
  const intensity = (avgLevel / 255) * beatIntensity

  const baseY = height * 0.9
  const flameCount = 7

  for (let f = 0; f < flameCount; f++) {
    const x = (width / (flameCount + 1)) * (f + 1)
    const dataIdx = Math.floor((f / flameCount) * data.length)
    const heightMult = 0.5 + (data[dataIdx] / 255) * 0.5 + intensity * 0.5

    const flameHeight = height * 0.4 * heightMult
    const flameWidth = 30 + data[dataIdx] / 255 * 40

    const flameGradient = ctx.createLinearGradient(x, baseY, x, baseY - flameHeight)
    flameGradient.addColorStop(0, 'rgba(255, 200, 50, 0.9)')
    flameGradient.addColorStop(0.4, 'rgba(255, 100, 30, 0.7)')
    flameGradient.addColorStop(0.7, 'rgba(200, 30, 30, 0.4)')
    flameGradient.addColorStop(1, 'rgba(100, 0, 100, 0)')

    ctx.fillStyle = flameGradient
    ctx.beginPath()
    ctx.moveTo(x - flameWidth / 2, baseY)
    ctx.quadraticCurveTo(x - flameWidth * 0.3, baseY - flameHeight * 0.5, x, baseY - flameHeight)
    ctx.quadraticCurveTo(x + flameWidth * 0.3, baseY - flameHeight * 0.5, x + flameWidth / 2, baseY)
    ctx.closePath()
    ctx.fill()
  }

  if (intensity > 0.3) {
    ctx.shadowColor = '#ff6600'
    ctx.shadowBlur = intensity * 40
    ctx.fillStyle = `rgba(255, 150, 50, ${intensity * 0.1})`
    ctx.fillRect(0, 0, width, height)
    ctx.shadowBlur = 0
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
  color: string,
  beatIntensity: number,
  staticParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number }>
) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
  ctx.fillRect(0, 0, width, height)

  const avgLevel = data.reduce((a, b) => a + b, 0) / data.length
  const spawnRate = Math.floor((avgLevel / 255) * beatIntensity * 5)

  for (let i = 0; i < spawnRate; i++) {
    staticParticles.push({
      x: width / 2 + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1,
      size: 2 + Math.random() * 4
    })
  }

  for (let i = staticParticles.length - 1; i >= 0; i--) {
    const p = staticParticles[i]
    p.x += p.vx
    p.y += p.vy
    p.life -= 0.01

    if (p.life <= 0) {
      staticParticles.splice(i, 1)
      continue
    }

    ctx.globalAlpha = p.life
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawStarfield(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
  color: string,
  beatIntensity: number
) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.fillRect(0, 0, width, height)

  const starCount = 200
  const avgLevel = data.reduce((a, b) => a + b, 0) / data.length

  for (let i = 0; i < starCount; i++) {
    const seed = i * 9999
    const x = (seed % width)
    const y = ((seed * 7) % height)
    const dataIdx = Math.floor((i / starCount) * data.length)
    const brightness = 0.3 + (data[dataIdx] / 255) * 0.7

    const size = 0.5 + Math.random() * 2

    const pulse = beatIntensity > 0.2 ? (Math.sin(Date.now() / 500 + i) * 0.3 + 0.7) : 1

    ctx.globalAlpha = brightness * pulse
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, size * brightness, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  if (beatIntensity > 0.4) {
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.min(width, height) * 0.5
    )
    gradient.addColorStop(0, `rgba(255, 255, 255, ${beatIntensity * 0.1})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
}

function updateParticles(
  particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number }>,
  width: number,
  height: number
) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.05
    p.life -= 0.02

    if (p.life <= 0 || p.x < 0 || p.x > width || p.y > height) {
      particles.splice(i, 1)
    }
  }
}

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return '#' + (
    0x1000000 +
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1)
}

function getColorFromGradient(gradient: CanvasGradient, position: number): string {
  return '#6366f1'
}
