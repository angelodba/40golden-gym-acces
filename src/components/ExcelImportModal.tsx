import React, { useState } from 'react';
import { Member } from '../types';
import { parseExcelFile, downloadSampleExcel, ImportPreviewItem } from '../utils/excelUtils';
import { FileSpreadsheet, Upload, Download, CheckCircle, AlertTriangle, X, RefreshCw, Users, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateUUID } from '../lib/crypto';

interface ExcelImportModalProps {
  existingMembers: Member[];
  onClose: () => void;
  onImportSuccess: (importedMembers: Member[]) => Promise<void>;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  existingMembers,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const existingDnis = new Set(existingMembers.map((m) => m.dni.trim().toLowerCase()));

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setParsing(true);
    setErrorMsg(null);

    try {
      const parsed = await parseExcelFile(selectedFile);
      if (parsed.length === 0) {
        setErrorMsg('El archivo Excel no contiene filas de datos válidas.');
      } else {
        setPreviewItems(parsed);
      }
    } catch (err) {
      console.error('Error al leer Excel:', err);
      setErrorMsg('No se pudo leer el archivo Excel. Asegúrate de que tenga formato .xlsx, .xls o .csv');
    } finally {
      setParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    // Filter valid AND non-duplicate items before sending to Supabase
    const validItems = previewItems.filter(
      (item) => item.isValid && !existingDnis.has(item.dni.trim().toLowerCase())
    );
    const skippedDuplicates = previewItems.filter(
      (item) => item.isValid && existingDnis.has(item.dni.trim().toLowerCase())
    ).length;

    if (validItems.length === 0) {
      setErrorMsg('No hay registros nuevos para importar. Todos los DNI ya están registrados.');
      return;
    }

    setImporting(true);
    setErrorMsg(null);

    try {
      const now = new Date();
      const expirationDate = new Date(now.valueOf() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const newMembers: Member[] = validItems.map((item, index) => ({
        id: item.id || generateUUID(),
        qrToken: item.qrToken,
        name: item.name,
        lastName: item.lastName,
        dni: item.dni,
        phone: item.phone,
        email: item.email,
        status: item.debtAmount > 0 ? 'DEBTOR' : 'ACTIVE',
        debtAmount: item.debtAmount,
        expirationDate: expirationDate,
        avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + (index * 13) % 1000}?auto=format&fit=crop&q=80&w=200`,
        planName: item.planName || 'Musculación Standard',
      }));

      await onImportSuccess(newMembers);

      // Lanzar confeti de celebración al importar masivamente con éxito
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      if (skippedDuplicates > 0) {
        alert(`Éxito: ${newMembers.length} clientes importados. ${skippedDuplicates} registros omitidos por DNI duplicado.`);
      }

      onClose();
    } catch (err) {
      console.error('Error al importar en base de datos:', err);
      setErrorMsg('Ocurrió un error al guardar los clientes en la base de datos. Verifica la conexión a Supabase.');
    } finally {
      setImporting(false);
    }
  };

  const validCount = previewItems.filter((i) => i.isValid).length;
  const duplicateCount = previewItems.filter((i) => existingDnis.has(i.dni.toLowerCase())).length;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Importación Masiva de Clientes desde Excel / CSV
              </h3>
              <p className="text-xs text-slate-400">
                Cada cliente importado tendrá un código QR único firmado criptográficamente asignado en la base de datos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-xl hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload or Download Sample */}
        {!file && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/50 rounded-2xl p-8 text-center space-y-4 transition-colors cursor-pointer"
              onClick={() => {
                const el = document.getElementById('excel-file-input');
                if (el) el.click();
              }}
            >
              <input
                id="excel-file-input"
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-slate-800 text-emerald-400 shadow-inner">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-200">
                  Arrastra y suelta tu archivo Excel (.xlsx, .xls) o CSV aquí
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  O haz clic para seleccionar el archivo en tu equipo
                </p>
              </div>
              <div className="inline-block bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] text-slate-400">
                Columnas soportadas: <span className="text-emerald-400 font-mono">Nombre Completo, Cédula de Identidad, Teléfono, Plan, Deuda</span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-xs font-bold text-slate-200">¿No tienes la tabla con el formato listo?</p>
                  <p className="text-[11px] text-slate-400">Descarga nuestra plantilla de Excel lista con las columnas estándar.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadSampleExcel}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" /> Descargar Plantilla Excel (.xlsx)
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {parsing && (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-300 font-medium">
              Analizando archivo Excel y generando códigos QR únicos criptográficos para cada cliente...
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs font-semibold">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 2: Data Preview Table */}
        {file && !parsing && previewItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">
                  Archivo: <span className="text-emerald-400 font-mono">{file.name}</span> ({previewItems.length} registros detectados)
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> {validCount} Válidos
                </span>
                {duplicateCount > 0 && (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {duplicateCount} DNI ya registrados
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewItems([]);
                  }}
                  className="text-slate-400 hover:text-slate-200 underline text-[11px]"
                >
                  Cambiar archivo
                </button>
              </div>
            </div>

            {/* Preview Scrollable Table */}
            <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Nombre Completo</th>
                    <th className="py-2.5 px-3">Cédula / DNI</th>
                    <th className="py-2.5 px-3">Teléfono</th>
                    <th className="py-2.5 px-3">Plan</th>
                    <th className="py-2.5 px-3">Deuda</th>
                    <th className="py-2.5 px-3">Código QR Asignado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {previewItems.map((item, idx) => {
                    const isDuplicate = existingDnis.has(item.dni.toLowerCase());
                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-200">
                          {item.name} {item.lastName}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-300">
                          {item.dni}
                          {isDuplicate && (
                            <span className="ml-1.5 text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                              Duplicado
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-400">{item.phone}</td>
                        <td className="py-2 px-3 text-slate-300">{item.planName}</td>
                        <td className="py-2 px-3">
                          {item.debtAmount > 0 ? (
                            <span className="text-rose-400 font-bold">${item.debtAmount.toFixed(2)}</span>
                          ) : (
                            <span className="text-emerald-400 font-medium">$0.00</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400">
                            <ShieldCheck className="w-3 h-3" /> QR Criptográfico
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || validCount === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Guardando en Base de Datos...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Confirmar e Importar {validCount} Clientes con QR
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
