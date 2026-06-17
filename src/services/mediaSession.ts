import type { Song } from '../types'

export function setupMediaSession(): void {
  if (!('mediaSession' in navigator)) return

  navigator.mediaSession.setActionHandler('play', () => {
    const event = new CustomEvent('mediasession-play')
    window.dispatchEvent(event)
  })

  navigator.mediaSession.setActionHandler('pause', () => {
    const event = new CustomEvent('mediasession-pause')
    window.dispatchEvent(event)
  })

  navigator.mediaSession.setActionHandler('previoustrack', () => {
    const event = new CustomEvent('mediasession-prev')
    window.dispatchEvent(event)
  })

  navigator.mediaSession.setActionHandler('nexttrack', () => {
    const event = new CustomEvent('mediasession-next')
    window.dispatchEvent(event)
  })

  navigator.mediaSession.setActionHandler('seekbackward', (details) => {
    const event = new CustomEvent('mediasession-seekbackward', { detail: details })
    window.dispatchEvent(event)
  })

  navigator.mediaSession.setActionHandler('seekforward', (details) => {
    const event = new CustomEvent('mediasession-seekforward', { detail: details })
    window.dispatchEvent(event)
  })

  navigator.mediaSession.setActionHandler('seekto', (details) => {
    const event = new CustomEvent('mediasession-seekto', { detail: details })
    window.dispatchEvent(event)
  })
}

export function updateMediaSession(song: Song | null, isPlaying: boolean, currentTime: number, duration: number): void {
  if (!('mediaSession' in navigator) || !song) return

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: song.album,
    artwork: song.albumArt ? [
      { src: song.albumArt, sizes: '96x96', type: 'image/png' },
      { src: song.albumArt, sizes: '128x128', type: 'image/png' },
      { src: song.albumArt, sizes: '192x192', type: 'image/png' },
      { src: song.albumArt, sizes: '256x256', type: 'image/png' },
      { src: song.albumArt, sizes: '512x512', type: 'image/png' }
    ] : undefined
  })

  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'

  if ('setPositionState' in navigator.mediaSession) {
    try {
      navigator.mediaSession.setPositionState({
        duration: duration || song.duration,
        playbackRate: 1,
        position: currentTime
      })
    } catch (err) {
      console.warn('setPositionState failed:', err)
    }
  }
}

export function updateMediaSessionPlaybackState(isPlaying: boolean): void {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
}

export function registerMediaSessionHandlers(handlers: {
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeekBackward?: (seconds: number) => void
  onSeekForward?: (seconds: number) => void
  onSeekTo?: (time: number) => void
}): () => void {
  const handlePlay = () => handlers.onPlay()
  const handlePause = () => handlers.onPause()
  const handleNext = () => handlers.onNext()
  const handlePrev = () => handlers.onPrev()
  const handleSeekBackward = (e: Event) => {
    const detail = (e as CustomEvent).detail
    handlers.onSeekBackward?.(detail?.seekOffset || 5)
  }
  const handleSeekForward = (e: Event) => {
    const detail = (e as CustomEvent).detail
    handlers.onSeekForward?.(detail?.seekOffset || 5)
  }
  const handleSeekTo = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.seekTime !== undefined) {
      handlers.onSeekTo?.(detail.seekTime)
    }
  }

  window.addEventListener('mediasession-play', handlePlay)
  window.addEventListener('mediasession-pause', handlePause)
  window.addEventListener('mediasession-prev', handlePrev)
  window.addEventListener('mediasession-next', handleNext)
  window.addEventListener('mediasession-seekbackward', handleSeekBackward)
  window.addEventListener('mediasession-seekforward', handleSeekForward)
  window.addEventListener('mediasession-seekto', handleSeekTo)

  return () => {
    window.removeEventListener('mediasession-play', handlePlay)
    window.removeEventListener('mediasession-pause', handlePause)
    window.removeEventListener('mediasession-prev', handlePrev)
    window.removeEventListener('mediasession-next', handleNext)
    window.removeEventListener('mediasession-seekbackward', handleSeekBackward)
    window.removeEventListener('mediasession-seekforward', handleSeekForward)
    window.removeEventListener('mediasession-seekto', handleSeekTo)
  }
}
