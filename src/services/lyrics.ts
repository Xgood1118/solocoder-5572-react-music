import type { LyricLine, LyricsData } from '../types'
import { getLyrics, saveLyrics } from './db'

export function parseLRC(lrcText: string): LyricLine[] {
  const lines = lrcText.split('\n')
  const result: LyricLine[] = []
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g

  for (const line of lines) {
    const matches = [...line.matchAll(timeRegex)]
    if (matches.length === 0) continue

    const text = line.replace(timeRegex, '').trim()
    if (!text) continue

    for (const match of matches) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      const milliseconds = parseInt(match[3].padEnd(3, '0'))
      const time = minutes * 60 + seconds + milliseconds / 1000

      result.push({ time, text })
    }
  }

  return result.sort((a, b) => a.time - b.time)
}

export function parseLRCWithTranslation(lrcText: string, translationText?: string): LyricLine[] {
  const originalLines = parseLRC(lrcText)
  if (!translationText) return originalLines

  const translationLines = parseLRC(translationText)

  return originalLines.map(line => {
    const translation = translationLines.find(t => Math.abs(t.time - line.time) < 0.3)
    return {
      ...line,
      translation: translation?.text
    }
  })
}

export function findCurrentLyricIndex(lines: LyricLine[], currentTime: number): number {
  let low = 0
  let high = lines.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (lines[mid].time <= currentTime) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return Math.max(0, low - 1)
}

export async function fetchLyricsOnline(title: string, artist: string): Promise<LyricsData | null> {
  try {
    const searchQuery = encodeURIComponent(`${artist} ${title} lyrics`)
    const response = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    )

    if (response.ok) {
      const data = await response.json()
      if (data.lyrics) {
        return {
          lines: data.lyrics.split('\n').map((text: string, i: number) => ({
            time: i * 5,
            text: text.trim()
          })).filter((l: LyricLine) => l.text),
          source: 'online'
        }
      }
    }
  } catch (err) {
    console.warn('Online lyrics fetch failed:', err)
  }
  return null
}

export async function getSongLyrics(songId: string, title: string, artist: string): Promise<LyricsData> {
  try {
    const cached = await getLyrics(songId)
    if (cached && cached.lyrics) {
      const lines = parseLRC(cached.lyrics)
      if (lines.length > 0) {
        return { lines, source: 'local' }
      }
    }
  } catch {}

  const online = await fetchLyricsOnline(title, artist)
  if (online) {
    try {
      const lrcText = online.lines.map(l => `[${formatTime(l.time)}]${l.text}`).join('\n')
      await saveLyrics(songId, lrcText, 'online')
    } catch {}
    return online
  }

  return { lines: [], source: 'none' }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

export function generateRomanji(japaneseText: string): string {
  return japaneseText
}

export function hasTimeStamps(lines: LyricLine[]): boolean {
  if (lines.length < 2) return false
  return lines.some((line, i) => i > 0 && line.time > lines[i - 1].time && line.time > 0)
}
