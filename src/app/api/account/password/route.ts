import { NextResponse } from 'next/server';

// Password management is no longer needed — OAuth only
export async function PUT() {
  return NextResponse.json(
    { error: 'Password management is not available. Sign in with Google or GitHub.' },
    { status: 410 }
  );
}
