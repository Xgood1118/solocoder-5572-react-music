import * as musicMetadata from 'music-metadata'
import type { Song } from '../types'
import { parseFileName } from '../utils'
import { generateId } from '../utils'

export interface ParsedMetadata {
  title: string
  artist: string
  album: string
  albumArt?: string
  duration: number
  bitrate?: number
  sampleRate?: number
  genre?: string[]
  year?: number
  trackNumber?: number
  discNumber?: number
  lyrics?: string
  comments?: string
}

export async function parseMetadata(file: File): Promise<ParsedMetadata> {
  try {
    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)
    const metadata = await musicMetadata.parseBuffer(uint8Array, {
      mimeType: file.type,
      size: file.size
    })

    const common = metadata.common
    const format = metadata.format

    const fileNameInfo = parseFileName(file.name)

    let albumArt: string | undefined
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0]
      albumArt = `data:${pic.format};base64,${arrayBufferToBase64(pic.data)}`
    }

    const result: ParsedMetadata = {
      title: common.title || fileNameInfo.title || file.name,
      artist: common.artist || fileNameInfo.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      albumArt,
      duration: format.duration || 0,
      bitrate: format.bitrate,
      sampleRate: format.sampleRate,
      genre: common.genre,
      year: common.year,
      trackNumber: common.track?.no ?? undefined,
      discNumber: common.disk?.no ?? undefined,
      lyrics: common.lyrics?.[0],
      comments: common.comment?.join('\n')
    }

    return applyHeuristics(result, file.name)
  } catch (err) {
    console.warn('Metadata parsing failed, using heuristics:', err)
    return parseWithHeuristics(file)
  }
}

function applyHeuristics(metadata: ParsedMetadata, fileName: string): ParsedMetadata {
  const result = { ...metadata }
  const fileNameInfo = parseFileName(fileName)

  if (!result.title || result.title === fileName) {
    result.title = fileNameInfo.title
  }

  if (!result.artist || result.artist === 'Unknown Artist') {
    result.artist = fileNameInfo.artist || 'Unknown Artist'
  }

  if (result.artist && result.artist.toLowerCase() === 'unknown') {
    result.artist = fileNameInfo.artist || 'Unknown Artist'
  }

  if (!result.album || result.album === 'Unknown Album') {
    result.album = 'Unknown Album'
  }

  return result
}

async function parseWithHeuristics(file: File): Promise<ParsedMetadata> {
  const fileNameInfo = parseFileName(file.name)
  const duration = await estimateDuration(file)

  return {
    title: fileNameInfo.title,
    artist: fileNameInfo.artist || 'Unknown Artist',
    album: 'Unknown Album',
    duration,
    bitrate: undefined,
    sampleRate: undefined
  }
}

async function estimateDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    audio.src = url
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration || 0)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    setTimeout(() => {
      URL.revokeObjectURL(url)
      resolve(0)
    }, 5000)
  })
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function generateMetadataHash(song: Partial<Song>): string {
  const str = [
    song.title?.toLowerCase() || '',
    song.artist?.toLowerCase() || '',
    song.album?.toLowerCase() || '',
    Math.round(song.duration || 0)
  ].join('|')

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export function calculateSimilarity(song1: Partial<Song>, song2: Partial<Song>): number {
  let score = 0
  let totalWeight = 0

  const title1 = normalizeString(song1.title || '')
  const title2 = normalizeString(song2.title || '')
  const titleSimilarity = stringSimilarity(title1, title2)
  score += titleSimilarity * 0.35
  totalWeight += 0.35

  const artist1 = normalizeString(song1.artist || '')
  const artist2 = normalizeString(song2.artist || '')
  const artistSimilarity = stringSimilarity(artist1, artist2)
  score += artistSimilarity * 0.3
  totalWeight += 0.3

  const album1 = normalizeString(song1.album || '')
  const album2 = normalizeString(song2.album || '')
  const albumSimilarity = stringSimilarity(album1, album2)
  score += albumSimilarity * 0.2
  totalWeight += 0.2

  const durationDiff = Math.abs((song1.duration || 0) - (song2.duration || 0))
  if (song1.duration && song2.duration) {
    if (durationDiff < 2) {
      score += 0.15
    } else if (durationDiff < 5) {
      score += 0.1
    } else if (durationDiff < 10) {
      score += 0.05
    }
    totalWeight += 0.15
  }

  return totalWeight > 0 ? score / totalWeight : 0
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
}

function stringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1
  if (!s1 || !s2) return 0

  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1

  const longerLength = longer.length
  if (longerLength === 0) return 1

  const edits = levenshteinDistance(longer, shorter)
  return (longerLength - edits) / longerLength
}

function levenshteinDistance(s1: string, s2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[s2.length][s1.length]
}

export function findDuplicates(songs: Song[], threshold: number = 0.85): Array<{ song: Song; duplicates: Song[]; similarity: number }> {
  const results: Array<{ song: Song; duplicates: Song[]; similarity: number }> = []
  const processed = new Set<string>()

  for (let i = 0; i < songs.length; i++) {
    if (processed.has(songs[i].id)) continue

    const duplicates: Song[] = []
    let maxSimilarity = 0

    for (let j = i + 1; j < songs.length; j++) {
      if (processed.has(songs[j].id)) continue

      const similarity = calculateSimilarity(songs[i], songs[j])
      if (similarity >= threshold) {
        duplicates.push(songs[j])
        processed.add(songs[j].id)
        maxSimilarity = Math.max(maxSimilarity, similarity)
      }
    }

    if (duplicates.length > 0) {
      results.push({
        song: songs[i],
        duplicates,
        similarity: maxSimilarity
      })
    }
    processed.add(songs[i].id)
  }

  return results
}
