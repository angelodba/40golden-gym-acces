// =====================================================================
// UTILIDADES CRIPTOGRÁFICAS DE ALTA SEGURIDAD (Web Crypto API)
// Re-exportación unificada desde src/lib/crypto
// =====================================================================

import {
  generateSecureRandomString,
  generateSecureQRToken as generateAesGcmToken,
  verifyQrTokenSignature,
  hmacSign,
} from '../lib/crypto';

export { generateSecureRandomString, verifyQrTokenSignature, hmacSign };

/**
 * Genera un Pase QR firmado de alta seguridad para un socio sin revelar PII (Nombre/Apellido) en texto plano.
 */
export async function generateSecureQrToken(memberIdOrName: string, _optionalLastName?: string): Promise<string> {
  const targetId = memberIdOrName.trim();
  if (targetId.length > 8 && !targetId.includes(' ')) {
    return generateAesGcmToken(targetId);
  }

  const anonId = `MEM-${generateSecureRandomString(8).toUpperCase()}`;
  return generateAesGcmToken(anonId);
}

