declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: any) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

interface Window {
  showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle>
  showOpenFilePicker?: (options?: any) => Promise<FileSystemFileHandle[]>
}

interface FileSystemDirectoryHandle {
  kind: 'directory'
  name: string
  entries?(): AsyncIterableIterator<[string, FileSystemHandle]>
  values?(): AsyncIterableIterator<FileSystemHandle>
  getDirectoryHandle?(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  getFileHandle?(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  removeEntry?(name: string, options?: { recursive?: boolean }): Promise<void>
}

interface FileSystemFileHandle {
  kind: 'file'
  name: string
  getFile(): Promise<File>
  createWritable?(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>
  seek(position: number): Promise<void>
  truncate(size: number): Promise<void>
  close(): Promise<void>
}

interface File {
  webkitRelativePath?: string
}
