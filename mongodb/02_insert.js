// =============================================================================
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
const usuarios = [
  {
    "_id": 1,
    "nome": "Ana Souza",
    "email": "ana.souza@veai.dev",
    "senhaHash": "$2a$10$VeAiHashIlustrativoSomenteParaDadosDeTestexxxxxxxxxxx",
    "papel": "CIDADAO",
    "preferencias": {
      "velocidadeVoz": 1.25,
      "perguntaLivreAtiva": true
    },
    "criadoEm": diasAtras(90)
  },
  {
    "_id": 2,
    "nome": "Bruno Lima",
    "email": "bruno.lima@veai.dev",
    "senhaHash": "$2a$10$VeAiHashIlustrativoSomenteParaDadosDeTestexxxxxxxxxxx",
    "papel": "CIDADAO",
    "preferencias": {
      "velocidadeVoz": 1,
      "perguntaLivreAtiva": false
    },
    "criadoEm": diasAtras(85)
  },
  {
    "_id": 3,
    "nome": "Carla Mendes",
    "email": "carla.mendes@veai.dev",
    "senhaHash": "$2a$10$VeAiHashIlustrativoSomenteParaDadosDeTestexxxxxxxxxxx",
    "papel": "CIDADAO",
    "preferencias": {
      "velocidadeVoz": 1.5,
      "perguntaLivreAtiva": true
    },
    "criadoEm": diasAtras(80)
  },
  {
    "_id": 4,
    "nome": "Diego Rocha",
    "email": "diego.rocha@veai.dev",
    "senhaHash": "$2a$10$VeAiHashIlustrativoSomenteParaDadosDeTestexxxxxxxxxxx",
    "papel": "CIDADAO",
    "preferencias": {
      "velocidadeVoz": 0.9,
      "perguntaLivreAtiva": false
    },
    "criadoEm": diasAtras(70)
  },
  {
    "_id": 5,
    "nome": "Marina Alves",
    "email": "marina.alves@ong-veai.dev",
    "senhaHash": "$2a$10$VeAiHashIlustrativoSomenteParaDadosDeTestexxxxxxxxxxx",
    "papel": "GESTOR",
    "preferencias": {
      "velocidadeVoz": 1,
      "perguntaLivreAtiva": false
    },
    "criadoEm": diasAtras(100),
    "regioes": [
      {
        "id": 1,
        "nome": "Pinheiros"
      },
      {
        "id": 2,
        "nome": "Sé"
      }
    ]
  },
  {
    "_id": 6,
    "nome": "Rafael Costa",
    "email": "rafael.costa@cras-veai.dev",
    "senhaHash": "$2a$10$VeAiHashIlustrativoSomenteParaDadosDeTestexxxxxxxxxxx",
    "papel": "GESTOR",
    "preferencias": {
      "velocidadeVoz": 1,
      "perguntaLivreAtiva": false
    },
    "criadoEm": diasAtras(100),
    "regioes": [
      {
        "id": 3,
        "nome": "Vila Mariana"
      }
    ]
  }
];

