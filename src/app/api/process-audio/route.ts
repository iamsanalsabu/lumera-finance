import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { verifyJwtToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const user = await verifyJwtToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Convert audio file to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    const rawMimeType = audioFile.type || 'audio/webm';
    const mimeType = rawMimeType.split(';')[0];

    const prompt = `
      You are an expert AI finance keeper.
      Listen to the following audio recording (which may be in Malayalam or English) and extract the financial transaction details.
      Respond strictly in JSON format with no markdown formatting or backticks. Use this exact structure:
      {
        "type": "EXPENSE" or "INCOME",
        "amount": number,
        "category": "string",
        "description": "string",
        "transcript": "string"
      }
      The 'transcript' field should contain exactly what you heard in the audio.
      If the audio is silent or contains no recognizable transaction, return:
      {
        "type": "EXPENSE",
        "amount": 0,
        "category": "Unknown",
        "description": "No transaction detected",
        "transcript": "SILENCE"
      }
    `;

    const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];
    let response = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        console.log(`Attempting Gemini model: ${model}`);
        response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { data: base64Audio, mimeType } },
                { text: prompt }
              ]
            }
          ],
          config: {
            responseMimeType: 'application/json',
          }
        });
        if (response?.text) {
          break; // Successfully got a response!
        }
      } catch (err: any) {
        console.warn(`Model ${model} failed:`, err?.message || err);
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('All Gemini models failed to respond.');
    }

    const resultText = response.text;
    if (!resultText) {
      throw new Error('Empty response from Gemini');
    }

    console.log("Gemini Response:", resultText); // <-- DEBUG LOG
    const transactionData = JSON.parse(resultText);

    // Default to EXPENSE if not recognized
    const type = transactionData.type?.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE';
    // Remove any currency symbols and parse as float
    const amount = parseFloat(String(transactionData.amount).replace(/[^0-9.-]+/g, '')) || 0;
    
    // Save to database
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.userId as string,
        type,
        amount,
        category: transactionData.category || 'Other',
        description: transactionData.description || 'Voice entry',
        date: new Date(),
      }
    });

    return NextResponse.json({ success: true, data: transaction });
  } catch (error: any) {
    console.error('Error processing audio:', error);
    // Send the exact error message back to the client for debugging!
    return NextResponse.json({ 
      error: 'Failed to process audio', 
      details: error?.message || String(error)
    }, { status: 500 });
  }
}
