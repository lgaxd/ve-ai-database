# Vê AI · Banco de dados (Oracle PL/SQL + MongoDB)

Global Solution 2026/2 · FIAP 2TDSPX · Mastering Relational and Non-Relational Database

| Integrante | RM |
|---|---:|
| Lucas Grillo Alcântara | 561413 |
| Pietro Ferreira Gomes Abrahamian | 561469 |
| Pedro Peres Benitez | 561792 |
| Lucca Ramos Mussumecci | 562027 |

## 1. Problema

O **Vê AI** é um assistente para pessoas com deficiência visual. O cidadão tira uma foto, a IA descreve o ambiente por áudio (os perigos primeiro) e, quando encontra uma **barreira estrutural** (buraco, calçada obstruída, rampa irregular, falta de piso tátil, semáforo sem som), o app oferece enviar um **relato** com GPS à rede de apoio (ONG/CRAS). O **gestor** da região faz a triagem e encaminha o relato ao órgão público até a resolução.

As regras de negócio que este repositório implementa no banco:

- **Deduplicação a 30 m:** se já existe um relato **não finalizado, do mesmo tipo, a até 30 m**, o novo envio vira **+1 apoio** em vez de outro relato.
- **Prioridade na fila do gestor:** `peso da gravidade (BAIXA 1, MEDIA 3, ALTA 5) × (1 + apoios) + dias em aberto`, valendo 0 quando o relato está RESOLVIDO ou DESCARTADO.
- **Máquina de estados:** `ABERTO → EM_TRIAGEM → ENCAMINHADO → RESOLVIDO`, com `DESCARTADO` possível a partir de qualquer estado não final. Não se pula etapa nem se volta. ENCAMINHADO exige protocolo, DESCARTADO exige motivo, e o gestor só altera relatos das regiões que atende.
- **Qualidade da IA:** taxa de descrições úteis = úteis ÷ avaliadas (as não avaliadas ficam fora do denominador).
- **Privacidade:** a imagem nunca é armazenada, só o texto da descrição. O GPS existe apenas no relato.

## 2. Estrutura

```
oracle/
  00_instalar.sql     roda 01 a 08 em sequência (F5 no SQL Developer)
  01_ddl.sql          8 tabelas do domínio + AUDITORIA_RELATO, constraints e índices
  02_funcoes.sql      fn_prioridade_relato, fn_taxa_descricoes_uteis (+ 2 auxiliares)
  03_procedures.sql   prc_registrar_relato_ou_apoio, prc_atualizar_status
  04_triggers.sql     trg_auditoria_relato, trg_conta_apoio
  05_pacotes.sql      pkg_relatos, pkg_descricoes (spec + body)
  06_seed.sql         dados de teste (gerado)
  07_blocos.sql       2 blocos anônimos (cursor, repetição, decisão)
  08_testes.sql       testes dos pacotes com PASS/FAIL e ROLLBACK
  09_relatorios.sql   3 relatórios comparados + 2 bônus
mongodb/
  01_setup.js         database, collections com $jsonSchema e índices (2dsphere)
  02_insert.js        insertMany dos documentos (gerado)
  03_consultas.js     os mesmos 3 relatórios + 2 bônus
tools/
  dataset.json        fonte única dos dados de teste
  gerar-seed.js       gera 06_seed.sql e 02_insert.js a partir do dataset
docs/evidencias/      prints e saídas de execução
```

Os dois seeds saem do mesmo `tools/dataset.json`, com os mesmos IDs, valores e datas relativas. Por isso os relatórios do Oracle e do MongoDB devem dar **os mesmos números**. Para alterar os dados, edite o dataset e rode `node tools/gerar-seed.js` (Node 18+, sem dependências). O gerador valida o dataset com as mesmas regras do banco antes de escrever os arquivos.

## 3. Como executar

### Oracle (SQL Developer)

1. **Encoding:** em *Tools → Preferences → Environment → Encoding*, selecione **UTF-8** antes de abrir os arquivos. Sem isso, os acentos chegam errados ao banco.
2. Abra `oracle/00_instalar.sql` e rode com **F5 (Run Script)**. Ele executa os scripts de 01 a 08 e no fim lista os objetos inválidos, lista que deve sair vazia.
   Se o `@@` não encontrar os arquivos, abra e rode cada um, de 01 a 08, nessa ordem.
