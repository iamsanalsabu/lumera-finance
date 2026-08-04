const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
let key = env.match(/GEMINI_API_KEY=(.*)/)[1];
key = key.replace(/"/g, '').trim();
const ai = new GoogleGenAI({apiKey: key});

async function main() {
  const base64Audio = Buffer.from('dummy').toString('base64');
  
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: "What is this?" },
            { inlineData: { data: base64Audio, mimeType: 'audio/mp3' } }
          ]
        }
      ]
    });
    console.log("Success Format 1:", res.text);
  } catch(e) {
    console.error("Error Format 1:", e.message);
  }
}
main();
