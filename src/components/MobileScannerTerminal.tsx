import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff, Smartphone, ShieldCheck, Zap, CheckCircle2, XCircle, AlertTriangle, User } from 'lucide-react';
import jsQR from 'jsqr';
import { Member, AccessLog } from '../types';
import { verifyAccess } from '../services/supabaseService';
import { broadcastScanEvent } from '../utils/broadcast';
import { playAccessSound, primeAudioContext } from '../utils/audio';
import { generateUUID } from '../lib/crypto';

const SCAN_COOLDOWN_MS = 2500;

interface MobileScannerTerminalProps {
  members?: Member[];
  onLogAccess?: (log: AccessLog) => void;
}

export const MobileScannerTerminal: React.FC<MobileScannerTerminalProps> = ({
  members = [],
  onLogAccess,
}) => {
  const [manualInput, setManualInput] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [useCamera, setUseCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedToken, setLastScannedToken] = useState<string | null>(null);

  const [scanResult, setScanResult] = useState<{
    status: 'GRANTED' | 'DENIED';
    reason: string;
    member?: Member;
    timestamp: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanFrameTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const lastScannedTimeRef = useRef<number>(0);
  const scanningRef = useRef<boolean>(false);
  const membersRef = useRef<Member[]>(members);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const stopCameraStream = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleScanSuccess = async (token: string) => {
    const now = Date.now();
    if (now - lastScannedTimeRef.current < SCAN_COOLDOWN_MS) {
      return; // Cooldown anti-repetición
    }
    lastScannedTimeRef.current = now;

    // Pre-calentar Web Audio API en caso de que sea el primer escaneo
    primeAudioContext();

    setLastScannedToken(token);
    setTimeout(() => setLastScannedToken(null), 1500);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {
        // Ignorar si el navegador o dispositivo bloquea vibración
      }
    }

    // 1. Emitir evento por WebSocket / Broadcast a otros dispositivos (Pantalla de Recepción)
    await broadcastScanEvent({ token, timestamp: now });

    // 2. Verificar acceso localmente en la terminal escáner para feedback inmediato en pantalla
    const result = await verifyAccess(token, membersRef.current);
    setScanResult(result);

    // 3. Reproducir feedback sonoro (Chime ascendente / Buzzer de error)
    playAccessSound(result.status === 'GRANTED');

    // 4. Registrar evento en la lista de logs
    if (onLogAccess) {
      onLogAccess({
        id: generateUUID(),
        memberId: result.member?.id || 'UNKNOWN',
        memberName: result.member ? `${result.member.name} ${result.member.lastName}` : 'Desconocido',
        timestamp: new Date().toISOString(),
        status: result.status,
        reason: result.reason,
        debtAmount: result.member?.debtAmount,
        avatarUrl: result.member?.avatarUrl,
      });
    }

    // Auto-ocultar el modal de resultado tras 4.5 segundos
    setTimeout(() => {
      setScanResult(null);
    }, 4500);
  };

  const startCamera = async () => {
    setCameraError(null);
    setUseCamera(true);
    scanningRef.current = true;
    setScanning(true);

    try {
      let stream: MediaStream;
      try {
        // Intento 1: Cámara trasera (optimizada para móviles)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch (e) {
        // Intento 2: Webcam genérica de PC
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanFrame();
      }
    } catch (err: any) {
      console.error('Error accediendo a la cámara:', err);
      let msg = 'Permiso de cámara denegado o cámara no disponible.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permiso de cámara bloqueado en el navegador. Haz clic en el icono del candado o la cámara en la barra de direcciones y selecciona "Permitir".';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No se detectó ninguna cámara física conectada a este equipo.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'La cámara está siendo utilizada por otra aplicación (Zoom, Meet, etc.). Ciérrala y reintenta.';
      }
      setCameraError(msg);
      setUseCamera(false);
      scanningRef.current = false;
      setScanning(false);
    }
  };

  const scanFrame = () => {
    if (!scanningRef.current) return;
    const now = performance.now();

    // Limitación de frecuencia: máximo ~10 FPS (100ms entre análisis) para ahorrar CPU/memoria
    if (now - lastScanFrameTimeRef.current >= 100) {
      lastScanFrameTimeRef.current = now;

      // Bloqueo de procesamiento: no procesar mientras se verifica un token previo
      if (!isProcessingRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          // Escalar canvas a máximo 640x480 para mantener uso de CPU extremadamente bajo
          const targetWidth = Math.min(video.videoWidth, 640);
          const targetHeight = Math.min(video.videoHeight, 480);

          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
          }

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (code && code.data) {
              isProcessingRef.current = true;
              handleScanSuccess(code.data).finally(() => {
                setTimeout(() => {
                  isProcessingRef.current = false;
                }, SCAN_COOLDOWN_MS);
              });
            }
          }
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    if (useCamera) {
      startCamera();
    }
    return () => {
      scanningRef.current = false;
      stopCameraStream();
    };
  }, [useCamera, stopCameraStream]);

  const toggleCamera = () => {
    if (useCamera) {
      scanningRef.current = false;
      stopCameraStream();
      setUseCamera(false);
      setScanning(false);
    } else {
      startCamera();
    }
  };

  const handleManualScan = () => {
    if (!manualInput.trim()) return;
    handleScanSuccess(manualInput.trim());
    setManualInput('');
  };

  return (
    <div className="max-w-md mx-auto h-[calc(100vh-5rem)] flex flex-col bg-slate-100 relative overflow-hidden">
      {/* Header Escáner Móvil Claro */}
      <div className="p-4 bg-white border-b-2 border-slate-200 flex items-center justify-between shadow-md">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Smartphone className="w-6 h-6 text-emerald-600 stroke-[2.5]" />
            Terminal de Escaneo QR
          </h2>
          <p className="text-xs font-bold text-slate-600 mt-1">
            Apunta la cámara al QR o ingresa la C.I. del socio.
          </p>
        </div>
      </div>

      {/* Área del Visor de la Cámara */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-black overflow-hidden">
        {useCamera ? (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Guía de encuadre visual con alto contraste */}
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-4 border-emerald-400 rounded-3xl relative animate-pulse shadow-[0_0_40px_rgba(52,211,153,0.5)]">
                <div className="absolute top-0 left-0 w-9 h-9 border-t-8 border-l-8 border-emerald-300 rounded-tl-2xl -mt-2 -ml-2"></div>
                <div className="absolute top-0 right-0 w-9 h-9 border-t-8 border-r-8 border-emerald-300 rounded-tr-2xl -mt-2 -mr-2"></div>
                <div className="absolute bottom-0 left-0 w-9 h-9 border-b-8 border-l-8 border-emerald-300 rounded-bl-2xl -mb-2 -ml-2"></div>
                <div className="absolute bottom-0 right-0 w-9 h-9 border-b-8 border-r-8 border-emerald-300 rounded-br-2xl -mb-2 -mr-2"></div>
              </div>
            </div>

            {/* Flashing de confirmación al escanear */}
            {lastScannedToken && (
              <div className="absolute inset-0 z-20 bg-emerald-500/40 transition-colors duration-300 pointer-events-none" />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-100 h-full w-full">
            {cameraError ? (
              <>
                <CameraOff className="w-16 h-16 text-rose-600 mb-4 stroke-[2.5]" />
                <p className="text-base font-extrabold text-rose-950 max-w-xs">{cameraError}</p>
              </>
            ) : (
              <>
                <CameraOff className="w-16 h-16 text-slate-500 mb-4 stroke-[2]" />
                <p className="text-base font-extrabold text-slate-800">Cámara pausada</p>
              </>
            )}
            <button
              onClick={startCamera}
              className="mt-6 bg-emerald-600 text-white px-7 py-3 rounded-2xl text-sm font-black shadow-xl hover:bg-emerald-700 transition-all border-2 border-emerald-500"
            >
              Reintentar Cámara
            </button>
          </div>
        )}

        <button
          onClick={toggleCamera}
          className="absolute top-4 right-4 z-30 bg-white/90 p-3 rounded-2xl border-2 border-slate-300 text-slate-900 shadow-2xl"
        >
          {useCamera ? <CameraOff className="w-6 h-6 stroke-[2.5]" /> : <Camera className="w-6 h-6 stroke-[2.5]" />}
        </button>

        {/* OVERLAY DE RESULTADO EN MODO CLARO DE ALTA VISIBILIDAD */}
        {scanResult && (
          <div className="absolute inset-x-3 top-3 z-40 animate-in fade-in slide-in-from-top-4 duration-300">
            <div
              className={`p-4 sm:p-5 rounded-3xl border-4 shadow-2xl backdrop-blur-xl flex items-center gap-4 ${
                scanResult.status === 'GRANTED'
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-2xl'
                  : 'bg-rose-600 border-rose-400 text-white shadow-2xl'
              }`}
            >
              {scanResult.member?.avatarUrl ? (
                <img
                  src={scanResult.member.avatarUrl}
                  alt=""
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white shrink-0 shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border-2 border-white/40">
                  <User className="w-8 h-8 text-white" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {scanResult.status === 'GRANTED' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black bg-slate-950 text-emerald-400 px-3 py-1 rounded-lg uppercase tracking-wider shadow">
                      <CheckCircle2 className="w-4 h-4 stroke-[3]" /> CONCEDIDO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black bg-slate-950 text-rose-400 px-3 py-1 rounded-lg uppercase tracking-wider shadow">
                      <XCircle className="w-4 h-4 stroke-[3]" /> DENEGADO
                    </span>
                  )}
                </div>

                <h4 className="text-lg font-black truncate leading-tight tracking-tight text-white drop-shadow">
                  {scanResult.member
                    ? `${scanResult.member.name} ${scanResult.member.lastName}`
                    : 'Código / C.I. Desconocido'}
                </h4>
                <p className="text-xs font-bold text-white/90 mt-1 truncate">
                  {scanResult.reason}
                </p>
              </div>

              <button
                onClick={() => setScanResult(null)}
                className="text-white hover:text-slate-200 p-1 text-xl font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Panel de Ingreso Manual Claro de Alto Contraste */}
      <div className="p-4 bg-white border-t-2 border-slate-200 shadow-2xl">
        <label className="block text-xs font-black text-slate-900 mb-2 uppercase tracking-wider">
          Ingreso Manual por Cédula (C.I.) o Token
        </label>
        <div className="flex gap-2.5">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
            placeholder="Ej. 18492048 o V-18492048"
            className="flex-1 bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-2xl px-4 py-3.5 text-base font-bold text-slate-900 placeholder-slate-500 focus:outline-none font-mono shadow-inner"
          />
          <button
            onClick={handleManualScan}
            disabled={!manualInput.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all text-sm shadow-xl shrink-0 border-2 border-emerald-500"
          >
            <Zap className="w-5 h-5 fill-current" /> Verificar
          </button>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 text-xs font-extrabold text-slate-700 text-center flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          Transmisión En Tiempo Real al Monitor de Recepción
        </div>
      </div>
    </div>
  );
};
