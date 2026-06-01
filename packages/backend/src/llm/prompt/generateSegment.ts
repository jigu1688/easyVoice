const cnTemplate = (voiceList: VoiceConfig[], text: string) => `
我希望你根据以下声音配置和一段文字内容，为文字配音提供优化建议。任务包括：
1. 将文字按场景、角色、旁白分割。
2. 根据角色的性格、对话语气，从声音配置中推荐合适的“Name”。
3. 为每段推荐合理的“rate”（语速）、“volume”（音量）、“pitch”（音调）参数。
4. 请不要遗漏语句以及保证语句的顺序。
5. 返回结果为 JSON 格式。


### 声音配置
${JSON.stringify(voiceList, null, 2)}

### 参数说明
- name: 声音配置中的 Name 字段，区分旁白和角色。
- rate: 语速调整，百分比形式，默认 +0%（正常），如 "+50%"（加快 50%），"-20%"（减慢 20%）。
- volume: 音量调整，百分比形式，默认 +0%（正常），如 "+20%"（增 20%），"-10%"（减 10%）。
- pitch: 音调调整，默认 +0Hz（正常），如 "+10Hz"（提高 10 赫兹），"-5Hz"（降低 5 赫兹）。

### 最终返回JSON格式
{
  segments: [
    {
      name: 'specific voice',
      charactor: '角色名或narration',
      rate: '语速',
      volume: '音量',
      pitch: '音调',
      text: '文本段落',
    },
  ],
}

### 待处理内容
${text}
`
const engTemplate = (voiceList: VoiceConfig[], text: string) => `
I hope you can provide optimization suggestions for text dubbing based on the following sound configuration and a paragraph of text content. Tasks include:
1. Divide the text by scene, role, and narration.
2. Recommend a suitable "Name" from the sound configuration based on the character's personality and dialogue tone.
3. Recommend reasonable "rate" (speech speed), "volume" (volume), and "pitch" (pitch) parameters for each paragraph.
4. Please do not omit text and ensure the order of text.
5. The result is returned in JSON format.

### Sound configuration
${JSON.stringify(voiceList, null, 2)}

### Parameter description
- name: Name field in the sound configuration, distinguishing between narration and role.
- rate: Speech speed adjustment, percentage form, default +0% (normal), such as "+50%" (50% faster), "-20%" (20% slower).
- volume: Volume adjustment, percentage form, default +0% (normal), such as "+20%" (increase 20%), "-10%" (decrease 10%).
- pitch: pitch adjustment, default +0Hz (normal), such as "+10Hz" (increase 10 Hz), "-5Hz" (decrease 5 Hz).

### Final Output JSON format
{
  segments: [
    {
      name: 'specific voice',
      charactor: '角色名或narration',
      rate: '语速',
      volume: '音量',
      pitch: '音调',
      text: '文本段落',
    },
  ],
}


### Content to be processed
${text}
`
export function getPrompt(lang = 'cn', voiceList: VoiceConfig[], text: string) {
  switch (lang) {
    case 'zh':
    case 'cn':
      return cnTemplate(
        voiceList.filter((voice) => voice.Name.startsWith('zh')),
        text
      )
    case 'eng':
      return engTemplate(
        voiceList.filter((voice) => voice.Name.startsWith('en')),
        text
      )
    default:
      throw new Error(`Unsupported language: ${lang}`)
  }
}

const cnParseTemplate = (text: string) => `
你是一个小说文本解析专家。你的任务是分析以下小说文本，将文本分割为“旁白”和“各个角色的对话”段落。
要求：
1. 请保留所有的文本内容，不要遗漏任何字句，并保持原有的顺序。
2. 识别每一句话的说话人。如果属于角色的对话，请标出该角色的名字（如“徐凤年”、“姜泥”等）；如果是旁白、叙述或没有明确说话人的内容，请标记为“旁白”。
3. 返回的结果必须是有效的 JSON 格式。

最终返回的 JSON 格式如下：
{
  "segments": [
    {
      "charactor": "说话人角色名或旁白",
      "text": "对应的话语或叙述文本"
    }
  ]
}

待处理的小说文本内容如下：
${text}
`

const engParseTemplate = (text: string) => `
You are a novel text parsing expert. Your task is to analyze the following novel text and split it into "narration" and "dialogue of each character" paragraphs.
Requirements:
1. Please keep all text content, do not omit any words, and maintain the original order.
2. Identify the speaker of each sentence. If it is a character dialogue, please mark the character's name (e.g. "John", "Mary"); if it is narration, description or there is no clear speaker, please mark it as "旁白" (narration).
3. The returned result must be in valid JSON format.

The final returned JSON format is as follows:
{
  "segments": [
    {
      "charactor": "Speaker name or 旁白",
      "text": "Corresponding dialogue or narration text"
    }
  ]
}

The novel text to be processed is as follows:
${text}
`

export function getParseOnlyPrompt(lang = 'cn', text: string) {
  switch (lang) {
    case 'zh':
    case 'cn':
      return cnParseTemplate(text)
    case 'eng':
      return engParseTemplate(text)
    default:
      return cnParseTemplate(text)
  }
}
