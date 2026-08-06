// =====================================================================
// WEB AUDIO API — Feedback sonoro para verificación de acceso QR
// Soluciona Autoplay Policy de navegadores modernos (Chrome, Safari, Firefox)
// =====================================================================

// Singleton de AudioContext — reutilizar la misma instancia evita límites del navegador
let _audioCtx: AudioContext | null = null;

/**
 * Obtiene o crea el AudioContext singleton.
 * Si el contexto está suspendido (política de autoplay), lo reanuda.
 * DEBE llamarse después de un gesto del usuario para cumplir las políticas del navegador.
 */
async function getAudioContext(): Promise<AudioContext | null> {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!_audioCtx) {
      _audioCtx = new AudioContextClass();
    }

    // Reanudar el contexto si fue suspendido por política de autoplay
    if (_audioCtx.state === 'suspended') {
      await _audioCtx.resume();
    }

    return _audioCtx;
  } catch (e) {
    console.warn('[Audio] No se pudo inicializar AudioContext:', e);
    return null;
  }
}

/**
 * Toca un tono de acceso concedido (doble beep ascendente) o denegado (buzz descendente).
 * Funciona correctamente en Chrome, Firefox y Safari móvil.
 * Se llama dentro de un handler de click/touch, lo que garantiza cumplir con autoplay policies.
 */
export const playAccessSound = async (granted: boolean): Promise<void> => {
  const ctx = await getAudioContext();
  if (!ctx) return;

  try {
    if (granted) {
      // Doble beep ascendente — acceso concedido
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);       // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);   // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.38);

      // Liberar nodos después de terminar para evitar memory leaks
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } else {
      // Buzz / error tone descendente — acceso denegado
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.setValueAtTime(110, ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.52);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.52);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  } catch (e) {
    console.warn('[Audio] Error al reproducir sonido:', e);
  }
};

/**
 * Función para pre-calentar el AudioContext en el primer gesto del usuario.
 * Llamar desde cualquier botón de la UI para garantizar que el audio funcione
 * en la primera verificación QR sin retardos.
 */
export const primeAudioContext = async (): Promise<void> => {
  await getAudioContext();
};
