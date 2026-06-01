import fs from 'fs/promises'
import { EdgeSchema } from '../schema/generate'
import { EdgeTTS } from '../lib/node-edge-tts/edge-tts-fixed'
import { fileExist, readJson, safeRunWithRetry } from '../utils'

export async function runEdgeTTS({
  text,
  pitch,
  volume,
  voice,
  rate,
  output,
  outputType = 'file',
}: Omit<EdgeSchema, 'useLLM'> & { output: string; outputType?: string }) {
  const lang = /([a-zA-Z]{2,5}-[a-zA-Z]{2,5}\b)/.exec(voice)?.[1]
  const tts = new EdgeTTS({
    voice,
    lang,
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    saveSubtitles: true,
    pitch,
    rate,
    volume,
    timeout: 30_000,
  })
  console.log(`run with nodejs edge-tts service...`)
  if (outputType === 'file') {
    await tts.ttsPromise(text, { audioPath: output, outputType })
    return {
      audio: output,
      srt: output.replace('.mp3', '.srt'),
      file: '',
    }
  }
  return tts.ttsPromise(text, { audioPath: output, outputType: outputType as any })
}
import { runAzureTTS } from './azure-tts.service'
import { runOpenAITTS } from './openai-tts.service'

export async function runTTS(params: any) {
  if (params.ttsProvider === 'azure') {
    return runAzureTTS(params)
  } else if (params.ttsProvider === 'openai') {
    return runOpenAITTS(params)
  } else {
    return runEdgeTTS(params)
  }
}

export const generateSingleVoice = async (
  params: Omit<EdgeSchema, 'useLLM'> & { output: string }
) => {
  let result: TTSResult = {
    audio: '',
    srt: '',
  }
  await safeRunWithRetry(
    async () => {
      result = (await runTTS({ ...params })) as TTSResult
    },
    { retries: 5 }
  )
  return result!
}
export const generateSingleVoiceStream = async (
  params: Omit<EdgeSchema, 'useLLM'> & { output: string; outputType?: string }
) => {
  return runTTS({ ...params, outputType: 'stream' })
}

// 定义字幕数据的类型
interface Subtitle {
  part: string // 字幕文本
  start: number // 开始时间（毫秒）
  end: number // 结束时间（毫秒）
}

/**
 * 将毫秒转换为 SRT 时间格式（HH:MM:SS,MMM）
 * @param ms 毫秒数
 * @returns 格式化的时间字符串
 */
function formatTime(ms: number): string {
  const hours = Math.floor(ms / 3600000)
    .toString()
    .padStart(2, '0')
  const minutes = Math.floor((ms % 3600000) / 60000)
    .toString()
    .padStart(2, '0')
  const seconds = Math.floor((ms % 60000) / 1000)
    .toString()
    .padStart(2, '0')
  const milliseconds = (ms % 1000).toString().padStart(3, '0')
  return `${hours}:${minutes}:${seconds},${milliseconds}`
}

/**
 * 将字幕 JSON 数据转换为 SRT 格式字符串
 * @param subtitles 字幕数组
 * @returns SRT 格式的字符串
 */
function convertToSrt(subtitles: Subtitle[]): string {
  if (!subtitles || subtitles.length === 0) return ''

  const groupedSubtitles: Subtitle[] = []
  let current: Subtitle | null = null

  // 标点符号与断句正则（支持匹配末尾带引号/括号等闭合标点）
  const sentenceEndRegex = /[。！？!?\n][”’」』）'"）｝】\]\}]*$/
  const phraseEndRegex = /[，；、：,;:，][”’」』）'"）｝】\]\}]*$/
  const isOnlyPunctuationRegex = /^[”’」』）'"）｝】\]\}，。！？、：；,.;!?\s]*$/

  for (const sub of subtitles) {
    const part = sub.part
    if (!part) continue

    if (!current) {
      current = {
        part: part,
        start: sub.start,
        end: sub.end
      }
    } else {
      const currentText = current.part.trim()
      const isOnlyPunct = isOnlyPunctuationRegex.test(part.trim())

      if (isOnlyPunct) {
        // 如果当前片段仅仅是标点符号（如引号），强行合并到上一句，不进行断句
        current.part += part
        current.end = sub.end
      } else {
        const endsWithSentenceEnd = sentenceEndRegex.test(currentText)
        const endsWithPhraseEnd = phraseEndRegex.test(currentText)
        
        const totalLen = current.part.length + part.length
        const isOverLimit = totalLen > 18
        const isBigPause = sub.start - current.end > 1200 // 停顿超过 1.2 秒

        if (endsWithSentenceEnd || isOverLimit || isBigPause) {
          // 强断句
          groupedSubtitles.push(current)
          current = {
            part: part,
            start: sub.start,
            end: sub.end
          }
        } else if (endsWithPhraseEnd && totalLen >= 10) {
          // 弱断句，累积字数足够时在逗号处换行
          groupedSubtitles.push(current)
          current = {
            part: part,
            start: sub.start,
            end: sub.end
          }
        } else {
          // 合并
          current.part += part
          current.end = sub.end
        }
      }
    }
  }

  if (current) {
    groupedSubtitles.push(current)
  }

  let srtContent = ''
  groupedSubtitles.forEach((subtitle, index) => {
    const startTime = formatTime(subtitle.start)
    const endTime = formatTime(subtitle.end)
    const cleanText = subtitle.part.replace(/[\r\n]+/g, ' ').trim()

    srtContent += `${index + 1}\n`
    srtContent += `${startTime} --> ${endTime}\n`
    srtContent += `${cleanText}\n\n`
  })

  return srtContent
}

export const jsonToSrt = async (jsonPath: string) => {
  const json = await readJson<any>(jsonPath)
  const srtResult = convertToSrt(json)
  return srtResult
}

export const generateSrt = async (jsonPath: string, srtPath: string, deleteJson = false) => {
  if (await fileExist(srtPath)) {
    console.log(`SRT file already exists at ${srtPath}`)
    return
  }
  try {
    const srtTxt = await jsonToSrt(jsonPath)
    await fs.writeFile(srtPath, srtTxt, 'utf8')
    console.log(`SRT file created at ${srtPath}`)
    if (deleteJson) await fs.unlink(jsonPath)
    return srtPath
  } catch (err) {
    console.error(`Error reading JSON file at ${jsonPath}:`, err)
    return
  }
}
