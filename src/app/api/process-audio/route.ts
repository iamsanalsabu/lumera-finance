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
      You are an expert AI finance keeper specializing in Indian languages, especially Malayalam (both in Malayalam script and Manglish / Malayalam written in English alphabet) and English.
      
      Listen carefully to the audio recording. The user may speak in Malayalam, Manglish, or English.
      
      Examples of Malayalam / Manglish phrases:
      - "Chai koodichathinu 20 roopa" / "ചായ കുടിച്ചതിന് 20 രൂപ" -> EXPENSE, 20, Food, Tea
      - "500 roopa petrol" / "500 രൂപ പെട്രോൾ അടിച്ചു" -> EXPENSE, 500, Transport, Petrol
      - "10000 roopa sambalam / salary kittiyatha" -> INCOME, 10000, Salary, Salary received
      - "Kadayil 150 roopa koduthu" / "സാധനം വാങ്ങിയതിന് 150 രൂപ" -> EXPENSE, 150, Shopping, Paid at shop

      Common Malayalam words & numbers to recognize:
      - Words for currency: "roopa", "rupa", "rupees", "rs", "₹"
      - Words for expense: "koduthu", "aayi", "chelavayi", "vaangichu", "kudichu", "kazhichu", "petrol adichu"
      - Words for income: "kitti", "kittiyatha", "vandhu", "kitiya", "salary"
      - Numbers: onnu (1), randu (2), moonnu (3), naalu (4), anchu (5), aaru (6), ezhu (7), ettu (8), onpathu (9), pathu (10), irupathu (20), muppathu (30), naappathu (40), anpathu (50), arupathu (60), ezhupathu (70), enpathu (80), thonnooru (90), nooru (100), aayiram (1000), laksham (100000).

      Respond strictly in JSON format with no markdown formatting or backticks:
      {
        "type": "EXPENSE" or "INCOME",
        "amount": number,
        "category": "Food" | "Transport" | "Shopping" | "Bills" | "Entertainment" | "Salary" | "Other",
        "description": "Short English description of the transaction",
        "transcript": "Exact transcription of what was spoken"
      }

      If the audio is silent or no financial transaction was mentioned, return:
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
                { text: prompt },
                { inlineData: { data: base64Audio, mimeType } }
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
