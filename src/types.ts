export type MemberStatus = 'ACTIVE' | 'DEBTOR' | 'EXPIRED';
export type Currency = 'USD' | 'VES' | 'COP';
export type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Pago Móvil';

export interface ExchangeRates {
  VES: number; // Tasa de cambio Bolívares (ej. 36.5 Bs / USD)
  COP: number; // Tasa de cambio Pesos Colombianos (ej. 3900 COP / USD)
}

export interface Member {
  id: string;
  qrToken: string;
  name: string;
  lastName: string;
  dni: string;
  phone: string;
  email: string;
  status: MemberStatus;
  debtAmount: number;
  expirationDate: string;
  avatarUrl: string;
  planName: string;
}

export interface AccessLog {
  id: string;
  memberId: string;
  memberName: string;
  timestamp: string;
  status: 'GRANTED' | 'DENIED';
  reason: string;
  debtAmount?: number;
  avatarUrl?: string;
}

export interface PaymentRecord {
  id: string;
  memberId: string;
  memberName: string;
  amountUSD: number;
  amountOriginal: number;
  currency: Currency;
  exchangeRate: number;
  date: string;
  method: PaymentMethod;
  newExpirationDate: string;
  note?: string;
}

export interface MembershipHistory {
  id: string;
  memberId: string;
  planName: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVA' | 'PAUSADA' | 'VENCIDA' | 'CANCELADA';
  pauseReason?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  tableAffected: string;
  operation: string;
  memberId?: string;
  details: Record<string, unknown>;
  performedBy: string;
  createdAt: string;
}

export interface ExpiringMemberView {
  id: string;
  qrToken: string;
  name: string;
  lastName: string;
  dni: string;
  email: string;
  phone: string;
  planName: string;
  expirationDate: string;
  daysRemaining: number;
  debtAmount: number;
  status: string;
}

export interface FinancialSummaryView {
  month: string;
  paymentMethod: PaymentMethod;
  totalTransactions: number;
  totalCollectedUSD: number;
}

export interface DailyAttendanceView {
  date: string;
  accessStatus: 'GRANTED' | 'DENIED';
  totalAccesses: number;
}

