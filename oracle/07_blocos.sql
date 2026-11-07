-- =============================================================================
-- Vê AI · Oracle · 07 · Blocos anônimos (critério 01)
--   Bloco 1: CURSOR explícito + repetição + decisão: recalcula a prioridade
--            dos relatos não finalizados (os dias em aberto mudam todo dia)
--   Bloco 2: repetição + decisão: classifica cada região em CRÍTICA, ATENÇÃO
--            ou OK conforme os relatos atrasados (> 30 dias)
-- =============================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED
SET DEFINE OFF

-- -----------------------------------------------------------------------------
-- Bloco 1 · Recalcular prioridades
-- Logo depois do seed nada muda (o seed já calculou). Para ver o efeito na
-- apresentação, rode antes:  UPDATE relato SET prioridade = 0 WHERE id IN (1, 2, 4);
-- -----------------------------------------------------------------------------
DECLARE
  CURSOR c_relatos IS
    SELECT id, gravidade, total_apoios, criado_em, status, prioridade
      FROM relato
     WHERE status IN ('ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO')
     ORDER BY id
       FOR UPDATE OF prioridade;

  r           c_relatos%ROWTYPE;
  v_nova      relato.prioridade%TYPE;
  v_alterados PLS_INTEGER := 0;
  v_lidos     PLS_INTEGER;
BEGIN
  DBMS_OUTPUT.PUT_LINE('Recalculando prioridades dos relatos não finalizados...');
  DBMS_OUTPUT.PUT_LINE(RPAD('relato', 8) || RPAD('gravidade', 11) || RPAD('apoios', 8)
                       || RPAD('dias', 6) || RPAD('antes', 8) || 'depois');

  OPEN c_relatos;
  LOOP
    FETCH c_relatos INTO r;
    EXIT WHEN c_relatos%NOTFOUND;

    v_nova := fn_calcular_prioridade(r.gravidade, r.total_apoios, r.criado_em, r.status);

    DBMS_OUTPUT.PUT_LINE(RPAD('#' || r.id, 8) || RPAD(r.gravidade, 11) || RPAD(r.total_apoios, 8)
                         || RPAD(FLOOR(SYSDATE - r.criado_em), 6) || RPAD(r.prioridade, 8)
                         || v_nova
                         || CASE WHEN v_nova <> r.prioridade THEN '  (alterada)' END);

    IF v_nova <> r.prioridade THEN
      UPDATE relato SET prioridade = v_nova WHERE CURRENT OF c_relatos;
      v_alterados := v_alterados + 1;
    END IF;
  END LOOP;
  v_lidos := c_relatos%ROWCOUNT;
  CLOSE c_relatos;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('Relatos lidos: ' || v_lidos || ' · prioridades alteradas: ' || v_alterados);
END;
/

-- -----------------------------------------------------------------------------
-- Bloco 2 · Situação das regiões
--   CRÍTICA: pelo menos um relato atrasado de gravidade ALTA
--   ATENÇÃO: há relato atrasado, mas nenhum de gravidade ALTA
--   OK:      nenhum relato atrasado
-- -----------------------------------------------------------------------------
DECLARE
  c_dias_atraso CONSTANT PLS_INTEGER := 30;
  v_abertos        PLS_INTEGER;
  v_atrasados      PLS_INTEGER;
  v_atrasados_alta PLS_INTEGER;
  v_situacao       VARCHAR2(10);
  v_criticas       PLS_INTEGER := 0;
BEGIN
  DBMS_OUTPUT.PUT_LINE('Situação das regiões (atraso = mais de ' || c_dias_atraso || ' dias)');
  DBMS_OUTPUT.PUT_LINE(RPAD('região', 16) || RPAD('abertos', 9) || RPAD('atrasados', 11)
                       || RPAD('atras. ALTA', 13) || 'situação');

  FOR g IN (SELECT id, nome FROM regiao ORDER BY nome) LOOP
    SELECT COUNT(*),
           COUNT(CASE WHEN criado_em < SYSDATE - c_dias_atraso THEN 1 END),
           COUNT(CASE WHEN criado_em < SYSDATE - c_dias_atraso AND gravidade = 'ALTA' THEN 1 END)
      INTO v_abertos, v_atrasados, v_atrasados_alta
      FROM relato
     WHERE regiao_id = g.id
       AND status IN ('ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO');

    IF v_atrasados_alta > 0 THEN
      v_situacao := 'CRÍTICA';
      v_criticas := v_criticas + 1;
    ELSIF v_atrasados > 0 THEN
      v_situacao := 'ATENÇÃO';
    ELSE
      v_situacao := 'OK';
    END IF;

    DBMS_OUTPUT.PUT_LINE(RPAD(g.nome, 16) || RPAD(v_abertos, 9) || RPAD(v_atrasados, 11)
                         || RPAD(v_atrasados_alta, 13) || v_situacao);
  END LOOP;

  IF v_criticas > 0 THEN
    DBMS_OUTPUT.PUT_LINE(v_criticas || ' região(ões) crítica(s): priorize a triagem.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('Nenhuma região crítica.');
  END IF;
END;
/
