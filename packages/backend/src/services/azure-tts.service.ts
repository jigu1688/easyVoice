import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import { PassThrough, Readable } from 'stream'
import fs from 'fs/promises'
import path from 'path'
import { ensureDir } from '../utils'
import { generateSrt } from './edge-tts.service'

interface SubLine {
  part: string
  start: number
  end: number
}

export async function runAzureTTS(params: any): Promise<Buffer | Readable> {
  const {
    text,
    pitch,
    volume,
    voice,
    rate,
    output,
    outputType = 'file',
    azureKey,
    azureRegion,
  } = params

  if (!azureKey) {
    throw new Error('Azure TTS API Key (订阅密钥) 不能为空，请在全局 AI 设置中配置！')
  }
  if (!azureRegion) {
    throw new Error('Azure TTS Region (服务区域) 不能为空，请在全局 AI 设置中配置！')
  }

  const speechConfig = sdk.SpeechConfig.fromSubscription(azureKey, azureRegion)
  speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3

  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null)
  const subFile: SubLine[] = []

  // 监听分词/字的时间戳事件，生成 srt 字幕数据
  synthesizer.wordBoundary = (sender, event) => {
    // event.audioOffset 单位是 100ns (ticks)
    // 转换为毫秒除以 10000 即可
    const startMs = Math.floor(event.audioOffset / 10000)
    const durationMs = Math.floor(event.duration / 10000)
    subFile.push({
      part: event.text,
      start: startMs,
      end: startMs + durationMs,
    })
  }

  const escapeSSML = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
    <voice name="${voice}">
      <prosody rate="${rate || 'default'}" pitch="${pitch || 'default'}" volume="${volume || 'default'}">
        ${escapeSSML(text)}
      </prosody>
    </voice>
  </speak>`

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
    await fs.writeFile(subPath, JSON.stringify(subFile, null, '  '), { encoding: 'utf-8' })
  }

  return new Promise((resolve, reject) => {
    synthesizer.speakSsmlAsync(
      ssml,
      async (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          const audioBuffer = Buffer.from(result.audioData)

          if (outputType === 'file') {
            await fs.writeFile(output, audioBuffer)
            await saveSubFile(output, false)
            const tempJsonPath = output + '.json'
            await generateSrt(tempJsonPath, output.replace('.mp3', '.srt'), true)

            synthesizer.close()
            resolve({
              audio: output,
              srt: output.replace('.mp3', '.srt'),
              file: '',
            } as any)
          } else if (outputType === 'stream') {
            await saveSubFile(output, true)
            const passThrough = new PassThrough()
            passThrough.end(audioBuffer)
            synthesizer.close()
            resolve(passThrough)
          } else {
            synthesizer.close()
            resolve(audioBuffer)
          }
        } else {
          synthesizer.close()
          reject(new Error(`Azure TTS 合成失败: ${result.errorDetails || '未知错误'}`))
        }
      },
      (err) => {
        synthesizer.close()
        reject(err)
      }
    )
  })
}
