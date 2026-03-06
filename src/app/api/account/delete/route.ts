import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { requireFreshSession } from '@/lib/sensitive-action';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

const DELETION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

const deleteSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT'),
});

// DELETE — schedule account deletion (24h cooldown)
export async function DELETE(req: NextRequest) {
  // Require fresh session for this sensitive operation
  const freshResult = await requireFreshSession();
  if ('error' in freshResult) return freshResult.error;

  const result = await requireAuthWithLimit('api:backup');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'You must send { "confirmation": "DELETE MY ACCOUNT" } to proceed' },
        { status: 400 }
      );
    }

    // Schedule deletion for 24h from now instead of immediate deletion
    const deletionDate = new Date(Date.now() + DELETION_COOLDOWN_MS);
    await prisma.user.update({
      where: { id: userId },
      data: { scheduledDeletion: deletionDate },
    });

    await audit('delete_account', userId, `Scheduled for ${deletionDate.toISOString()}`);

    return NextResponse.json({
      scheduled: true,
      deletionDate: deletionDate.toISOString(),
      message: 'Account deletion scheduled. You have 24 hours to cancel by signing back in.',
    });
  } catch (error) {
    console.error('Account deletion error:', (error as Error).message);
    return NextResponse.json({ error: 'Account deletion failed' }, { status: 500 });
  }
}

// PATCH — cancel scheduled deletion
export async function PATCH() {
  const result = await requireAuthWithLimit('api:backup');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { scheduledDeletion: null },
    });

    await audit('delete_account', userId, 'Cancelled scheduled deletion');
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    console.error('Cancel deletion error:', (error as Error).message);
    return NextResponse.json({ error: 'Failed to cancel deletion' }, { status: 500 });
  }
}

// GET — check deletion status
export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;
  const { userId } = result;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { scheduledDeletion: true },
  });

  return NextResponse.json({
    scheduledDeletion: user?.scheduledDeletion?.toISOString() || null,
  });
}
