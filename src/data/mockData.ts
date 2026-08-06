import { Member, AccessLog } from '../types';

export const initialMembers: Member[] = [
  {
    id: 'MEM-001',
    qrToken: 'GYM-PASS-9B1D-CARLOS-SILVA',
    name: 'Carlos',
    lastName: 'Silva',
    dni: '18492048',
    phone: '+54 9 11 4829-1029',
    email: 'carlos.silva@email.com',
    status: 'ACTIVE',
    debtAmount: 0,
    expirationDate: '2026-08-25',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    planName: 'Pase Total VIP (Mensual)'
  },
  {
    id: 'MEM-002',
    qrToken: 'GYM-PASS-4A2E-VALENTINA-RODRIGUEZ',
    name: 'Valentina',
    lastName: 'Rodríguez',
    dni: '29481029',
    phone: '+54 9 11 5920-1182',
    email: 'v.rodriguez@email.com',
    status: 'DEBTOR',
    debtAmount: 35.00,
    expirationDate: '2026-07-20',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
    planName: 'Musculación Standard'
  },
  {
    id: 'MEM-003',
    qrToken: 'GYM-PASS-7C8F-MATIAS-GOMEZ',
    name: 'Matías',
    lastName: 'Gómez',
    dni: '38192049',
    phone: '+54 9 11 3910-4492',
    email: 'matias.gomez@email.com',
    status: 'ACTIVE',
    debtAmount: 0,
    expirationDate: '2026-09-01',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    planName: 'Crossfit & Funcional'
  },
  {
    id: 'MEM-004',
    qrToken: 'GYM-PASS-1E3D-LUCIA-FERNANDEZ',
    name: 'Lucía',
    lastName: 'Fernández',
    dni: '41029384',
    phone: '+54 9 11 6720-9931',
    email: 'lucia.f@email.com',
    status: 'EXPIRED',
    debtAmount: 45.00,
    expirationDate: '2026-06-15',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
    planName: 'Pase Libre Anual'
  }
];

export const initialLogs: AccessLog[] = [
  {
    id: 'LOG-101',
    memberId: 'MEM-001',
    memberName: 'Carlos Silva',
    timestamp: '2026-07-28 14:10:02',
    status: 'GRANTED',
    reason: 'Acceso Autorizado (Cuota al día)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'LOG-100',
    memberId: 'MEM-002',
    memberName: 'Valentina Rodríguez',
    timestamp: '2026-07-28 13:45:12',
    status: 'DENIED',
    reason: 'Saldo Pendiente Adeudado',
    debtAmount: 35.00,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200'
  }
];