3. Ative a saída em *View → Dbms Output*, ou use a aba *Script Output*, que já mostra o `SERVEROUTPUT`.
4. Rode `oracle/09_relatorios.sql` para os relatórios.

Todos os scripts podem ser executados de novo: o `01_ddl.sql` remove as tabelas antes de criá-las, e o `06_seed.sql` limpa os dados antes de inserir.

Requisito: Oracle 19c ou superior, por causa de `IDENTITY`, `IS JSON` e `FETCH FIRST`.

### MongoDB (mongosh)

```bash
mongosh --file mongodb/01_setup.js
mongosh --file mongodb/02_insert.js
mongosh --file mongodb/03_consultas.js
```

Esses comandos usam `mongodb://localhost:27017`. Para outro servidor, passe a URI antes de `--file`. Os scripts usam `db.getSiblingDB('veai')`, que é o equivalente a `use veai` dentro de um arquivo.

> **As datas são relativas ao momento da carga.** Rode o `06_seed.sql` e o `02_insert.js` no mesmo dia, e de novo antes da apresentação, para que "abertos há mais de 30 dias" e a prioridade continuem iguais nos dois bancos.

## 4. Modelo relacional (Oracle)

| Tabela | Papel | Destaques |
|---|---|---|
| `USUARIO` | cidadão ou gestor | `CHECK papel IN (CIDADAO, GESTOR)`, e-mail único, preferências de voz |
| `REGIAO` | bairro/subprefeitura | único por (nome, cidade, uf) |
| `GESTOR_REGIAO` | N:N gestor × região | PK composta |
| `DESCRICAO` | resultado da IA | `perigos` e `objetos` em `CLOB CHECK (... IS JSON)`; `util` nulo = não avaliada |
| `RELATO` | barreira relatada | lat/long, `status`, `prioridade` gravada, CHECKs de protocolo e motivo por status |
| `APOIO_RELATO` | +1 de outro cidadão | único por (relato, usuário) |
| `ATUALIZACAO_RELATO` | histórico de **negócio** | qual gestor mudou o status, de quê para quê, com qual comentário |
| `NOTIFICACAO` | aviso ao cidadão | criado para o autor e para cada apoiador |
| `AUDITORIA_RELATO` | trilha **técnica** | data, operação, usuário do banco, status e prioridade antigos e novos; sem FK, para sobreviver ao DELETE |

As PKs são `GENERATED BY DEFAULT AS IDENTITY`: o seed insere IDs fixos, que precisam ser iguais aos do MongoDB, e depois ajusta as sequências com `START WITH LIMIT VALUE`. Os enums da API viram `CHECK` constraints.

`APOIO_RELATO` não tem `ON DELETE CASCADE` de propósito. O `trg_conta_apoio` atualiza `RELATO`, e num delete em cascata a tabela `RELATO` estaria "mutante" (ORA-04091). Para excluir um relato com apoios, remova os apoios antes.

## 5. Objetos PL/SQL por critério

| Critério | Objeto | O que faz |
|---|---|---|
| 01 · blocos | `07_blocos.sql` bloco 1 | **cursor explícito** `FOR UPDATE` + `LOOP/FETCH` + `IF`: recalcula a prioridade dos relatos não finalizados (`WHERE CURRENT OF`) e imprime antes/depois |
| 01 · blocos | `07_blocos.sql` bloco 2 | `FOR` sobre as regiões + `IF/ELSIF`: classifica cada região em CRÍTICA, ATENÇÃO ou OK pelos relatos atrasados |
| 02 · funções | `fn_prioridade_relato(id)` | prioridade atual do relato; erro -20005 se ele não existe |
| 02 · funções | `fn_taxa_descricoes_uteis(usuario)` | úteis ÷ avaliadas × 100; `NULL` = todos os usuários |
| 02 · procedures | `prc_registrar_relato_ou_apoio` | regra dos 30 m (Haversine + bounding box) e devolve `CRIADO`, `APOIO_REGISTRADO` ou `JA_REGISTRADO` |
| 02 · procedures | `prc_atualizar_status` | valida a transição, o protocolo, o motivo e a região do gestor; grava o histórico; um **cursor** cria as notificações |
| 03 · gatilhos | `trg_auditoria_relato` | **auditoria** `AFTER INSERT OR UPDATE OR DELETE` com data, operação, usuário e valores antigo e novo |
| 03 · gatilhos | `trg_conta_apoio` | `AFTER INSERT OR DELETE` em `APOIO_RELATO`: ±1 em `total_apoios` e recálculo da prioridade |
| 04 · pacotes | `pkg_relatos` | `prioridade`, `registrar`, `atualizar_status`, `recalcular_prioridades`, `relatos_atrasados` (REF CURSOR), exceções nomeadas |
| 04 · pacotes | `pkg_descricoes` | `taxa_utilidade`, `latencia_media`, `total_barreiras_detectadas`, `avaliar`, `estatisticas_usuario` |
| 04 · testes | `08_testes.sql` | 49 verificações positivas e negativas com PASS/FAIL; `ROLLBACK` no fim |

