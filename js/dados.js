// Números de balanceamento. Mudou algo aqui? Atualize o DECISOES.md.
(function (GF) {
  'use strict';

  GF.dados = {
    JOGADOR: {
      vidaInicial: 20
    },

    ENERGIA: {
      inicial: 60,
      ticksPorPonto: 30,     // +1 de energia a cada 0,5 s (= 2/s)
      custoInicial: 20,      // custo da 1ª invocação
      aumentoCusto: 10       // cada invocação encarece as próximas em 10
    },

    // Os 5 guardiões. Alcance: o caminho inteiro.
    // dano(nível) = dano * (1 + DANO_POR_NIVEL * (nível - 1))
    // intervaloTicks = ticks entre ataques (60 = 1 s), antes do buff do Tambor.
    TIPOS_GUARDIAO: ['lanca', 'geada', 'brasa', 'tambor', 'sorte'],
    DANO_POR_NIVEL: 0.8,
    NIVEL_MAX: 7,      // dois guardiões de nível 7 não se fundem
    VEL_PROJETIL: 420, // px/s
    GUARDIOES: {
      lanca:  { nome: 'Lança',  papel: 'dano único',
                dano: 20, intervaloTicks: 36 },
      geada:  { nome: 'Geada',  papel: 'lentidão',
                dano: 8, intervaloTicks: 60,
                lento: 0.30, lentoPorNivel: 0.05, lentoMax: 0.60, lentoTicks: 120 },
      brasa:  { nome: 'Brasa',  papel: 'dano em área',
                dano: 15, intervaloTicks: 72,
                raio: 40, raioPorNivel: 4 },
      tambor: { nome: 'Tambor', papel: 'suporte (buff)',
                // não ataca; vizinhos ortogonais atacam mais rápido
                buff: 0.20, buffPorNivel: 0.10 },
      sorte:  { nome: 'Sorte',  papel: 'crítico',
                dano: 12, intervaloTicks: 48,
                critChance: 0.25, critPorNivel: 0.05, critMult: 2.5 }
    },

    // vel em px/s (o caminho tem 940 px); dano = vida que tira do jogador ao escapar;
    // energia = recompensa ao ser abatido.
    INIMIGOS: {
      comum:  { nome: 'Fragmento',  vida: 100, vel: 45, dano: 1, raio: 10, energia: 5 },
      rapido: { nome: 'Faísca',     vida: 60,  vel: 75, dano: 1, raio: 8,  energia: 4 },
      tanque: { nome: 'Rocha-oca',  vida: 300, vel: 30, dano: 2, raio: 14, energia: 10 }
    },

    // Provisório (etapa 2): fluxo contínuo de inimigos para ver o caminho funcionando.
    // A etapa 6 substitui isto pelas 10 ondas.
    DEMO: {
      intervaloTicks: 72,      // 1,2 s entre inimigos
      primeiroTick: 60,
      tipos: ['comum', 'comum', 'rapido', 'tanque']
    }
  };
})(window.GF = window.GF || {});
