const sdk = require('microsoft-cognitiveservices-speech-sdk');

const azureKey = '49945b1adafe4d899d81179bc53a7985';
const azureRegion = 'eastus';

const speechConfig = sdk.SpeechConfig.fromSubscription(azureKey, azureRegion);
speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3;

const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

const voice = 'zh-CN-XiaoxiaoNeural';

async function testSSML(ssmlText, label) {
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
    <voice name="${voice}">
      <prosody rate="default" pitch="default" volume="default">
        ${ssmlText}
      </prosody>
    </voice>
  </speak>`;

  return new Promise((resolve) => {
    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          console.log(`[SUCCESS] ${label}`);
          resolve(true);
        } else {
          console.log(`[FAILED] ${label}: ${result.errorDetails || 'Unknown error'}`);
          resolve(false);
        }
      },
      (err) => {
        console.log(`[ERROR] ${label}:`, err);
        resolve(false);
      }
    );
  });
}

async function run() {
  // Test case 1: chong 2 lian 2 (with spaces)
  await testSSML('现在开始<phoneme alphabet="sapi" ph="chong 2 lian 2">重联</phoneme>测试', 'chong 2 lian 2 (sapi with space)');

  // Test case 2: chong2 lian2 (no space before tone digits)
  await testSSML('现在开始<phoneme alphabet="sapi" ph="chong2 lian2">重联</phoneme>测试', 'chong2 lian2 (sapi without space)');

  // Test case 3: sapi tone numbers as 1, 2, 3, 4 without spaces?
  await testSSML('现在开始<phoneme alphabet="sapi" ph="chong2lian2">重联</phoneme>测试', 'chong2lian2 (sapi no spaces at all)');

  // Test case 4: x-microsoft-sapi alphabet
  await testSSML('现在开始<phoneme alphabet="x-microsoft-sapi" ph="chong 2 lian 2">重联</phoneme>测试', 'chong 2 lian 2 (x-microsoft-sapi with space)');
  await testSSML('现在开始<phoneme alphabet="x-microsoft-sapi" ph="chong2 lian2">重联</phoneme>测试', 'chong2 lian2 (x-microsoft-sapi without space)');

  // Test case 5: ipa alphabet
  await testSSML('现在开始<phoneme alphabet="ipa" ph="tʂʰʊŋ ˧˥ liɛn ˧˥">重联</phoneme>测试', 'ipa phonetic');

  // Test case 6: what about only one word?
  await testSSML('现在开始<phoneme alphabet="sapi" ph="chong 2">重</phoneme>联测试', 'chong 2 (single word sapi)');
  await testSSML('现在开始<phoneme alphabet="sapi" ph="chong2">重</phoneme>联测试', 'chong2 (single word sapi no space)');

  // Test case 7: chonglian 2 (joint pinyin with one tone at the end)
  await testSSML('现在开始<phoneme alphabet="sapi" ph="chonglian 2">重联</phoneme>测试', 'chonglian 2');
  await testSSML('现在开始<phoneme alphabet="sapi" ph="chong2lian2">重联</phoneme>测试', 'chong2lian2');

  synthesizer.close();
}

run();
