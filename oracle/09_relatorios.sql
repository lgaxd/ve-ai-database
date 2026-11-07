-- =============================================================================
-- Vê AI · Oracle · 09 · Relatórios comparados com o MongoDB (03_consultas.js)
-- Rodar com F5 (Run Script) ou cada SELECT com Ctrl+Enter para ver em grade.
-- =============================================================================
SET DEFINE OFF

-- -----------------------------------------------------------------------------
-- Relatório 1 · Barreiras por região e tipo (relatos não descartados)
-- Mongo: aggregate $match / $group / $project / $sort
-- -----------------------------------------------------------------------------
SELECT g.nome                       AS regiao,
       r.tipo,
       COUNT(*)                     AS qtd_relatos,
       SUM(r.total_apoios)          AS total_apoios,
       CASE MAX(CASE r.gravidade WHEN 'BAIXA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END)
         WHEN 1 THEN 'BAIXA'
         WHEN 2 THEN 'MEDIA'
         ELSE 'ALTA'
       END                          AS gravidade_maxima
  FROM relato r
  JOIN regiao g ON g.id = r.regiao_id
 WHERE r.status <> 'DESCARTADO'
 GROUP BY g.nome, r.tipo
 ORDER BY g.nome, qtd_relatos DESC, r.tipo;

-- -----------------------------------------------------------------------------
-- Relatório 2 · Relatos não finalizados abertos há mais de 30 dias
-- Mongo: find({status: {$in: [...]}, criadoEm: {$lt: agora - 30 dias}})
-- (a mesma consulta está em pkg_relatos.relatos_atrasados como REF CURSOR)
-- -----------------------------------------------------------------------------
SELECT r.id,
       g.nome                       AS regiao,
       r.tipo,
       r.gravidade,
       r.status,
       FLOOR(SYSDATE - r.criado_em) AS dias_em_aberto,
       r.total_apoios
  FROM relato r
  JOIN regiao g ON g.id = r.regiao_id
 WHERE r.status IN ('ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO')
   AND r.criado_em < SYSDATE - 30
 ORDER BY r.criado_em, r.id;

-- -----------------------------------------------------------------------------
-- Relatório 3 · Taxa de descrições úteis por modo
-- taxa = úteis / avaliadas; COUNT(util) ignora NULL (não avaliada)
-- Mongo: aggregate $group com $cond
-- -----------------------------------------------------------------------------
SELECT modo,
       COUNT(*)                                 AS total,
       COUNT(util)                              AS avaliadas,
       COUNT(CASE WHEN util = 1 THEN 1 END)     AS uteis,
       ROUND(COUNT(CASE WHEN util = 1 THEN 1 END) / NULLIF(COUNT(util), 0) * 100, 2) AS taxa_pct
  FROM descricao
 GROUP BY modo
 ORDER BY modo;

-- Mesma taxa pela função do critério 02 (geral e por usuário)
SELECT fn_taxa_descricoes_uteis()  AS taxa_geral_pct,
       fn_taxa_descricoes_uteis(1) AS taxa_ana_pct
  FROM dual;

-- -----------------------------------------------------------------------------
-- Bônus · Regra dos 30 m: relatos CALCADA_DANIFICADA não finalizados a até 30 m
-- de um cidadão a ~10 m do relato #1.
-- Mongo: $geoNear no índice 2dsphere.
-- -----------------------------------------------------------------------------
SELECT id, endereco, status, total_apoios, distancia_metros
  FROM (SELECT r.id, r.endereco, r.status, r.total_apoios,
               ROUND(fn_distancia_metros(-23.566050, -46.684250, r.latitude, r.longitude), 1) AS distancia_metros
          FROM relato r
         WHERE r.tipo = 'CALCADA_DANIFICADA'
           AND r.status IN ('ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO'))
 WHERE distancia_metros <= 30
 ORDER BY distancia_metros;

-- -----------------------------------------------------------------------------
-- Bônus · Fila da gestora Marina (id 5) com o nome do autor
-- Mongo: $match nas regiões embutidas no gestor + $lookup em usuarios
-- -----------------------------------------------------------------------------
SELECT r.id, g.nome AS regiao, r.tipo, r.status, r.prioridade, u.nome AS autor
  FROM relato r
  JOIN regiao g         ON g.id = r.regiao_id
  JOIN gestor_regiao gr ON gr.regiao_id = r.regiao_id AND gr.gestor_id = 5
  JOIN usuario u        ON u.id = r.cidadao_id
 WHERE r.status IN ('ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO')
 ORDER BY r.prioridade DESC, r.id;
