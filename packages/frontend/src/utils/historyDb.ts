export interface HistoryRecord {
  id: string
  title: string
  text: string
  voiceType: 'single' | 'multi'
  provider: string
  config: any
  audioBlob: Blob
  srtText?: string
  file: string
  size: number
  createdAt: number
}

const DB_NAME = 'EasyVoiceOfflineDb'
const DB_VERSION = 1
const STORE_NAME = 'audio_history'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('无法打开 IndexedDB 本地历史数据库'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

export async function getHistoryRecords(): Promise<HistoryRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      // 按照创建时间降序排序
      const records = (request.result as HistoryRecord[]).sort((a, b) => b.createdAt - a.createdAt)
      resolve(records)
    }

    request.onerror = () => {
      reject(new Error('获取历史音频记录失败'))
    }
  })
}

export async function saveHistoryRecord(record: Omit<HistoryRecord, 'createdAt'>): Promise<void> {
  const db = await openDb()
  
  // 1. 获取现有所有记录
  const existingRecords = await getHistoryRecords()
  
  // 2. 如果记录条数 >= 10，删除最久远的历史项 (先进先出)
  if (existingRecords.length >= 10) {
    const oldestCount = existingRecords.length - 9 // 删掉多出的部分，腾出至少一个空位
    const recordsToDelete = existingRecords.slice(-oldestCount)
    
    for (const oldRec of recordsToDelete) {
      await deleteHistoryRecord(oldRec.id)
    }
  }

  // 3. 写入新记录
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const newRecord: HistoryRecord = {
      ...record,
      createdAt: Date.now()
    }
    
    const request = store.put(newRecord)

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => {
      reject(new Error('保存历史音频记录失败'))
    }
  })
}

export async function updateHistorySrt(id: string, srtText: string): Promise<void> {
  const db = await openDb()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    // 先获取
    const getRequest = store.get(id)
    
    getRequest.onsuccess = () => {
      const record = getRequest.result as HistoryRecord | undefined
      if (record) {
        record.srtText = srtText
        const putRequest = store.put(record)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(new Error('更新 SRT 失败'))
      } else {
        // 记录可能已被滚动删除
        resolve()
      }
    }
    
    getRequest.onerror = () => {
      reject(new Error('查找历史记录进行 SRT 更新失败'))
    }
  })
}

export async function deleteHistoryRecord(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => {
      reject(new Error('删除历史音频记录失败'))
    }
  })
}

export async function clearHistoryRecords(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => {
      reject(new Error('清空历史音频记录失败'))
    }
  })
}
