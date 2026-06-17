import type { Song } from '../types'
import { hasAudioExtension, parseFileName, getExtension } from '../utils'
import { parseMetadata } from './metadata'

const HANDLE_DB_NAME = 'music-fs-handles'
const HANDLE_STORE_NAME = 'directory-handles'
const HANDLE_KEY = 'main-library'

export interface FileSystemOptions {
  onProgress?: (current: number, total: number, fileName: string) => void
  onDuplicate?: (existing: Song, newSong: Partial<Song>) => 'skip' | 'replace' | 'merge'
}

export interface ScanResult {
  songs: Song[]
  fileMap: Map<string, File>
  handleMap: Map<string, FileSystemFileHandle>
}

let handleDB: IDBDatabase | null = null

async function getHandleDB(): Promise<IDBDatabase> {
  if (handleDB) return handleDB

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        db.createObjectStore(HANDLE_STORE_NAME)
      }
    }

    request.onsuccess = () => {
      handleDB = request.result
      resolve(handleDB)
    }

    request.onerror = () => reject(request.error)
  })
}

async function saveHandleToDB(handle: FileSystemDirectoryHandle, name: string = HANDLE_KEY): Promise<void> {
  try {
    const db = await getHandleDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite')
      tx.objectStore(HANDLE_STORE_NAME).put(handle, name)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('Failed to save handle to DB:', err)
  }
}

async function getHandleFromDB(name: string = HANDLE_KEY): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await getHandleDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readonly')
      const request = tx.objectStore(HANDLE_STORE_NAME).get(name)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('Failed to get handle from DB:', err)
    return null
  }
}

async function verifyHandlePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const opts = { mode: 'read' as const }
    const result = await (handle as any).queryPermission?.(opts)

    if (result === 'granted') {
      return true
    }

    if (result === 'prompt') {
      const requestResult = await (handle as any).requestPermission?.(opts)
      return requestResult === 'granted'
    }

    return false
  } catch (err) {
    console.warn('Permission check failed:', err)
    return false
  }
}

export function supportsFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window
}

export async function requestDirectoryPermission(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsFileSystemAccess()) {
    return null
  }
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'read' })
    await saveHandleToDB(handle)
    return handle
  } catch (err) {
    console.log('Directory picker cancelled or failed:', err)
    return null
  }
}

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsFileSystemAccess()) return null

  try {
    const handle = await getHandleFromDB()
    if (!handle) return null

    const hasPermission = await verifyHandlePermission(handle)
    if (hasPermission) {
      return handle
    }

    return null
  } catch (err) {
    console.warn('Failed to restore directory handle:', err)
    return null
  }
}

export async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  options: FileSystemOptions = {}
): Promise<Song[]> {
  const result = await scanDirectoryWithFiles(dirHandle, options)
  return result.songs
}

export async function scanDirectoryWithFiles(
  dirHandle: FileSystemDirectoryHandle,
  options: FileSystemOptions = {}
): Promise<ScanResult> {
  const files: File[] = []
  const paths: string[] = []
  const fileHandles: FileSystemFileHandle[] = []

  async function traverse(handle: any, path: string = '') {
    if (handle.entries) {
      for await (const entry of handle.entries()) {
        const entryHandle = entry[1]
        const entryName = entry[0]
        const entryPath = path ? `${path}/${entryName}` : entryName

        if (entryHandle.kind === 'file') {
          if (hasAudioExtension(entryName)) {
            try {
              const file = await entryHandle.getFile()
              files.push(file)
              paths.push(entryPath)
              fileHandles.push(entryHandle)
            } catch {}
          }
        } else if (entryHandle.kind === 'directory') {
          await traverse(entryHandle, entryPath)
        }
      }
    }
  }

  await traverse(dirHandle)

  const songs: Song[] = []
  const fileMap = new Map<string, File>()
  const handleMap = new Map<string, FileSystemFileHandle>()

  for (let i = 0; i < files.length; i++) {
    options.onProgress?.(i + 1, files.length, paths[i])
    try {
      const metadata = await parseMetadata(files[i])
      const song = {
        ...metadata,
        filePath: paths[i],
        fileName: files[i].name,
        fileSize: files[i].size,
        format: getExtension(files[i].name).slice(1)
      } as Song
      songs.push(song)
      fileMap.set(paths[i], files[i])
      handleMap.set(paths[i], fileHandles[i])
    } catch (err) {
      console.error('Failed to parse:', paths[i], err)
    }
  }

  return { songs, fileMap, handleMap }
}

export function setupWebkitDirectoryInput(
  input: HTMLInputElement,
  options: FileSystemOptions = {}
): Promise<Song[]> {
  return new Promise((resolve, reject) => {
    input.type = 'file'
    ;(input as any).webkitdirectory = true
    input.multiple = true
    input.accept = 'audio/*'

    input.onchange = async () => {
      const files = input.files
      if (!files) {
        resolve([])
        return
      }

      const audioFiles: File[] = []
      const paths: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (hasAudioExtension(file.name)) {
          audioFiles.push(file)
          paths.push((file as any).webkitRelativePath || file.name)
        }
      }

      const songs: Song[] = []
      for (let i = 0; i < audioFiles.length; i++) {
        options.onProgress?.(i + 1, audioFiles.length, paths[i])
        try {
          const metadata = await parseMetadata(audioFiles[i])
          const song = {
            ...metadata,
            filePath: paths[i],
            fileName: audioFiles[i].name,
            fileSize: audioFiles[i].size,
            format: getExtension(audioFiles[i].name).slice(1)
          } as Song
          songs.push(song)
        } catch (err) {
          console.error('Failed to parse:', paths[i], err)
        }
      }

      resolve(songs)
    }

    input.onerror = reject
    input.click()
  })
}

export async function handleFiles(
  files: FileList | File[],
  options: FileSystemOptions = {}
): Promise<Song[]> {
  const fileArray = Array.isArray(files) ? files : Array.from(files)
  const audioFiles = fileArray.filter(f => hasAudioExtension(f.name))

  const songs: Song[] = []
  for (let i = 0; i < audioFiles.length; i++) {
    options.onProgress?.(i + 1, audioFiles.length, audioFiles[i].name)
    try {
      const metadata = await parseMetadata(audioFiles[i])
      const song = {
        ...metadata,
        filePath: audioFiles[i].name,
        fileName: audioFiles[i].name,
        fileSize: audioFiles[i].size,
        format: getExtension(audioFiles[i].name).slice(1)
      } as Song
      songs.push(song)
    } catch (err) {
      console.error('Failed to parse:', audioFiles[i].name, err)
    }
  }

  return songs
}

export function setupDragDrop(
  container: HTMLElement,
  onFiles: (files: File[]) => void
): () => void {
  let dragCount = 0

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'copy'
  }

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    dragCount++
    container.classList.add('drag-over')
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragCount--
    if (dragCount === 0) {
      container.classList.remove('drag-over')
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    dragCount = 0
    container.classList.remove('drag-over')

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      onFiles(Array.from(files))
    }
  }

  container.addEventListener('dragover', handleDragOver)
  container.addEventListener('dragenter', handleDragEnter)
  container.addEventListener('dragleave', handleDragLeave)
  container.addEventListener('drop', handleDrop)

  return () => {
    container.removeEventListener('dragover', handleDragOver)
    container.removeEventListener('dragenter', handleDragEnter)
    container.removeEventListener('dragleave', handleDragLeave)
    container.removeEventListener('drop', handleDrop)
  }
}

export async function getFileFromHandle(handle: FileSystemFileHandle): Promise<File | null> {
  try {
    return await handle.getFile()
  } catch {
    return null
  }
}
