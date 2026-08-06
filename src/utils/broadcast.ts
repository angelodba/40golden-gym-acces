import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const LOCAL_CHANNEL_NAME = 'gym_access_local_channel';
const SUPABASE_CHANNEL_NAME = 'gym-access-events';

let localChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  localChannel = new BroadcastChannel(LOCAL_CHANNEL_NAME);
}

const listeners: Set<(payload: { token: string; timestamp: number }) => void> = new Set();

let supabaseChannel: any = null;

function initSupabaseRealtime() {
  if (!isSupabaseConfigured || !supabase || supabaseChannel) return;

  // Supabase Realtime SDK v2 REQUIRES .on() BEFORE .subscribe()
  supabaseChannel = supabase.channel(SUPABASE_CHANNEL_NAME);
  
  supabaseChannel
    .on('broadcast', { event: 'MEMBER_SCANNED' }, (payload: any) => {
      console.log('[broadcast.ts] Evento MEMBER_SCANNED recibido vía Supabase:', payload);
      if (payload && payload.payload) {
        listeners.forEach((fn) => fn(payload.payload));
      }
    })
    .subscribe((status: string) => {
      console.log('[broadcast.ts] Estado suscripción canal Supabase:', status);
    });
}

// Inicializar en carga del módulo
if (typeof window !== 'undefined') {
  initSupabaseRealtime();
}

export const broadcastScanEvent = async (payload: { token: string; timestamp: number }) => {
  console.log('[broadcastScanEvent] Emitiendo token escaneado:', payload.token);

  if (isSupabaseConfigured && supabase) {
    initSupabaseRealtime();
    if (supabaseChannel) {
      try {
        await supabaseChannel.send({
          type: 'broadcast',
          event: 'MEMBER_SCANNED',
          payload,
        });
      } catch (err) {
        console.warn('[broadcastScanEvent] Error enviando broadcast por Supabase:', err);
      }
    }
  }

  // Notificar inmediatamente a listeners locales (en la misma pestaña/app)
  listeners.forEach((fn) => fn(payload));

  // Enviar por BroadcastChannel del navegador para otras pestañas locales
  if (localChannel) {
    localChannel.postMessage({
      event: 'MEMBER_SCANNED',
      payload,
    });
  }
};

export const subscribeToScanEvents = (callback: (payload: { token: string; timestamp: number }) => void) => {
  listeners.add(callback);
  initSupabaseRealtime();

  const handleLocalMessage = (event: MessageEvent) => {
    if (event.data?.event === 'MEMBER_SCANNED' && event.data.payload) {
      console.log('[broadcast.ts] Evento MEMBER_SCANNED recibido vía BroadcastChannel local:', event.data.payload);
      callback(event.data.payload);
    }
  };

  if (localChannel) {
    localChannel.addEventListener('message', handleLocalMessage);
  }

  return () => {
    listeners.delete(callback);
    if (localChannel) {
      localChannel.removeEventListener('message', handleLocalMessage);
    }
  };
};
