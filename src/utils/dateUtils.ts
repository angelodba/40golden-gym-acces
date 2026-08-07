/**
 * Utilidades de Formato de Fecha en Formato Latinoamericano (Venezuela / DD/MM/YYYY)
 */

/**
 * Formatea cualquier fecha (ISO, YYYY-MM-DD o Date) al estándar latinoamericano: DD/MM/YYYY
 * Ejemplo: "2026-08-25" -> "25/08/2026"
 */
export function formatDateLatam(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';

  // Si es formato YYYY-MM-DD simple
  if (typeof dateInput === 'string') {
    const clean = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [year, month, day] = clean.split('-');
      return `${day}/${month}/${year}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formatea fecha y hora completa al estándar latinoamericano: DD/MM/YYYY, hh:mm a.m./p.m.
 * Ejemplo: "2026-08-25T14:30:00Z" -> "25/08/2026, 02:30 p. m."
 */
export function formatDateTimeLatam(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
