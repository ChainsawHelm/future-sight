import { NextResponse } from 'next/server';

// Registration is handled by OAuth providers — this endpoint is no longer used
export async function POST() {
  return NextResponse.json(
    { error: 'Registration is only available via Google or GitHub sign-in.' },
    { status: 410 }
  );
}
