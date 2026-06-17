import { useRef, useEffect, useState } from 'react'
import type { LyricLine, LyricsData } from '../types'
import { findCurrentLyricIndex } from '../services/lyrics'

interface LyricsDisplayProps {
  lyrics: LyricsData | null
  currentTime: number
  showTranslation?: boolean
  showRomanji?: boolean
}

export function LyricsDisplay({
  lyrics,
  currentTime,
  showTranslation = false,
  showRomanji = false
}: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const [showTranslationState, setShowTranslationState] = useState(showTranslation)

  useEffect(() => {
    setShowTranslationState(showTranslation)
  }, [showTranslation])

  useEffect(() => {
    if (!lyrics || lyrics.lines.length === 0) return

    const currentIndex = findCurrentLyricIndex(lyrics.lines, currentTime)
    const activeElement = lineRefs.current[currentIndex]
    const container = containerRef.current

    if (activeElement && container) {
      const containerRect = container.getBoundingClientRect()
      const elementRect = activeElement.getBoundingClientRect()
      const offsetTop = elementRect.top - containerRect.top
      const scrollTop = offsetTop - containerRect.height / 2 + elementRect.height / 2

      container.scrollTo({
        top: container.scrollTop + scrollTop,
        behavior: 'smooth'
      })
    }
  }, [currentTime, lyrics])

  if (!lyrics || lyrics.lines.length === 0) {
    return (
      <div className="lyrics-empty">
        <div className="empty-icon" aria-hidden="true">🎵</div>
        <p>暂无歌词</p>
        <p className="empty-hint">
          {lyrics?.source === 'none'
            ? '未找到该歌曲的歌词'
            : '正在加载歌词...'}
        </p>
      </div>
    )
  }

  const hasTimeStamps = lyrics.lines.some((line, i) =>
    i > 0 && line.time > lyrics.lines[i - 1].time && line.time > 0
  )

  const currentIndex = hasTimeStamps
    ? findCurrentLyricIndex(lyrics.lines, currentTime)
    : -1

  return (
    <div className="lyrics-container" ref={containerRef} role="region" aria-label="歌词显示">
      <div className="lyrics-list">
        {lyrics.lines.map((line, index) => {
          const isActive = index === currentIndex
          const isNear = Math.abs(index - currentIndex) <= 3

          return (
            <div
              key={index}
              ref={(el) => (lineRefs.current[index] = el)}
              className={`lyric-line ${isActive ? 'active' : ''} ${!isNear && hasTimeStamps ? 'dimmed' : ''}`}
            >
              <div className="lyric-text">
                {line.text}
              </div>
              {showTranslationState && line.translation && (
                <div className="lyric-translation">
                  {line.translation}
                </div>
              )}
              {showRomanji && line.romanji && (
                <div className="lyric-romanji">
                  {line.romanji}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {lyrics.source === 'online' && (
        <div className="lyrics-source">
          歌词来源：网络
        </div>
      )}
    </div>
  )
}
