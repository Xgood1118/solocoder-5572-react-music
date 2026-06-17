import type { ThemeMode, ThemeConfig } from '../types'
import { getSetting, setSetting } from './db'
import { DEFAULT_THEME_COLOR, THEME_COLORS } from '../constants'

export const THEMES: Record<ThemeMode, { name: string; description: string }> = {
  light: { name: '亮色', description: '明亮清新的浅色主题' },
  dark: { name: '暗色', description: '护眼的深色主题' },
  cyber: { name: '赛博朋克', description: '霓虹科技感未来风格' },
  retro: { name: '复古', description: '怀旧温暖的复古风格' },
  minimal: { name: '极简', description: '简约干净的黑白风格' }
}

export function applyTheme(theme: ThemeConfig): void {
  document.documentElement.setAttribute('data-theme', theme.mode)
  document.documentElement.style.setProperty('--primary-color', theme.primaryColor)

  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', getThemeBackground(theme.mode))
  }

  applyThemeVariables(theme.mode, theme.primaryColor)
}

function getThemeBackground(mode: ThemeMode): string {
  const backgrounds: Record<ThemeMode, string> = {
    light: '#ffffff',
    dark: '#1a1a2e',
    cyber: '#0d0221',
    retro: '#1a1a1a',
    minimal: '#f5f5f5'
  }
  return backgrounds[mode]
}

function applyThemeVariables(mode: ThemeMode, primaryColor: string): void {
  const root = document.documentElement

  switch (mode) {
    case 'light':
      root.style.setProperty('--bg-primary', '#ffffff')
      root.style.setProperty('--bg-secondary', '#f3f4f6')
      root.style.setProperty('--bg-tertiary', '#e5e7eb')
      root.style.setProperty('--text-primary', '#111827')
      root.style.setProperty('--text-secondary', '#6b7280')
      root.style.setProperty('--text-tertiary', '#9ca3af')
      root.style.setProperty('--border-color', '#e5e7eb')
      root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.1)')
      break

    case 'dark':
      root.style.setProperty('--bg-primary', '#1a1a2e')
      root.style.setProperty('--bg-secondary', '#16213e')
      root.style.setProperty('--bg-tertiary', '#0f3460')
      root.style.setProperty('--text-primary', '#f1f5f9')
      root.style.setProperty('--text-secondary', '#94a3b8')
      root.style.setProperty('--text-tertiary', '#64748b')
      root.style.setProperty('--border-color', '#334155')
      root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)')
      break

    case 'cyber':
      root.style.setProperty('--bg-primary', '#0d0221')
      root.style.setProperty('--bg-secondary', '#1a0533')
      root.style.setProperty('--bg-tertiary', '#2d1b4e')
      root.style.setProperty('--text-primary', '#e0e0ff')
      root.style.setProperty('--text-secondary', '#a0a0cc')
      root.style.setProperty('--text-tertiary', '#6b6b99')
      root.style.setProperty('--border-color', '#3d2066')
      root.style.setProperty('--shadow-color', 'rgba(0, 245, 255, 0.2)')
      break

    case 'retro':
      root.style.setProperty('--bg-primary', '#1a1a1a')
      root.style.setProperty('--bg-secondary', '#2d2d2d')
      root.style.setProperty('--bg-tertiary', '#3d3d3d')
      root.style.setProperty('--text-primary', '#f5e6d3')
      root.style.setProperty('--text-secondary', '#c4a574')
      root.style.setProperty('--text-tertiary', '#8b7355')
      root.style.setProperty('--border-color', '#4a4a4a')
      root.style.setProperty('--shadow-color', 'rgba(255, 107, 53, 0.15)')
      break

    case 'minimal':
      root.style.setProperty('--bg-primary', '#f5f5f5')
      root.style.setProperty('--bg-secondary', '#e8e8e8')
      root.style.setProperty('--bg-tertiary', '#d0d0d0')
      root.style.setProperty('--text-primary', '#1a1a1a')
      root.style.setProperty('--text-secondary', '#4a4a4a')
      root.style.setProperty('--text-tertiary', '#7a7a7a')
      root.style.setProperty('--border-color', '#d0d0d0')
      root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.08)')
      break
  }

  root.style.setProperty('--primary-color', primaryColor)
  root.style.setProperty('--primary-hover', adjustColor(primaryColor, -10))
  root.style.setProperty('--primary-light', adjustColor(primaryColor, 20))
  root.style.setProperty('--primary-glow', `${primaryColor}33`)
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

export async function loadSavedTheme(): Promise<ThemeConfig> {
  try {
    const saved = await getSetting('theme', null)
    if (saved && saved.mode) {
      return saved
    }
  } catch {}

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return {
    mode: prefersDark ? 'dark' : 'light',
    primaryColor: DEFAULT_THEME_COLOR
  }
}

export async function saveTheme(theme: ThemeConfig): Promise<void> {
  try {
    await setSetting('theme', theme)
  } catch {}
}

export function getDefaultPrimaryColor(mode: ThemeMode): string {
  return THEME_COLORS[mode] || DEFAULT_THEME_COLOR
}
