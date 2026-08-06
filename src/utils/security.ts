/**
 * MÓDULO DE SEGURIDAD Y PROTECCIÓN DE TERMINAL (Kiosk Anti-Tampering & DevTools Shield)
 * Previene la inspección de elementos, alteración del DOM y atajos de navegador.
 */

const IS_PROD = import.meta.env.PROD === true;

/**
 * Inicializa las protecciones de seguridad del cliente.
 */
export function initSecurityHardening() {
  if (typeof window === 'undefined') return;

  // 1. Bloquear Clic Derecho (Menú de Contexto) en la aplicación
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  }, { capture: true });

  // 2. Bloquear atajos de teclado de Herramientas de Desarrollador (DevTools)
  window.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Ctrl+Shift+I / Cmd+Option+I (Inspeccionar)
    // Ctrl+Shift+J / Cmd+Option+J (Consola)
    // Ctrl+Shift+C (Seleccionar Elemento)
    // Ctrl+U (Ver Código Fuente)
    // Ctrl+S (Guardar Página)
    if (ctrlOrCmd && (
      (shift && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
      e.key === 'U' || e.key === 'u' ||
      e.key === 'S' || e.key === 's'
    )) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // 3. Prevenir arrastrar imágenes o seleccionar textos críticos
  window.addEventListener('dragstart', (e) => e.preventDefault());

  // 4. En producción: Silenciar la consola y activar la trampa de depuración (Anti-DevTools Loop)
  if (IS_PROD) {
    // Deshabilitar funciones de consola para evitar inyección de código desde la consola
    const noop = () => {};
    window.console.log = noop;
    window.console.debug = noop;
    window.console.info = noop;
    window.console.warn = noop;

    // Trampa de depuración continua si alguien intenta abrir DevTools
    setInterval(() => {
      const startTime = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const endTime = performance.now();
      if (endTime - startTime > 100) {
        // DevTools detectado — limpiar pantalla e inhabilitar vista
        console.clear();
      }
    }, 1000);
  }

  console.log('[Security] Protecciones de terminal y anti-inspección activadas correctamente.');
}
