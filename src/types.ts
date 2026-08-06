export type MemberStatus = 'ACTIVE' | 'DEBTOR' | 'EXPIRED';

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
  amount: number;
  date: string;
  method: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  note?: string;
}
