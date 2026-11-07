-- =============================================================================
-- Vê AI · Oracle · 08 · Testes dos pacotes (critério 04)
-- Cenários positivos e negativos de pkg_relatos e pkg_descricoes, além das
-- funções, procedures e triggers que eles usam. Cada teste imprime PASS/FAIL.
-- Tudo é desfeito com ROLLBACK no fim: o seed continua intacto.
-- Pré-requisito: 01 a 06 executados.
-- =============================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED
SET DEFINE OFF

DECLARE
  g_pass   PLS_INTEGER := 0;
  g_fail   PLS_INTEGER := 0;

  -- Ponto de teste em Pinheiros, longe de todos os relatos do seed
  c_lat    CONSTANT NUMBER := -23.570000;
  c_lon    CONSTANT NUMBER := -46.700000;

  v_id        relato.id%TYPE;
  v_id_apoio  relato.id%TYPE;
  v_id_outro  relato.id%TYPE;
  v_resultado VARCHAR2(30);
  v_num       NUMBER;
  v_num2      NUMBER;
  v_txt       VARCHAR2(100);
  v_total     PLS_INTEGER;
  v_amb       PLS_INTEGER;
  v_tex       PLS_INTEGER;
  v_taxa      NUMBER;
  v_lat       NUMBER;
  v_cursor    SYS_REFCURSOR;
  v_c_id      NUMBER;
  v_c_regiao  VARCHAR2(80);
  v_c_tipo    VARCHAR2(30);
  v_c_grav    VARCHAR2(5);
  v_c_status  VARCHAR2(12);
  v_c_dias    NUMBER;
  v_c_apoios  NUMBER;

  PROCEDURE check_true (p_nome VARCHAR2, p_cond BOOLEAN, p_detalhe VARCHAR2 DEFAULT NULL) IS
  BEGIN
    IF p_cond THEN
      g_pass := g_pass + 1;
      DBMS_OUTPUT.PUT_LINE('PASS  ' || p_nome);
    ELSE
      g_fail := g_fail + 1;
      DBMS_OUTPUT.PUT_LINE('FAIL  ' || p_nome || CASE WHEN p_detalhe IS NOT NULL THEN '  -> ' || p_detalhe END);
    END IF;
  END check_true;

  PROCEDURE check_eq (p_nome VARCHAR2, p_esperado VARCHAR2, p_obtido VARCHAR2) IS
  BEGIN
    check_true(p_nome,
               p_esperado = p_obtido OR (p_esperado IS NULL AND p_obtido IS NULL),
               'esperado [' || p_esperado || '] obtido [' || p_obtido || ']');
  END check_eq;

  PROCEDURE falhou_sem_erro (p_nome VARCHAR2) IS
  BEGIN
    check_true(p_nome, FALSE, 'nenhuma exceção foi lançada');
  END falhou_sem_erro;

