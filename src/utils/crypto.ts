// =====================================================================
// UTILIDADES CRIPTOGRÁFICAS DE ALTA SEGURIDAD (Web Crypto API)
// Generación y verificación de tokens QR firmados con HMAC-SHA256
// =====================================================================

// La clave se lee desde la variable de entorno en lugar de estar hardcodeada.
// PRODUCCIÓN: Establece VITE_HMAC_SECRET en tu .env con al menos 64 chars aleatorios.
const SECRET_SIGNING_KEY: string =
  import.meta.env.VITE_HMAC_SECRET || 'FITPASS-DEV-FALLBACK-KEY-DO-NOT-USE-IN-PROD';

// Detectar modo producción para eliminar bypasses inseguros
const IS_PRODUCTION = import.meta.env.PROD === true;

/**
 * Genera una cadena aleatoria criptográficamente segura usando PRNG del sistema operativo.
 */
export function generateSecureRandomString(length: number = 16): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Importa la clave HMAC una sola vez y la cachea para evitar re-importaciones costosas.
 */
let _cachedCryptoKey: CryptoKey | null = null;

async function getHmacKey(): Promise<CryptoKey> {
  if (_cachedCryptoKey) return _cachedCryptoKey;
  const encoder = new TextEncoder();
  _cachedCryptoKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET_SIGNING_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return _cachedCryptoKey;
}

/**
 * Firma un texto payload utilizando HMAC-SHA256 a través de Web Crypto API (SubtleCrypto).
 */
async function hmacSign(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await getHmacKey();

  const signatureBuffer = await window.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(payload)
  );

  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  // Retorna los primeros 12 caracteres hexadecimales de la firma para un QR compacto
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 12)
    .toUpperCase();
}

/**
 * Compara dos strings en tiempo constante para evitar timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    // XOR byte a byte — nunca cortocircuita
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Genera un Pase QR firmado de alta seguridad para un socio sin revelar PII (Nombre/Apellido) en texto plano.
 * Si recibe un memberId o UUID, utiliza AES-GCM cifrado. De lo contrario, genera un token HMAC basado en UUID.
 */
export async function generateSecureQrToken(memberIdOrName: string, optionalLastName?: string): Promise<string> {
  // Import dynamically from lib/crypto for unified AES-GCM dynamic encryption
  const { generateSecureQRToken: generateAesGcmToken } = await import('../lib/crypto');
  
  // If first parameter looks like a UUID or memberId (e.g. MEM-xxx or UUID), generate AES-GCM token directly
  const targetId = memberIdOrName.trim();
  if (targetId.length > 8 && !targetId.includes(' ')) {
    return generateAesGcmToken(targetId);
  }

  // Fallback: Generate an anonymous member identifier based on PRNG random hex, keeping names out of plain text
  const anonId = `MEM-${generateSecureRandomString(8).toUpperCase()}`;
  return generateAesGcmToken(anonId);
}

/**
 * Valida la firma HMAC de un token QR recibido para evitar falsificaciones.
 *
 * PRODUCCIÓN:
 *   - Solo acepta tokens con firma HMAC válida. Sin bypasses.
 *
 * DESARROLLO (IS_PRODUCTION === false):
 *   - Acepta también tokens legacy sin firma (prefijo GYM-PASS-) para pruebas.
 */
export async function verifyQrTokenSignature(token: string): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;

  const trimmed = token.trim();

  // El token debe tener estructura mínima: GYM-PASS-RND-NAME-LASTNAME-SIG
  // Mínimo 6 segmentos cuando se divide por '-'
  const parts = trimmed.split('-');
  if (parts.length < 6) {
    // En producción, rechazar cualquier token sin estructura completa
    if (IS_PRODUCTION) return false;
    // En dev, aceptar tokens de prueba con prefijo correcto
    return trimmed.startsWith('GYM-PASS-');
  }

  // Extraer firma del último segmento y payload del resto
  const providedSignature = parts[parts.length - 1];
  const basePayload = parts.slice(0, parts.length - 1).join('-');

  // Validar que la firma tenga el formato esperado (12 hex chars uppercase)
  if (!/^[0-9A-F]{12}$/.test(providedSignature)) {
    if (IS_PRODUCTION) return false;
    return trimmed.startsWith('GYM-PASS-');
  }

  const expectedSignature = await hmacSign(basePayload);

  // Comparación en tiempo constante para prevenir timing attacks
  return timingSafeEqual(providedSignature, expectedSignature);
}
