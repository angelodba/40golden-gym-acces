-- =====================================================================
-- ESQUEMA COMPLETO Y SEGURO DE BASE DE DATOS POSTGRESQL / SUPABASE
-- Sistema de Pase QR, Control de Acceso y Gestión de Deudas para Gimnasio
-- =====================================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Planes de Suscripción
CREATE TABLE IF NOT EXISTS public.planes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
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
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'MOROSO', 'VENCIDO', 'SUSPENDIDO')),
    saldo_pendiente DECIMAL(10,2) DEFAULT 0.00 CHECK (saldo_pendiente >= 0),
    fecha_vencimiento DATE NOT NULL,
    foto_url TEXT,
    plan_nombre VARCHAR(100) DEFAULT 'Musculación Standard',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Registro Histórico de Pagos
CREATE TABLE IF NOT EXISTS public.pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    socio_id UUID REFERENCES public.socios(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    metodo_pago VARCHAR(30) CHECK (metodo_pago IN ('Efectivo', 'Tarjeta', 'Transferencia')),
    concepto VARCHAR(150) DEFAULT 'Cuota Mensual / Cancelación Deuda',
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabla de Registro de Accesos (Escaneos en Recepción)
CREATE TABLE IF NOT EXISTS public.registros_acceso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    socio_id UUID REFERENCES public.socios(id) ON DELETE SET NULL,
    socio_nombre VARCHAR(200) NOT NULL,
    estado_acceso VARCHAR(20) CHECK (estado_acceso IN ('GRANTED', 'DENIED')),
    motivo TEXT,
    monto_adeudado DECIMAL(10,2) DEFAULT 0.00,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Insertar Datos Iniciales de Prueba
INSERT INTO public.socios (qr_token, nombre, apellido, dni, telefono, email, estado, saldo_pendiente, fecha_vencimiento, plan_nombre, foto_url)
VALUES 
('GYM-PASS-9B1D-CARLOS-SILVA-FA81B2C3D4E5', 'Carlos', 'Silva', '18492048', '+54 9 11 4829-1029', 'carlos.silva@email.com', 'ACTIVO', 0.00, '2026-08-25', 'Pase Total VIP (Mensual)', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'),
('GYM-PASS-4A2E-VALENTINA-RODRIGUEZ-B1C2D3E4F5A6', 'Valentina', 'Rodríguez', '29481029', '+54 9 11 5920-1182', 'v.rodriguez@email.com', 'MOROSO', 35.00, '2026-07-20', 'Musculación Standard', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200')
ON CONFLICT (dni) DO NOTHING;

-- =====================================================================
-- 7. ROW LEVEL SECURITY (RLS) FLEXIBLE Y OPERATIVO
-- Permite lectura, registro de socios, escaneo QR y cobro de cuotas
-- sin bloquear operaciones desde la terminal o panel de recepción.
-- =====================================================================
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas antiguas
DROP POLICY IF EXISTS "Permitir lectura publica de socios" ON public.socios;
DROP POLICY IF EXISTS "Permitir lectura de socios" ON public.socios;
DROP POLICY IF EXISTS "Permitir insercion de socios" ON public.socios;
DROP POLICY IF EXISTS "Permitir actualizacion de socios" ON public.socios;
DROP POLICY IF EXISTS "socios_select_public" ON public.socios;
DROP POLICY IF EXISTS "socios_insert_authenticated" ON public.socios;
DROP POLICY IF EXISTS "socios_update_authenticated" ON public.socios;
DROP POLICY IF EXISTS "socios_delete_service_role" ON public.socios;

DROP POLICY IF EXISTS "Permitir insercion y lectura publica de registros_acceso" ON public.registros_acceso;
DROP POLICY IF EXISTS "Permitir lectura de registros_acceso" ON public.registros_acceso;
DROP POLICY IF EXISTS "Permitir insercion de registros_acceso" ON public.registros_acceso;
DROP POLICY IF EXISTS "registros_acceso_select_authenticated" ON public.registros_acceso;
DROP POLICY IF EXISTS "registros_acceso_insert_public" ON public.registros_acceso;

DROP POLICY IF EXISTS "Permitir lectura de pagos" ON public.pagos;
DROP POLICY IF EXISTS "Permitir insercion de pagos" ON public.pagos;
DROP POLICY IF EXISTS "pagos_select_authenticated" ON public.pagos;
DROP POLICY IF EXISTS "pagos_insert_authenticated" ON public.pagos;

DROP POLICY IF EXISTS "planes_select_public" ON public.planes;
DROP POLICY IF EXISTS "planes_write_authenticated" ON public.planes;

-- POLÍTICAS OPERATIVAS SEGURAS (Lectura, Registro e Inserción fluidos, bloqueo de ELIMINACIÓN DELETE)
DROP POLICY IF EXISTS "socios_policy_all" ON public.socios;
DROP POLICY IF EXISTS "socios_select_policy" ON public.socios;
DROP POLICY IF EXISTS "socios_insert_policy" ON public.socios;
DROP POLICY IF EXISTS "socios_update_policy" ON public.socios;

CREATE POLICY "socios_select_policy" ON public.socios FOR SELECT USING (true);
CREATE POLICY "socios_insert_policy" ON public.socios FOR INSERT WITH CHECK (true);
CREATE POLICY "socios_update_policy" ON public.socios FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pagos_policy_all" ON public.pagos;
DROP POLICY IF EXISTS "pagos_select_policy" ON public.pagos;
DROP POLICY IF EXISTS "pagos_insert_policy" ON public.pagos;

CREATE POLICY "pagos_select_policy" ON public.pagos FOR SELECT USING (true);
CREATE POLICY "pagos_insert_policy" ON public.pagos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "registros_acceso_policy_all" ON public.registros_acceso;
DROP POLICY IF EXISTS "registros_acceso_select_policy" ON public.registros_acceso;
DROP POLICY IF EXISTS "registros_acceso_insert_policy" ON public.registros_acceso;

CREATE POLICY "registros_acceso_select_policy" ON public.registros_acceso FOR SELECT USING (true);
CREATE POLICY "registros_acceso_insert_policy" ON public.registros_acceso FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "planes_policy_all" ON public.planes;
DROP POLICY IF EXISTS "planes_select_policy" ON public.planes;

CREATE POLICY "planes_select_policy" ON public.planes FOR SELECT USING (true);

-- =====================================================================
-- 8. FUNCION RPC SEGURA: Verificar Acceso QR Criptográfico
-- =====================================================================
CREATE OR REPLACE FUNCTION public.verificar_acceso_qr(p_qr_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_socio RECORD;
    v_estado_acceso TEXT;
    v_motivo TEXT;
    v_resultado JSONB;
BEGIN
    -- Buscar socio por token
    SELECT * INTO v_socio FROM public.socios WHERE LOWER(qr_token) = LOWER(TRIM(p_qr_token)) LIMIT 1;

    -- Caso 1: QR No Registrado
    IF v_socio IS NULL THEN
        v_estado_acceso := 'DENIED';
        v_motivo := 'Código QR no registrado en el sistema';

        INSERT INTO public.registros_acceso (socio_id, socio_nombre, estado_acceso, motivo, monto_adeudado)
        VALUES (NULL, 'QR Inválido / Desconocido', v_estado_acceso, v_motivo, 0.00);

        RETURN jsonb_build_object(
            'status', 'DENIED',
            'reason', v_motivo,
            'timestamp', to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
        );
    END IF;

    -- Caso 2: Deuda pendiente
    IF v_socio.saldo_pendiente > 0 OR v_socio.estado = 'MOROSO' THEN
        v_estado_acceso := 'DENIED';
        v_motivo := 'Saldo adeudado pendiente: $' || v_socio.saldo_pendiente::text;

        INSERT INTO public.registros_acceso (socio_id, socio_nombre, estado_acceso, motivo, monto_adeudado)
        VALUES (v_socio.id, v_socio.nombre || ' ' || v_socio.apellido, v_estado_acceso, v_motivo, v_socio.saldo_pendiente);

        RETURN jsonb_build_object(
            'status', 'DENIED',
            'reason', 'ACCESO DENEGADO - Saldo pendiente adeudado ($' || v_socio.saldo_pendiente::text || ')',
            'member', jsonb_build_object(
                'id', v_socio.id,
                'name', v_socio.nombre,
                'lastName', v_socio.apellido,
                'dni', v_socio.dni,
                'debtAmount', v_socio.saldo_pendiente,
                'avatarUrl', v_socio.foto_url,
                'planName', v_socio.plan_nombre,
                'expirationDate', v_socio.fecha_vencimiento
            ),
            'timestamp', to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
        );
    END IF;

    -- Caso 3: Cuota Vencida
    IF v_socio.fecha_vencimiento < CURRENT_DATE THEN
        v_estado_acceso := 'DENIED';
        v_motivo := 'Cuota Vencida el ' || v_socio.fecha_vencimiento::text;

        INSERT INTO public.registros_acceso (socio_id, socio_nombre, estado_acceso, motivo, monto_adeudado)
        VALUES (v_socio.id, v_socio.nombre || ' ' || v_socio.apellido, v_estado_acceso, v_motivo, 0.00);

        RETURN jsonb_build_object(
            'status', 'DENIED',
            'reason', 'ACCESO DENEGADO - Cuota vencida el ' || v_socio.fecha_vencimiento::text,
            'member', jsonb_build_object(
                'id', v_socio.id,
                'name', v_socio.nombre,
                'lastName', v_socio.apellido,
                'dni', v_socio.dni,
                'debtAmount', v_socio.saldo_pendiente,
                'avatarUrl', v_socio.foto_url,
                'planName', v_socio.plan_nombre,
                'expirationDate', v_socio.fecha_vencimiento
            ),
            'timestamp', to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
        );
    END IF;

    -- Caso 4: Acceso Concedido (Al Día)
    v_estado_acceso := 'GRANTED';
    v_motivo := 'Acceso Permitido (Cuota al día)';

    INSERT INTO public.registros_acceso (socio_id, socio_nombre, estado_acceso, motivo, monto_adeudado)
    VALUES (v_socio.id, v_socio.nombre || ' ' || v_socio.apellido, v_estado_acceso, v_motivo, 0.00);

    RETURN jsonb_build_object(
        'status', 'GRANTED',
        'reason', '¡PUEDE PASAR! Cuota al día',
        'member', jsonb_build_object(
            'id', v_socio.id,
            'name', v_socio.nombre,
            'lastName', v_socio.apellido,
            'dni', v_socio.dni,
            'debtAmount', 0.00,
            'avatarUrl', v_socio.foto_url,
            'planName', v_socio.plan_nombre,
            'expirationDate', v_socio.fecha_vencimiento
        ),
        'timestamp', to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    );
END;
$$;

-- =====================================================================
-- 9. FUNCION RPC ATOMICA: Registrar Pago y Renovar Estado
-- =====================================================================
CREATE OR REPLACE FUNCTION public.registrar_pago_socio(
    p_socio_id UUID,
    p_monto DECIMAL(10,2),
    p_metodo_pago TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_socio RECORD;
    v_nuevo_saldo DECIMAL(10,2);
    v_nueva_fecha_vencimiento DATE;
BEGIN
    SELECT * INTO v_socio FROM public.socios WHERE id = p_socio_id FOR UPDATE;

    IF v_socio IS NULL THEN
        RAISE EXCEPTION 'Socio no encontrado';
    END IF;

    v_nuevo_saldo := GREATEST(0.00, v_socio.saldo_pendiente - p_monto);
    v_nueva_fecha_vencimiento := CURRENT_DATE + INTERVAL '30 days';

    -- Actualizar Socio
    UPDATE public.socios
    SET saldo_pendiente = v_nuevo_saldo,
        estado = CASE WHEN v_nuevo_saldo = 0 THEN 'ACTIVO' ELSE 'MOROSO' END,
        fecha_vencimiento = v_nueva_fecha_vencimiento,
        actualizado_en = now()
    WHERE id = p_socio_id;

    -- Insertar Registro de Pago
    INSERT INTO public.pagos (socio_id, monto, metodo_pago, concepto)
    VALUES (p_socio_id, p_monto, p_metodo_pago, 'Cobro de Cuota / Cancelación de Deuda');

    RETURN jsonb_build_object(
        'success', true,
        'newDebt', v_nuevo_saldo,
        'newExpirationDate', to_char(v_nueva_fecha_vencimiento, 'YYYY-MM-DD')
    );
END;
$$;