BEGIN
  DBMS_OUTPUT.PUT_LINE('=== Funções auxiliares ===');

  -- T01 Haversine: mesmo ponto = 0; 0,00027 grau de latitude ~ 30 m
  check_eq('T01a fn_distancia_metros: mesmo ponto = 0 m',
           '0', TO_CHAR(fn_distancia_metros(c_lat, c_lon, c_lat, c_lon)));
  v_num := fn_distancia_metros(c_lat, c_lon, c_lat + 0.00027, c_lon);
  check_true('T01b fn_distancia_metros: 0,00027 grau de latitude ~ 30 m',
             v_num BETWEEN 29.5 AND 30.5, 'obtido ' || ROUND(v_num, 2));

  -- T02/T03 Fórmula da prioridade
  check_eq('T02 prioridade ALTA, 2 apoios, 10 dias = 5 x 3 + 10 = 25',
           '25', TO_CHAR(fn_calcular_prioridade('ALTA', 2, SYSDATE - 10, 'ABERTO')));
  check_eq('T03a prioridade MEDIA, 0 apoios, hoje = 3',
           '3', TO_CHAR(fn_calcular_prioridade('MEDIA', 0, SYSDATE, 'ABERTO')));
  check_eq('T03b relato RESOLVIDO tem prioridade 0',
           '0', TO_CHAR(fn_calcular_prioridade('ALTA', 9, SYSDATE - 90, 'RESOLVIDO')));

  DBMS_OUTPUT.PUT_LINE('=== pkg_relatos.registrar (regra dos 30 m) ===');

  -- T04 Relato novo, longe de tudo -> CRIADO
  pkg_relatos.registrar(1, NULL, 1, 'CALCADA_DANIFICADA', 'ALTA', 'Teste: buraco novo',
                        c_lat, c_lon, 'Endereço de teste', v_id, v_resultado);
  check_eq('T04a novo relato longe de outros -> CRIADO', 'CRIADO', v_resultado);
  SELECT prioridade INTO v_num FROM relato WHERE id = v_id;
  check_eq('T04b prioridade inicial ALTA sem apoios = 5', '5', TO_CHAR(v_num));
  SELECT COUNT(*) INTO v_num FROM auditoria_relato WHERE relato_id = v_id AND operacao = 'INSERT';
  check_eq('T04c trg_auditoria_relato registrou o INSERT', '1', TO_CHAR(v_num));

  -- T05 Outro cidadão, mesmo tipo, ~10 m -> APOIO_REGISTRADO (+1 pelo trigger)
  pkg_relatos.registrar(2, NULL, 1, 'CALCADA_DANIFICADA', 'MEDIA', 'Teste: mesmo buraco',
                        c_lat + 0.00009, c_lon, 'Endereço de teste', v_id_apoio, v_resultado);
  check_eq('T05a mesmo tipo a ~10 m por outro cidadão -> APOIO_REGISTRADO', 'APOIO_REGISTRADO', v_resultado);
  check_eq('T05b devolve o relato existente', TO_CHAR(v_id), TO_CHAR(v_id_apoio));
  SELECT total_apoios, prioridade INTO v_num, v_num2 FROM relato WHERE id = v_id;
  check_eq('T05c trg_conta_apoio: total_apoios = 1', '1', TO_CHAR(v_num));
  check_eq('T05d trg_conta_apoio: prioridade recalculada = 5 x 2 = 10', '10', TO_CHAR(v_num2));

  -- T06 Repetições -> JA_REGISTRADO
  pkg_relatos.registrar(2, NULL, 1, 'CALCADA_DANIFICADA', 'MEDIA', 'Teste: de novo',
                        c_lat, c_lon, NULL, v_id_apoio, v_resultado);
  check_eq('T06a quem já apoiou envia de novo -> JA_REGISTRADO', 'JA_REGISTRADO', v_resultado);
  pkg_relatos.registrar(1, NULL, 1, 'CALCADA_DANIFICADA', 'ALTA', 'Teste: autor de novo',
                        c_lat, c_lon, NULL, v_id_apoio, v_resultado);
  check_eq('T06b o próprio autor envia de novo -> JA_REGISTRADO', 'JA_REGISTRADO', v_resultado);
  SELECT total_apoios INTO v_num FROM relato WHERE id = v_id;
  check_eq('T06c total_apoios continua 1', '1', TO_CHAR(v_num));

  -- T07 Tipo diferente no mesmo ponto, ou mesmo tipo a ~50 m -> CRIADO
  pkg_relatos.registrar(2, NULL, 1, 'RAMPA', 'BAIXA', 'Teste: rampa',
                        c_lat, c_lon, NULL, v_id_outro, v_resultado);
  check_true('T07a tipo diferente no mesmo ponto -> CRIADO (outro relato)',
             v_resultado = 'CRIADO' AND v_id_outro <> v_id, v_resultado);
  pkg_relatos.registrar(3, NULL, 1, 'CALCADA_DANIFICADA', 'BAIXA', 'Teste: 50 m',
                        c_lat + 0.00045, c_lon, NULL, v_id_apoio, v_resultado);
  check_true('T07b mesmo tipo a ~50 m -> CRIADO (fora do raio)',
             v_resultado = 'CRIADO' AND v_id_apoio <> v_id, v_resultado);

  -- T07c Gestor não pode registrar relato
  BEGIN
    pkg_relatos.registrar(5, NULL, 1, 'OUTRO', 'BAIXA', 'Teste', c_lat, c_lon, NULL, v_id_apoio, v_resultado);
    falhou_sem_erro('T07c gestor registrando relato -> e_usuario_invalido');
  EXCEPTION
    WHEN pkg_relatos.e_usuario_invalido THEN check_true('T07c gestor registrando relato -> e_usuario_invalido', TRUE);
    WHEN OTHERS THEN check_true('T07c gestor registrando relato -> e_usuario_invalido', FALSE, SQLERRM);
  END;

  DBMS_OUTPUT.PUT_LINE('=== pkg_relatos.atualizar_status (máquina de estados) ===');

  -- T08 ABERTO -> EM_TRIAGEM pela gestora de Pinheiros
  pkg_relatos.atualizar_status(v_id, 5, 'EM_TRIAGEM', p_comentario => 'Teste: triagem');
  SELECT status INTO v_txt FROM relato WHERE id = v_id;
  check_eq('T08a ABERTO -> EM_TRIAGEM', 'EM_TRIAGEM', v_txt);
  SELECT COUNT(*) INTO v_num FROM atualizacao_relato WHERE relato_id = v_id;
  check_eq('T08b gravou 1 ATUALIZACAO_RELATO', '1', TO_CHAR(v_num));
  SELECT COUNT(*) INTO v_num FROM notificacao WHERE relato_id = v_id;
  check_eq('T08c notificou autor + 1 apoiador = 2', '2', TO_CHAR(v_num));
  SELECT COUNT(*) INTO v_num FROM auditoria_relato
   WHERE relato_id = v_id AND operacao = 'UPDATE'
     AND status_antigo = 'ABERTO' AND status_novo = 'EM_TRIAGEM';
  check_eq('T08d auditoria guardou status antigo e novo', '1', TO_CHAR(v_num));

  -- T09 Pular etapa
  BEGIN
    pkg_relatos.atualizar_status(v_id, 5, 'RESOLVIDO');
    falhou_sem_erro('T09 EM_TRIAGEM -> RESOLVIDO -> e_transicao_invalida');
  EXCEPTION
    WHEN pkg_relatos.e_transicao_invalida THEN check_true('T09 EM_TRIAGEM -> RESOLVIDO -> e_transicao_invalida', TRUE);
    WHEN OTHERS THEN check_true('T09 EM_TRIAGEM -> RESOLVIDO -> e_transicao_invalida', FALSE, SQLERRM);
  END;

  -- T10 Encaminhar sem protocolo
  BEGIN
    pkg_relatos.atualizar_status(v_id, 5, 'ENCAMINHADO');
    falhou_sem_erro('T10a ENCAMINHADO sem protocolo -> e_protocolo_obrigatorio');
  EXCEPTION
    WHEN pkg_relatos.e_protocolo_obrigatorio THEN check_true('T10a ENCAMINHADO sem protocolo -> e_protocolo_obrigatorio', TRUE);
    WHEN OTHERS THEN check_true('T10a ENCAMINHADO sem protocolo -> e_protocolo_obrigatorio', FALSE, SQLERRM);
  END;

  -- T11 Gestor de outra região
  BEGIN
    pkg_relatos.atualizar_status(v_id, 6, 'ENCAMINHADO', 'SP156-TESTE');
    falhou_sem_erro('T11 gestor de Vila Mariana em relato de Pinheiros -> e_gestor_fora_regiao');
  EXCEPTION
    WHEN pkg_relatos.e_gestor_fora_regiao THEN check_true('T11 gestor de Vila Mariana em relato de Pinheiros -> e_gestor_fora_regiao', TRUE);
    WHEN OTHERS THEN check_true('T11 gestor de Vila Mariana em relato de Pinheiros -> e_gestor_fora_regiao', FALSE, SQLERRM);
  END;

  -- T10b Encaminhar com protocolo
  pkg_relatos.atualizar_status(v_id, 5, 'ENCAMINHADO', 'SP156-TESTE-0001', 'Teste: encaminhado');
  SELECT status || '|' || protocolo_orgao INTO v_txt FROM relato WHERE id = v_id;
  check_eq('T10b EM_TRIAGEM -> ENCAMINHADO grava o protocolo', 'ENCAMINHADO|SP156-TESTE-0001', v_txt);

  -- T12 Descartar sem motivo
  BEGIN
    pkg_relatos.atualizar_status(v_id, 5, 'DESCARTADO');
    falhou_sem_erro('T12a DESCARTADO sem motivo -> e_motivo_obrigatorio');
  EXCEPTION
    WHEN pkg_relatos.e_motivo_obrigatorio THEN check_true('T12a DESCARTADO sem motivo -> e_motivo_obrigatorio', TRUE);
    WHEN OTHERS THEN check_true('T12a DESCARTADO sem motivo -> e_motivo_obrigatorio', FALSE, SQLERRM);
  END;

  -- T12b Resolver -> prioridade 0
  pkg_relatos.atualizar_status(v_id, 5, 'RESOLVIDO', p_comentario => 'Teste: resolvido');
  SELECT status, prioridade INTO v_txt, v_num FROM relato WHERE id = v_id;
  check_eq('T12b ENCAMINHADO -> RESOLVIDO zera a prioridade', 'RESOLVIDO|0', v_txt || '|' || v_num);

  -- T12c Estado final não muda mais
  BEGIN
    pkg_relatos.atualizar_status(v_id, 5, 'EM_TRIAGEM');
    falhou_sem_erro('T12c RESOLVIDO é final -> e_transicao_invalida');
  EXCEPTION
    WHEN pkg_relatos.e_transicao_invalida THEN check_true('T12c RESOLVIDO é final -> e_transicao_invalida', TRUE);
    WHEN OTHERS THEN check_true('T12c RESOLVIDO é final -> e_transicao_invalida', FALSE, SQLERRM);
  END;

  -- T12d Descarte direto a partir de ABERTO, com motivo
  pkg_relatos.atualizar_status(v_id_outro, 5, 'DESCARTADO', p_motivo => 'Teste: duplicado');
  SELECT status || '|' || motivo_descarte INTO v_txt FROM relato WHERE id = v_id_outro;
  check_eq('T12d ABERTO -> DESCARTADO grava o motivo', 'DESCARTADO|Teste: duplicado', v_txt);

  -- T13 Relato inexistente
  BEGIN
    pkg_relatos.atualizar_status(999999, 5, 'EM_TRIAGEM');
    falhou_sem_erro('T13a atualizar relato inexistente -> e_relato_inexistente');
  EXCEPTION
    WHEN pkg_relatos.e_relato_inexistente THEN check_true('T13a atualizar relato inexistente -> e_relato_inexistente', TRUE);
    WHEN OTHERS THEN check_true('T13a atualizar relato inexistente -> e_relato_inexistente', FALSE, SQLERRM);
  END;
  BEGIN
    v_num := pkg_relatos.prioridade(999999);
    falhou_sem_erro('T13b prioridade de relato inexistente -> e_relato_inexistente');
  EXCEPTION
    WHEN pkg_relatos.e_relato_inexistente THEN check_true('T13b prioridade de relato inexistente -> e_relato_inexistente', TRUE);
    WHEN OTHERS THEN check_true('T13b prioridade de relato inexistente -> e_relato_inexistente', FALSE, SQLERRM);
  END;

  DBMS_OUTPUT.PUT_LINE('=== pkg_relatos: prioridades e atrasados ===');

  -- T14 recalcular_prioridades corrige uma prioridade desatualizada
  UPDATE relato SET prioridade = 0 WHERE id = 1;
  pkg_relatos.recalcular_prioridades(v_total);
  SELECT prioridade INTO v_num FROM relato WHERE id = 1;
  check_true('T14a recalcular_prioridades alterou pelo menos 1 relato', v_total >= 1, 'alterados ' || v_total);
  check_eq('T14b prioridade do relato #1 = pkg_relatos.prioridade(1)', TO_CHAR(pkg_relatos.prioridade(1)), TO_CHAR(v_num));

  -- T15 relatos_atrasados (REF CURSOR) = consulta direta
  SELECT COUNT(*) INTO v_num
    FROM relato
   WHERE status IN ('ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO')
     AND criado_em < SYSDATE - 30;
  v_total := 0;
  v_cursor := pkg_relatos.relatos_atrasados;
  LOOP
    FETCH v_cursor INTO v_c_id, v_c_regiao, v_c_tipo, v_c_grav, v_c_status, v_c_dias, v_c_apoios;
    EXIT WHEN v_cursor%NOTFOUND;
    v_total := v_total + 1;
    IF v_c_dias <= 30 THEN
      check_true('T15 relato #' || v_c_id || ' tem mais de 30 dias', FALSE, v_c_dias || ' dias');
    END IF;
  END LOOP;
  CLOSE v_cursor;
  check_true('T15a relatos_atrasados devolve linhas', v_total > 0);
  check_eq('T15b relatos_atrasados = consulta direta', TO_CHAR(v_num), TO_CHAR(v_total));

  DBMS_OUTPUT.PUT_LINE('=== Gatilhos em DELETE ===');

  -- T16 Remover apoio decrementa o contador
  SELECT relato_id INTO v_num FROM apoio_relato WHERE relato_id = 1 AND usuario_id = 2;
  DELETE FROM apoio_relato WHERE relato_id = 1 AND usuario_id = 2;
  SELECT total_apoios INTO v_num FROM relato WHERE id = 1;
  check_eq('T16 trg_conta_apoio: remover apoio do relato #1 -> total_apoios = 1', '1', TO_CHAR(v_num));

  -- T17 DELETE de relato fica na auditoria (relato sem apoios)
  DELETE FROM relato WHERE id = v_id_outro;
  SELECT COUNT(*) INTO v_num FROM auditoria_relato
   WHERE relato_id = v_id_outro AND operacao = 'DELETE' AND status_antigo = 'DESCARTADO' AND status_novo IS NULL;
  check_eq('T17 trg_auditoria_relato registrou o DELETE com o status antigo', '1', TO_CHAR(v_num));

  DBMS_OUTPUT.PUT_LINE('=== pkg_descricoes ===');

  -- T18 Taxa de utilidade (seed: 11 úteis de 15 avaliadas = 73,33%)
  check_eq('T18a taxa_utilidade geral = 73,33', '73.33',
           TO_CHAR(pkg_descricoes.taxa_utilidade, 'FM990.00', 'NLS_NUMERIC_CHARACTERS=''.,'''));
  check_eq('T18b taxa_utilidade da Ana (4 de 5) = 80', '80', TO_CHAR(pkg_descricoes.taxa_utilidade(1)));
  check_eq('T18c taxa de quem nunca avaliou = NULL', NULL, TO_CHAR(pkg_descricoes.taxa_utilidade(5)));

  -- T19 Avaliar muda a taxa (descrição 19 está sem avaliação)
  pkg_descricoes.avaliar(19, 1);
  check_eq('T19 após avaliar a #19 como útil: 12 de 16 = 75', '75', TO_CHAR(pkg_descricoes.taxa_utilidade));

  -- T20/T21 Avaliações inválidas
  BEGIN
    pkg_descricoes.avaliar(999999, 1);
    falhou_sem_erro('T20 avaliar descrição inexistente -> e_descricao_inexistente');
  EXCEPTION
    WHEN pkg_descricoes.e_descricao_inexistente THEN check_true('T20 avaliar descrição inexistente -> e_descricao_inexistente', TRUE);
    WHEN OTHERS THEN check_true('T20 avaliar descrição inexistente -> e_descricao_inexistente', FALSE, SQLERRM);
  END;
  BEGIN
    pkg_descricoes.avaliar(1, 5);
    falhou_sem_erro('T21 avaliar com valor 5 -> e_avaliacao_invalida');
  EXCEPTION
    WHEN pkg_descricoes.e_avaliacao_invalida THEN check_true('T21 avaliar com valor 5 -> e_avaliacao_invalida', TRUE);
    WHEN OTHERS THEN check_true('T21 avaliar com valor 5 -> e_avaliacao_invalida', FALSE, SQLERRM);
  END;

  -- T22 Estatísticas da Ana (6 descrições: 5 AMBIENTE + 1 TEXTO)
  pkg_descricoes.estatisticas_usuario(1, v_total, v_amb, v_tex, v_taxa, v_lat);
  check_eq('T22a estatisticas_usuario: total/ambiente/texto = 6/5/1', '6/5/1', v_total || '/' || v_amb || '/' || v_tex);
  SELECT ROUND(AVG(latencia_ms)) INTO v_num FROM descricao WHERE usuario_id = 1;
  check_eq('T22b latência média da Ana = AVG direto', TO_CHAR(v_num), TO_CHAR(v_lat));

  BEGIN
    pkg_descricoes.estatisticas_usuario(999999, v_total, v_amb, v_tex, v_taxa, v_lat);
    falhou_sem_erro('T22c estatísticas de usuário inexistente -> erro -20006');
  EXCEPTION
    WHEN pkg_relatos.e_usuario_invalido THEN check_true('T22c estatísticas de usuário inexistente -> erro -20006', TRUE);
    WHEN OTHERS THEN check_true('T22c estatísticas de usuário inexistente -> erro -20006', FALSE, SQLERRM);
  END;

  -- T23 Latência média por modo e barreiras detectadas
  SELECT ROUND(AVG(latencia_ms)) INTO v_num FROM descricao WHERE modo = 'TEXTO';
  check_eq('T23a latencia_media(modo TEXTO) = AVG direto', TO_CHAR(v_num), TO_CHAR(pkg_descricoes.latencia_media(p_modo => 'TEXTO')));
  check_eq('T23b total_barreiras_detectadas (seed) = 10', '10', TO_CHAR(pkg_descricoes.total_barreiras_detectadas));

  -- ---------------------------------------------------------------------------
  ROLLBACK;
  DBMS_OUTPUT.PUT_LINE('----------------------------------------------------------');
  DBMS_OUTPUT.PUT_LINE('Resultado: ' || g_pass || ' PASS · ' || g_fail || ' FAIL');
  DBMS_OUTPUT.PUT_LINE('ROLLBACK executado: os dados do seed não foram alterados.');
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    DBMS_OUTPUT.PUT_LINE('ERRO INESPERADO (teste interrompido): ' || SQLERRM);
    DBMS_OUTPUT.PUT_LINE(DBMS_UTILITY.FORMAT_ERROR_BACKTRACE);
    DBMS_OUTPUT.PUT_LINE('Parcial: ' || g_pass || ' PASS · ' || g_fail || ' FAIL');
END;
/
