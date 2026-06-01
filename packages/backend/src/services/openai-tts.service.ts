import { OpenAITtsEngine } from '../tts/engines/openaiTts'
import { PassThrough, Readable } from 'stream'
import fs from 'fs/promises'
import path from 'path'
import { ensureDir, ssmlToPlainText } from '../utils'
import { generateSrt } from './edge-tts.service'

export async function runOpenAITTS(params: any): Promise<Buffer | Readable> {
  const {
    text,
    voice,
    rate,
    output,
    outputType = 'file',
    openaiTtsKey,
    openaiTtsBaseUrl,
  } = params

  const apiKey = openaiTtsKey || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API Key 不能为空，请在全局 AI 设置中配置！')
  }

  const engine = new OpenAITtsEngine(apiKey, openaiTtsBaseUrl || process.env.OPENAI_BASE_URL)

  // 转换语速参数 (将 "+20%" -> 1.2, "-10%" -> 0.9)
  let speed = 1.0
  if (rate) {
    const match = /([+-]?\d+)%/.exec(rate)
    if (match) {
      const percentage = parseInt(match[1], 10)
      speed = 1.0 + percentage / 100
      // 限制在 OpenAI 允许的 0.25 - 4.0 之间
      speed = Math.max(0.25, Math.min(4.0, speed))
    }
  }

  let targetVoice = voice
  const isOfficialOpenAI = !openaiTtsBaseUrl || openaiTtsBaseUrl.includes('api.openai.com')
  if (!isOfficialOpenAI) {
    const voiceMapping: Record<string, string> = {
      alloy: 'M1',
      echo: 'M2',
      fable: 'M3',
      onyx: 'M4',
      nova: 'F1',
      shimmer: 'F2',
    }
    if (voiceMapping[voice]) {
      targetVoice = voiceMapping[voice]
    }
  }

  const audioBuffer = await engine.synthesize(ssmlToPlainText(text), {
    voice: targetVoice,
    speed,
    format: 'mp3',
  })

  const saveSubFile = async (audioPath: string, isStream: boolean) => {
    let subPath = audioPath + '.json'
    if (isStream) {
      const tmpDir = audioPath + '_tmp'
      await ensureDir(tmpDir)
      const { base } = path.parse(audioPath)
      const targetAudioPath = path.resolve(tmpDir, base)
      let basePath = targetAudioPath + '.srt.json'
      let finalSubPath = basePath
      let counter = 1
      try {
        await fs.access(finalSubPath)
        while (true) {
          finalSubPath = `${basePath}.${counter}`
          try {
            await fs.access(finalSubPath)
            counter++
          } catch {
            break
          }
        }
      } catch {}
      subPath = finalSubPath
    }
    // 写入空的字幕 JSON，以保证后续多段合并或前端播放不崩
    await fs.writeFile(subPath, JSON.stringify([], null, '  '), { encoding: 'utf-8' })
  }

  if (outputType === 'file') {
    await fs.writeFile(output, audioBuffer)
    await saveSubFile(output, false)
    const tempJsonPath = output + '.json'
    await generateSrt(tempJsonPath, output.replace('.mp3', '.srt'), true)
    return {
      audio: output,
      srt: output.replace('.mp3', '.srt'),
      file: '',
    } as any
  } else if (outputType === 'stream') {
    await saveSubFile(output, true)
    const passThrough = new PassThrough()
    passThrough.end(audioBuffer)
    return passThrough
  } else {
    return audioBuffer
  }
}
