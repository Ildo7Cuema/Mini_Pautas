-- =============================================================================
-- Notificar Direções Municipais quando a DP publica um concurso público
-- Espelha o padrão de circulares_provinciais (notify on publish).
-- Não altera o fluxo de criação/publicação existente no frontend.
-- =============================================================================

-- UPDATE: estado passa a 'publicado'
CREATE OR REPLACE FUNCTION notify_direcao_municipal_concurso_publicado()
RETURNS TRIGGER AS $$
DECLARE
    direcao_record RECORD;
    v_mensagem TEXT;
    v_notificados INTEGER := 0;
BEGIN
    IF NEW.estado = 'publicado'
       AND (OLD.estado IS DISTINCT FROM 'publicado') THEN

        v_mensagem := NEW.titulo;
        IF NEW.descricao IS NOT NULL AND LENGTH(TRIM(NEW.descricao)) > 0 THEN
            v_mensagem := NEW.titulo || E'\n\n' || LEFT(NEW.descricao, 400);
            IF LENGTH(NEW.descricao) > 400 THEN
                v_mensagem := v_mensagem || '...';
            END IF;
        END IF;

        IF NEW.data_inicio IS NOT NULL OR NEW.data_fim IS NOT NULL THEN
            v_mensagem := v_mensagem || E'\n\nPeríodo: '
                || COALESCE(TO_CHAR(NEW.data_inicio, 'DD/MM/YYYY'), '—')
                || ' a '
                || COALESCE(TO_CHAR(NEW.data_fim, 'DD/MM/YYYY'), '—');
        END IF;

        FOR direcao_record IN
            SELECT user_id, nome
            FROM direcoes_municipais
            WHERE provincia = NEW.provincia
              AND ativo = true
              AND user_id IS NOT NULL
        LOOP
            INSERT INTO notificacoes (
                destinatario_id,
                tipo,
                titulo,
                mensagem,
                link,
                dados_adicionais
            ) VALUES (
                direcao_record.user_id,
                'novo_concurso_publico',
                'Novo Concurso Público',
                v_mensagem,
                'concursos-publicos',
                jsonb_build_object(
                    'concurso_id', NEW.id,
                    'titulo', NEW.titulo,
                    'provincia', NEW.provincia,
                    'data_inicio', NEW.data_inicio,
                    'data_fim', NEW.data_fim,
                    'direcao_provincial_id', NEW.direcao_provincial_id
                )
            );
            v_notificados := v_notificados + 1;
        END LOOP;

        RAISE NOTICE 'Notified % municipal directorates about concurso %', v_notificados, NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_concurso_publicado ON concursos_publicos;
CREATE TRIGGER trigger_notify_concurso_publicado
    AFTER UPDATE ON concursos_publicos
    FOR EACH ROW
    EXECUTE FUNCTION notify_direcao_municipal_concurso_publicado();

-- INSERT directo já como 'publicado' (raro; o fluxo actual cria em rascunho)
CREATE OR REPLACE FUNCTION notify_direcao_municipal_concurso_publicado_insert()
RETURNS TRIGGER AS $$
DECLARE
    direcao_record RECORD;
    v_mensagem TEXT;
    v_notificados INTEGER := 0;
BEGIN
    IF NEW.estado = 'publicado' THEN
        v_mensagem := NEW.titulo;
        IF NEW.descricao IS NOT NULL AND LENGTH(TRIM(NEW.descricao)) > 0 THEN
            v_mensagem := NEW.titulo || E'\n\n' || LEFT(NEW.descricao, 400);
            IF LENGTH(NEW.descricao) > 400 THEN
                v_mensagem := v_mensagem || '...';
            END IF;
        END IF;

        IF NEW.data_inicio IS NOT NULL OR NEW.data_fim IS NOT NULL THEN
            v_mensagem := v_mensagem || E'\n\nPeríodo: '
                || COALESCE(TO_CHAR(NEW.data_inicio, 'DD/MM/YYYY'), '—')
                || ' a '
                || COALESCE(TO_CHAR(NEW.data_fim, 'DD/MM/YYYY'), '—');
        END IF;

        FOR direcao_record IN
            SELECT user_id, nome
            FROM direcoes_municipais
            WHERE provincia = NEW.provincia
              AND ativo = true
              AND user_id IS NOT NULL
        LOOP
            INSERT INTO notificacoes (
                destinatario_id,
                tipo,
                titulo,
                mensagem,
                link,
                dados_adicionais
            ) VALUES (
                direcao_record.user_id,
                'novo_concurso_publico',
                'Novo Concurso Público',
                v_mensagem,
                'concursos-publicos',
                jsonb_build_object(
                    'concurso_id', NEW.id,
                    'titulo', NEW.titulo,
                    'provincia', NEW.provincia,
                    'data_inicio', NEW.data_inicio,
                    'data_fim', NEW.data_fim,
                    'direcao_provincial_id', NEW.direcao_provincial_id
                )
            );
            v_notificados := v_notificados + 1;
        END LOOP;

        RAISE NOTICE 'Notified % municipal directorates about new concurso %', v_notificados, NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_concurso_publicado_insert ON concursos_publicos;
CREATE TRIGGER trigger_notify_concurso_publicado_insert
    AFTER INSERT ON concursos_publicos
    FOR EACH ROW
    EXECUTE FUNCTION notify_direcao_municipal_concurso_publicado_insert();
