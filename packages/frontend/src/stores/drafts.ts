import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface DraftItem {
  id: string
  title: string
  text: string
  dubbingMode: 'single' | 'multi'
  config: {
    ttsProvider: string
    selectedVoice?: string
    rate?: number
    pitch?: number
    volume?: number
    characterMap?: any
    parsedSegments?: any
  }
  createdAt: number
}

export const useDraftsStore = defineStore('drafts', () => {
  const drafts = ref<DraftItem[]>([])

  function saveDraft(
    title: string,
    text: string,
    dubbingMode: 'single' | 'multi',
    config: any
  ) {
    const newDraft: DraftItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || `草稿 ${new Date().toLocaleString()}`,
      text,
      dubbingMode,
      config,
      createdAt: Date.now()
    }
    // 添加到最前，方便展示
    drafts.value.unshift(newDraft)
  }

  function deleteDraft(id: string) {
    const index = drafts.value.findIndex(d => d.id === id)
    if (index !== -1) {
      drafts.value.splice(index, 1)
    }
  }

  function clearDrafts() {
    drafts.value = []
  }

  return { drafts, saveDraft, deleteDraft, clearDrafts }
}, {
  persist: true
})
