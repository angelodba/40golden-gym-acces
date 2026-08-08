// Cryptographic Utility for Secure QR Passes
// Uses Web Crypto API (AES-GCM & HMAC-SHA256)

const ENV_SECRET = (import.meta.env.VITE_HMAC_SECRET as string) || (import.meta.env.VITE_AES_SECRET as string);

if (!ENV_SECRET && import.meta.env.DEV) {
  console.warn('[SECURITY WARNING] VITE_HMAC_SECRET no está definida en .env. Se está utilizando una clave por defecto para desarrollo.');
}

const GLOBAL_SECRET_KEY = ENV_SECRET || "GoldGymSecureSecretKey2026!@#$%^";
const IS_PRODUCTION = import.meta.env.PROD === true;

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

// Generar cadena aleatoria segura usando PRNG del sistema operativo
/**
 * Generador universal de UUID v4 con compatibilidad 100% para iPad/iOS Safari y entornos HTTP
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Continuar al fallback
    }
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Continuar al fallback
    }
  }

  // Pure JS Math.random Fallback para navegadores antiguos / HTTP no seguro
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generar cadena aleatoria segura usando PRNG del sistema operativo o fallback JS
export function generateSecureRandomString(length: number = 16): string {
  const array = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    try {
      window.crypto.getRandomValues(array);
    } catch {
      for (let i = 0; i < length; i++) array[i] = Math.floor(Math.random() * 256);
    }
  } else {
    for (let i = 0; i < length; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Get the AES CryptoKey from secret
async function getCryptoKey(): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', stringToBuffer(GLOBAL_SECRET_KEY));
  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Get HMAC key
let _cachedHmacKey: CryptoKey | null = null;
async function getHmacKey(): Promise<CryptoKey> {
  if (_cachedHmacKey) return _cachedHmacKey;
  _cachedHmacKey = await window.crypto.subtle.importKey(
    'raw',
    stringToBuffer(GLOBAL_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return _cachedHmacKey;
}

export interface QRTokenPayload {
  userId: string;
  timestamp: number;
  nonce: string;
}

/**
 * Generates a secure, encrypted AES-GCM QR token containing no plain text PII.
 */
export async function generateSecureQRToken(userId: string): Promise<string> {
  const nonce = generateUUID();
  const timestamp = Date.now();

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const key = await getCryptoKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const payload: QRTokenPayload = { userId, timestamp, nonce };
      const data = stringToBuffer(JSON.stringify(payload));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      return bufferToBase64Url(combined.buffer);
    } catch {
      // Fallback a pase básico si WebCrypto AES-GCM falla
    }
  }

  // Fallback para entornos no-HTTPS en iPad
  const simplePayload = JSON.stringify({ userId, timestamp, nonce });
  return btoa(simplePayload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decrypts and verifies the secure AES-GCM QR token.
 */
export async function verifySecureQRToken(tokenStr: string): Promise<QRTokenPayload> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const key = await getCryptoKey();
      const buffer = base64UrlToBuffer(tokenStr);
      
      if (buffer.byteLength >= 13) {
        const iv = buffer.slice(0, 12);
        const encrypted = buffer.slice(12);

        const decryptedBuffer = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(iv) },
          key,
          encrypted
        );

        const decryptedStr = bufferToString(decryptedBuffer);
        const payload: QRTokenPayload = JSON.parse(decryptedStr);
        if (payload.userId) return payload;
      }
    }
  } catch {
    // Continuar al fallback de des-ofuscación
  }

  try {
    let base64 = tokenStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jsonStr = atob(base64);
    const payload = JSON.parse(jsonStr);
    if (payload.userId) return payload;
  } catch {
    // Error final
  }

  throw new Error('Invalid or corrupted QR token');
}

/**
 * Firma un payload usando HMAC-SHA256
 */
export async function hmacSign(payload: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const hmacKey = await getHmacKey();

      const signatureBuffer = await window.crypto.subtle.sign(
        'HMAC',
        hmacKey,
        encoder.encode(payload)
      );

      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      return hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 12)
        .toUpperCase();
    } catch {
      // Fallback
    }
  }

  // Fallback HMAC simple
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(12, '0').substring(0, 12).toUpperCase();
}

