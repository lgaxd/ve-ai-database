-- =============================================================================
-- Vê AI · Oracle · 05 · Pacotes
--   pkg_relatos      fila do gestor: prioridade, registro, status, atrasados
--   pkg_descricoes   métricas de qualidade da IA: utilidade, latência, barreiras
--
-- Os objetos avulsos (fn_/prc_) contêm a implementação das regras exigidas no
-- critério 02. Os pacotes expõem essas regras com uma API única, acrescentam
-- rotinas próprias e declaram exceções nomeadas para cada código de erro.
-- =============================================================================
SET SERVEROUTPUT ON
SET DEFINE OFF

-- =============================================================================
-- pkg_relatos · SPEC
-- =============================================================================
CREATE OR REPLACE PACKAGE pkg_relatos AS

  e_transicao_invalida    EXCEPTION;
  e_gestor_fora_regiao    EXCEPTION;
  e_protocolo_obrigatorio EXCEPTION;
  e_motivo_obrigatorio    EXCEPTION;
  e_relato_inexistente    EXCEPTION;
  e_usuario_invalido      EXCEPTION;

  PRAGMA EXCEPTION_INIT(e_transicao_invalida,    -20001);
  PRAGMA EXCEPTION_INIT(e_gestor_fora_regiao,    -20002);
  PRAGMA EXCEPTION_INIT(e_protocolo_obrigatorio, -20003);
  PRAGMA EXCEPTION_INIT(e_motivo_obrigatorio,    -20004);
  PRAGMA EXCEPTION_INIT(e_relato_inexistente,    -20005);
  PRAGMA EXCEPTION_INIT(e_usuario_invalido,      -20006);

  -- Relato não finalizado criado há mais de N dias é considerado "atrasado"
  c_dias_atraso CONSTANT PLS_INTEGER := 30;

  -- Prioridade atual do relato (delegada a fn_prioridade_relato)
  FUNCTION prioridade (p_relato_id IN relato.id%TYPE) RETURN NUMBER;

  -- Regra dos 30 m (delegada a prc_registrar_relato_ou_apoio)
  PROCEDURE registrar (
    p_cidadao_id   IN  relato.cidadao_id%TYPE,
    p_descricao_id IN  relato.descricao_id%TYPE,
    p_regiao_id    IN  relato.regiao_id%TYPE,
    p_tipo         IN  relato.tipo%TYPE,
    p_gravidade    IN  relato.gravidade%TYPE,
    p_texto        IN  relato.texto%TYPE,
    p_latitude     IN  relato.latitude%TYPE,
    p_longitude    IN  relato.longitude%TYPE,
    p_endereco     IN  relato.endereco%TYPE,
    p_relato_id    OUT relato.id%TYPE,
    p_resultado    OUT VARCHAR2
  );

  -- Máquina de estados (delegada a prc_atualizar_status)
  PROCEDURE atualizar_status (
    p_relato_id   IN relato.id%TYPE,
    p_gestor_id   IN usuario.id%TYPE,
    p_status_novo IN relato.status%TYPE,
    p_protocolo   IN relato.protocolo_orgao%TYPE        DEFAULT NULL,
    p_comentario  IN atualizacao_relato.comentario%TYPE DEFAULT NULL,
    p_motivo      IN relato.motivo_descarte%TYPE        DEFAULT NULL
  );

  -- Recalcula a prioridade de todos os relatos (os dias em aberto mudam todo dia).
  -- Devolve quantos relatos tiveram a prioridade alterada. Não faz COMMIT.
  PROCEDURE recalcular_prioridades (p_qtd_alterados OUT PLS_INTEGER);

  -- Relatos não finalizados criados há mais de p_dias, do mais antigo ao mais novo
  FUNCTION relatos_atrasados (p_dias IN PLS_INTEGER DEFAULT c_dias_atraso) RETURN SYS_REFCURSOR;

END pkg_relatos;
/

