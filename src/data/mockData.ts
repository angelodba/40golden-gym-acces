import { Member, AccessLog } from '../types';
import { getMemberAvatarUrl } from '../utils/avatarUtils';

export const initialMembers: Member[] = [
  {
    id: 'MEM-001',
    qrToken: 'GYM-PASS-9B1D-CARLOS-SILVA',
    name: 'Carlos',
    lastName: 'Silva',
    dni: '18492048',
    phone: '+58 414 4829-1029',
    email: 'carlos.silva@email.com',
    status: 'ACTIVE',
    debtAmount: 0,
    expirationDate: '2026-08-25',
    avatarUrl: getMemberAvatarUrl('Carlos', 'Silva'),
    planName: 'Pase Total VIP (Mensual)'
  },
  {
    id: 'MEM-002',
    qrToken: 'GYM-PASS-4A2E-VALENTINA-RODRIGUEZ',
    name: 'Valentina',
    lastName: 'Rodríguez',
    dni: '29481029',
    phone: '+58 412 5920-1182',
    email: 'v.rodriguez@email.com',
    status: 'DEBTOR',
    debtAmount: 35.00,
    expirationDate: '2026-07-20',
    avatarUrl: getMemberAvatarUrl('Valentina', 'Rodríguez'),
    planName: 'Musculación Standard'
  },
  {
    id: 'MEM-003',
    qrToken: 'GYM-PASS-7C8F-MATIAS-GOMEZ',
    name: 'Matías',
    lastName: 'Gómez',
    dni: '38192049',
    phone: '+58 424 3910-4492',
    email: 'matias.gomez@email.com',
    status: 'ACTIVE',
    debtAmount: 0,
    expirationDate: '2026-09-01',
    avatarUrl: getMemberAvatarUrl('Matías', 'Gómez'),
    planName: 'Crossfit & Funcional'
  },
  {
    id: 'MEM-004',
    qrToken: 'GYM-PASS-1E3D-LUCIA-FERNANDEZ',
    name: 'Lucía',
    lastName: 'Fernández',
    dni: '41029384',
    phone: '+58 416 6720-9931',
    email: 'lucia.f@email.com',
    status: 'EXPIRED',
    debtAmount: 45.00,
    expirationDate: '2026-06-15',
    avatarUrl: getMemberAvatarUrl('Lucía', 'Fernández'),
    planName: 'Pase Libre Anual'
  }
];

export const initialLogs: AccessLog[] = [
  {
    id: 'LOG-101',
    memberId: 'MEM-001',
    memberName: 'Carlos Silva',
    timestamp: '2026-08-06 14:10:02',
    status: 'GRANTED',
    reason: 'Acceso Autorizado (Cuota al día)',
    avatarUrl: getMemberAvatarUrl('Carlos', 'Silva')
  },
  {
    id: 'LOG-100',
    memberId: 'MEM-002',
    memberName: 'Valentina Rodríguez',
    timestamp: '2026-08-06 13:45:12',
    status: 'DENIED',
    reason: 'Saldo Pendiente Adeudado',
    debtAmount: 35.00,
    avatarUrl: getMemberAvatarUrl('Valentina', 'Rodríguez')
  }
];
