# 🏋️‍♂️ FitPass Gym — Control de Acceso Criptográfico & Monitoreo Realtime

Sistema de control de acceso enterprise para gimnasios de arquitectura multi-dispositivo y alta resiliencia. Permite validar la entrada de socios mediante escaneo de códigos QR criptográficos (AES-GCM) sin revelar PII o por búsqueda directa de Cédula (C.I.), transmitiendo los accesos en tiempo real (<30ms) a las pantallas de recepción.

![FitPass Header](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![AES-GCM](https://img.shields.io/badge/Security-AES--GCM_256bit-emerald?style=for-the-badge)

---

## 🌟 Características Clave

- 📱 **Terminal Escáner Móvil (`/scanner`):** Diseñada para smartphones del personal con cámara activa, encuadre visual, feedback sonoro Web Audio API y vibración háptica.
- 🖥️ **Pantalla de Recepción en Tiempo Real (`/reception`):** Transmisión instantánea de accesos por WebSockets (`<30ms`), despliegue del socio en grande, alerta de cuota morosa, confetti y panel de **Historial de Pases en Vivo**.
- 🛡️ **Seguridad Criptográfica AES-GCM:** Generación y desencriptación de tokens QR sin PII (nombres/apellidos en texto plano) usando Web Crypto API de 256 bits y Nonces anti-replay.
- 📶 **Resiliencia Offline-First PWA:** Registro de Service Worker PWA y caché local (`LocalStorage`) para mantener el escaneo y la verificación activos en caso de caídas de conexión a Internet.
- 👥 **Gestión de Socios y Morosidad (`/admin/members`):** Panel para registrar socios individuales, importación masiva desde Excel (`.xlsx`), cobro rápido de cuotas y renovación de membresías.
- 📊 **Auditoría de Accesos Diaria (`/admin/logs`):** Persistencia en base de datos PostgreSQL (`registros_acceso`) de cada entrada concedida o rechazada con timestamps completos todo el año.
- ☀️ **Diseño de Alto Contraste para Luz de Día:** Tema claro brillante con tipografía pesada (`Outfit` & `Plus Jakarta Sans`) optimizado para evitar reflejos solares en pantallas y teléfonos.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React 18, TypeScript, React Router v6, TailwindCSS, Lucide Icons, Canvas Confetti.
- **Criptografía & Audio:** Web Crypto API (SubtleCrypto AES-GCM), Web Audio API (OscillatorNode).
- **Backend & Database:** Supabase PostgreSQL, Realtime WebSockets, Stored Procedures (RPC SQL) y Row Level Security (RLS).
- **Excel & QR:** `xlsx`, `qrcode.react`, `jsQR`.

---

## 🚀 Instalación y Ejecución Local

### Prerrequisitos
- Node.js (v18+)
- npm o pnpm

### Pasos

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/fitpass-gym-access.git
   cd fitpass-gym-access/sistema-acceso
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno (`.env`):**
   Crea un archivo `.env` en la raíz con:
   ```env
   VITE_SUPABASE_URL=tu_supabase_url
   VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
   VITE_HMAC_SECRET=tu_clave_secreta_criptografica
   ```

4. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

5. Abrir en el navegador:
   - **Terminal Escáner:** `https://localhost:3000/scanner`
   - **Pantalla Recepción:** `https://localhost:3000/reception`

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
