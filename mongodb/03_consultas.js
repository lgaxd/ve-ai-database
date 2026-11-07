// =============================================================================
// Vê AI · MongoDB · 03 · Relatórios comparados com o Oracle (09_relatorios.sql)
// Execução:  mongosh --file mongodb/03_consultas.js
// =============================================================================
db = db.getSiblingDB('veai');

const DIA_MS = 24 * 60 * 60 * 1000;
const agora = new Date();
const STATUS_ABERTOS = ['ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO'];

function titulo(t) {
  print('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78));
}

// -----------------------------------------------------------------------------
// Relatório 1 · Barreiras por região e tipo (relatos não descartados)
// Oracle: JOIN REGIAO + GROUP BY.  Mongo: a região já está embutida, então o
// agrupamento acontece direto na collection, sem junção.
// -----------------------------------------------------------------------------
titulo('Relatório 1 · Barreiras por região e tipo (aggregate)');
const r1 = db.relatos.aggregate([
  { $match: { status: { $ne: 'DESCARTADO' } } },
  {
    $group: {
      _id: { regiao: '$regiao.nome', tipo: '$tipo' },
      qtdRelatos: { $sum: 1 },
      totalApoios: { $sum: '$totalApoios' },
      gravidadeNivel: {
        $max: {
          $switch: {
            branches: [
              { case: { $eq: ['$gravidade', 'BAIXA'] }, then: 1 },
              { case: { $eq: ['$gravidade', 'MEDIA'] }, then: 2 },
            ],
            default: 3,
          },
        },
      },
    },
  },
  {
    $project: {
      _id: 0,
      regiao: '$_id.regiao',
      tipo: '$_id.tipo',
      qtdRelatos: 1,
      totalApoios: 1,
      gravidadeMaxima: { $arrayElemAt: [['', 'BAIXA', 'MEDIA', 'ALTA'], '$gravidadeNivel'] },
    },
  },
  { $sort: { regiao: 1, qtdRelatos: -1, tipo: 1 } },
]).toArray();
console.table(r1.map((d) => ({
  regiao: d.regiao, tipo: d.tipo, qtdRelatos: d.qtdRelatos,
  totalApoios: d.totalApoios, gravidadeMaxima: d.gravidadeMaxima,
})));

// -----------------------------------------------------------------------------
// Relatório 2 · Relatos não finalizados abertos há mais de 30 dias
// Oracle: WHERE status IN (...) AND criado_em < SYSDATE - 30.
// Mongo: find com filtro + projeção calculada (dias em aberto).
// -----------------------------------------------------------------------------
titulo('Relatório 2 · Relatos abertos há mais de 30 dias (find)');
const limite = new Date(agora.getTime() - 30 * DIA_MS);
const r2 = db.relatos.find(
  { status: { $in: STATUS_ABERTOS }, criadoEm: { $lt: limite } },
  {
    _id: 1,
    regiao: '$regiao.nome',
    tipo: 1,
    gravidade: 1,
    status: 1,
    diasEmAberto: { $floor: { $divide: [{ $subtract: [agora, '$criadoEm'] }, DIA_MS] } },
    totalApoios: 1,
  }
).sort({ criadoEm: 1, _id: 1 }).toArray();
console.table(r2.map((d) => ({
  id: d._id, regiao: d.regiao, tipo: d.tipo, gravidade: d.gravidade,
  status: d.status, diasEmAberto: d.diasEmAberto, totalApoios: d.totalApoios,
})));

// -----------------------------------------------------------------------------
// Relatório 3 · Taxa de descrições úteis por modo
// taxa = úteis / avaliadas (util nulo = não avaliada, fica fora do denominador)
// -----------------------------------------------------------------------------
titulo('Relatório 3 · Taxa de descrições úteis por modo (aggregate)');
const r3 = db.descricoes.aggregate([
  {
    $group: {
      _id: '$modo',
      total: { $sum: 1 },
      avaliadas: { $sum: { $cond: [{ $ne: ['$util', null] }, 1, 0] } },
      uteis: { $sum: { $cond: [{ $eq: ['$util', true] }, 1, 0] } },
    },
  },
  {
    $project: {
      _id: 0,
      modo: '$_id',
      total: 1,
      avaliadas: 1,
      uteis: 1,
      taxaPct: {
        $cond: [
          { $eq: ['$avaliadas', 0] },
          null,
          { $round: [{ $multiply: [{ $divide: ['$uteis', '$avaliadas'] }, 100] }, 2] },
        ],
      },
    },
  },
  { $sort: { modo: 1 } },
]).toArray();
console.table(r3.map((d) => ({
  modo: d.modo, total: d.total, avaliadas: d.avaliadas, uteis: d.uteis, taxaPct: d.taxaPct,
})));

// -----------------------------------------------------------------------------
// Bônus · Regra dos 30 m com índice geoespacial
// Oracle: fn_distancia_metros (Haversine) + bounding box.
// Mongo: $geoNear no índice 2dsphere, devolvendo a distância em metros.
// Ponto: um cidadão a ~10 m do relato #1 tentando relatar o mesmo buraco.
// -----------------------------------------------------------------------------
titulo('Bônus · Relatos CALCADA_DANIFICADA não finalizados a até 30 m do ponto (aggregate $geoNear)');
const bonus = db.relatos.aggregate([
  {
    $geoNear: {
      near: { type: 'Point', coordinates: [-46.684250, -23.566050] },
      distanceField: 'distanciaMetros',
      maxDistance: 30,
      spherical: true,
      query: { tipo: 'CALCADA_DANIFICADA', status: { $in: STATUS_ABERTOS } },
    },
  },
  { $project: { _id: 1, endereco: 1, status: 1, totalApoios: 1, distanciaMetros: { $round: ['$distanciaMetros', 1] } } },
]).toArray();
console.table(bonus);

// -----------------------------------------------------------------------------
// Bônus · Referência a usuário com $lookup (equivalente ao JOIN USUARIO)
// Fila do gestor: relatos não finalizados com o nome do autor, por prioridade.
// -----------------------------------------------------------------------------
titulo('Bônus · Fila da gestora Marina (Pinheiros e Sé) com $lookup do autor');
const gestora = db.usuarios.findOne({ _id: 5 });
const fila = db.relatos.aggregate([
  { $match: { 'regiao.id': { $in: gestora.regioes.map((g) => g.id) }, status: { $in: STATUS_ABERTOS } } },
  { $lookup: { from: 'usuarios', localField: 'cidadaoId', foreignField: '_id', as: 'autor' } },
  { $unwind: '$autor' },
  { $project: { _id: 1, regiao: '$regiao.nome', tipo: 1, status: 1, prioridade: 1, autor: '$autor.nome' } },
  { $sort: { prioridade: -1, _id: 1 } },
]).toArray();
console.table(fila.map((d) => ({
  id: d._id, regiao: d.regiao, tipo: d.tipo, status: d.status, prioridade: d.prioridade, autor: d.autor,
})));
