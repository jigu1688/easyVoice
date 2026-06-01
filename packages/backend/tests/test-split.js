const toneMap = {
  'ā': { letter: 'a', tone: 1 }, 'ō': { letter: 'o', tone: 1 }, 'ē': { letter: 'e', tone: 1 },
  'ī': { letter: 'i', tone: 1 }, 'ū': { letter: 'u', tone: 1 }, 'ǖ': { letter: 'v', tone: 1 },
  'á': { letter: 'a', tone: 2 }, 'ó': { letter: 'o', tone: 2 }, 'é': { letter: 'e', tone: 2 },
  'í': { letter: 'i', tone: 2 }, 'ú': { letter: 'u', tone: 2 }, 'ǘ': { letter: 'v', tone: 2 },
  'ǎ': { letter: 'a', tone: 3 }, 'ǒ': { letter: 'o', tone: 3 }, 'ě': { letter: 'e', tone: 3 },
  'ǐ': { letter: 'i', tone: 3 }, 'ǔ': { letter: 'u', tone: 3 }, 'ǚ': { letter: 'v', tone: 3 },
  'à': { letter: 'a', tone: 4 }, 'ò': { letter: 'o', tone: 4 }, 'è': { letter: 'e', tone: 4 },
  'ì': { letter: 'i', tone: 4 }, 'ù': { letter: 'u', tone: 4 }, 'ǜ': { letter: 'v', tone: 4 },
};

function convertPinyinToSapi(pinyinStr) {
  // 1. 将所有带声调的字母替换为 "元音 + 声调数字"
  // 例如 chóng -> cho2ng, lián -> lia2n
  let normalized = '';
  for (let i = 0; i < pinyinStr.length; i++) {
    const char = pinyinStr[i];
    if (toneMap[char]) {
      normalized += toneMap[char].letter + toneMap[char].tone;
    } else {
      normalized += char;
    }
  }

  // 2. 将所有的 u: 或 ü 替换为 v
  normalized = normalized.toLowerCase().replace(/ü/g, 'v').replace(/u:/g, 'v');

  // 3. 将声调数字移到音节末尾
  // 规则：若 [1-5] 后面跟着 n/ng/r 且后面不是元音/声调，则移动
  const regex = /([1-5])(ng|n|r)(?![aeiouüv1-5])/gi;
  let prev;
  do {
    prev = normalized;
    normalized = normalized.replace(regex, '$2$1');
  } while (normalized !== prev);

  // 4. 在每个声调数字后面插入空格，以将连在一起的拼音分割开
  // 例如 chong2lian2 -> chong2 lian2
  normalized = normalized.replace(/([1-5])/g, '$1 ');

  // 5. 分割并格式化为 SAPI 所需的 "pinyin tone" 格式
  return normalized
    .split(/\s+/)
    .map(word => {
      let cleanedWord = word.trim();
      if (!cleanedWord) return '';

      // 如果已是带声调数字的格式 (如 chong2 或 lv3)
      const numMatch = /^([a-z]+)([1-5])$/.exec(cleanedWord);
      if (numMatch) {
        const pinyin = numMatch[1];
        const tone = numMatch[2];
        return `${pinyin} ${tone}`;
      }

      // 如果没有声调数字，默认加上轻声 5
      if (/^[a-z]+$/.test(cleanedWord)) {
        return `${cleanedWord} 5`;
      }
      return word;
    })
    .filter(Boolean)
    .join(' ');
}

console.log('chónglián ->', convertPinyinToSapi('chónglián'));
console.log('chong2lian2 ->', convertPinyinToSapi('chong2lian2'));
console.log('chong2 lian2 ->', convertPinyinToSapi('chong2 lian2'));
console.log('chóng lián ->', convertPinyinToSapi('chóng lián'));
console.log('lǜ ->', convertPinyinToSapi('lǜ'));
console.log('lv3 ->', convertPinyinToSapi('lv3'));
console.log('xian ->', convertPinyinToSapi('xian'));
console.log('xi\'an ->', convertPinyinToSapi('xi\'an'));

