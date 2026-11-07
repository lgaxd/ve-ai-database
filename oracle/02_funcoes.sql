-- =============================================================================
-- Vê AI · Oracle · 02 · Funções
--   Exigidas pela rubrica (critério 02):
--     fn_prioridade_relato       prioridade de um relato na fila do gestor
--     fn_taxa_descricoes_uteis   % de descrições avaliadas como úteis
--   Auxiliares (usadas por procedures, triggers e pacotes):
--     fn_distancia_metros        distância entre dois pontos GPS (Haversine)
--     fn_calcular_prioridade     fórmula pura da prioridade, sem acesso a tabelas
-- =============================================================================
SET SERVEROUTPUT ON
SET DEFINE OFF

-- -----------------------------------------------------------------------------
-- fn_distancia_metros: fórmula de Haversine (raio médio da Terra = 6.371 km).
-- Usada na regra de deduplicação: relato do mesmo tipo a até 30 m vira apoio.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_distancia_metros (
  p_lat1 IN NUMBER,
  p_lon1 IN NUMBER,
  p_lat2 IN NUMBER,
  p_lon2 IN NUMBER
) RETURN NUMBER DETERMINISTIC
IS
  c_raio_terra CONSTANT NUMBER := 6371000;
  c_rad        CONSTANT NUMBER := ACOS(-1) / 180;
  v_dlat NUMBER;
  v_dlon NUMBER;
  v_a    NUMBER;
BEGIN
  IF p_lat1 IS NULL OR p_lon1 IS NULL OR p_lat2 IS NULL OR p_lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  v_dlat := (p_lat2 - p_lat1) * c_rad;
  v_dlon := (p_lon2 - p_lon1) * c_rad;
  v_a    := POWER(SIN(v_dlat / 2), 2)
          + COS(p_lat1 * c_rad) * COS(p_lat2 * c_rad) * POWER(SIN(v_dlon / 2), 2);

  RETURN c_raio_terra * 2 * ATAN2(SQRT(v_a), SQRT(1 - v_a));
END fn_distancia_metros;
/

-- -----------------------------------------------------------------------------
-- fn_calcular_prioridade: peso(gravidade) x (1 + apoios) + dias em aberto.
--   BAIXA = 1, MEDIA = 3, ALTA = 5. Relato RESOLVIDO/DESCARTADO = 0.
-- Não consulta tabelas, por isso pode ser chamada dentro de UPDATE RELATO e de
-- triggers sem causar erro de tabela mutante.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calcular_prioridade (
  p_gravidade    IN VARCHAR2,
  p_total_apoios IN NUMBER,
  p_criado_em    IN DATE,
  p_status       IN VARCHAR2
) RETURN NUMBER
IS
  v_peso NUMBER;
BEGIN
  IF p_status IN ('RESOLVIDO', 'DESCARTADO') THEN
    RETURN 0;
  END IF;

  v_peso := CASE p_gravidade
              WHEN 'BAIXA' THEN 1
              WHEN 'MEDIA' THEN 3
              WHEN 'ALTA'  THEN 5
              ELSE 1
            END;

  RETURN v_peso * (1 + NVL(p_total_apoios, 0))
       + GREATEST(FLOOR(SYSDATE - p_criado_em), 0);
END fn_calcular_prioridade;
/

-- -----------------------------------------------------------------------------
-- fn_prioridade_relato: prioridade atual de um relato pelo id.
-- Erro -20005 se o relato não existir.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prioridade_relato (
  p_relato_id IN relato.id%TYPE
) RETURN NUMBER
IS
  v_gravidade    relato.gravidade%TYPE;
  v_total_apoios relato.total_apoios%TYPE;
  v_criado_em    relato.criado_em%TYPE;
  v_status       relato.status%TYPE;
BEGIN
  SELECT gravidade, total_apoios, criado_em, status
    INTO v_gravidade, v_total_apoios, v_criado_em, v_status
    FROM relato
   WHERE id = p_relato_id;

  RETURN fn_calcular_prioridade(v_gravidade, v_total_apoios, v_criado_em, v_status);
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20005, 'Relato ' || p_relato_id || ' não existe.');
END fn_prioridade_relato;
/

-- -----------------------------------------------------------------------------
-- fn_taxa_descricoes_uteis: úteis / avaliadas x 100 (2 casas).
--   p_usuario_id NULL = todos os usuários.
--   Descrições sem avaliação (util NULL) não entram no denominador.
--   Retorna NULL se nenhuma descrição foi avaliada.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_taxa_descricoes_uteis (
  p_usuario_id IN usuario.id%TYPE DEFAULT NULL
) RETURN NUMBER
IS
  v_uteis     PLS_INTEGER;
  v_avaliadas PLS_INTEGER;
BEGIN
  SELECT COUNT(CASE WHEN util = 1 THEN 1 END),
         COUNT(util)
    INTO v_uteis, v_avaliadas
    FROM descricao
   WHERE p_usuario_id IS NULL
      OR usuario_id = p_usuario_id;

  IF v_avaliadas = 0 THEN
    RETURN NULL;
  END IF;

  RETURN ROUND(v_uteis / v_avaliadas * 100, 2);
END fn_taxa_descricoes_uteis;
/

SHOW ERRORS
