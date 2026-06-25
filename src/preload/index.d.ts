import type { GvueApi } from './index'

declare global {
  interface Window {
    api: GvueApi
  }
}

export {}
