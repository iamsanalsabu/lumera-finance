import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwtToken } from '@/lib/auth';
import { cookies } from 'next/headers';

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = await verifyJwtToken(token);
  return payload;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const budgets = await prisma.budget.findMany({
      where: { userId: user.userId as string }
    });
    return NextResponse.json(budgets);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { category, limit } = await req.json();

    const budget = await prisma.budget.upsert({
      where: {
        userId_category: {
          userId: user.userId as string,
          category,
        }
      },
      update: { limit: parseFloat(limit) },
      create: {
        category,
        limit: parseFloat(limit),
        userId: user.userId as string,
      }
    });

    return NextResponse.json(budget);
  } catch (error) {
    console.error('Budget error:', error);
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });
  }
}
