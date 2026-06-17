export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = window.setTimeout(() => func(...args), wait)
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function parseFileName(fileName: string): { title: string; artist?: string } {
  const name = fileName.replace(/\.[^/.]+$/, '')
  const patterns = [
    /^(.+?)\s*-\s*(.+)$/,
    /^(.+?)\s*–\s*(.+)$/,
    /^【(.+?)】(.+)$/,
    /^\[(.+?)\](.+)$/
  ]
  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) {
      return {
        artist: match[1].trim(),
        title: match[2].trim()
      }
    }
  }
  return { title: name }
}

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx > -1 ? fileName.substring(idx).toLowerCase() : ''
}

export function hasAudioExtension(fileName: string): boolean {
  const ext = getExtension(fileName)
  return ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.opus', '.webm'].includes(ext)
}

export function hasLyricExtension(fileName: string): boolean {
  const ext = getExtension(fileName)
  return ['.lrc', '.txt'].includes(ext)
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}
