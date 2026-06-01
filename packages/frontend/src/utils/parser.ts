export interface ParsedSegment {
  charactor: string
  text: string
}

function extractSpeakerName(namePart: string): string {
  if (!namePart) return '对话角色'
  let name = namePart.trim()
  // 匹配常见的非名字字词或小说描述中名字后的动作助词来截断名字
  const stopMatch = name.match(/[\s对向跟同和在由被让也又就还才却竟已早正刚忽顿冷怒笑哭叹哼啐骂喊叫说道问答应嚷听瞧看见走跑跳了着过地一，。！]/)
  if (stopMatch && stopMatch.index !== undefined && stopMatch.index > 0) {
    name = name.slice(0, stopMatch.index)
  }
  // 中文名字一般2-4字，超出4个字则截取前3个字作为名字
  if (name.length > 4) {
    name = name.slice(0, 3)
  }
  return name || '对话角色'
}

export function parseTextByRules(text: string): ParsedSegment[] {
  if (!text || !text.trim()) return []
  
  // 按段落切分，并过滤空行
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)
  const segments: ParsedSegment[] = []
  
  // 匹配中文双引号 “...” 或英文双引号 "..." 或日文/古风 「...」
  const quoteRegex = /[“"「]([^”"」]+)[”"」]/g

  for (const line of lines) {
    quoteRegex.lastIndex = 0
    let match
    let lastIndex = 0
    const lineSegments: ParsedSegment[] = []
    
    while ((match = quoteRegex.exec(line)) !== null) {
      const quoteStart = match.index
      const quoteEnd = quoteRegex.lastIndex
      const quoteText = match[1]
      
      // 引号前如果有文字，通常是旁白或说话人介绍
      if (quoteStart > lastIndex) {
        const precedingText = line.slice(lastIndex, quoteStart).trim()
        if (precedingText) {
          lineSegments.push({
            charactor: '旁白',
            text: precedingText
          })
        }
      }
      
      // 判定说话角色
      let speaker = '对话角色'
      if (quoteStart > lastIndex) {
        const precedingText = line.slice(lastIndex, quoteStart).trim()
        const cleanPreceding = precedingText.replace(/[:：\s,，。、]$/, '')
        
        const speakVerbs = /[说道喊笑问喝哼啐骂应答道气嚷]/
        const verbMatch = cleanPreceding.match(speakVerbs)
        
        if (verbMatch && verbMatch.index !== undefined && verbMatch.index > 0) {
          const namePart = cleanPreceding.slice(0, verbMatch.index).trim()
          speaker = extractSpeakerName(namePart)
        } else {
          speaker = extractSpeakerName(cleanPreceding)
        }
      }
      
      lineSegments.push({
        charactor: speaker,
        text: quoteText
      })
      
      lastIndex = quoteEnd
    }
    
    // 引号后的尾随文字
    if (lastIndex < line.length) {
      const remainingText = line.slice(lastIndex).trim()
      if (remainingText) {
        const speakVerbs = /[说道喊笑问喝哼啐骂应答道气嚷]/
        const verbMatch = remainingText.match(speakVerbs)
        
        if (verbMatch && verbMatch.index !== undefined && verbMatch.index > 0) {
          const namePart = remainingText.slice(0, verbMatch.index).trim()
          const speakerName = extractSpeakerName(namePart)
          
          // 如果倒数第一段是对话且为“对话角色”，则用后面的说话人去修正它
          const lastPushed = lineSegments[lineSegments.length - 1]
          if (lastPushed && lastPushed.charactor === '对话角色') {
            lastPushed.charactor = speakerName
          }
        }
        
        // 推送完整的尾随文本作为旁白，不遗漏或裁剪任何小说原文内容
        lineSegments.push({
          charactor: '旁白',
          text: remainingText
        })
      }
    }
    
    if (lineSegments.length === 0) {
      segments.push({
        charactor: '旁白',
        text: line
      })
    } else {
      segments.push(...lineSegments)
    }
  }
  
  return segments
}
