-- =============================================================================
-- Vê AI · Oracle · 04 · Gatilhos
--   trg_auditoria_relato   auditoria de INSERT/UPDATE/DELETE em RELATO
--                          (data, operação, usuário, valor antigo e novo)
--   trg_conta_apoio        mantém RELATO.total_apoios e a prioridade quando um
--                          apoio é inserido ou removido
-- =============================================================================
SET SERVEROUTPUT ON
SET DEFINE OFF

-- -----------------------------------------------------------------------------
-- trg_auditoria_relato
--   :OLD é nulo no INSERT e :NEW é nulo no DELETE, então status_antigo /
--   status_novo ficam vazios exatamente onde não existem.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_auditoria_relato
AFTER INSERT OR UPDATE OR DELETE ON relato
FOR EACH ROW
DECLARE
  v_operacao auditoria_relato.operacao%TYPE;
BEGIN
  IF INSERTING THEN
    v_operacao := 'INSERT';
  ELSIF UPDATING THEN
    v_operacao := 'UPDATE';
  ELSE
    v_operacao := 'DELETE';
  END IF;

  INSERT INTO auditoria_relato (relato_id, operacao, usuario_bd, data_operacao,
                                status_antigo, status_novo,
                                prioridade_antiga, prioridade_nova)
  VALUES (NVL(:NEW.id, :OLD.id), v_operacao,
          SYS_CONTEXT('USERENV', 'SESSION_USER'), SYSTIMESTAMP,
          :OLD.status, :NEW.status,
          :OLD.prioridade, :NEW.prioridade);
END trg_auditoria_relato;
/

-- -----------------------------------------------------------------------------
-- trg_conta_apoio
--   Atualiza OUTRA tabela (RELATO), então não há erro de tabela mutante.
--   No SET, "total_apoios" à direita é o valor ANTES do update, por isso a
--   prioridade é calculada com total_apoios + 1 / - 1.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_conta_apoio
AFTER INSERT OR DELETE ON apoio_relato
FOR EACH ROW
BEGIN
  IF INSERTING THEN
    UPDATE relato
       SET total_apoios = total_apoios + 1,
           prioridade   = fn_calcular_prioridade(gravidade, total_apoios + 1, criado_em, status)
     WHERE id = :NEW.relato_id;
  ELSE
    UPDATE relato
       SET total_apoios = GREATEST(total_apoios - 1, 0),
           prioridade   = fn_calcular_prioridade(gravidade, GREATEST(total_apoios - 1, 0),
                                                 criado_em, status)
     WHERE id = :OLD.relato_id;
  END IF;
END trg_conta_apoio;
/

SHOW ERRORS
