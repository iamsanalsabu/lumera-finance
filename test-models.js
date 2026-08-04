const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
let key = env.match(/GEMINI_API_KEY=(.*)/)[1];
key = key.replace(/"/g, '').trim();
const ai = new GoogleGenAI({apiKey: key});
async function main() {
  const models = await ai.models.list();
  for await (const m of models) {
    console.log(m.name);
  }
}
main().catch(console.error);
