import type { Song } from '../types'

class FileCacheService {
  private fileMap: Map<string, File> = new Map()
  private blobUrlMap: Map<string, string> = new Map()
  private handleMap: Map<string, FileSystemFileHandle> = new Map()

  setFile(songId: string, file: File): void {
    this.fileMap.set(songId, file)
  }

  getFile(songId: string): File | null {
    return this.fileMap.get(songId) || null
  }

  setBlobUrl(songId: string, url: string): void {
    this.blobUrlMap.set(songId, url)
  }

  getBlobUrl(songId: string): string | null {
    return this.blobUrlMap.get(songId) || null
  }

  setHandle(songId: string, handle: FileSystemFileHandle): void {
    this.handleMap.set(songId, handle)
  }

  getHandle(songId: string): FileSystemFileHandle | null {
    return this.handleMap.get(songId) || null
  }

  async getFileForSong(song: Song): Promise<File | null> {
    const cachedFile = this.fileMap.get(song.id)
    if (cachedFile) {
      return cachedFile
    }

    const handle = this.handleMap.get(song.id)
    if (handle && 'getFile' in handle) {
      try {
        const file = await handle.getFile()
        this.fileMap.set(song.id, file)
        return file
      } catch (err) {
        console.warn('Failed to get file from handle:', err)
      }
    }

    return null
  }

  createBlobUrl(songId: string, file: File): string {
    const existing = this.blobUrlMap.get(songId)
    if (existing) {
      URL.revokeObjectURL(existing)
    }
    const url = URL.createObjectURL(file)
    this.blobUrlMap.set(songId, url)
    return url
  }

  revokeBlobUrl(songId: string): void {
    const url = this.blobUrlMap.get(songId)
    if (url) {
      URL.revokeObjectURL(url)
      this.blobUrlMap.delete(songId)
    }
  }

  clear(): void {
    for (const url of this.blobUrlMap.values()) {
      URL.revokeObjectURL(url)
    }
    this.fileMap.clear()
    this.blobUrlMap.clear()
    this.handleMap.clear()
  }

  hasFile(songId: string): boolean {
    return this.fileMap.has(songId) || this.handleMap.has(songId)
  }

  removeSong(songId: string): void {
    this.revokeBlobUrl(songId)
    this.fileMap.delete(songId)
    this.handleMap.delete(songId)
  }
}

export const fileCache = new FileCacheService()
