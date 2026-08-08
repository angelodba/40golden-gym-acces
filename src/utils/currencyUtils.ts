import { Currency, ExchangeRates } from '../types';

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  VES: 36.5, // 1 USD = 36.5 Bs.
  COP: 3900, // 1 USD = 3,900 COP
};

const LS_RATES_KEY = 'fitpass_exchange_rates';

/**
 * Obtener las tasas de cambio guardadas o los valores por defecto.
 */
export function getSavedExchangeRates(): ExchangeRates {
  try {
    const saved = localStorage.getItem(LS_RATES_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_EXCHANGE_RATES;
}

/**
 * Guardar nuevas tasas de cambio en el sistema.
 */
export function saveExchangeRates(newRates: ExchangeRates): void {
  try {
    localStorage.setItem(LS_RATES_KEY, JSON.stringify(newRates));
  } catch (err) {
    console.warn('Error guardando tasas de cambio:', err);
  }
}

/**
 * Convertir un monto en USD a la moneda seleccionada.
 */
export function convertFromUSD(amountUSD: number, currency: Currency, rates: ExchangeRates = getSavedExchangeRates()): number {
  if (currency === 'VES') return amountUSD * rates.VES;
  if (currency === 'COP') return amountUSD * rates.COP;
  return amountUSD;
}

/**
 * Convertir un monto en la moneda seleccionada a equivalente en USD.
 */
export function convertToUSD(amountOriginal: number, currency: Currency, rates: ExchangeRates = getSavedExchangeRates()): number {
  if (currency === 'VES' && rates.VES > 0) return amountOriginal / rates.VES;
  if (currency === 'COP' && rates.COP > 0) return amountOriginal / rates.COP;
  return amountOriginal;
}

/**
 * Formatear un monto USD en la moneda especificada para despliegue visual de alta legibilidad.
 */
export function formatCurrency(amountUSD: number, currency: Currency = 'USD', rates: ExchangeRates = getSavedExchangeRates()): string {
  if (currency === 'VES') {
    const ves = amountUSD * rates.VES;
    return `Bs. ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === 'COP') {
    const cop = amountUSD * rates.COP;
    return `$ ${cop.toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`;
  }
  return `$${amountUSD.toFixed(2)} USD`;
}

/**
 * Parsea una cadena de fecha YYYY-MM-DD o ISO a un objeto Date seguro en la zona horaria local.
 * Si es una fecha de vencimiento (YYYY-MM-DD), ajusta la hora a las 23:59:59 para cubrir todo el día.
 */
export function parseLocalDate(dateStr: string | undefined | null, endOfDay: boolean = true): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [year, month, day] = clean.split('-').map(Number);
    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Calcular la nueva fecha de vencimiento sumando días a la fecha actual o fecha previa.
 */
export function calculateNewExpirationDate(currentExpirationDate: string, daysToAdd: number = 30): string {
  const now = new Date();
  const exp = parseLocalDate(currentExpirationDate, true);

  // Si la fecha previa ya venció, renovar a partir de HOY. Si sigue vigente, extender desde la fecha previa.
  const baseDate = exp > now ? exp : now;
  const result = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  
  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, '0');
  const day = String(result.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Obtener los días restantes antes del vencimiento (considerando hora local).
 */
export function getDaysRemaining(expirationDate: string): number {
  if (!expirationDate) return 0;
  const exp = parseLocalDate(expirationDate, true);
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

