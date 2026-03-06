import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithLimit } from '@/lib/api-auth';

/**
 * POST /api/parse-pdf
 * Accepts a PDF file upload, extracts text, and attempts to parse transactions.
 * Returns parsed rows for the client to review before importing.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuthWithLimit('api:write');
  if ('error' in auth) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Dynamic import pdf-parse (it uses fs internally, only works server-side)
    const pdfParse = (await import('pdf-parse')).default;
    const pdf = await pdfParse(buffer);
    const text = pdf.text;

    // Parse the extracted text into transaction rows
    const transactions = parseStatementText(text);

    return NextResponse.json({
      filename: file.name,
      pages: pdf.numpages,
      totalRows: transactions.length,
      transactions,
    });
  } catch (err: any) {
    console.error('PDF parse error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to parse PDF' },
      { status: 500 }
    );
  }
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
}

/**
 * Heuristic PDF statement parser.
 * Handles common bank statement formats:
 * - Lines with a date at the start followed by description and amount
 * - Supports MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY, YYYY-MM-DD
 * - Negative amounts or amounts in parentheses treated as debits
 */
function parseStatementText(text: string): ParsedRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  const transactions: ParsedRow[] = [];

  // Date patterns
  const dateRegex = /^(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/;
  // Amount patterns: $1,234.56 or (1,234.56) or -1234.56 or 1234.56 at end of line
  const amountRegex = /[-−]?\$?[\d,]+\.\d{2}\)?$/;
  const parenAmountRegex = /\([\$\d,]+\.\d{2}\)/;

  for (const line of lines) {
    const dateMatch = line.match(dateRegex);
    if (!dateMatch) continue;

    const dateStr = dateMatch[1];
    const rest = line.slice(dateMatch[0].length).trim();

    // Find amount at end of line
    const amountMatch = rest.match(amountRegex);
    if (!amountMatch) continue;

    const amountStr = amountMatch[0];
    const description = rest.slice(0, rest.length - amountStr.length).trim();

    if (!description || description.length < 2) continue;

    // Parse amount
    let amount = parseFloat(amountStr.replace(/[$,()−]/g, ''));
    if (isNaN(amount)) continue;

    // Detect debits: negative sign, minus sign, or parentheses
    const isDebit = amountStr.includes('-') || amountStr.includes('−') || parenAmountRegex.test(amountStr);
    if (isDebit) amount = -Math.abs(amount);

    // Normalize date
    const date = normalizeDate(dateStr);

    transactions.push({
      date,
      description: cleanDescription(description),
      amount,
      category: 'Uncategorized',
      account: 'PDF Import',
    });
  }

  return transactions;
}

function normalizeDate(d: string): string {
  const parts = d.split(/[\/\-]/);
  if (parts.length === 3) {
    let [a, b, c] = parts;
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    if (c.length === 4) return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    if (c.length === 2) {
      const yr = parseInt(c) > 50 ? `19${c}` : `20${c}`;
      return `${yr}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    }
  }
  return d;
}

function cleanDescription(desc: string): string {
  return desc
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove trailing reference numbers
    .replace(/\s+#?\d{6,}$/, '')
    // Remove card number suffixes
    .replace(/\s+x{1,4}\d{4}$/i, '')
    .trim();
}