-- =============================================================================
-- pkg_relatos · BODY
-- =============================================================================
CREATE OR REPLACE PACKAGE BODY pkg_relatos AS

  FUNCTION prioridade (p_relato_id IN relato.id%TYPE) RETURN NUMBER IS
  BEGIN
    RETURN fn_prioridade_relato(p_relato_id);
  END prioridade;

  PROCEDURE registrar (
    p_cidadao_id   IN  relato.cidadao_id%TYPE,
    p_descricao_id IN  relato.descricao_id%TYPE,
    p_regiao_id    IN  relato.regiao_id%TYPE,
    p_tipo         IN  relato.tipo%TYPE,
    p_gravidade    IN  relato.gravidade%TYPE,
    p_texto        IN  relato.texto%TYPE,
    p_latitude     IN  relato.latitude%TYPE,
    p_longitude    IN  relato.longitude%TYPE,
    p_endereco     IN  relato.endereco%TYPE,
    p_relato_id    OUT relato.id%TYPE,
    p_resultado    OUT VARCHAR2
  ) IS
  BEGIN
    prc_registrar_relato_ou_apoio(p_cidadao_id, p_descricao_id, p_regiao_id, p_tipo, p_gravidade,
                                  p_texto, p_latitude, p_longitude, p_endereco,
                                  p_relato_id, p_resultado);
  END registrar;

  PROCEDURE atualizar_status (
    p_relato_id   IN relato.id%TYPE,
    p_gestor_id   IN usuario.id%TYPE,
    p_status_novo IN relato.status%TYPE,
    p_protocolo   IN relato.protocolo_orgao%TYPE        DEFAULT NULL,
    p_comentario  IN atualizacao_relato.comentario%TYPE DEFAULT NULL,
    p_motivo      IN relato.motivo_descarte%TYPE        DEFAULT NULL
  ) IS
  BEGIN
    prc_atualizar_status(p_relato_id, p_gestor_id, p_status_novo, p_protocolo, p_comentario, p_motivo);
  END atualizar_status;

  PROCEDURE recalcular_prioridades (p_qtd_alterados OUT PLS_INTEGER) IS
    v_nova relato.prioridade%TYPE;
  BEGIN
    p_qtd_alterados := 0;

    FOR r IN (SELECT id, gravidade, total_apoios, criado_em, status, prioridade
                FROM relato
                 FOR UPDATE OF prioridade)
    LOOP
      v_nova := fn_calcular_prioridade(r.gravidade, r.total_apoios, r.criado_em, r.status);

      IF v_nova <> r.prioridade THEN
        UPDATE relato SET prioridade = v_nova WHERE id = r.id;
        p_qtd_alterados := p_qtd_alterados + 1;
      END IF;
    END LOOP;
  END recalcular_prioridades;

  FUNCTION relatos_atrasados (p_dias IN PLS_INTEGER DEFAULT c_dias_atraso) RETURN SYS_REFCURSOR IS
    v_cursor SYS_REFCURSOR;
  BEGIN
    OPEN v_cursor FOR
      SELECT r.id,
             g.nome                      AS regiao,
             r.tipo,
             r.gravidade,
             r.status,
             FLOOR(SYSDATE - r.criado_em) AS dias_em_aberto,
             r.total_apoios
        FROM relato r
        JOIN regiao g ON g.id = r.regiao_id
       WHERE r.status IN ('ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO')
         AND r.criado_em < SYSDATE - p_dias
       ORDER BY r.criado_em, r.id;
    RETURN v_cursor;
  END relatos_atrasados;

END pkg_relatos;
/

