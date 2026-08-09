import type { ScreenerType } from '../shared/types'

/**
 * The only place the two screeners differ. Both run the same flow; this decides
 * which parts of it they show.
 */
export type ScreenerConfig = {
  title: string
  intro: string
  placeholder: string
  /** Fixed yes/no questions asked alongside the chat. Empty means chat only. */
  checklist: string[]
  showsNotes: boolean
  collectsContact: boolean
}

export const SCREENER_CONFIG: Record<ScreenerType, ScreenerConfig> = {
  adult: {
    title: 'Adult Screener',
    intro: 'Tell the assistant what brought you here, and it will ask a few questions.',
    placeholder: 'Describe your reading or writing difficulties...',
    checklist: [],
    showsNotes: false,
    collectsContact: true,
  },
  child: {
    title: 'Child Screener',
    intro: 'Tell the assistant about the child, and it will ask a few questions.',
    placeholder: 'Describe what you have noticed about the child...',
    checklist: [],
    showsNotes: false,
    collectsContact: true,
  },
}