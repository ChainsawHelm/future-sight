import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

type AuditAction =
  | 'login'
  | 'login_failed'
  | 'register'
  | 'export_backup'
  | 'restore_backup'
  | 'reset_data'
  | 'delete_account'
  | 'plaid_connect'
  | 'plaid_disconnect'
  | 'plaid_sync'
  | 'password_change';

export async function audit(action: AuditAction, userId?: string | null, detail?: string) {
  try {
    const hdrs = headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
      || hdrs.get('x-real-ip')
      || null;

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        detail: detail?.slice(0, 500) || null,
        ip,
      },
    });
  } catch {
    // Audit logging should never break the main flow
  }
}