// -----------------------------------------------------------------------------
// descricoes: o JSON da IA fica embutido em "ia" (no Oracle é CLOB IS JSON)
// -----------------------------------------------------------------------------
const descricoes = [
  {
    "_id": 1,
    "usuarioId": 1,
    "modo": "AMBIENTE",
    "resumo": "Calçada com buraco grande à frente.",
    "descricaoCompleta": "Calçada de concreto com um buraco de cerca de 40 cm a dois passos à frente. À direita há um poste e, à esquerda, uma árvore com raízes expostas.",
    "ia": {
      "perigos": [
        {
          "descricao": "buraco na calçada",
          "direcao": "frente",
          "distanciaAprox": "2 m"
        }
      ],
      "objetos": [
        "poste",
        "árvore"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "CALCADA_DANIFICADA"
      }
    },
    "latenciaMs": 2300,
    "util": true,
    "criadoEm": diasAtras(60)
  },
  {
    "_id": 2,
    "usuarioId": 1,
    "modo": "TEXTO",
    "resumo": "Placa: Farmácia aberta 24 horas.",
    "descricaoCompleta": "Placa luminosa na fachada com o texto: Farmácia aberta 24 horas.",
    "ia": {
      "perigos": [],
      "objetos": [
        "placa"
      ],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 1900,
    "util": true,
    "criadoEm": diasAtras(58)
  },
  {
    "_id": 3,
    "usuarioId": 2,
    "modo": "AMBIENTE",
    "resumo": "Calçada obstruída por uma banca fixa.",
    "descricaoCompleta": "Uma banca de jornal fixa ocupa quase toda a largura da calçada, deixando uma passagem estreita junto ao meio-fio.",
    "ia": {
      "perigos": [
        {
          "descricao": "banca de jornal",
          "direcao": "frente",
          "distanciaAprox": "1 m"
        }
      ],
      "objetos": [
        "banca de jornal",
        "poste",
        "meio-fio"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "OBSTRUCAO_PERMANENTE"
      }
    },
    "latenciaMs": 2800,
    "util": true,
    "criadoEm": diasAtras(50)
  },
  {
    "_id": 4,
    "usuarioId": 2,
    "modo": "AMBIENTE",
    "resumo": "Rampa de acesso termina em degrau.",
    "descricaoCompleta": "Rampa de acesso à faixa de pedestres que termina em um degrau de aproximadamente 10 cm antes da rua.",
    "ia": {
      "perigos": [
        {
          "descricao": "degrau no fim da rampa",
          "direcao": "frente",
          "distanciaAprox": "3 m"
        }
      ],
      "objetos": [
        "rampa",
        "faixa de pedestres"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "RAMPA"
      }
    },
    "latenciaMs": 3100,
    "util": false,
    "criadoEm": diasAtras(25)
  },
  {
    "_id": 5,
    "usuarioId": 3,
    "modo": "AMBIENTE",
    "resumo": "Piso tátil interrompido por um canteiro.",
    "descricaoCompleta": "A linha de piso tátil direcional termina em um canteiro de plantas no meio da praça.",
    "ia": {
      "perigos": [
        {
          "descricao": "canteiro elevado",
          "direcao": "frente",
          "distanciaAprox": "2 m"
        }
      ],
      "objetos": [
        "piso tátil",
        "canteiro",
        "banco"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "PISO_TATIL"
      }
    },
    "latenciaMs": 2500,
    "util": true,
    "criadoEm": diasAtras(25)
  },
  {
    "_id": 6,
    "usuarioId": 3,
    "modo": "TEXTO",
    "resumo": "Cardápio: prato do dia, frango grelhado.",
    "descricaoCompleta": "Quadro de giz com o texto: Prato do dia, frango grelhado com arroz e salada.",
    "ia": {
      "perigos": [],
      "objetos": [
        "quadro de giz"
      ],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 2100,
    "util": null,
    "criadoEm": diasAtras(44)
  },
  {
    "_id": 7,
    "usuarioId": 4,
    "modo": "AMBIENTE",
    "resumo": "Obra na calçada sem sinalização.",
    "descricaoCompleta": "Vala aberta na calçada, sem tapume nem fita de sinalização, ocupando metade da passagem.",
    "ia": {
      "perigos": [
        {
          "descricao": "vala aberta",
          "direcao": "esquerda",
          "distanciaAprox": "1,5 m"
        }
      ],
      "objetos": [
        "vala",
        "terra",
        "cone caído"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "OBRA_SEM_SINALIZACAO"
      }
    },
    "latenciaMs": 3400,
    "util": true,
    "criadoEm": diasAtras(40)
  },
  {
    "_id": 8,
    "usuarioId": 1,
    "modo": "AMBIENTE",
    "resumo": "Faixa de pedestres com carro se aproximando.",
    "descricaoCompleta": "Faixa de pedestres à frente. Um carro se aproxima pela direita. Aguarde antes de atravessar.",
    "ia": {
      "perigos": [
        {
          "descricao": "carro em movimento",
          "direcao": "direita",
          "distanciaAprox": "5 m"
        }
      ],
      "objetos": [
        "faixa de pedestres",
        "carro",
        "semáforo"
      ],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 2600,
    "util": true,
    "criadoEm": diasAtras(35)
  },
  {
    "_id": 9,
    "usuarioId": 4,
    "modo": "TEXTO",
    "resumo": "Letreiro do ônibus: 875A Lapa.",
    "descricaoCompleta": "Letreiro do ônibus parcialmente legível: 875A Lapa.",
    "ia": {
      "perigos": [],
      "objetos": [
        "ônibus",
        "letreiro"
      ],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 1800,
    "util": false,
    "criadoEm": diasAtras(31)
  },
  {
    "_id": 10,
    "usuarioId": 2,
    "modo": "AMBIENTE",
    "resumo": "Calçada estreita com poste à direita.",
    "descricaoCompleta": "Calçada estreita, com um poste à direita a um passo e uma lixeira logo depois.",
    "ia": {
      "perigos": [
        {
          "descricao": "poste",
          "direcao": "direita",
          "distanciaAprox": "1 m"
        }
      ],
      "objetos": [
        "poste",
        "lixeira"
      ],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 2200,
    "util": true,
    "criadoEm": diasAtras(26)
  },
  {
    "_id": 11,
    "usuarioId": 3,
    "modo": "AMBIENTE",
    "resumo": "Calçada quebrada perto do ponto de ônibus.",
    "descricaoCompleta": "Placas de concreto soltas e desniveladas na calçada, logo antes do ponto de ônibus.",
    "ia": {
      "perigos": [
        {
          "descricao": "piso desnivelado",
          "direcao": "frente",
          "distanciaAprox": "1 m"
        }
      ],
      "objetos": [
        "ponto de ônibus",
        "placas de concreto"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "CALCADA_DANIFICADA"
      }
    },
    "latenciaMs": 2900,
    "util": true,
    "criadoEm": diasAtras(20)
  },
  {
    "_id": 12,
    "usuarioId": 1,
    "modo": "AMBIENTE",
    "resumo": "A foto está escura. Não é possível descrever com segurança.",
    "descricaoCompleta": "A imagem está muito escura. Tente novamente com mais luz ou aproxime o celular.",
    "ia": {
      "perigos": [],
      "objetos": [],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 1700,
    "util": false,
    "criadoEm": diasAtras(18)
  },
  {
    "_id": 13,
    "usuarioId": 4,
    "modo": "AMBIENTE",
    "resumo": "Calçada obstruída por entulho junto ao muro.",
    "descricaoCompleta": "Pilha de entulho encostada no muro ocupa boa parte da calçada.",
    "ia": {
      "perigos": [
        {
          "descricao": "entulho",
          "direcao": "frente",
          "distanciaAprox": "2 m"
        }
      ],
      "objetos": [
        "entulho",
        "muro"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "OBSTRUCAO_PERMANENTE"
      }
    },
    "latenciaMs": 3000,
    "util": null,
    "criadoEm": diasAtras(15)
  },
  {
    "_id": 14,
    "usuarioId": 2,
    "modo": "TEXTO",
    "resumo": "Aviso: elevador em manutenção.",
    "descricaoCompleta": "Folha colada na porta: Elevador em manutenção. Use a escada à esquerda.",
    "ia": {
      "perigos": [],
      "objetos": [
        "aviso",
        "porta do elevador"
      ],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 2000,
    "util": true,
    "criadoEm": diasAtras(12)
  },
  {
    "_id": 15,
    "usuarioId": 3,
    "modo": "AMBIENTE",
    "resumo": "Rampa muito inclinada e sem corrimão.",
    "descricaoCompleta": "Rampa de acesso com inclinação acentuada e sem corrimão em nenhum dos lados.",
    "ia": {
      "perigos": [
        {
          "descricao": "rampa íngreme",
          "direcao": "frente",
          "distanciaAprox": "2 m"
        }
      ],
      "objetos": [
        "rampa"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "RAMPA"
      }
    },
    "latenciaMs": 3300,
    "util": true,
    "criadoEm": diasAtras(10)
  },
  {
    "_id": 16,
    "usuarioId": 1,
    "modo": "AMBIENTE",
    "resumo": "Bicicleta vindo pela calçada.",
    "descricaoCompleta": "Uma bicicleta se aproxima pela calçada, de frente. Mantenha-se à direita.",
    "ia": {
      "perigos": [
        {
          "descricao": "bicicleta em movimento",
          "direcao": "frente",
          "distanciaAprox": "4 m"
        }
      ],
      "objetos": [
        "bicicleta",
        "calçada"
      ],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 2400,
    "util": true,
    "criadoEm": diasAtras(7)
  },
  {
    "_id": 17,
    "usuarioId": 4,
    "modo": "AMBIENTE",
    "resumo": "Travessia sem piso tátil.",
    "descricaoCompleta": "Travessia de pedestres sem piso tátil de alerta no rebaixamento da calçada.",
    "ia": {
      "perigos": [
        {
          "descricao": "rebaixamento sem alerta tátil",
          "direcao": "frente",
          "distanciaAprox": "1 m"
        }
      ],
      "objetos": [
        "faixa de pedestres",
        "guia rebaixada"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "PISO_TATIL"
      }
    },
    "latenciaMs": 2700,
    "util": false,
    "criadoEm": diasAtras(5)
  },
  {
    "_id": 18,
    "usuarioId": 2,
    "modo": "TEXTO",
    "resumo": "Placa de rua: Rua Augusta.",
    "descricaoCompleta": "Placa de rua azul com o texto: Rua Augusta.",
    "ia": {
      "perigos": [],
      "objetos": [
        "placa de rua"
      ],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 1600,
    "util": null,
    "criadoEm": diasAtras(3)
  },
  {
    "_id": 19,
    "usuarioId": 3,
    "modo": "AMBIENTE",
    "resumo": "Calçada larga; atenção ao meio-fio à esquerda.",
    "descricaoCompleta": "Calçada larga e plana. O meio-fio fica à esquerda, a cerca de um metro. Não identifiquei outros obstáculos próximos, mas não posso garantir que o caminho esteja livre.",
    "ia": {
      "perigos": [
        {
          "descricao": "meio-fio",
          "direcao": "esquerda",
          "distanciaAprox": "1 m"
        }
      ],
      "objetos": [
        "meio-fio",
        "calçada"
      ],
      "barreira": {
        "detectada": false,
        "tipo": null
      }
    },
    "latenciaMs": 2300,
    "util": null,
    "criadoEm": diasAtras(2)
  },
  {
    "_id": 20,
    "usuarioId": 1,
    "modo": "AMBIENTE",
    "resumo": "Buraco profundo na calçada ao lado da árvore.",
    "descricaoCompleta": "Buraco profundo na calçada, junto às raízes de uma árvore, à frente e um pouco à esquerda.",
    "ia": {
      "perigos": [
        {
          "descricao": "buraco profundo",
          "direcao": "frente-esquerda",
          "distanciaAprox": "2 m"
        }
      ],
      "objetos": [
        "árvore",
        "buraco"
      ],
      "barreira": {
        "detectada": true,
        "tipo": "CALCADA_DANIFICADA"
      }
    },
    "latenciaMs": 2600,
    "util": null,
    "criadoEm": diasAtras(1)
  }
];

// -----------------------------------------------------------------------------
// relatos: APOIO_RELATO e ATUALIZACAO_RELATO viram os arrays "apoios" e
// "historico"; REGIAO vira um snapshot embutido; o usuário fica por referência.
// -----------------------------------------------------------------------------
const relatos = [
  {
    "_id": 1,
    "cidadaoId": 1,
    "descricaoId": 1,
    "regiao": {
      "id": 1,
      "nome": "Pinheiros",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "CALCADA_DANIFICADA",
    "gravidade": "ALTA",
    "texto": "Buraco grande na calçada, em frente ao número 500.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.68431,
        -23.56612
      ]
    },
    "endereco": "Rua dos Pinheiros, 500",
    "status": "ABERTO",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [
      {
        "usuarioId": 2,
        "criadoEm": diasAtras(55)
      },
      {
        "usuarioId": 3,
        "criadoEm": diasAtras(40)
      }
    ],
    "historico": [],
    "criadoEm": diasAtras(60),
    "atualizadoEm": diasAtras(60)
  },
  {
    "_id": 2,
    "cidadaoId": 2,
    "descricaoId": 3,
    "regiao": {
      "id": 1,
      "nome": "Pinheiros",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "OBSTRUCAO_PERMANENTE",
    "gravidade": "MEDIA",
    "texto": "Banca fixa ocupa quase toda a calçada.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.68254,
        -23.56145
      ]
    },
    "endereco": "Rua Teodoro Sampaio, 1200",
    "status": "EM_TRIAGEM",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [
      {
        "usuarioId": 4,
        "criadoEm": diasAtras(30)
      }
    ],
    "historico": [
      {
        "gestorId": 5,
        "statusAnterior": "ABERTO",
        "statusNovo": "EM_TRIAGEM",
        "comentario": "Em análise pela equipe da ONG.",
        "criadoEm": diasAtras(20)
      }
    ],
    "criadoEm": diasAtras(50),
    "atualizadoEm": diasAtras(20)
  },
  {
    "_id": 3,
    "cidadaoId": 2,
    "descricaoId": 4,
    "regiao": {
      "id": 3,
      "nome": "Vila Mariana",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "RAMPA",
    "gravidade": "MEDIA",
    "texto": "Rampa da faixa de pedestres termina em degrau de 10 cm.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6342,
        -23.5889
      ]
    },
    "endereco": "Rua Domingos de Morais, 2000",
    "status": "ENCAMINHADO",
    "protocoloOrgao": "SP156-2026-0012345",
    "motivoDescarte": null,
    "normaReferencia": "ABNT NBR 9050:2020, seção 6.6 (rampas)",
    "apoios": [],
    "historico": [
      {
        "gestorId": 6,
        "statusAnterior": "ABERTO",
        "statusNovo": "EM_TRIAGEM",
        "comentario": "Vistoria agendada.",
        "criadoEm": diasAtras(22)
      },
      {
        "gestorId": 6,
        "statusAnterior": "EM_TRIAGEM",
        "statusNovo": "ENCAMINHADO",
        "comentario": "Encaminhado à subprefeitura via SP156.",
        "criadoEm": diasAtras(18)
      }
    ],
    "criadoEm": diasAtras(25),
    "atualizadoEm": diasAtras(18)
  },
  {
    "_id": 4,
    "cidadaoId": 3,
    "descricaoId": 5,
    "regiao": {
      "id": 2,
      "nome": "Sé",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "PISO_TATIL",
    "gravidade": "ALTA",
    "texto": "Piso tátil interrompido por canteiro na praça.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.63331,
        -23.55052
      ]
    },
    "endereco": "Praça da Sé, s/n",
    "status": "ABERTO",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": "ABNT NBR 16537:2016 (sinalização tátil no piso)",
    "apoios": [
      {
        "usuarioId": 1,
        "criadoEm": diasAtras(24)
      },
      {
        "usuarioId": 2,
        "criadoEm": diasAtras(22)
      },
      {
        "usuarioId": 4,
        "criadoEm": diasAtras(21)
      }
    ],
    "historico": [],
    "criadoEm": diasAtras(25),
    "atualizadoEm": diasAtras(25)
  },
  {
    "_id": 5,
    "cidadaoId": 4,
    "descricaoId": 7,
    "regiao": {
      "id": 2,
      "nome": "Sé",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "OBRA_SEM_SINALIZACAO",
    "gravidade": "ALTA",
    "texto": "Vala aberta na calçada sem tapume.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6361,
        -23.5478
      ]
    },
    "endereco": "Rua Direita, 150",
    "status": "RESOLVIDO",
    "protocoloOrgao": "SP156-2026-0013001",
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [
      {
        "usuarioId": 1,
        "criadoEm": diasAtras(39)
      }
    ],
    "historico": [
      {
        "gestorId": 5,
        "statusAnterior": "ABERTO",
        "statusNovo": "EM_TRIAGEM",
        "comentario": "Prioridade alta: risco de queda.",
        "criadoEm": diasAtras(38)
      },
      {
        "gestorId": 5,
        "statusAnterior": "EM_TRIAGEM",
        "statusNovo": "ENCAMINHADO",
        "comentario": "Encaminhado à concessionária responsável.",
        "criadoEm": diasAtras(37)
      },
      {
        "gestorId": 5,
        "statusAnterior": "ENCAMINHADO",
        "statusNovo": "RESOLVIDO",
        "comentario": "Obra sinalizada e vala fechada.",
        "criadoEm": diasAtras(10)
      }
    ],
    "criadoEm": diasAtras(40),
    "atualizadoEm": diasAtras(10)
  },
  {
    "_id": 6,
    "cidadaoId": 1,
    "descricaoId": null,
    "regiao": {
      "id": 1,
      "nome": "Pinheiros",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "SEMAFORO_SEM_SOM",
    "gravidade": "MEDIA",
    "texto": "Semáforo de pedestres sem sinal sonoro.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6938,
        -23.5673
      ]
    },
    "endereco": "Av. Pedroso de Morais, 300",
    "status": "ABERTO",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [
      {
        "usuarioId": 3,
        "criadoEm": diasAtras(20)
      }
    ],
    "historico": [],
    "criadoEm": diasAtras(38),
    "atualizadoEm": diasAtras(38)
  },
  {
    "_id": 7,
    "cidadaoId": 3,
    "descricaoId": 11,
    "regiao": {
      "id": 3,
      "nome": "Vila Mariana",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "CALCADA_DANIFICADA",
    "gravidade": "MEDIA",
    "texto": "Calçada quebrada perto do ponto de ônibus.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6377,
        -23.5862
      ]
    },
    "endereco": "Rua Vergueiro, 3100",
    "status": "EM_TRIAGEM",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [],
    "historico": [
      {
        "gestorId": 6,
        "statusAnterior": "ABERTO",
        "statusNovo": "EM_TRIAGEM",
        "comentario": "Aguardando vistoria.",
        "criadoEm": diasAtras(15)
      }
    ],
    "criadoEm": diasAtras(20),
    "atualizadoEm": diasAtras(15)
  },
  {
    "_id": 8,
    "cidadaoId": 4,
    "descricaoId": 13,
    "regiao": {
      "id": 2,
      "nome": "Sé",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "OBSTRUCAO_PERMANENTE",
    "gravidade": "BAIXA",
    "texto": "Entulho fixo junto ao muro.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6349,
        -23.5459
      ]
    },
    "endereco": "Rua XV de Novembro, 80",
    "status": "DESCARTADO",
    "protocoloOrgao": null,
    "motivoDescarte": "Entulho removido antes da vistoria.",
    "normaReferencia": null,
    "apoios": [],
    "historico": [
      {
        "gestorId": 5,
        "statusAnterior": "ABERTO",
        "statusNovo": "DESCARTADO",
        "comentario": "Vistoria não encontrou o problema.",
        "criadoEm": diasAtras(8)
      }
    ],
    "criadoEm": diasAtras(15),
    "atualizadoEm": diasAtras(8)
  },
  {
    "_id": 9,
    "cidadaoId": 3,
    "descricaoId": 15,
    "regiao": {
      "id": 3,
      "nome": "Vila Mariana",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "RAMPA",
    "gravidade": "ALTA",
    "texto": "Rampa muito inclinada e sem corrimão.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6365,
        -23.5904
      ]
    },
    "endereco": "Rua Domingos de Morais, 2600",
    "status": "ABERTO",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [],
    "historico": [],
    "criadoEm": diasAtras(10),
    "atualizadoEm": diasAtras(10)
  },
  {
    "_id": 10,
    "cidadaoId": 4,
    "descricaoId": 17,
    "regiao": {
      "id": 1,
      "nome": "Pinheiros",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "PISO_TATIL",
    "gravidade": "MEDIA",
    "texto": "Travessia sem piso tátil de alerta.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6902,
        -23.5648
      ]
    },
    "endereco": "Rua Cardeal Arcoverde, 900",
    "status": "ABERTO",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [
      {
        "usuarioId": 2,
        "criadoEm": diasAtras(3)
      }
    ],
    "historico": [],
    "criadoEm": diasAtras(5),
    "atualizadoEm": diasAtras(5)
  },
  {
    "_id": 11,
    "cidadaoId": 2,
    "descricaoId": null,
    "regiao": {
      "id": 2,
      "nome": "Sé",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "OBRA_SEM_SINALIZACAO",
    "gravidade": "ALTA",
    "texto": "Nova vala aberta no mesmo trecho, sem sinalização.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.63615,
        -23.5479
      ]
    },
    "endereco": "Rua Direita, 160",
    "status": "ABERTO",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [
      {
        "usuarioId": 4,
        "criadoEm": diasAtras(2)
      }
    ],
    "historico": [],
    "criadoEm": diasAtras(4),
    "atualizadoEm": diasAtras(4)
  },
  {
    "_id": 12,
    "cidadaoId": 2,
    "descricaoId": null,
    "regiao": {
      "id": 3,
      "nome": "Vila Mariana",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "OUTRO",
    "gravidade": "BAIXA",
    "texto": "Lixeira instalada no meio da faixa livre da calçada.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6329,
        -23.5875
      ]
    },
    "endereco": "Rua Joaquim Távora, 400",
    "status": "ABERTO",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [],
    "historico": [],
    "criadoEm": diasAtras(20),
    "atualizadoEm": diasAtras(20)
  },
  {
    "_id": 13,
    "cidadaoId": 1,
    "descricaoId": null,
    "regiao": {
      "id": 2,
      "nome": "Sé",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "SEMAFORO_SEM_SOM",
    "gravidade": "MEDIA",
    "texto": "Botoeira sonora do semáforo quebrada.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6389,
        -23.5493
      ]
    },
    "endereco": "Rua Líbero Badaró, 400",
    "status": "ENCAMINHADO",
    "protocoloOrgao": "SP156-2026-0009876",
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [
      {
        "usuarioId": 3,
        "criadoEm": diasAtras(60)
      },
      {
        "usuarioId": 4,
        "criadoEm": diasAtras(59)
      }
    ],
    "historico": [
      {
        "gestorId": 5,
        "statusAnterior": "ABERTO",
        "statusNovo": "EM_TRIAGEM",
        "comentario": "Confirmado por dois apoios.",
        "criadoEm": diasAtras(58)
      },
      {
        "gestorId": 5,
        "statusAnterior": "EM_TRIAGEM",
        "statusNovo": "ENCAMINHADO",
        "comentario": "Encaminhado à CET via SP156.",
        "criadoEm": diasAtras(50)
      }
    ],
    "criadoEm": diasAtras(62),
    "atualizadoEm": diasAtras(50)
  },
  {
    "_id": 14,
    "cidadaoId": 4,
    "descricaoId": null,
    "regiao": {
      "id": 3,
      "nome": "Vila Mariana",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "CALCADA_DANIFICADA",
    "gravidade": "BAIXA",
    "texto": "Calçada com desnível pequeno entre placas.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6338,
        -23.5911
      ]
    },
    "endereco": "Rua Vergueiro, 3800",
    "status": "RESOLVIDO",
    "protocoloOrgao": "SP156-2026-0014500",
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [],
    "historico": [
      {
        "gestorId": 6,
        "statusAnterior": "ABERTO",
        "statusNovo": "EM_TRIAGEM",
        "comentario": "Baixa gravidade, mas fácil de resolver.",
        "criadoEm": diasAtras(27)
      },
      {
        "gestorId": 6,
        "statusAnterior": "EM_TRIAGEM",
        "statusNovo": "ENCAMINHADO",
        "comentario": "Encaminhado à subprefeitura.",
        "criadoEm": diasAtras(25)
      },
      {
        "gestorId": 6,
        "statusAnterior": "ENCAMINHADO",
        "statusNovo": "RESOLVIDO",
        "comentario": "Calçada nivelada pela subprefeitura.",
        "criadoEm": diasAtras(6)
      }
    ],
    "criadoEm": diasAtras(28),
    "atualizadoEm": diasAtras(6)
  },
  {
    "_id": 15,
    "cidadaoId": 3,
    "descricaoId": null,
    "regiao": {
      "id": 1,
      "nome": "Pinheiros",
      "cidade": "São Paulo",
      "uf": "SP"
    },
    "tipo": "OUTRO",
    "gravidade": "MEDIA",
    "texto": "Grade de proteção de árvore solta na calçada.",
    "localizacao": {
      "type": "Point",
      "coordinates": [
        -46.6887,
        -23.5639
      ]
    },
    "endereco": "Rua Fradique Coutinho, 700",
    "status": "ABERTO",
    "protocoloOrgao": null,
    "motivoDescarte": null,
    "normaReferencia": null,
    "apoios": [],
    "historico": [],
    "criadoEm": diasAtras(2),
    "atualizadoEm": diasAtras(2)
  }
];

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