Funções auxiliares: `fn_distancia_metros` (Haversine, raio de 6.371 km) e `fn_calcular_prioridade` (a fórmula pura, sem acesso a tabelas, que por isso pode ser usada dentro de `UPDATE RELATO` e de triggers sem erro de tabela mutante).

As procedures não fazem `COMMIT`: quem chama decide. É isso que permite aos testes desfazerem tudo.

**Notificações:** na arquitetura real do Vê AI, quem cria a `NOTIFICACAO` é o consumidor RabbitMQ da API Java (`@RabbitListener` na fila `veai.notificacoes`). Aqui a regra foi replicada em `prc_atualizar_status` para o banco poder demonstrar o fluxo inteiro sozinho.

### Códigos de erro

| Código | Exceção | Quando |
|---|---|---|
| -20001 | `pkg_relatos.e_transicao_invalida` | transição de status não permitida (inclui status inexistente) |
| -20002 | `pkg_relatos.e_gestor_fora_regiao` | gestor não atende a região do relato |
| -20003 | `pkg_relatos.e_protocolo_obrigatorio` | ENCAMINHADO sem protocolo |
| -20004 | `pkg_relatos.e_motivo_obrigatorio` | DESCARTADO sem motivo |
| -20005 | `pkg_relatos.e_relato_inexistente` | relato não existe |
| -20006 | `pkg_relatos.e_usuario_invalido` | usuário inexistente ou com papel errado |
| -20007 | `pkg_descricoes.e_descricao_inexistente` | descrição não existe |
| -20008 | `pkg_descricoes.e_avaliacao_invalida` | avaliação diferente de 1, 0 ou NULL |

### Exemplos para a apresentação

```sql
SET SERVEROUTPUT ON
-- Função
SELECT id, prioridade, fn_prioridade_relato(id) AS calculada FROM relato ORDER BY prioridade DESC;
SELECT fn_taxa_descricoes_uteis() AS geral, fn_taxa_descricoes_uteis(1) AS ana FROM dual;

-- Procedure: Diego a ~10 m do buraco do relato #1 -> APOIO_REGISTRADO
DECLARE v_id NUMBER; v_res VARCHAR2(30);
BEGIN
  prc_registrar_relato_ou_apoio(4, NULL, 1, 'CALCADA_DANIFICADA', 'ALTA', 'Buraco enorme',
                                -23.566050, -46.684250, 'Rua dos Pinheiros, 498', v_id, v_res);
  DBMS_OUTPUT.PUT_LINE(v_res || ' no relato #' || v_id);
END;
/
-- Procedure + trigger de auditoria
EXEC prc_atualizar_status(1, 5, 'EM_TRIAGEM', p_comentario => 'Vistoria agendada');
SELECT * FROM auditoria_relato ORDER BY id DESC;
SELECT * FROM notificacao WHERE relato_id = 1 ORDER BY id DESC;
ROLLBACK;
```

## 6. Modelo documental (MongoDB) e mapeamento

Database `veai`, com 3 collections validadas por `$jsonSchema` e 41 documentos (6 usuários, 20 descrições e 15 relatos).

