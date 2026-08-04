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
      Respond strictly in JSON format with no markdown formatting or extra text.
      The JSON object must contain the following fields:
      - type: string (must be either "EXPENSE" or "REVENUE")
      - amount: number (the amount mentioned, e.g., 150)
      - category: string (the category of the transaction, e.g., "Food", "Transport", "Salary", "Shopping")
      - description: string (a short translation or summary of the expense in English, e.g., "Lunch")
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Audio,
                mimeType,
              },
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text || '';
    let transactionData;
    
    try {
      transactionData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Gemini response:', responseText);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Save to database
    const transaction = await prisma.transaction.create({
      data: {
        type: transactionData.type || 'EXPENSE',
        amount: parseFloat(transactionData.amount) || 0,
        category: transactionData.category || 'Uncategorized',
        description: transactionData.description || 'Processed via Voice',
        date: new Date(),
        userId: user.userId as string,
      },
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error('Error processing audio:', error);
    return NextResponse.json({ error: 'Failed to process audio' }, { status: 500 });
  }
}
