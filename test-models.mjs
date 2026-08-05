import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  try {
    const response = await ai.models.list();
    for (const model of response) {
      if (model.name.includes('flash')) {
        console.log(model.name);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
listModels();