| Oracle | MongoDB | Decisão | Por quê |
|---|---|---|---|
| `USUARIO` | `usuarios` | collection própria | o usuário é lido sozinho (login, preferências) e referenciado por vários documentos |
| `GESTOR_REGIAO` | `usuarios.regioes[]` | **embutido** no gestor | a lista é pequena e sempre lida com o gestor; elimina a tabela N:N |
| `REGIAO` | `relatos.regiao` | **snapshot embutido** `{id, nome, cidade, uf}` | quase nunca muda e é usada em todo agrupamento: o relatório 1 dispensa o JOIN |
| `DESCRICAO` | `descricoes` | collection própria | cresce sem limite por usuário, então não pode ficar dentro do usuário (limite de 16 MB) |
| `DESCRICAO.perigos/objetos` (CLOB JSON) | `descricoes.ia` | **embutido e nativo** | o JSON do LLM vira um subdocumento consultável e validado, sem `JSON_TABLE` |
| `RELATO` | `relatos` | collection própria | |
| `RELATO.latitude/longitude` | `relatos.localizacao` | **GeoJSON `Point`** + índice `2dsphere` | a regra dos 30 m vira um `$geoNear` com índice, em vez da Haversine manual |
| `APOIO_RELATO` | `relatos.apoios[]` | **embutido** | poucos por relato e sempre exibidos junto; `totalApoios` fica gravado para ordenar |
| `ATUALIZACAO_RELATO` | `relatos.historico[]` | **embutido** | a linha do tempo do relato é lida inteira numa única consulta |
| `USUARIO` ↔ `RELATO`/`DESCRICAO` | `cidadaoId`, `usuarioId`, `gestorId` | **referência** | o usuário muda (nome, preferências) e é compartilhado; demonstrado com `$lookup` |
| `NOTIFICACAO` | — | **não migrada** | é dado transacional de entrega (lida/não lida, fila por usuário), que cabe melhor no relacional ou na própria mensageria |
| `AUDITORIA_RELATO` | — | **não migrada** | é trilha de compliance: precisa de garantia transacional e de imutabilidade, que o Oracle dá com o trigger na mesma transação |

## 7. Relatórios comparados

Rodados contra o mesmo dataset. Os resultados abaixo são a saída real do MongoDB (`docs/evidencias/mongodb-saida.txt`); o Oracle deve devolver as mesmas linhas (prints em `docs/evidencias/`).

### Relatório 1 · Barreiras por região e tipo (relatos não descartados)

| | Oracle | MongoDB |
|---|---|---|
| Operação | `JOIN regiao` + `GROUP BY nome, tipo` | `aggregate`: `$match` → `$group` → `$project` → `$sort` |
| Gravidade máxima | `MAX(CASE ...)` traduzido de volta | `$max` de um `$switch` + `$arrayElemAt` |
| Junção | necessária (nome da região) | nenhuma: a região está embutida |

| regiao | tipo | qtd | apoios | gravidade máx. |
|---|---|---:|---:|---|
| Pinheiros | CALCADA_DANIFICADA | 1 | 2 | ALTA |
| Pinheiros | OBSTRUCAO_PERMANENTE | 1 | 1 | MEDIA |
| Pinheiros | OUTRO | 1 | 0 | MEDIA |
| Pinheiros | PISO_TATIL | 1 | 1 | MEDIA |
| Pinheiros | SEMAFORO_SEM_SOM | 1 | 1 | MEDIA |
| Sé | OBRA_SEM_SINALIZACAO | 2 | 2 | ALTA |
| Sé | PISO_TATIL | 1 | 3 | ALTA |
| Sé | SEMAFORO_SEM_SOM | 1 | 2 | MEDIA |
| Vila Mariana | CALCADA_DANIFICADA | 2 | 0 | MEDIA |
| Vila Mariana | RAMPA | 2 | 0 | ALTA |
| Vila Mariana | OUTRO | 1 | 0 | BAIXA |

### Relatório 2 · Relatos não finalizados abertos há mais de 30 dias

| | Oracle | MongoDB |
|---|---|---|
| Operação | `WHERE status IN (...) AND criado_em < SYSDATE - 30` | `find({status: {$in}, criadoEm: {$lt}})` |
| Dias em aberto | `FLOOR(SYSDATE - criado_em)` | projeção com `$floor` / `$divide` / `$subtract` |
| Índice | `ix_relato_regiao_status` | `ix_status_data` |

| id | regiao | tipo | gravidade | status | dias | apoios |
|---:|---|---|---|---|---:|---:|
| 13 | Sé | SEMAFORO_SEM_SOM | MEDIA | ENCAMINHADO | 62 | 2 |
| 1 | Pinheiros | CALCADA_DANIFICADA | ALTA | ABERTO | 60 | 2 |
| 2 | Pinheiros | OBSTRUCAO_PERMANENTE | MEDIA | EM_TRIAGEM | 50 | 1 |
| 6 | Pinheiros | SEMAFORO_SEM_SOM | MEDIA | ABERTO | 38 | 1 |