-- =============================================================================
-- pkg_descricoes · SPEC
-- =============================================================================
CREATE OR REPLACE PACKAGE pkg_descricoes AS

  e_descricao_inexistente EXCEPTION;
  e_avaliacao_invalida    EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_descricao_inexistente, -20007);
  PRAGMA EXCEPTION_INIT(e_avaliacao_invalida,    -20008);

  -- % de descrições úteis entre as avaliadas (delegada a fn_taxa_descricoes_uteis)
  FUNCTION taxa_utilidade (p_usuario_id IN usuario.id%TYPE DEFAULT NULL) RETURN NUMBER;

  -- Latência média da IA em ms, com filtros opcionais por usuário e modo
  FUNCTION latencia_media (
    p_usuario_id IN usuario.id%TYPE      DEFAULT NULL,
    p_modo       IN descricao.modo%TYPE  DEFAULT NULL
  ) RETURN NUMBER;

  -- Quantas descrições tiveram barreira estrutural detectada pela IA
  FUNCTION total_barreiras_detectadas (p_usuario_id IN usuario.id%TYPE DEFAULT NULL) RETURN PLS_INTEGER;

  -- Avaliação do cidadão: 1 = útil, 0 = não útil, NULL = limpa a avaliação
  PROCEDURE avaliar (p_descricao_id IN descricao.id%TYPE, p_util IN NUMBER);

  -- Resumo de uso de um cidadão
  PROCEDURE estatisticas_usuario (
    p_usuario_id     IN  usuario.id%TYPE,
    p_total          OUT PLS_INTEGER,
    p_ambiente       OUT PLS_INTEGER,
    p_texto          OUT PLS_INTEGER,
    p_taxa_util      OUT NUMBER,
    p_latencia_media OUT NUMBER
  );

END pkg_descricoes;
/

-- =============================================================================
-- pkg_descricoes · BODY
-- =============================================================================
CREATE OR REPLACE PACKAGE BODY pkg_descricoes AS

  FUNCTION taxa_utilidade (p_usuario_id IN usuario.id%TYPE DEFAULT NULL) RETURN NUMBER IS
  BEGIN
    RETURN fn_taxa_descricoes_uteis(p_usuario_id);
  END taxa_utilidade;

  FUNCTION latencia_media (
    p_usuario_id IN usuario.id%TYPE      DEFAULT NULL,
    p_modo       IN descricao.modo%TYPE  DEFAULT NULL
  ) RETURN NUMBER IS
    v_media NUMBER;
  BEGIN
    SELECT ROUND(AVG(latencia_ms))
      INTO v_media
      FROM descricao
     WHERE (p_usuario_id IS NULL OR usuario_id = p_usuario_id)
       AND (p_modo IS NULL OR modo = p_modo);
    RETURN v_media;
  END latencia_media;

  FUNCTION total_barreiras_detectadas (p_usuario_id IN usuario.id%TYPE DEFAULT NULL) RETURN PLS_INTEGER IS
    v_total PLS_INTEGER;
  BEGIN
    SELECT COUNT(*)
      INTO v_total
      FROM descricao
     WHERE barreira_detectada = 1
       AND (p_usuario_id IS NULL OR usuario_id = p_usuario_id);
    RETURN v_total;
  END total_barreiras_detectadas;

  PROCEDURE avaliar (p_descricao_id IN descricao.id%TYPE, p_util IN NUMBER) IS
  BEGIN
    IF p_util IS NOT NULL AND p_util NOT IN (0, 1) THEN
      RAISE_APPLICATION_ERROR(-20008, 'Avaliação inválida: use 1 (útil), 0 (não útil) ou NULL.');
    END IF;

    UPDATE descricao SET util = p_util WHERE id = p_descricao_id;

    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20007, 'Descrição ' || p_descricao_id || ' não existe.');
    END IF;
  END avaliar;

  PROCEDURE estatisticas_usuario (
    p_usuario_id     IN  usuario.id%TYPE,
    p_total          OUT PLS_INTEGER,
    p_ambiente       OUT PLS_INTEGER,
    p_texto          OUT PLS_INTEGER,
    p_taxa_util      OUT NUMBER,
    p_latencia_media OUT NUMBER
  ) IS
    v_existe PLS_INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_existe FROM usuario WHERE id = p_usuario_id;
    IF v_existe = 0 THEN
      RAISE_APPLICATION_ERROR(-20006, 'Usuário ' || p_usuario_id || ' não existe.');
    END IF;

    SELECT COUNT(*),
           COUNT(CASE WHEN modo = 'AMBIENTE' THEN 1 END),
           COUNT(CASE WHEN modo = 'TEXTO' THEN 1 END)
      INTO p_total, p_ambiente, p_texto
      FROM descricao
     WHERE usuario_id = p_usuario_id;

    p_taxa_util      := taxa_utilidade(p_usuario_id);
    p_latencia_media := latencia_media(p_usuario_id);
  END estatisticas_usuario;

END pkg_descricoes;
/

SHOW ERRORS
