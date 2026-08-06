/**
 * Generador de Avatares Criptográficos y de Alta Legibilidad Offline para Socios.
 * Elimina las imágenes falsas de Unsplash y genera avatares SVG basados en las iniciales.
 * Funciona 100% Offline sin depender de servidores externos.
 */

export function getMemberAvatarUrl(name: string, lastName: string, customUrl?: string): string {
  if (customUrl && customUrl.trim() && !customUrl.includes('unsplash.com')) {
    return customUrl.trim();
  }

  const firstInitial = (name || '').trim().charAt(0).toUpperCase() || 'G';
  const lastInitial = (lastName || '').trim().charAt(0).toUpperCase() || 'P';
  const initials = `${firstInitial}${lastInitial}`;

  // Lista de gradientes esmeralda/teal de alto contraste
  const bgColors = ['#059669', '#0d9488', '#0284c7', '#4f46e5', '#7c3aed'];
  const charCode = (firstInitial.charCodeAt(0) + lastInitial.charCodeAt(0)) % bgColors.length;
  const bgColor = bgColors[charCode];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" rx="28" fill="${bgColor}"/>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="42" fill="#ffffff">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
