-- ============================================
-- Public lookup of staff invite cargo by email
-- Allows /register-secretary to show the correct
-- welcome profile without authenticated RLS.
-- ============================================

CREATE OR REPLACE FUNCTION public.lookup_staff_invite_cargo(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cargo text;
BEGIN
    IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
        RETURN 'TECNICO_SECRETARIA';
    END IF;

    SELECT CASE
        WHEN upper(coalesce(f.subcategoria, '')) = 'SECRETARIO' THEN 'TECNICO_SECRETARIA'
        WHEN upper(coalesce(f.subcategoria, '')) IN (
            'DIRECTOR_PEDAGOGICO',
            'DIRECTOR_ADMINISTRATIVO',
            'TECNICO_SECRETARIA'
        ) THEN upper(f.subcategoria)
        ELSE NULL
    END
    INTO v_cargo
    FROM funcionarios_escola f
    WHERE lower(coalesce(f.email, '')) = lower(trim(p_email))
    ORDER BY f.ativo DESC NULLS LAST
    LIMIT 1;

    IF v_cargo IS NULL THEN
        BEGIN
            SELECT CASE
                WHEN upper(coalesce(s.cargo, '')) IN (
                    'DIRECTOR_PEDAGOGICO',
                    'DIRECTOR_ADMINISTRATIVO',
                    'TECNICO_SECRETARIA'
                ) THEN upper(s.cargo)
                ELSE NULL
            END
            INTO v_cargo
            FROM secretarios s
            WHERE lower(coalesce(s.email, '')) = lower(trim(p_email))
            ORDER BY s.ativo DESC NULLS LAST
            LIMIT 1;
        EXCEPTION
            WHEN undefined_column THEN
                v_cargo := NULL;
        END;
    END IF;

    RETURN coalesce(v_cargo, 'TECNICO_SECRETARIA');
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_staff_invite_cargo(text) TO anon, authenticated;

COMMENT ON FUNCTION public.lookup_staff_invite_cargo(text) IS
    'Returns staff login cargo for invite page (Director Pedagógico / Administrativo / Técnico).';
