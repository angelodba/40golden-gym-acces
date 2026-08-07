import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Member } from './types';
import { Navbar } from './components/Navbar';
import { MobileScannerTerminal } from './components/MobileScannerTerminal';
import { ReceptionDisplayDashboard } from './components/ReceptionDisplayDashboard';
import { AdminMembers } from './components/AdminMembers';
import { AccessLogs } from './components/AccessLogs';
import { PaymentModal } from './components/PaymentModal';
import { useMembers } from './hooks/useMembers';
import { useAccessLogs } from './hooks/useAccessLogs';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { members, loading: membersLoading, addMember, addMembersBatch, handlePaymentSuccess } = useMembers();
  const { logs, loading: logsLoading, logAccess, clearLogs } = useAccessLogs();

  const [paymentModalMember, setPaymentModalMember] = useState<Member | null>(null);

  const debtorCount = members.filter((m) => m.debtAmount > 0).length;

  if (membersLoading || logsLoading) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center font-['Plus_Jakarta_Sans',sans-serif]">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-3" />
        <p className="text-base font-black text-slate-800">Cargando Sistema de Acceso 40GOLDEN GYM...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navbar */}
      <Navbar debtorCount={debtorCount} />

      {/* Declarative Routes */}
      <main className="flex-1 py-6">
        <Routes>
          <Route
            path="/scanner"
            element={
              <MobileScannerTerminal
                members={members}
                onLogAccess={logAccess}
              />
            }
          />
          <Route
            path="/reception"
            element={
              <ReceptionDisplayDashboard
                members={members}
                logs={logs}
                onLogAccess={logAccess}
                onOpenPaymentModal={(member) => setPaymentModalMember(member)}
              />
            }
          />
          <Route
            path="/admin/members"
            element={
              <AdminMembers
                members={members}
                onAddMember={addMember}
                onAddMembersBatch={addMembersBatch}
                onOpenPaymentModal={(member) => setPaymentModalMember(member)}
              />
            }
          />
          <Route path="/admin/logs" element={<AccessLogs logs={logs} onClearLogs={clearLogs} />} />
          <Route path="*" element={<Navigate to="/reception" replace />} />
        </Routes>
      </main>

      {/* Settle Debt Payment Modal */}
      {paymentModalMember && (
        <PaymentModal
          member={paymentModalMember}
          onClose={() => setPaymentModalMember(null)}
          onPaymentSuccess={async (memberId, amount, method) => {
            await handlePaymentSuccess(memberId, amount, method);
          }}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t-2 border-slate-200 py-4 text-center text-xs font-bold text-slate-600 shadow-sm">
        <p>40GOLDEN GYM • System Control Acceso QR Criptográfico Multi-Moneda & Supabase Realtime</p>
      </footer>
    </div>
  );
};

export default App;
