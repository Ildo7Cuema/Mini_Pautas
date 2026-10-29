-- ============================================
-- MIGRATION: Alertas de novos registos para o Administrador
-- Purpose: Registar (e tornar idempotente) o envio de alertas ao SuperAdmin
--          (WhatsApp + notificação no perfil) quando uma Escola, Direção
--          Municipal ou Direção Provincial se cadastra.
-- Notes:
--   * Não altera nenhum RPC / trigger existente.
--   * Tabela acessível apenas pela Edge Function `notify-admin-registration`
--     (service role). RLS activo e sem policies = negado para anon/authenticated.
-- Date: 2026-10-29
-- ============================================

CREATE TABLE IF NOT EXISTS admin_registration_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('ESCOLA', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL')),
    user_id UUID NOT NULL,
    whatsapp_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (whatsapp_status IN ('pending', 'sent', 'failed', 'not_configured')),
    whatsapp_provider TEXT,
    whatsapp_error TEXT,
    in_app_created BOOLEAN NOT NULL DEFAULT false,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT admin_registration_alerts_unique UNIQUE (tipo, user_id)
);

ALTER TABLE admin_registration_alerts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_registration_alerts IS
'Controlo de alertas enviados ao SuperAdmin (WhatsApp/in-app) por novo registo. Escrito apenas pela Edge Function notify-admin-registration.';
