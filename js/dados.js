// Números de balanceamento. Mudou algo aqui? Atualize o DECISOES.md.
(function (GF) {
  'use strict';

  GF.dados = {
    JOGADOR: {
      vidaInicial: 20
    },

    // vel em px/s (o caminho tem 940 px); dano = vida que tira do jogador ao escapar.
    INIMIGOS: {
      comum:  { nome: 'Fragmento',  vida: 100, vel: 45, dano: 1, raio: 10 },
      rapido: { nome: 'Faísca',     vida: 60,  vel: 75, dano: 1, raio: 8 },
      tanque: { nome: 'Rocha-oca',  vida: 300, vel: 30, dano: 2, raio: 14 }
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
