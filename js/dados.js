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

    // Os 5 guardiões. Os atributos de combate entram na etapa 4.
    TIPOS_GUARDIAO: ['lanca', 'geada', 'brasa', 'tambor', 'sorte'],
    GUARDIOES: {
      lanca:  { nome: 'Lança',  papel: 'dano único' },
      geada:  { nome: 'Geada',  papel: 'lentidão' },
      brasa:  { nome: 'Brasa',  papel: 'dano em área' },
      tambor: { nome: 'Tambor', papel: 'suporte (buff)' },
      sorte:  { nome: 'Sorte',  papel: 'crítico' }
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
