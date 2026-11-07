-- =============================================================================
-- Vê AI · Oracle · 03 · Procedimentos
--   prc_registrar_relato_ou_apoio   regra dos 30 m: cria o relato ou registra +1 apoio
--   prc_atualizar_status            máquina de estados do relato + histórico + notificações
--
-- As procedures NÃO fazem COMMIT: quem chama decide (assim os testes
-- conseguem desfazer tudo com ROLLBACK).
--
-- Códigos de erro (também expostos como exceções em pkg_relatos):
--   -20001 transição de status inválida
--   -20002 gestor não atende a região do relato
--   -20003 protocolo do órgão obrigatório para ENCAMINHADO
--   -20004 motivo obrigatório para DESCARTADO
--   -20005 relato inexistente
--   -20006 usuário inexistente ou com papel incorreto
-- =============================================================================
SET SERVEROUTPUT ON
SET DEFINE OFF

-- -----------------------------------------------------------------------------
-- prc_registrar_relato_ou_apoio
--   Procura um relato NÃO FINALIZADO (ABERTO, EM_TRIAGEM ou ENCAMINHADO) do
--   mesmo tipo a até 30 m.
--     - não existe          -> cria o relato              p_resultado = 'CRIADO'
--     - existe, outro autor -> insere APOIO_RELATO         p_resultado = 'APOIO_REGISTRADO'
--       (o trg_conta_apoio soma +1 e recalcula a prioridade)
--     - existe, e quem envia é o autor ou já apoiou        p_resultado = 'JA_REGISTRADO'
--   Em todos os casos p_relato_id devolve o relato afetado.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE prc_registrar_relato_ou_apoio (
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
)
IS
  c_raio_metros CONSTANT NUMBER := 30;
  -- Pré-filtro (bounding box) para não calcular Haversine na tabela inteira:
  -- 1 grau de latitude ~ 111 km; folga de 50%.
  c_delta_lat   CONSTANT NUMBER := c_raio_metros / 111000 * 1.5;
  v_delta_lon   NUMBER;
  v_papel       usuario.papel%TYPE;
  v_autor_id    relato.cidadao_id%TYPE;
  v_ja_apoiou   PLS_INTEGER;
BEGIN
  -- 1. Só cidadão registra relato
  BEGIN
    SELECT papel INTO v_papel FROM usuario WHERE id = p_cidadao_id;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN v_papel := NULL;
  END;

  IF v_papel IS NULL OR v_papel <> 'CIDADAO' THEN
    RAISE_APPLICATION_ERROR(-20006, 'Usuário ' || p_cidadao_id || ' não é um cidadão válido.');
  END IF;

  -- 2. Procura relato equivalente a até 30 m
  v_delta_lon := c_delta_lat / COS(p_latitude * ACOS(-1) / 180);

  BEGIN
    SELECT id, cidadao_id
      INTO p_relato_id, v_autor_id
      FROM (SELECT r.id,
                   r.cidadao_id,
                   fn_distancia_metros(p_latitude, p_longitude, r.latitude, r.longitude) AS distancia
              FROM relato r
             WHERE r.tipo = p_tipo
               AND r.status IN ('ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO')
               AND r.latitude  BETWEEN p_latitude  - c_delta_lat AND p_latitude  + c_delta_lat
               AND r.longitude BETWEEN p_longitude - v_delta_lon AND p_longitude + v_delta_lon)
     WHERE distancia <= c_raio_metros
     ORDER BY distancia
     FETCH FIRST 1 ROW ONLY;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN p_relato_id := NULL;
  END;

  -- 3. Decide: criar, apoiar ou ignorar
  IF p_relato_id IS NULL THEN
    INSERT INTO relato (cidadao_id, descricao_id, regiao_id, tipo, gravidade, texto,
                        latitude, longitude, endereco, status, total_apoios, prioridade,
                        criado_em, atualizado_em)
    VALUES (p_cidadao_id, p_descricao_id, p_regiao_id, p_tipo, p_gravidade, p_texto,
            p_latitude, p_longitude, p_endereco, 'ABERTO', 0,
            fn_calcular_prioridade(p_gravidade, 0, SYSDATE, 'ABERTO'),
            SYSDATE, SYSDATE)
    RETURNING id INTO p_relato_id;

    p_resultado := 'CRIADO';

  ELSIF v_autor_id = p_cidadao_id THEN
    p_resultado := 'JA_REGISTRADO';

  ELSE
    SELECT COUNT(*) INTO v_ja_apoiou
      FROM apoio_relato
     WHERE relato_id = p_relato_id
       AND usuario_id = p_cidadao_id;

    IF v_ja_apoiou > 0 THEN
      p_resultado := 'JA_REGISTRADO';
    ELSE
      INSERT INTO apoio_relato (relato_id, usuario_id, criado_em)
      VALUES (p_relato_id, p_cidadao_id, SYSDATE);
      p_resultado := 'APOIO_REGISTRADO';
    END IF;
  END IF;
END prc_registrar_relato_ou_apoio;
/

