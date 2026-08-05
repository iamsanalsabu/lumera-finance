import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function listModels() {
  try {
    let pageToken;
    do {
      const response = await ai.models.list({ pageToken });
      for (const m of response) {
        console.log(m.name);
      }
      pageToken = response.paramsInternal.config.pageToken;
    } while (pageToken);
  } catch (error) {
    console.log('Error:', error);
  }
}
listModels();
