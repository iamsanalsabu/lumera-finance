import { NextResponse } from 'next/server';
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
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile || audioFile.size < 500) {
      return NextResponse.json({ 
        error: 'Audio recording too short', 
        details: 'Audio recording was under 0.5 seconds or empty. Please hold the microphone button firmly while speaking.' 
      }, { status: 400 });
    }

    // Convert audio file to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine clean file extension for Groq Whisper
    let fileName = 'recording.webm';
    const mime = (audioFile.type || '').toLowerCase();
    if (mime.includes('mp4') || mime.includes('m4a')) {
      fileName = 'recording.m4a';
    } else if (mime.includes('wav')) {
      fileName = 'recording.wav';
    } else if (mime.includes('mp3') || mime.includes('mpeg')) {
      fileName = 'recording.mp3';
    } else if (mime.includes('ogg')) {
      fileName = 'recording.ogg';
    }

    // Step 1: Speech-to-Text via Groq Whisper
    console.log(`Transcribing audio (${buffer.length} bytes, ${fileName}) via Groq Whisper (whisper-large-v3)...`);
    
    const cleanFile = new File([buffer], fileName, { type: audioFile.type || 'audio/webm' });

    const groqFormData = new FormData();
    groqFormData.append('file', cleanFile, fileName);
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('temperature', '0');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: groqFormData
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq Whisper failed:', errText);
      return NextResponse.json({ error: 'Failed to transcribe audio', details: errText }, { status: 500 });
    }

    const groqData = await groqRes.json();
    const transcript = groqData.text || '';
    console.log('Groq Whisper Transcript:', transcript);

    if (!transcript.trim()) {
      return NextResponse.json({ error: 'No transaction detected', details: 'Audio was silent or unclear' }, { status: 400 });
    }

    // Step 2: Text-to-JSON via Groq Llama 3.3 70B
    const systemPrompt = `
      You are an expert AI finance keeper specializing in Indian languages, especially Malayalam (both script and Manglish) and English.
      Extract the transaction details from the user's spoken sentence.
      
      Respond strictly in JSON format matching this schema:
      {
        "type": "EXPENSE" or "INCOME",
        "amount": number,
        "category": "Food" | "Transport" | "Shopping" | "Bills" | "Entertainment" | "Salary" | "Other",
        "description": "Short English summary of the transaction"
      }
      If no financial transaction is mentioned, set amount to 0 and category to "Unknown".
    `;

    const llamaRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!llamaRes.ok) {
      const errText = await llamaRes.text();
      console.error('Groq Llama failed:', errText);
      return NextResponse.json({ error: 'Failed to parse text', details: errText }, { status: 500 });
    }

    const llamaData = await llamaRes.json();
    const resultText = llamaData.choices?.[0]?.message?.content;
    
    if (!resultText) {
      throw new Error('Empty response from Groq Llama');
    }

    console.log('Groq Llama Result:', resultText);
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

    return NextResponse.json({ success: true, data: transaction, transcript });
  } catch (error: any) {
    console.error('Error processing audio:', error);
    return NextResponse.json({ 
      error: 'Failed to process audio', 
      details: error?.message || String(error)
    }, { status: 500 });
  }
}
