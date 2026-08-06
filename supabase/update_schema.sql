-- =====================================================================
-- ACTUALIZACIÓN DE ESQUEMA: Sistema QR Criptográfico y Anti-Replay
-- =====================================================================

-- 1. Tabla para almacenar los Nonces (Prevención de Replay Attacks)
CREATE TABLE IF NOT EXISTS public.qr_nonces (
    nonce VARCHAR(64) PRIMARY KEY,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Limpieza automática de nonces viejos (opcional, se puede hacer con pg_cron, pero por ahora los guardamos)
-- Opcional: Se puede crear una política RLS
ALTER TABLE public.qr_nonces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr_nonces_policy_all" ON public.qr_nonces FOR ALL USING (true) WITH CHECK (true);

-- 2. Función RPC para verificar acceso seguro usando el ID desencriptado y el Nonce
CREATE OR REPLACE FUNCTION public.verificar_acceso_seguro(
    p_socio_id UUID,
    p_nonce TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_socio RECORD;
    v_estado_acceso TEXT;
    v_motivo TEXT;
    v_nonce_exists BOOLEAN;
BEGIN
    -- 1. Verificar Anti-Replay (Nonce)
    SELECT EXISTS(SELECT 1 FROM public.qr_nonces WHERE nonce = p_nonce) INTO v_nonce_exists;
    
    IF v_nonce_exists THEN
        v_estado_acceso := 'DENIED';
        v_motivo := 'Intento de clonación/Replay Attack detectado (QR ya utilizado)';
        
        INSERT INTO public.registros_acceso (socio_id, socio_nombre, estado_acceso, motivo, monto_adeudado)
        VALUES (p_socio_id, 'Alerta de Seguridad', v_estado_acceso, v_motivo, 0.00);
        
        RETURN jsonb_build_object(
            'status', 'DENIED',
            'reason', v_motivo,
            'timestamp', to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
        );
    END IF;

    -- Registrar el nonce para que no se pueda volver a usar
    INSERT INTO public.qr_nonces (nonce) VALUES (p_nonce);

    -- 2. Buscar socio por ID
    SELECT * INTO v_socio FROM public.socios WHERE id = p_socio_id LIMIT 1;

    -- Caso 1: Socio No Encontrado
    IF v_socio IS NULL THEN
        v_estado_acceso := 'DENIED';
        v_motivo := 'Socio no encontrado en la base de datos';

        INSERT INTO public.registros_acceso (socio_id, socio_nombre, estado_acceso, motivo, monto_adeudado)
        VALUES (NULL, 'Desconocido', v_estado_acceso, v_motivo, 0.00);

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
