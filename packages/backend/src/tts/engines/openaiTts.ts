import { TTSEngine, TtsOptions } from '../types'
import { fetcher } from '../../utils/request'

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const
type OpenAIVoice = (typeof OPENAI_VOICES)[number]

const RESPONSE_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const
type ResponseFormat = (typeof RESPONSE_FORMATS)[number]

export class OpenAITtsEngine implements TTSEngine {
  name = 'openai-tts'
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl?: string) {
    if (!apiKey) {
      throw new Error('OpenAI TTS requires an API key.')
    }
    this.apiKey = apiKey
    this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://api.openai.com/v1'
  }

  async synthesize(text: string, options: TtsOptions): Promise<Buffer> {
    const { speed = 1.0, voice = 'alloy', format = 'mp3', model = 'tts-1' } = options

    if (typeof text !== 'string' || text.length === 0) {
      throw new Error('Input text is required.')
    }
    if (text.length > 4096) {
      throw new Error(
        'Input text exceeds 4096 characters, which is the maximum allowed by OpenAI TTS.'
      )
    }
    const isOfficialOpenAI = this.baseUrl.includes('api.openai.com')
    if (isOfficialOpenAI && !OPENAI_VOICES.includes(voice as OpenAIVoice)) {
      throw new Error(`Invalid voice: ${voice}. Supported voices are: ${OPENAI_VOICES.join(', ')}.`);
    }
    if (speed < 0.25 || speed > 4.0) {
      throw new Error('Speed must be between 0.25 and 4.0.')
    }
    if (!RESPONSE_FORMATS.includes(format as ResponseFormat)) {
      throw new Error(
        `Invalid response format: ${format}. Supported formats are: ${RESPONSE_FORMATS.join(', ')}.`
      )
    }

    let targetModel = model
    let targetFormat = format
    if (!isOfficialOpenAI) {
      if (model === 'tts-1') {
        targetModel = 'supertonic-3'
      }
      if (format === 'mp3') {
        targetFormat = 'wav'
      }
    }

    try {
      const response = await fetcher.post(
        `${this.baseUrl}/audio/speech`,
        {
          model: targetModel,
          input: text,
          voice,
          speed,
          response_format: targetFormat,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: isOfficialOpenAI ? 30000 : 300000, // 30s for official, 5 minutes for local NAS to download models
        }
      )

      return Buffer.from(response.data)
    } catch (error) {
      const err = error as any
      if (err.response?.status === 401) {
        throw new Error('Invalid OpenAI API key.')
      } else if (err.response?.status === 429) {
        throw new Error('Rate limit exceeded for OpenAI TTS.')
      }
      let errorMsg = err.message
      if (err.response?.data) {
        try {
          const dataStr = Buffer.from(err.response.data).toString('utf8')
          errorMsg += ` - Details: ${dataStr}`
        } catch {}
      }
      throw new Error(`Failed to synthesize speech: ${errorMsg}`)
    }
  }

  async getSupportedLanguages(): Promise<string[]> {
    return ['en-US', 'zh-CN', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP']
  }

  async getVoiceOptions(): Promise<string[]> {
    return [...OPENAI_VOICES]
  }
}
