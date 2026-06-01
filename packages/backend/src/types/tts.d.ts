interface Segment {
  id: string
  text: string
}

interface TTSResult {
  audio: string
  srt: string
  partial?: boolean
}

interface TTSParams {
  text: string
  voice: string
  volume?: string
  rate?: string
  pitch?: string
  output: string
  ttsProvider?: string
  azureKey?: string
  azureRegion?: string
  openaiTtsKey?: string
  openaiTtsBaseUrl?: string
}
type BuildSegment = TTSParams & {
  text: string
}

