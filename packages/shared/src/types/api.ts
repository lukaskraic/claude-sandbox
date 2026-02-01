export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modifiedAt?: Date
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  unstaged: string[]
  untracked: string[]
}

export interface GitCommit {
  hash: string
  message: string
  author: string
  date: Date
}
