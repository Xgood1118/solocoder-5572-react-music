import { useState, useRef, useEffect } from 'react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onFocus?: () => void
}

export function SearchBar({
  value,
  onChange,
  placeholder = '搜索歌曲、艺术家、专辑...',
  onFocus
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="search-bar" role="search">
      <span className="search-icon" aria-hidden="true">🔍</span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="搜索"
        onFocus={onFocus}
      />
      {value && (
        <button
          className="search-clear"
          onClick={() => onChange('')}
          aria-label="清除搜索"
        >
          ✕
        </button>
      )}
    </div>
  )
}