-- -----------------------------------------------------------------------------
-- prc_atualizar_status
--   Transições válidas (sem pular etapa e sem voltar):
--     ABERTO      -> EM_TRIAGEM | DESCARTADO
--     EM_TRIAGEM  -> ENCAMINHADO | DESCARTADO
--     ENCAMINHADO -> RESOLVIDO | DESCARTADO
--     RESOLVIDO e DESCARTADO são finais.
--   Regras extras: ENCAMINHADO exige protocolo; DESCARTADO exige motivo;
--   o gestor precisa atender a região do relato (GESTOR_REGIAO).
--   Efeitos: atualiza RELATO (status, protocolo/motivo, prioridade),
--   grava ATUALIZACAO_RELATO e cria uma NOTIFICACAO para o autor e para cada
--   apoiador (na arquitetura real isso é feito pelo consumidor RabbitMQ da API).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE prc_atualizar_status (
  p_relato_id   IN relato.id%TYPE,
  p_gestor_id   IN usuario.id%TYPE,
  p_status_novo IN relato.status%TYPE,
  p_protocolo   IN relato.protocolo_orgao%TYPE        DEFAULT NULL,
  p_comentario  IN atualizacao_relato.comentario%TYPE DEFAULT NULL,
  p_motivo      IN relato.motivo_descarte%TYPE        DEFAULT NULL
)
IS
  v_status_atual relato.status%TYPE;
  v_regiao_id    relato.regiao_id%TYPE;
  v_vinculo      PLS_INTEGER;
  v_valida       BOOLEAN := FALSE;
  v_mensagem     notificacao.mensagem%TYPE;
  v_notificados  PLS_INTEGER := 0;

  -- Autor do relato + todos os apoiadores (UNION remove repetidos)
  CURSOR c_interessados IS
    SELECT cidadao_id AS usuario_id FROM relato WHERE id = p_relato_id
    UNION
    SELECT usuario_id FROM apoio_relato WHERE relato_id = p_relato_id;
BEGIN
  -- 1. Relato existe? (trava a linha até o fim da transação)
  BEGIN
    SELECT status, regiao_id
      INTO v_status_atual, v_regiao_id
      FROM relato
     WHERE id = p_relato_id
       FOR UPDATE;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20005, 'Relato ' || p_relato_id || ' não existe.');
  END;

  -- 2. Gestor atende a região do relato?
  SELECT COUNT(*)
    INTO v_vinculo
    FROM gestor_regiao gr
    JOIN usuario u ON u.id = gr.gestor_id
   WHERE gr.gestor_id = p_gestor_id
     AND gr.regiao_id = v_regiao_id
     AND u.papel = 'GESTOR';

  IF v_vinculo = 0 THEN
    RAISE_APPLICATION_ERROR(-20002, 'Gestor ' || p_gestor_id || ' não atende a região do relato '
                                    || p_relato_id || '.');
  END IF;

  -- 3. Transição permitida?
  IF v_status_atual = 'ABERTO' AND p_status_novo IN ('EM_TRIAGEM', 'DESCARTADO') THEN
    v_valida := TRUE;
  ELSIF v_status_atual = 'EM_TRIAGEM' AND p_status_novo IN ('ENCAMINHADO', 'DESCARTADO') THEN
    v_valida := TRUE;
  ELSIF v_status_atual = 'ENCAMINHADO' AND p_status_novo IN ('RESOLVIDO', 'DESCARTADO') THEN
    v_valida := TRUE;
  END IF;

  IF NOT v_valida THEN
    RAISE_APPLICATION_ERROR(-20001, 'Transição inválida: ' || v_status_atual || ' -> '
                                    || NVL(p_status_novo, '(nulo)') || '.');
  END IF;

  -- 4. Campos obrigatórios por status
  IF p_status_novo = 'ENCAMINHADO' AND TRIM(p_protocolo) IS NULL THEN
    RAISE_APPLICATION_ERROR(-20003, 'Informe o protocolo do órgão para encaminhar o relato.');
  END IF;

  IF p_status_novo = 'DESCARTADO' AND TRIM(p_motivo) IS NULL THEN
    RAISE_APPLICATION_ERROR(-20004, 'Informe o motivo do descarte.');
  END IF;

  -- 5. Atualiza o relato (o trg_auditoria_relato registra antigo/novo)
  UPDATE relato
     SET status          = p_status_novo,
         protocolo_orgao = CASE WHEN p_status_novo = 'ENCAMINHADO' THEN TRIM(p_protocolo)
                                ELSE protocolo_orgao END,
         motivo_descarte = CASE WHEN p_status_novo = 'DESCARTADO' THEN TRIM(p_motivo)
                                ELSE motivo_descarte END,
         prioridade      = fn_calcular_prioridade(gravidade, total_apoios, criado_em, p_status_novo),
         atualizado_em   = SYSDATE
   WHERE id = p_relato_id;

  -- 6. Histórico de negócio
  INSERT INTO atualizacao_relato (relato_id, gestor_id, status_anterior, status_novo, comentario, criado_em)
  VALUES (p_relato_id, p_gestor_id, v_status_atual, p_status_novo, p_comentario, SYSDATE);

  -- 7. Notificações (lidas em voz alta pelo app)
  v_mensagem := 'O relato #' || p_relato_id || ' que você registrou ou apoiou '
             || CASE p_status_novo
                  WHEN 'EM_TRIAGEM'  THEN 'está em triagem pela rede de apoio.'
                  WHEN 'ENCAMINHADO' THEN 'foi encaminhado ao órgão responsável. Protocolo '
                                          || TRIM(p_protocolo) || '.'
                  WHEN 'RESOLVIDO'   THEN 'foi resolvido. Obrigado por ajudar a cidade!'
                  WHEN 'DESCARTADO'  THEN 'foi descartado. Motivo: ' || TRIM(p_motivo)
                END;

  FOR r IN c_interessados LOOP
    INSERT INTO notificacao (usuario_id, relato_id, mensagem, lida, criado_em)
    VALUES (r.usuario_id, p_relato_id, SUBSTR(v_mensagem, 1, 300), 0, SYSDATE);
    v_notificados := v_notificados + 1;
  END LOOP;

  DBMS_OUTPUT.PUT_LINE('Relato ' || p_relato_id || ': ' || v_status_atual || ' -> ' || p_status_novo
                       || ' (' || v_notificados || ' notificação(ões) criada(s))');
END prc_atualizar_status;
/

SHOW ERRORS
