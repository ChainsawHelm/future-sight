import { NextResponse } from 'next/server';

/** Validate that a route param looks like a CUID (alphanumeric, reasonable length) */
const CUID_RE = /^[a-z0-9]{20,30}$/;

export function validateId(id: string | undefined): string | NextResponse {
  if (!id || !CUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  return id;
}
