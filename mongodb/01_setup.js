// =============================================================================
// Vê AI · MongoDB · 01 · Database, collections, validação e índices
// Execução:  mongosh --file mongodb/01_setup.js
// No shell interativo, o equivalente da primeira linha é:  use veai
// Reexecutável: remove as collections antes de criar.
// =============================================================================
db = db.getSiblingDB('veai');

const TIPOS = ['CALCADA_DANIFICADA', 'OBSTRUCAO_PERMANENTE', 'PISO_TATIL', 'RAMPA',
  'SEMAFORO_SEM_SOM', 'OBRA_SEM_SINALIZACAO', 'OUTRO'];
const STATUS = ['ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO', 'RESOLVIDO', 'DESCARTADO'];

['usuarios', 'descricoes', 'relatos'].forEach((c) => db.getCollection(c).drop());

// -----------------------------------------------------------------------------
// usuarios  (USUARIO + GESTOR_REGIAO embutido em "regioes")
// -----------------------------------------------------------------------------
db.createCollection('usuarios', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'nome', 'email', 'senhaHash', 'papel', 'preferencias', 'criadoEm'],
      properties: {
        _id: { bsonType: 'int' },
        nome: { bsonType: 'string', maxLength: 120 },
        email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
        senhaHash: { bsonType: 'string' },
        papel: { enum: ['CIDADAO', 'GESTOR'] },
        preferencias: {
          bsonType: 'object',
          required: ['velocidadeVoz', 'perguntaLivreAtiva'],
          properties: {
            velocidadeVoz: { bsonType: ['double', 'int'], minimum: 0.5, maximum: 2 },
            perguntaLivreAtiva: { bsonType: 'bool' },
          },
        },
        regioes: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['id', 'nome'],
            properties: { id: { bsonType: 'int' }, nome: { bsonType: 'string' } },
          },
        },
        criadoEm: { bsonType: 'date' },
      },
    },
  },
});

// -----------------------------------------------------------------------------
// descricoes  (DESCRICAO, com o JSON da IA embutido em "ia")
// -----------------------------------------------------------------------------
db.createCollection('descricoes', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'usuarioId', 'modo', 'resumo', 'ia', 'latenciaMs', 'criadoEm'],
      properties: {
        _id: { bsonType: 'int' },
        usuarioId: { bsonType: 'int' },
        modo: { enum: ['AMBIENTE', 'TEXTO'] },
        resumo: { bsonType: 'string', maxLength: 500 },
        descricaoCompleta: { bsonType: ['string', 'null'] },
        ia: {
          bsonType: 'object',
          required: ['perigos', 'objetos', 'barreira'],
          properties: {
            perigos: {
              bsonType: 'array',
              items: {
                bsonType: 'object',
                required: ['descricao', 'direcao'],
                properties: {
                  descricao: { bsonType: 'string' },
                  direcao: { bsonType: 'string' },
                  distanciaAprox: { bsonType: ['string', 'null'] },
                },
              },
            },
            objetos: { bsonType: 'array', items: { bsonType: 'string' } },
            barreira: {
              bsonType: 'object',
              required: ['detectada'],
              properties: {
                detectada: { bsonType: 'bool' },
                tipo: { enum: [...TIPOS, null] },
              },
            },
          },
        },
        latenciaMs: { bsonType: ['int', 'double'], minimum: 0 },
        util: { bsonType: ['bool', 'null'] },
        criadoEm: { bsonType: 'date' },
      },
    },
  },
});

// -----------------------------------------------------------------------------
// relatos  (RELATO + APOIO_RELATO e ATUALIZACAO_RELATO embutidos;
//           REGIAO como snapshot; usuário e descrição por referência)
// -----------------------------------------------------------------------------
db.createCollection('relatos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'cidadaoId', 'regiao', 'tipo', 'gravidade', 'texto', 'localizacao',
        'status', 'totalApoios', 'prioridade', 'apoios', 'historico', 'criadoEm', 'atualizadoEm'],
      properties: {
        _id: { bsonType: 'int' },
        cidadaoId: { bsonType: 'int' },
        descricaoId: { bsonType: ['int', 'null'] },
        regiao: {
          bsonType: 'object',
          required: ['id', 'nome', 'cidade', 'uf'],
          properties: {
            id: { bsonType: 'int' },
            nome: { bsonType: 'string' },
            cidade: { bsonType: 'string' },
            uf: { bsonType: 'string', minLength: 2, maxLength: 2 },
          },
        },
        tipo: { enum: TIPOS },
        gravidade: { enum: ['BAIXA', 'MEDIA', 'ALTA'] },
        texto: { bsonType: 'string', maxLength: 1000 },
        localizacao: {
          bsonType: 'object',
          required: ['type', 'coordinates'],
          properties: {
            type: { enum: ['Point'] },
            coordinates: { bsonType: 'array', minItems: 2, maxItems: 2, items: { bsonType: 'double' } },
          },
        },
        endereco: { bsonType: ['string', 'null'] },
        status: { enum: STATUS },
        protocoloOrgao: { bsonType: ['string', 'null'] },
        motivoDescarte: { bsonType: ['string', 'null'] },
        normaReferencia: { bsonType: ['string', 'null'] },
        totalApoios: { bsonType: 'int', minimum: 0 },
        prioridade: { bsonType: ['int', 'double'], minimum: 0 },
        apoios: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['usuarioId', 'criadoEm'],
            properties: { usuarioId: { bsonType: 'int' }, criadoEm: { bsonType: 'date' } },
          },
        },
        historico: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['gestorId', 'statusAnterior', 'statusNovo', 'criadoEm'],
            properties: {
              gestorId: { bsonType: 'int' },
              statusAnterior: { enum: STATUS },
              statusNovo: { enum: STATUS },
              comentario: { bsonType: ['string', 'null'] },
              criadoEm: { bsonType: 'date' },
            },
          },
        },
        criadoEm: { bsonType: 'date' },
        atualizadoEm: { bsonType: 'date' },
      },
    },
  },
});

// -----------------------------------------------------------------------------
// Índices
// -----------------------------------------------------------------------------
db.usuarios.createIndex({ email: 1 }, { unique: true, name: 'uk_email' });
db.descricoes.createIndex({ usuarioId: 1, criadoEm: -1 }, { name: 'ix_usuario_data' });
db.descricoes.createIndex({ modo: 1 }, { name: 'ix_modo' });
db.relatos.createIndex({ localizacao: '2dsphere' }, { name: 'ix_localizacao_geo' }); // regra dos 30 m
db.relatos.createIndex({ 'regiao.id': 1, status: 1, prioridade: -1 }, { name: 'ix_fila_gestor' });
db.relatos.createIndex({ status: 1, criadoEm: 1 }, { name: 'ix_status_data' });
db.relatos.createIndex({ cidadaoId: 1 }, { name: 'ix_cidadao' });

print('Database: ' + db.getName());
printjson(db.getCollectionNames().sort());