### Relatório 3 · Taxa de descrições úteis por modo

| | Oracle | MongoDB |
|---|---|---|
| Avaliadas | `COUNT(util)`, que ignora NULL | `$sum` de `$cond: [{$ne: ['$util', null]}, 1, 0]` |
| Úteis | `COUNT(CASE WHEN util = 1 ...)` | `$sum` de `$cond: [{$eq: ['$util', true]}, 1, 0]` |
| Taxa | `ROUND(... / NULLIF(avaliadas, 0) * 100, 2)` | `$round` com proteção para divisão por zero |

| modo | total | avaliadas | úteis | taxa |
|---|---:|---:|---:|---:|
| AMBIENTE | 15 | 12 | 9 | 75,00% |
| TEXTO | 5 | 3 | 2 | 66,67% |

Taxa geral (`fn_taxa_descricoes_uteis()`): 11 ÷ 15 = **73,33%**.

### Bônus

- **Regra dos 30 m:** Haversine em PL/SQL × `$geoNear` no índice `2dsphere`. Para um ponto a ~10 m do relato #1, os dois devolvem só o relato #1 (≈ 9,9 m).
- **Fila da gestora:** `JOIN gestor_regiao + usuario` × `$match` nas regiões embutidas no gestor + `$lookup` em `usuarios`.

## 8. Por que fazer a transição (e por que não fazer de tudo)

**O que o MongoDB faz melhor para o Vê AI:**

- **A saída da IA é um documento.** O JSON do LLM (perigos, objetos, barreira) muda de forma conforme o prompt evolui. No Oracle ele é um `CLOB` opaco; no MongoDB é um subdocumento consultável e validado por `$jsonSchema`.
- **Uma leitura por tela.** O app mostra o relato com o histórico e os apoios. No Mongo isso é um documento; no Oracle são três tabelas e dois JOINs.
- **Geolocalização nativa.** A deduplicação a 30 m usa o índice `2dsphere` em vez de uma fórmula manual com bounding box.
- **Volume:** as descrições são a maior parte das escritas (cada foto gera uma) e escalam horizontalmente melhor numa collection.

**O que fica no Oracle:**

- **A máquina de estados e a auditoria.** A transição de status, a gravação do histórico, as notificações e a auditoria acontecem numa única transação ACID, com triggers que não dá para "pular" pela aplicação.
- **As regras com integridade referencial:** apoio único por usuário, gestor só na sua região, protocolo obrigatório.
- **O custo do embutido:** se o nome da região mudar, o snapshot nos relatos precisa ser atualizado (`updateMany`), e o `totalApoios` precisa ser mantido pela aplicação, enquanto no Oracle o trigger garante isso.

A conclusão é **persistência poliglota**: descrições e leitura de relatos no MongoDB; fluxo de status, auditoria e notificações no Oracle.

## 9. Evidências

| Evidência | Arquivo |
|---|---|
| Saída completa do MongoDB (setup, inserção e relatórios) | `docs/evidencias/mongodb-saida.txt` |
| Oracle: instalação sem objetos inválidos | `docs/evidencias/oracle-01-instalacao.png` |
| Oracle: blocos anônimos | `docs/evidencias/oracle-02-blocos.png` |
| Oracle: testes (PASS/FAIL) | `docs/evidencias/oracle-03-testes.png` |
| Oracle: relatórios 1, 2 e 3 | `docs/evidencias/oracle-04-relatorio-1.png` … `-3.png` |
| Oracle: auditoria após mudança de status | `docs/evidencias/oracle-05-auditoria.png` |
| MongoDB: collections e documentos no Compass | `docs/evidencias/mongodb-01-collections.png` |

## 10. Uso de IA generativa

Usamos o Claude (Anthropic), via Claude Code, como apoio para estruturar os scripts SQL e JavaScript, montar o dataset de teste e revisar o README. As regras de negócio, o modelo de dados e as decisões de mapeamento foram definidos pelo grupo no escopo do projeto. Todo o código foi revisado e executado pelo grupo, que sabe explicar cada objeto.
