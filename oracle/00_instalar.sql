-- =============================================================================
-- Vê AI · Oracle · 00 · Instalação completa
-- Abra este arquivo no SQL Developer e rode com F5 (Run Script).
-- O "@@" procura os arquivos na mesma pasta deste script.
-- Se preferir, abra e rode cada arquivo na ordem abaixo.
-- =============================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED
SET DEFINE OFF

PROMPT ===== 01 DDL =====
@@01_ddl.sql
PROMPT ===== 02 Funções =====
@@02_funcoes.sql
PROMPT ===== 03 Procedimentos =====
@@03_procedures.sql
PROMPT ===== 04 Gatilhos =====
@@04_triggers.sql
PROMPT ===== 05 Pacotes =====
@@05_pacotes.sql
PROMPT ===== 06 Seed =====
@@06_seed.sql
PROMPT ===== 07 Blocos anônimos =====
@@07_blocos.sql
PROMPT ===== 08 Testes =====
@@08_testes.sql

PROMPT ===== Objetos inválidos (deve vir vazio) =====
SELECT object_type, object_name, status
  FROM user_objects
 WHERE status <> 'VALID'
 ORDER BY object_type, object_name;

PROMPT Pronto. Rode 09_relatorios.sql para os relatórios comparados.
