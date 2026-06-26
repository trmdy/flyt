import type { FlytApi } from '@shared/types'

declare global {
  interface Window {
    flyt: FlytApi
  }
}

export {}