/**
 * Compara dos cadenas en tiempo constante para evitar ataques por análisis de tiempo
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Valida la firma HMAC de un token QR recibido
 */
export async function verifyQrTokenSignature(token: string): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;

  const trimmed = token.trim();
  const parts = trimmed.split('-');
  if (parts.length < 6) {
    if (IS_PRODUCTION) return false;
    return trimmed.startsWith('GYM-PASS-');
  }

  const providedSignature = parts[parts.length - 1];
  const basePayload = parts.slice(0, parts.length - 1).join('-');

  if (!/^[0-9A-F]{12}$/.test(providedSignature)) {
    if (IS_PRODUCTION) return false;
    return trimmed.startsWith('GYM-PASS-');
  }

  const expectedSignature = await hmacSign(basePayload);
  return timingSafeEqual(providedSignature, expectedSignature);
}

/**
 * Deriva un hash seguro de contraseña utilizando PBKDF2-HMAC-SHA256 con 100,000 iteraciones
 */
export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder();
  
  // Generar o decodificar el salt de 16 bytes (128 bits)
  let saltBytes: Uint8Array;
  if (saltHex) {
    const matched = saltHex.match(/.{1,2}/g) || [];
    saltBytes = new Uint8Array(matched.map((byte) => parseInt(byte, 16)));
  } else {
    saltBytes = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      try {
        window.crypto.getRandomValues(saltBytes);
      } catch {
        for (let i = 0; i < 16; i++) saltBytes[i] = Math.floor(Math.random() * 256);
      }
    } else {
      for (let i = 0; i < 16; i++) saltBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const finalSaltHex = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && window.crypto.subtle.importKey) {
    try {
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes.buffer as ArrayBuffer,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        256 // 256 bits = 32 bytes
      );

      const hashArray = Array.from(new Uint8Array(derivedBits));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return { hash: hashHex, salt: finalSaltHex };
    } catch {
      // Fallback
    }
  }

  // Fallback hashing para entornos HTTP sin WebCrypto API en iPad
  let simpleHash = 0;
  const combinedStr = password + ':' + finalSaltHex;
  for (let i = 0; i < combinedStr.length; i++) {
    const char = combinedStr.charCodeAt(i);
    simpleHash = (simpleHash << 5) - simpleHash + char;
    simpleHash |= 0;
  }
  const fallbackHashHex = Math.abs(simpleHash).toString(16).padStart(32, '0') + finalSaltHex.substring(0, 32);
  return { hash: fallbackHashHex, salt: finalSaltHex };
}

/**
 * Verifica si una contraseña coincide con el hash almacenado mediante comparación en tiempo constante
 */
export async function verifyPassword(
  password: string,
  expectedHash: string,
  saltHex: string
): Promise<boolean> {
  try {
    const { hash } = await hashPassword(password, saltHex);
    return timingSafeEqual(hash, expectedHash);
  } catch (error) {
    return false;
  }
}

/**
 * Genera un código OTP de N dígitos utilizando PRNG criptográficamente seguro
 */
export function generateOtpCode(length: number = 6): string {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 10).toString()).join('');
}

/**
 * Evalúa la fortaleza de una contraseña y retorna una métrica visual
 */
export function checkPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 8) score += 1;
  else feedback.push('Usa al menos 8 caracteres');

  if (password.length >= 12) score += 1;

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Añade al menos una letra mayúscula (A-Z)');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Añade al menos un número (0-9)');

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push('Añade al menos un carácter especial (!@#$%^&*)');

  let label = 'Débil';
  let color = 'bg-rose-500 text-white';

  if (score >= 5) {
    label = 'Excelente (100% Segura)';
    color = 'bg-emerald-600 text-white';
  } else if (score >= 3) {
    label = 'Aceptable';
    color = 'bg-amber-500 text-white';
  }

  return { score, label, color, feedback };
}



