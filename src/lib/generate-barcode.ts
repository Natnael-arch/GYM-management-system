import crypto from 'crypto';

export function generateBarcodeToken(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}
