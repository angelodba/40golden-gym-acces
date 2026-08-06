// Cryptographic Utility for Secure QR Passes
// Uses Web Crypto API (AES-GCM)

// In a real production app, this secret should be injected via environment variables.
const GLOBAL_SECRET_KEY =
  (import.meta.env.VITE_HMAC_SECRET as string) ||
  (import.meta.env.VITE_AES_SECRET as string) ||
  "GoldGymSecureSecretKey2026!@#$%^";

// Convert string to ArrayBuffer
function stringToBuffer(str: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(str);
  return bytes.buffer;
}

// Convert ArrayBuffer to string
function bufferToString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return new TextDecoder().decode(bytes);
}

// Convert ArrayBuffer to Base64URL
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert Base64URL to ArrayBuffer
function base64UrlToBuffer(base64Url: string): ArrayBuffer {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Get the CryptoKey from the secret
async function getCryptoKey(): Promise<CryptoKey> {
  // Hash the secret to ensure it's exactly 256 bits (32 bytes)
  const hash = await crypto.subtle.digest('SHA-256', stringToBuffer(GLOBAL_SECRET_KEY));
  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface QRTokenPayload {
  userId: string;
  timestamp: number;
  nonce: string;
}

/**
 * Generates a secure, encrypted AES-GCM QR token containing no plain text PII.
 * Contains only { userId, timestamp, nonce }.
 */
export async function generateSecureQRToken(userId: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const nonce = crypto.randomUUID(); // Unique identifier for anti-replay
  const timestamp = Date.now();
  
  const payload: QRTokenPayload = { userId, timestamp, nonce };
  const data = stringToBuffer(JSON.stringify(payload));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV and Encrypted Data (Ciphertext + AuthTag are returned together by AES-GCM)
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return bufferToBase64Url(combined.buffer);
}

/**
 * Decrypts and verifies the secure AES-GCM QR token.
 * Throws an error if invalid, tampered, or corrupted.
 * NOTE: Timestamp expiration is intentionally NOT enforced here.
 * Static/printed QR codes must remain valid indefinitely.
 * Anti-replay protection is handled server-side via the qr_nonces table in Supabase.
 */
export async function verifySecureQRToken(tokenStr: string): Promise<QRTokenPayload> {
  try {
    const key = await getCryptoKey();
    const buffer = base64UrlToBuffer(tokenStr);
    
    if (buffer.byteLength < 13) {
      throw new Error('Token length too short');
    }

    // Extract IV (first 12 bytes) and encrypted data
    const iv = buffer.slice(0, 12);
    const encrypted = buffer.slice(12);

    // Decrypt data — AES-GCM auth tag verification is implicit.
    // If the token has been tampered with, this will throw a DOMException.
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      encrypted
    );

    const decryptedStr = bufferToString(decryptedBuffer);
    const payload: QRTokenPayload = JSON.parse(decryptedStr);

    // Validate required fields are present
    if (!payload.userId || !payload.nonce) {
      throw new Error('Malformed token payload: missing required fields');
    }

    return payload;
  } catch (error: any) {
    throw new Error('Invalid or corrupted QR token: ' + error.message);
  }
}

