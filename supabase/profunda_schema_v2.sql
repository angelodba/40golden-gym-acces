-- =====================================================================
-- ESQUEMA PROFUNDO Y ROBUSTO DE BASE DE DATOS (POSTGRESQL / SUPABASE) v2.0
-- Sistema de Control de Acceso, Auditoría y Gestión de Membresías - Golden Gym
-- =====================================================================
-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 2. Tabla de Planes de Suscripción
CREATE TABLE IF NOT EXISTS public.planes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    duracion_dias INT DEFAULT 30,
    descripcion TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 3. Tabla Principal de Socios (Clientes del Gimnasio)
CREATE TABLE IF NOT EXISTS public.socios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qr_token VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni VARCHAR(30) UNIQUE NOT NULL,
    telefono VARCHAR(30),
    email VARCHAR(150),
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (
        estado IN ('ACTIVO', 'MOROSO', 'VENCIDO', 'SUSPENDIDO')
    ),
    saldo_pendiente DECIMAL(10, 2) DEFAULT 0.00 CHECK (saldo_pendiente >= 0),
    fecha_vencimiento DATE NOT NULL,
    foto_url TEXT,
    plan_nombre VARCHAR(100) DEFAULT 'Musculación Standard',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 4. Tabla de Historial de Membresías y Congelamiento (Pausas)
CREATE TABLE IF NOT EXISTS public.historial_membresias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    socio_id UUID NOT NULL REFERENCES public.socios(id) ON DELETE CASCADE,
    plan_nombre VARCHAR(100) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado_membresia VARCHAR(30) DEFAULT 'ACTIVA' CHECK (
        estado_membresia IN ('ACTIVA', 'PAUSADA', 'VENCIDA', 'CANCELADA')
    ),
    motivo_pausa TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 5. Tabla de Registro Histórico de Pagos
CREATE TABLE IF NOT EXISTS public.pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    socio_id UUID REFERENCES public.socios(id) ON DELETE CASCADE,
    monto DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
    monto_original DECIMAL(10, 2),
    moneda VARCHAR(10) DEFAULT 'USD',
    tasa_cambio DECIMAL(10, 4) DEFAULT 1.0000,
    metodo_pago VARCHAR(30) CHECK (
        metodo_pago IN (
            'Efectivo',
            'Tarjeta',
            'Transferencia',
            'Pago Móvil'
        )
    ),
    concepto VARCHAR(150) DEFAULT 'Cuota Mensual / Cancelación Deuda',
    fecha_vencimiento_resultante DATE,
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 6. Tabla de Registro de Accesos (Escaneos en Recepción)
CREATE TABLE IF NOT EXISTS public.registros_acceso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    socio_id UUID REFERENCES public.socios(id) ON DELETE
    SET NULL,
        socio_nombre VARCHAR(200) NOT NULL,
        estado_acceso VARCHAR(20) CHECK (estado_acceso IN ('GRANTED', 'DENIED')),
        motivo TEXT,
        monto_adeudado DECIMAL(10, 2) DEFAULT 0.00,
        fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 7. Tabla Anti-Replay para Códigos QR Criptográficos (Nonces)
