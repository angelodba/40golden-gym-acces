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
 * Calcular la nueva fecha de vencimiento sumando días a la fecha actual o fecha previa.
 */
export function calculateNewExpirationDate(currentExpirationDate: string, daysToAdd: number = 30): string {
  const now = new Date();
  const exp = new Date(currentExpirationDate);

  // Si la fecha previa ya venció, renovar a partir de HOY. Si sigue vigente, extender desde la fecha previa.
  const baseDate = exp > now ? exp : now;
  const result = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  return result.toISOString().split('T')[0];
}

/**
 * Obtener los días restantes antes del vencimiento.
 */
export function getDaysRemaining(expirationDate: string): number {
  const exp = new Date(expirationDate);
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
