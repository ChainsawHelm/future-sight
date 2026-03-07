import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';

export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;

  const nicknames = await prisma.accountNickname.findMany({
    where: { userId: result.userId },
    orderBy: { accountName: 'asc' },
  });

  return NextResponse.json({ nicknames });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const { accountName, nickname } = await req.json();
    if (!accountName || !nickname) {
      return NextResponse.json({ error: 'accountName and nickname are required' }, { status: 400 });
    }

    const entry = await prisma.accountNickname.upsert({
      where: {
        userId_accountName: { userId: result.userId, accountName },
      },
      create: { userId: result.userId, accountName, nickname },
      update: { nickname },
    });

    return NextResponse.json({ nickname: entry }, { status: 201 });
  } catch (error) {
    console.error('POST /api/account-nicknames error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const { accountName } = await req.json();
    if (!accountName) {
      return NextResponse.json({ error: 'accountName is required' }, { status: 400 });
    }

    await prisma.accountNickname.deleteMany({
      where: { userId: result.userId, accountName },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/account-nicknames error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
