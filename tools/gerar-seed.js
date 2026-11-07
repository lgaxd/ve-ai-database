#!/usr/bin/env node
/**
 * Vê AI · gerador de seed
 *
 * Lê tools/dataset.json e gera, a partir da MESMA fonte:
 *   oracle/06_seed.sql     (INSERTs com datas relativas a SYSDATE)
 *   mongodb/02_insert.js   (insertMany com datas relativas a new Date())
 *
 * Assim os relatórios comparados (09_relatorios.sql x 03_consultas.js) dão os
 * mesmos números. Uso:  node tools/gerar-seed.js
 * Não precisa de dependências: só Node 18+.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const dados = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset.json'), 'utf8'));

const SENHA_HASH = ('$2a$10$' + 'VeAiHashIlustrativoSomenteParaDadosDeTeste').padEnd(60, 'x');
const STATUS_ABERTOS = ['ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO'];
const TRANSICOES = {
  ABERTO: ['EM_TRIAGEM', 'DESCARTADO'],
  EM_TRIAGEM: ['ENCAMINHADO', 'DESCARTADO'],
  ENCAMINHADO: ['RESOLVIDO', 'DESCARTADO'],
  RESOLVIDO: [],
  DESCARTADO: [],
};

// ---------------------------------------------------------------------------
// 1. Valida o dataset com as mesmas regras do banco (falha cedo, antes do SQL)
// ---------------------------------------------------------------------------
function validar() {
  const erros = [];
  const usuarios = new Map(dados.usuarios.map((u) => [u.id, u]));
  const regioes = new Set(dados.regioes.map((r) => r.id));
  const descricoes = new Map(dados.descricoes.map((d) => [d.id, d]));

  for (const u of dados.usuarios) {
    for (const rid of u.regioes || []) {
      if (u.papel !== 'GESTOR') erros.push(`usuario ${u.id}: só gestor tem regiões`);
      if (!regioes.has(rid)) erros.push(`usuario ${u.id}: região ${rid} inexistente`);
    }
  }

  for (const d of dados.descricoes) {
    if (!usuarios.has(d.usuarioId)) erros.push(`descricao ${d.id}: usuário inexistente`);
    if (d.barreira.detectada && !d.barreira.tipo) erros.push(`descricao ${d.id}: barreira sem tipo`);
  }

  for (const r of dados.relatos) {
    const autor = usuarios.get(r.cidadaoId);
    if (!autor || autor.papel !== 'CIDADAO') erros.push(`relato ${r.id}: autor não é cidadão`);
    if (!regioes.has(r.regiaoId)) erros.push(`relato ${r.id}: região inexistente`);
    if (r.descricaoId != null) {
      const d = descricoes.get(r.descricaoId);
      if (!d) erros.push(`relato ${r.id}: descrição inexistente`);
      else if (d.usuarioId !== r.cidadaoId) erros.push(`relato ${r.id}: descrição é de outro usuário`);
    }

    const apoiadores = new Set();
    for (const a of r.apoios) {
      if (a.usuarioId === r.cidadaoId) erros.push(`relato ${r.id}: autor não pode apoiar`);
      if (apoiadores.has(a.usuarioId)) erros.push(`relato ${r.id}: apoio repetido`);
      if (a.diasAtras > r.diasAtras) erros.push(`relato ${r.id}: apoio anterior ao relato`);
      apoiadores.add(a.usuarioId);
    }

    let status = 'ABERTO';
    let dia = r.diasAtras;
    for (const h of r.historico) {
      if (h.de !== status) erros.push(`relato ${r.id}: histórico começa em ${h.de}, esperado ${status}`);
      if (!TRANSICOES[h.de].includes(h.para)) erros.push(`relato ${r.id}: transição ${h.de}->${h.para}`);
      if (h.diasAtras > dia) erros.push(`relato ${r.id}: histórico fora de ordem`);
      const gestor = usuarios.get(h.gestorId);
      if (!gestor || !(gestor.regioes || []).includes(r.regiaoId)) {
        erros.push(`relato ${r.id}: gestor ${h.gestorId} não atende a região`);
      }
      status = h.para;
      dia = h.diasAtras;
    }
    if (status !== r.status) erros.push(`relato ${r.id}: status ${r.status} difere do histórico (${status})`);
    if (['ENCAMINHADO', 'RESOLVIDO'].includes(r.status) && !r.protocoloOrgao) {
      erros.push(`relato ${r.id}: falta protocolo`);
    }
    if (r.status === 'DESCARTADO' && !r.motivoDescarte) erros.push(`relato ${r.id}: falta motivo`);
  }

  if (erros.length) {
    console.error('Dataset inválido:\n  - ' + erros.join('\n  - '));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------
const sqlTexto = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const sqlNum = (v) => (v === null || v === undefined ? 'NULL' : String(v));
const sqlBool = (v) => (v === null || v === undefined ? 'NULL' : v ? '1' : '0');
const sqlData = (dias) => (dias === 0 ? 'SYSDATE' : `SYSDATE - ${dias}`);

function mensagemNotificacao(relatoId, statusNovo, relato) {
  const base = `O relato #${relatoId} que você registrou ou apoiou `;
  switch (statusNovo) {
    case 'EM_TRIAGEM': return base + 'está em triagem pela rede de apoio.';
    case 'ENCAMINHADO': return base + `foi encaminhado ao órgão responsável. Protocolo ${relato.protocoloOrgao}.`;
    case 'RESOLVIDO': return base + 'foi resolvido. Obrigado por ajudar a cidade!';
    case 'DESCARTADO': return base + `foi descartado. Motivo: ${relato.motivoDescarte}`;
    default: return base + 'foi atualizado.';
  }
}

const ultimaAtividade = (r) => (r.historico.length ? r.historico[r.historico.length - 1].diasAtras : r.diasAtras);

// ---------------------------------------------------------------------------
// 3. Oracle
// ---------------------------------------------------------------------------
function gerarOracle() {
  const L = [];
  const add = (s = '') => L.push(s);

  add('-- =============================================================================');
  add('-- Vê AI · Oracle · 06 · Seed (dados de teste)');
  add('-- GERADO por tools/gerar-seed.js a partir de tools/dataset.json. NÃO EDITE À MÃO.');
  add('-- Datas relativas a SYSDATE: rode de novo antes da apresentação para manter');
  add('-- "abertos há mais de 30 dias" com o mesmo resultado do MongoDB.');
  add('-- Requer 02_funcoes e 04_triggers: o trg_conta_apoio calcula total_apoios.');
  add('-- =============================================================================');
  add('SET SERVEROUTPUT ON');
  add('SET DEFINE OFF');
  add();
  add('-- Limpa os dados (ordem inversa das FKs). Apoios antes dos relatos: ver 01_ddl.');
  for (const t of ['notificacao', 'atualizacao_relato', 'apoio_relato', 'relato', 'descricao', 'gestor_regiao', 'usuario', 'regiao', 'auditoria_relato']) {
    add(`DELETE FROM ${t};`);
  }
  add();

  add('-- REGIAO');
  for (const g of dados.regioes) {
    add(`INSERT INTO regiao (id, nome, cidade, uf) VALUES (${g.id}, ${sqlTexto(g.nome)}, ${sqlTexto(g.cidade)}, ${sqlTexto(g.uf)});`);
  }
  add();

  add('-- USUARIO (senha_hash ilustrativo: a API Java/.NET cria os próprios usuários de teste)');
  for (const u of dados.usuarios) {
    add('INSERT INTO usuario (id, nome, email, senha_hash, papel, velocidade_voz, pergunta_livre_ativa, criado_em)');
    add(`  VALUES (${u.id}, ${sqlTexto(u.nome)}, ${sqlTexto(u.email)}, ${sqlTexto(SENHA_HASH)}, ${sqlTexto(u.papel)}, ${sqlNum(u.velocidadeVoz)}, ${sqlBool(u.perguntaLivreAtiva)}, ${sqlData(u.diasAtras)});`);
  }
  add();

  add('-- GESTOR_REGIAO');
  for (const u of dados.usuarios) {
    for (const rid of u.regioes || []) {
      add(`INSERT INTO gestor_regiao (gestor_id, regiao_id) VALUES (${u.id}, ${rid});`);
    }
  }
  add();

  add('-- DESCRICAO (perigos/objetos = JSON devolvido pela IA)');
  for (const d of dados.descricoes) {
    add('INSERT INTO descricao (id, usuario_id, modo, resumo, descricao_completa, perigos, objetos, barreira_detectada, barreira_tipo, latencia_ms, util, criado_em)');
    add(`  VALUES (${d.id}, ${d.usuarioId}, ${sqlTexto(d.modo)}, ${sqlTexto(d.resumo)},`);
    add(`          ${sqlTexto(d.descricaoCompleta)},`);
    add(`          ${sqlTexto(JSON.stringify(d.perigos))},`);
    add(`          ${sqlTexto(JSON.stringify(d.objetos))},`);
    add(`          ${sqlBool(d.barreira.detectada)}, ${sqlTexto(d.barreira.tipo)}, ${d.latenciaMs}, ${sqlBool(d.util)}, ${sqlData(d.diasAtras)});`);
  }
  add();

  add('-- RELATO (total_apoios e prioridade começam em 0; o trigger e o UPDATE final ajustam)');
  for (const r of dados.relatos) {
    add('INSERT INTO relato (id, cidadao_id, descricao_id, regiao_id, tipo, gravidade, texto, latitude, longitude, endereco,');
    add('                    status, protocolo_orgao, motivo_descarte, total_apoios, prioridade, norma_referencia, criado_em, atualizado_em)');
    add(`  VALUES (${r.id}, ${r.cidadaoId}, ${sqlNum(r.descricaoId)}, ${r.regiaoId}, ${sqlTexto(r.tipo)}, ${sqlTexto(r.gravidade)},`);
    add(`          ${sqlTexto(r.texto)}, ${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}, ${sqlTexto(r.endereco)},`);
    add(`          ${sqlTexto(r.status)}, ${sqlTexto(r.protocoloOrgao)}, ${sqlTexto(r.motivoDescarte)}, 0, 0, ${sqlTexto(r.normaReferencia)},`);
    add(`          ${sqlData(r.diasAtras)}, ${sqlData(ultimaAtividade(r))});`);
  }
  add();

  add('-- APOIO_RELATO (cada INSERT dispara trg_conta_apoio: total_apoios + 1)');
  let apoioId = 0;
  for (const r of dados.relatos) {
    for (const a of r.apoios) {
      apoioId += 1;
      add(`INSERT INTO apoio_relato (id, relato_id, usuario_id, criado_em) VALUES (${apoioId}, ${r.id}, ${a.usuarioId}, ${sqlData(a.diasAtras)});`);
    }
  }
  add();

  add('-- ATUALIZACAO_RELATO (histórico de status feito pelos gestores)');
  let atualizacaoId = 0;
  for (const r of dados.relatos) {
    for (const h of r.historico) {
      atualizacaoId += 1;
      add('INSERT INTO atualizacao_relato (id, relato_id, gestor_id, status_anterior, status_novo, comentario, criado_em)');
      add(`  VALUES (${atualizacaoId}, ${r.id}, ${h.gestorId}, ${sqlTexto(h.de)}, ${sqlTexto(h.para)}, ${sqlTexto(h.comentario)}, ${sqlData(h.diasAtras)});`);
    }
  }
  add();

  add('-- NOTIFICACAO (uma por mudança de status, para o autor e quem já apoiava)');
  let notificacaoId = 0;
  for (const r of dados.relatos) {
    for (const h of r.historico) {
      const interessados = [r.cidadaoId, ...r.apoios.filter((a) => a.diasAtras >= h.diasAtras).map((a) => a.usuarioId)];
      for (const uid of interessados) {
        notificacaoId += 1;
        const lida = h.diasAtras > 7 ? 1 : 0;
        add('INSERT INTO notificacao (id, usuario_id, relato_id, mensagem, lida, criado_em)');
        add(`  VALUES (${notificacaoId}, ${uid}, ${r.id}, ${sqlTexto(mensagemNotificacao(r.id, h.para, r))}, ${lida}, ${sqlData(h.diasAtras)});`);
      }
    }
  }
  add();

  add('-- Prioridade de todos os relatos com os apoios já contados');
  add('UPDATE relato SET prioridade = fn_calcular_prioridade(gravidade, total_apoios, criado_em, status);');
  add();
  add('-- A carga inicial não é uma operação de negócio: limpa a auditoria gerada por ela');
  add('DELETE FROM auditoria_relato;');
  add();
  add('COMMIT;');
  add();
  add('-- Ajusta as colunas IDENTITY para continuar depois dos IDs fixos do seed');
  for (const t of ['usuario', 'regiao', 'descricao', 'relato', 'apoio_relato', 'atualizacao_relato', 'notificacao']) {
    add(`ALTER TABLE ${t} MODIFY (id GENERATED BY DEFAULT AS IDENTITY (START WITH LIMIT VALUE));`);
  }
  add();
  add('-- Conferência');
  add(`SELECT 'regiao' AS tabela, COUNT(*) AS linhas FROM regiao`);
  for (const t of ['usuario', 'gestor_regiao', 'descricao', 'relato', 'apoio_relato', 'atualizacao_relato', 'notificacao']) {
    add(`UNION ALL SELECT '${t}', COUNT(*) FROM ${t}`);
  }
  add(';');
  add();

  return L.join('\n');
}

// ---------------------------------------------------------------------------
// 4. MongoDB
// ---------------------------------------------------------------------------
function gerarMongo() {
  const regiaoPorId = new Map(dados.regioes.map((g) => [g.id, g]));
  const DATA = (dias) => `__DIAS__${dias}__`;

  const usuarios = dados.usuarios.map((u) => {
    const doc = {
      _id: u.id,
      nome: u.nome,
      email: u.email,
      senhaHash: SENHA_HASH,
      papel: u.papel,
      preferencias: { velocidadeVoz: u.velocidadeVoz, perguntaLivreAtiva: u.perguntaLivreAtiva },
      criadoEm: DATA(u.diasAtras),
    };
    if (u.papel === 'GESTOR') {
      doc.regioes = u.regioes.map((rid) => ({ id: rid, nome: regiaoPorId.get(rid).nome }));
    }
    return doc;
  });

  const descricoes = dados.descricoes.map((d) => ({
    _id: d.id,
    usuarioId: d.usuarioId,
    modo: d.modo,
    resumo: d.resumo,
    descricaoCompleta: d.descricaoCompleta,
    ia: {
      perigos: d.perigos,
      objetos: d.objetos,
      barreira: { detectada: d.barreira.detectada, tipo: d.barreira.tipo },
    },
    latenciaMs: d.latenciaMs,
    util: d.util,
    criadoEm: DATA(d.diasAtras),
  }));

  const relatos = dados.relatos.map((r) => {
    const g = regiaoPorId.get(r.regiaoId);
    return {
      _id: r.id,
      cidadaoId: r.cidadaoId,
      descricaoId: r.descricaoId,
      regiao: { id: g.id, nome: g.nome, cidade: g.cidade, uf: g.uf },
      tipo: r.tipo,
      gravidade: r.gravidade,
      texto: r.texto,
      localizacao: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      endereco: r.endereco,
      status: r.status,
      protocoloOrgao: r.protocoloOrgao ?? null,
      motivoDescarte: r.motivoDescarte ?? null,
      normaReferencia: r.normaReferencia ?? null,
      apoios: r.apoios.map((a) => ({ usuarioId: a.usuarioId, criadoEm: DATA(a.diasAtras) })),
      historico: r.historico.map((h) => ({
        gestorId: h.gestorId,
        statusAnterior: h.de,
        statusNovo: h.para,
        comentario: h.comentario,
        criadoEm: DATA(h.diasAtras),
      })),
      criadoEm: DATA(r.diasAtras),
      atualizadoEm: DATA(ultimaAtividade(r)),
    };
  });

  const js = (v) => JSON.stringify(v, null, 2).replace(/"__DIAS__([\d.]+)__"/g, 'diasAtras($1)');

  return `// =============================================================================
// Vê AI · MongoDB · 02 · Inserção dos documentos
// GERADO por tools/gerar-seed.js a partir de tools/dataset.json. NÃO EDITE À MÃO.
// Mesmo conjunto de dados do oracle/06_seed.sql (mesmos ids, valores e datas
// relativas), para que os relatórios comparados deem o mesmo resultado.
// Execução: mongosh --file mongodb/02_insert.js   (depois do 01_setup.js)
// =============================================================================
db = db.getSiblingDB('veai');

const DIA_MS = 24 * 60 * 60 * 1000;
const AGORA = Date.now();
function diasAtras(n) {
  return new Date(AGORA - n * DIA_MS);
}

// Mesma regra de fn_calcular_prioridade (Oracle) e da API
function calcularPrioridade(gravidade, totalApoios, criadoEm, status) {
  if (status === 'RESOLVIDO' || status === 'DESCARTADO') return 0;
  const peso = { BAIXA: 1, MEDIA: 3, ALTA: 5 }[gravidade] ?? 1;
  const diasEmAberto = Math.max(Math.floor((AGORA - criadoEm.getTime()) / DIA_MS), 0);
  return peso * (1 + totalApoios) + diasEmAberto;
}

db.usuarios.deleteMany({});
db.descricoes.deleteMany({});
db.relatos.deleteMany({});

// -----------------------------------------------------------------------------
// usuarios: GESTOR_REGIAO vira o array "regioes" embutido no gestor
// -----------------------------------------------------------------------------
const usuarios = ${js(usuarios)};

// -----------------------------------------------------------------------------
// descricoes: o JSON da IA fica embutido em "ia" (no Oracle é CLOB IS JSON)
// -----------------------------------------------------------------------------
const descricoes = ${js(descricoes)};

// -----------------------------------------------------------------------------
// relatos: APOIO_RELATO e ATUALIZACAO_RELATO viram os arrays "apoios" e
// "historico"; REGIAO vira um snapshot embutido; o usuário fica por referência.
// -----------------------------------------------------------------------------
const relatos = ${js(relatos)};

relatos.forEach((r) => {
  r.totalApoios = r.apoios.length;
  r.prioridade = calcularPrioridade(r.gravidade, r.totalApoios, r.criadoEm, r.status);
});

const resUsuarios = db.usuarios.insertMany(usuarios);
const resDescricoes = db.descricoes.insertMany(descricoes);
const resRelatos = db.relatos.insertMany(relatos);

print('Documentos inseridos:');
printjson({
  usuarios: Object.keys(resUsuarios.insertedIds).length,
  descricoes: Object.keys(resDescricoes.insertedIds).length,
  relatos: Object.keys(resRelatos.insertedIds).length,
});
`;
}

// ---------------------------------------------------------------------------
validar();
fs.writeFileSync(path.join(RAIZ, 'oracle', '06_seed.sql'), gerarOracle(), 'utf8');
fs.writeFileSync(path.join(RAIZ, 'mongodb', '02_insert.js'), gerarMongo(), 'utf8');
console.log('Gerados: oracle/06_seed.sql e mongodb/02_insert.js');
console.log(
  `  ${dados.regioes.length} regiões · ${dados.usuarios.length} usuários · ` +
    `${dados.descricoes.length} descrições · ${dados.relatos.length} relatos · ` +
    `${dados.relatos.reduce((s, r) => s + r.apoios.length, 0)} apoios`
);
