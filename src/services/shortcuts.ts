export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  category: string
}

export interface Shortcuts {
  playPause: ShortcutConfig
  nextTrack: ShortcutConfig
  prevTrack: ShortcutConfig
  seekForward5: ShortcutConfig
  seekForward15: ShortcutConfig
  seekBackward5: ShortcutConfig
  seekBackward15: ShortcutConfig
  volumeUp: ShortcutConfig
  volumeDown: ShortcutConfig
  mute: ShortcutConfig
  toggleShuffle: ShortcutConfig
  toggleRepeat: ShortcutConfig
  search: ShortcutConfig
  toggleLibrary: ShortcutConfig
  toggleEqualizer: ShortcutConfig
  toggleVisualizer: ShortcutConfig
  toggleLyrics: ShortcutConfig
  toggleFullscreen: ShortcutConfig
}

export const defaultShortcuts: Shortcuts = {
  playPause: { key: ' ', description: '播放/暂停', category: '播放控制' },
  nextTrack: { key: 'ArrowRight', alt: true, description: '下一首', category: '播放控制' },
  prevTrack: { key: 'ArrowLeft', alt: true, description: '上一首', category: '播放控制' },
  seekForward5: { key: 'ArrowRight', description: '快进 5 秒', category: '播放控制' },
  seekForward15: { key: 'ArrowRight', shift: true, description: '快进 15 秒', category: '播放控制' },
  seekBackward5: { key: 'ArrowLeft', description: '快退 5 秒', category: '播放控制' },
  seekBackward15: { key: 'ArrowLeft', shift: true, description: '快退 15 秒', category: '播放控制' },
  volumeUp: { key: 'ArrowUp', description: '音量增加', category: '音量控制' },
  volumeDown: { key: 'ArrowDown', description: '音量减少', category: '音量控制' },
  mute: { key: 'm', description: '静音', category: '音量控制' },
  toggleShuffle: { key: 's', description: '随机播放', category: '播放模式' },
  toggleRepeat: { key: 'r', description: '循环播放', category: '播放模式' },
  search: { key: 'f', ctrl: true, description: '搜索', category: '导航' },
  toggleLibrary: { key: 'l', ctrl: true, description: '音乐库', category: '导航' },
  toggleEqualizer: { key: 'e', ctrl: true, description: '均衡器', category: '视图' },
  toggleVisualizer: { key: 'v', ctrl: true, description: '可视化', category: '视图' },
  toggleLyrics: { key: 'k', ctrl: true, description: '歌词', category: '视图' },
  toggleFullscreen: { key: 'f11', description: '全屏', category: '视图' }
}

export function matchShortcut(event: KeyboardEvent, shortcut: ShortcutConfig): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false
  if (!!shortcut.ctrl !== (event.ctrlKey || event.metaKey)) return false
  if (!!shortcut.shift !== event.shiftKey) return false
  if (!!shortcut.alt !== event.altKey) return false
  return true
}

export function formatShortcut(shortcut: ShortcutConfig): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')

  const keyNames: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'F11': 'F11'
  }

  parts.push(keyNames[shortcut.key] || shortcut.key.toUpperCase())
  return parts.join(' + ')
}

interface ShortcutHandlers {
  onPlayPause?: () => void
  onNextTrack?: () => void
  onPrevTrack?: () => void
  onSeekForward?: (seconds: number) => void
  onSeekBackward?: (seconds: number) => void
  onVolumeUp?: () => void
  onVolumeDown?: () => void
  onMute?: () => void
  onToggleShuffle?: () => void
  onToggleRepeat?: () => void
  onSearch?: () => void
  onToggleLibrary?: () => void
  onToggleEqualizer?: () => void
  onToggleVisualizer?: () => void
  onToggleLyrics?: () => void
  onToggleFullscreen?: () => void
}

export function setupKeyboardShortcuts(handlers: ShortcutHandlers): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      if (event.key !== 'Escape') return
    }

    const s = defaultShortcuts

    if (matchShortcut(event, s.playPause)) {
      event.preventDefault()
      handlers.onPlayPause?.()
    } else if (matchShortcut(event, s.nextTrack)) {
      event.preventDefault()
      handlers.onNextTrack?.()
    } else if (matchShortcut(event, s.prevTrack)) {
      event.preventDefault()
      handlers.onPrevTrack?.()
    } else if (matchShortcut(event, s.seekForward15)) {
      event.preventDefault()
      handlers.onSeekForward?.(15)
    } else if (matchShortcut(event, s.seekForward5)) {
      event.preventDefault()
      handlers.onSeekForward?.(5)
    } else if (matchShortcut(event, s.seekBackward15)) {
      event.preventDefault()
      handlers.onSeekBackward?.(15)
    } else if (matchShortcut(event, s.seekBackward5)) {
      event.preventDefault()
      handlers.onSeekBackward?.(5)
    } else if (matchShortcut(event, s.volumeUp)) {
      event.preventDefault()
      handlers.onVolumeUp?.()
    } else if (matchShortcut(event, s.volumeDown)) {
      event.preventDefault()
      handlers.onVolumeDown?.()
    } else if (matchShortcut(event, s.mute)) {
      event.preventDefault()
      handlers.onMute?.()
    } else if (matchShortcut(event, s.toggleShuffle)) {
      event.preventDefault()
      handlers.onToggleShuffle?.()
    } else if (matchShortcut(event, s.toggleRepeat)) {
      event.preventDefault()
      handlers.onToggleRepeat?.()
    } else if (matchShortcut(event, s.search)) {
      event.preventDefault()
      handlers.onSearch?.()
    } else if (matchShortcut(event, s.toggleEqualizer)) {
      event.preventDefault()
      handlers.onToggleEqualizer?.()
    } else if (matchShortcut(event, s.toggleVisualizer)) {
      event.preventDefault()
      handlers.onToggleVisualizer?.()
    } else if (matchShortcut(event, s.toggleLyrics)) {
      event.preventDefault()
      handlers.onToggleLyrics?.()
    } else if (matchShortcut(event, s.toggleFullscreen)) {
      event.preventDefault()
      handlers.onToggleFullscreen?.()
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}
