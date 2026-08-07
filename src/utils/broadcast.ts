import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const LOCAL_CHANNEL_NAME = 'gym_access_local_channel';
const SUPABASE_CHANNEL_NAME = 'gym-access-events';

// Client ID único para evitar bucles de retroalimentación circular en la misma sesión
export const CLIENT_ID = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

export interface ScanPayload {
  token: string;
  timestamp: number;
  senderId?: string;
}

let localChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  localChannel = new BroadcastChannel(LOCAL_CHANNEL_NAME);
}

const listeners: Set<(payload: ScanPayload) => void> = new Set();

let supabaseChannel: any = null;

function initSupabaseRealtime() {
  if (!isSupabaseConfigured || !supabase || supabaseChannel) return;

  // Supabase Realtime SDK v2 REQUIRES .on() BEFORE .subscribe()
  supabaseChannel = supabase.channel(SUPABASE_CHANNEL_NAME);
  
  supabaseChannel
    .on('broadcast', { event: 'MEMBER_SCANNED' }, (payload: any) => {
      console.log('[broadcast.ts] Evento MEMBER_SCANNED recibido vía Supabase:', payload);
      if (payload && payload.payload) {
        const data: ScanPayload = payload.payload;
        // Filtrar eventos generados por este mismo cliente para evitar bucles circulares
        if (data.senderId === CLIENT_ID) return;
        listeners.forEach((fn) => fn(data));
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

export const broadcastScanEvent = async (payload: ScanPayload) => {
  const fullPayload: ScanPayload = {
    ...payload,
    senderId: payload.senderId || CLIENT_ID,
  };

  console.log('[broadcastScanEvent] Emitiendo token escaneado:', fullPayload.token);

  if (isSupabaseConfigured && supabase) {
    initSupabaseRealtime();
    if (supabaseChannel) {
      try {
        await supabaseChannel.send({
          type: 'broadcast',
          event: 'MEMBER_SCANNED',
          payload: fullPayload,
        });
      } catch (err) {
        console.warn('[broadcastScanEvent] Error enviando broadcast por Supabase:', err);
      }
    }
  }

  // Notificar por BroadcastChannel del navegador para OTRAS pestañas locales
  if (localChannel) {
    localChannel.postMessage({
      event: 'MEMBER_SCANNED',
      payload: fullPayload,
    });
  }
};

export const subscribeToScanEvents = (callback: (payload: ScanPayload) => void) => {
  listeners.add(callback);
  initSupabaseRealtime();

  const handleLocalMessage = (event: MessageEvent) => {
    if (event.data?.event === 'MEMBER_SCANNED' && event.data.payload) {
      const data: ScanPayload = event.data.payload;
      // Descartar eventos autogenerados por esta misma pestaña
      if (data.senderId === CLIENT_ID) return;
      console.log('[broadcast.ts] Evento MEMBER_SCANNED recibido vía BroadcastChannel local:', data);
      callback(data);
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