CREATE TABLE IF NOT EXISTS public.qr_nonces (
    nonce VARCHAR(64) PRIMARY KEY,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 8. Tabla de Auditoría del Sistema (Logs de Operaciones Sensibles)
CREATE TABLE IF NOT EXISTS public.auditoria_sistema (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tabla_afectada VARCHAR(100) NOT NULL,
    operacion VARCHAR(20) NOT NULL,
    socio_id UUID,
    detalles JSONB,
    realizado_por VARCHAR(100) DEFAULT 'SISTEMA',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- =====================================================================
-- 9. ÍNDICES DE ALTO RENDIMIENTO (OPTIMIZACIÓN DE CONSULTAS B-TREE)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_socios_qr_token_lower ON public.socios (LOWER(qr_token));
CREATE INDEX IF NOT EXISTS idx_socios_dni ON public.socios (dni);
CREATE INDEX IF NOT EXISTS idx_socios_estado_vencimiento ON public.socios (estado, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_registros_acceso_fecha ON public.registros_acceso (fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_registros_acceso_socio ON public.registros_acceso (socio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_socio_fecha ON public.pagos (socio_id, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_historial_membresias_socio ON public.historial_membresias (socio_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_creado_en ON public.auditoria_sistema (creado_en DESC);
-- =====================================================================
-- 10. VISTAS ANALÍTICAS EN TIEMPO REAL
-- =====================================================================
-- Vista A: Socios con cuota próxima a vencer (ideal para envío de correos)
CREATE OR REPLACE VIEW public.vista_socios_proximos_vencer AS
SELECT id,
    qr_token,
    nombre,
    apellido,
    dni,
    email,
    telefono,
    plan_nombre,
    fecha_vencimiento,
    (fecha_vencimiento - CURRENT_DATE) AS dias_restantes,
    saldo_pendiente,
    estado
FROM public.socios
WHERE fecha_vencimiento >= CURRENT_DATE
    AND fecha_vencimiento <= (CURRENT_DATE + INTERVAL '7 days')
    AND estado <> 'SUSPENDIDO';
-- Vista B: Resumen Financiero Mensual por Método de Pago
CREATE OR REPLACE VIEW public.vista_resumen_financiero_mensual AS
SELECT DATE_TRUNC('month', fecha_pago) AS mes,
    metodo_pago,
    COUNT(*) AS total_transacciones,
    SUM(monto) AS total_recaudado_usd
FROM public.pagos
GROUP BY DATE_TRUNC('month', fecha_pago),
    metodo_pago
ORDER BY mes DESC;
-- Vista C: Reporte de Asistencia Diaria (Accesos permitidos vs denegados)
CREATE OR REPLACE VIEW public.vista_asistencia_diaria AS
SELECT DATE(fecha_hora) AS fecha,
    estado_acceso,
    COUNT(*) AS total_accesos
FROM public.registros_acceso
GROUP BY DATE(fecha_hora),
    estado_acceso
ORDER BY fecha DESC;
-- =====================================================================
-- 11. TRIGGER DE AUTOMATIZACIÓN DE ESTADO DE SOCIOS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_actualizar_estado_socio_auto() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.saldo_pendiente > 0 THEN NEW.estado := 'MOROSO';
ELSIF NEW.fecha_vencimiento < CURRENT_DATE THEN NEW.estado := 'VENCIDO';
ELSIF NEW.estado NOT IN ('SUSPENDIDO') THEN NEW.estado := 'ACTIVO';
END IF;
NEW.actualizado_en := now();
RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_estado_socio ON public.socios;
CREATE TRIGGER trg_auto_estado_socio BEFORE
INSERT
    OR
UPDATE ON public.socios FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_estado_socio_auto();
-- =====================================================================
-- 12. FUNCIONES RPC SEGURAS Y AUDITADAS
-- =====================================================================
-- RPC A: Verificar Acceso con Nonce Anti-Replay
CREATE OR REPLACE FUNCTION public.verificar_acceso_seguro(p_socio_id UUID, p_nonce TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_socio RECORD;
v_estado_acceso TEXT;
v_motivo TEXT;
v_nonce_exists BOOLEAN;
BEGIN -- 1. Anti-Replay
SELECT EXISTS(
        SELECT 1
        FROM public.qr_nonces
        WHERE nonce = p_nonce
    ) INTO v_nonce_exists;
IF v_nonce_exists THEN v_estado_acceso := 'DENIED';
v_motivo := 'Intento de clonación/Replay Attack detectado (QR ya utilizado)';
INSERT INTO public.registros_acceso (
        socio_id,
        socio_nombre,
        estado_acceso,
        motivo,
        monto_adeudado
    )
VALUES (
        p_socio_id,
        'Alerta de Seguridad',
        v_estado_acceso,
        v_motivo,
        0.00
    );
RETURN jsonb_build_object(
    'status',
    'DENIED',
    'reason',
    v_motivo,
    'timestamp',
    to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
END IF;
INSERT INTO public.qr_nonces (nonce)
VALUES (p_nonce);
-- 2. Buscar socio
SELECT * INTO v_socio
FROM public.socios
WHERE id = p_socio_id
LIMIT 1;
IF v_socio IS NULL THEN v_estado_acceso := 'DENIED';
v_motivo := 'Socio no encontrado en la base de datos';
INSERT INTO public.registros_acceso (
        socio_id,
        socio_nombre,
        estado_acceso,
        motivo,
        monto_adeudado
    )
VALUES (
        NULL,
        'Desconocido',
        v_estado_acceso,
        v_motivo,
        0.00
    );
RETURN jsonb_build_object(
    'status',
    'DENIED',
    'reason',
    v_motivo,
    'timestamp',
    to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
END IF;
-- 3. Deuda o Morosidad
IF v_socio.saldo_pendiente > 0
OR v_socio.estado = 'MOROSO' THEN v_estado_acceso := 'DENIED';
v_motivo := 'Saldo adeudado pendiente: $' || v_socio.saldo_pendiente::text;
INSERT INTO public.registros_acceso (
        socio_id,
        socio_nombre,
        estado_acceso,
        motivo,
        monto_adeudado
    )
VALUES (
        v_socio.id,
        v_socio.nombre || ' ' || v_socio.apellido,
        v_estado_acceso,
        v_motivo,
        v_socio.saldo_pendiente
    );
RETURN jsonb_build_object(
    'status',
    'DENIED',
    'reason',
    'ACCESO DENEGADO - Saldo pendiente adeudado ($' || v_socio.saldo_pendiente::text || ')',
    'member',
    jsonb_build_object(
        'id',
        v_socio.id,
        'name',
        v_socio.nombre,
        'lastName',
        v_socio.apellido,
        'dni',
        v_socio.dni,
        'debtAmount',
        v_socio.saldo_pendiente,
        'avatarUrl',
        v_socio.foto_url,
        'planName',
        v_socio.plan_nombre,
        'expirationDate',
        v_socio.fecha_vencimiento
    ),
    'timestamp',
    to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
END IF;
-- 4. Cuota Vencida
IF v_socio.fecha_vencimiento < CURRENT_DATE THEN v_estado_acceso := 'DENIED';
v_motivo := 'Cuota Vencida el ' || v_socio.fecha_vencimiento::text;
INSERT INTO public.registros_acceso (
        socio_id,
        socio_nombre,
        estado_acceso,
        motivo,
        monto_adeudado
    )
VALUES (
        v_socio.id,
        v_socio.nombre || ' ' || v_socio.apellido,
        v_estado_acceso,
        v_motivo,
        0.00
    );
RETURN jsonb_build_object(
    'status',
    'DENIED',
    'reason',
    'ACCESO DENEGADO - Cuota vencida el ' || v_socio.fecha_vencimiento::text,
    'member',
    jsonb_build_object(
        'id',
        v_socio.id,
        'name',
        v_socio.nombre,
        'lastName',
        v_socio.apellido,
        'dni',
        v_socio.dni,
        'debtAmount',
        v_socio.saldo_pendiente,
        'avatarUrl',
        v_socio.foto_url,
        'planName',
        v_socio.plan_nombre,
        'expirationDate',
        v_socio.fecha_vencimiento
    ),
    'timestamp',
    to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
END IF;
-- 5. Acceso Concedido
v_estado_acceso := 'GRANTED';
v_motivo := 'Acceso Permitido (Cuota al día)';
INSERT INTO public.registros_acceso (
        socio_id,
        socio_nombre,
        estado_acceso,
        motivo,
        monto_adeudado
    )
VALUES (
        v_socio.id,
        v_socio.nombre || ' ' || v_socio.apellido,
        v_estado_acceso,
        v_motivo,
        0.00
    );
RETURN jsonb_build_object(
    'status',
    'GRANTED',
    'reason',
    '¡PUEDE PASAR! Cuota al día',
    'member',
    jsonb_build_object(
        'id',
        v_socio.id,
        'name',
        v_socio.nombre,
        'lastName',
        v_socio.apellido,
        'dni',
        v_socio.dni,
        'debtAmount',
        0.00,
        'avatarUrl',
        v_socio.foto_url,
        'planName',
        v_socio.plan_nombre,
        'expirationDate',
        v_socio.fecha_vencimiento
    ),
    'timestamp',
    to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
END;
$$;
-- RPC B: Registrar Pago con Auditoría Integrada
CREATE OR REPLACE FUNCTION public.registrar_pago_con_auditoria(
        p_socio_id UUID,
        p_monto_usd DECIMAL(10, 2),
        p_monto_original DECIMAL(10, 2),
        p_moneda TEXT,
        p_tasa_cambio DECIMAL(10, 4),
        p_metodo_pago TEXT,
        p_dias_extension INT DEFAULT 30
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_socio RECORD;
v_nuevo_saldo DECIMAL(10, 2);
v_nueva_fecha_vencimiento DATE;
BEGIN
SELECT * INTO v_socio
FROM public.socios
WHERE id = p_socio_id FOR
UPDATE;
IF v_socio IS NULL THEN RAISE EXCEPTION 'Socio no encontrado';
END IF;
v_nuevo_saldo := GREATEST(0.00, v_socio.saldo_pendiente - p_monto_usd);
-- Extender fecha de vencimiento desde el día actual o desde la fecha de vencimiento si aún es válida
IF v_socio.fecha_vencimiento >= CURRENT_DATE THEN v_nueva_fecha_vencimiento := v_socio.fecha_vencimiento + (p_dias_extension || ' days')::INTERVAL;
ELSE v_nueva_fecha_vencimiento := CURRENT_DATE + (p_dias_extension || ' days')::INTERVAL;
END IF;
-- Actualizar Socio
UPDATE public.socios
SET saldo_pendiente = v_nuevo_saldo,
    fecha_vencimiento = v_nueva_fecha_vencimiento
WHERE id = p_socio_id;
-- Insertar Pago
INSERT INTO public.pagos (
        socio_id,
        monto,
        monto_original,
        moneda,
        tasa_cambio,
        metodo_pago,
        fecha_vencimiento_resultante
    )
VALUES (
        p_socio_id,
        p_monto_usd,
        COALESCE(p_monto_original, p_monto_usd),
        COALESCE(p_moneda, 'USD'),
        COALESCE(p_tasa_cambio, 1.0000),
        p_metodo_pago,
        v_nueva_fecha_vencimiento
    );
-- Registrar Auditoría
INSERT INTO public.auditoria_sistema (
        tabla_afectada,
        operacion,
        socio_id,
        detalles,
        realizado_por
    )
VALUES (
        'socios',
        'PAGO_REGISTRADO',
        p_socio_id,
        jsonb_build_object(
            'monto_usd',
            p_monto_usd,
            'metodo_pago',
            p_metodo_pago,
            'nuevo_saldo',
            v_nuevo_saldo,
            'nueva_fecha_vencimiento',
            v_nueva_fecha_vencimiento
        ),
        'RECEPCION'
    );
RETURN jsonb_build_object(
    'success',
    true,
    'newDebt',
    v_nuevo_saldo,
    'newExpirationDate',
    to_char(v_nueva_fecha_vencimiento, 'YYYY-MM-DD')
);
END;
$$;
-- =====================================================================
-- 13. HABILITACIÓN DE ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_membresias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_sistema ENABLE ROW LEVEL SECURITY;
-- Políticas de lectura/escritura fluidas para el sistema
DROP POLICY IF EXISTS "socios_select_policy" ON public.socios;
DROP POLICY IF EXISTS "socios_insert_policy" ON public.socios;
DROP POLICY IF EXISTS "socios_update_policy" ON public.socios;
CREATE POLICY "socios_select_policy" ON public.socios FOR
SELECT USING (true);
CREATE POLICY "socios_insert_policy" ON public.socios FOR
INSERT WITH CHECK (true);
CREATE POLICY "socios_update_policy" ON public.socios FOR
UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pagos_select_policy" ON public.pagos;
DROP POLICY IF EXISTS "pagos_insert_policy" ON public.pagos;
CREATE POLICY "pagos_select_policy" ON public.pagos FOR
SELECT USING (true);
CREATE POLICY "pagos_insert_policy" ON public.pagos FOR
INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "registros_acceso_select_policy" ON public.registros_acceso;
DROP POLICY IF EXISTS "registros_acceso_insert_policy" ON public.registros_acceso;
CREATE POLICY "registros_acceso_select_policy" ON public.registros_acceso FOR
SELECT USING (true);
CREATE POLICY "registros_acceso_insert_policy" ON public.registros_acceso FOR
INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "qr_nonces_policy_all" ON public.qr_nonces;
CREATE POLICY "qr_nonces_policy_all" ON public.qr_nonces FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "historial_membresias_policy_all" ON public.historial_membresias;
CREATE POLICY "historial_membresias_policy_all" ON public.historial_membresias FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auditoria_sistema_policy_all" ON public.auditoria_sistema;
CREATE POLICY "auditoria_sistema_policy_all" ON public.auditoria_sistema FOR ALL USING (true) WITH CHECK (true);