import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Check if a string matches our iv:ciphertext:tag encrypted format */
export function isEncrypted(value: string): boolean {
  if (!value.includes(':')) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  // Derive a 32-byte key from the secret using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string. Returns base64 string: iv:ciphertext:tag
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

/**
 * Decrypt an encrypted string (iv:ciphertext:tag format).
 * Also handles plaintext tokens (for migration from unencrypted storage).
 */
export function decrypt(encryptedText: string): string {
  // If it doesn't look like our encrypted format, return as-is (migration compat)
  if (!encryptedText.includes(':') || encryptedText.split(':').length !== 3) {
    console.warn('[SECURITY] Decrypting plaintext value — this should be re-encrypted');
    return encryptedText;
  }

  try {
    const [ivB64, dataB64, tagB64] = encryptedText.split(':');
    const key = getKey();
    const iv = Buffer.from(ivB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
  } catch {
    // Don't log error details — could leak crypto internals
    console.error('[SECURITY] Decryption failed — check ENCRYPTION_KEY');
    throw new Error('Internal server error');
  }
}
