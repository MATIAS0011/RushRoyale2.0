// Simulação do jogo. Regras:
//  - Só avança em passos fixos (GF.sim.DT). Nada aqui lê relógio, FPS ou Math.random.
//  - Toda aleatoriedade vem de estado.rng.
//  - Ações do jogador entram numa fila e são aplicadas no início do próximo passo,
//    ficando registradas com o número do tick (permite replay e testes).
(function (GF) {
  'use strict';

  var TICKS_POR_SEG = 60;
  var DT = 1 / TICKS_POR_SEG;

  // Dimensões lógicas do mundo (retrato 9:16). O render escala isso para a tela.
  var LARGURA = 360;
  var ALTURA = 640;

  function criarEstado(semente) {
    return {
      semente: semente,
      tick: 0,
      rng: GF.rng.criar(semente),
      fila: [],       // ações aguardando o próximo passo
      registro: [],   // ações já aplicadas: { tick, acao }
      // Conteúdo provisório da etapa 1 (será substituído pelo jogo real):
      faiscas: []
    };
  }

  function agendar(estado, acao) {
    estado.fila.push(acao);
  }

  function aplicarAcao(estado, acao) {
    if (acao.tipo === 'pulso') {
      for (var i = 0; i < 8; i++) criarFaisca(estado, acao.x, acao.y);
    }
  }

  function criarFaisca(estado, x, y) {
    var ang = GF.rng.proximo(estado.rng) * Math.PI * 2;
    var vel = 40 + GF.rng.proximo(estado.rng) * 60; // px/s
    estado.faiscas.push({
      x: x, y: y,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel,
      vida: 1.5 // segundos
    });
  }

  function passo(estado) {
    // 1) Ações do jogador
    for (var i = 0; i < estado.fila.length; i++) {
      var acao = estado.fila[i];
      aplicarAcao(estado, acao);
      estado.registro.push({ tick: estado.tick, acao: acao });
    }
    estado.fila.length = 0;

    // 2) Demo: a fenda solta uma faísca a cada meio segundo
    if (estado.tick % 30 === 0) criarFaisca(estado, LARGURA / 2, ALTURA * 0.42);

    // 3) Movimento
    for (var j = estado.faiscas.length - 1; j >= 0; j--) {
      var f = estado.faiscas[j];
      f.x += f.vx * DT;
      f.y += f.vy * DT;
      f.vida -= DT;
      if (f.vida <= 0) estado.faiscas.splice(j, 1);
    }

    estado.tick++;
  }

  // Resumo do estado usado para comparar execuções nos testes.
  function resumo(estado) {
    return JSON.stringify({
      tick: estado.tick,
      rng: estado.rng.s,
      faiscas: estado.faiscas
    });
  }

  GF.sim = {
    TICKS_POR_SEG: TICKS_POR_SEG,
    DT: DT,
    LARGURA: LARGURA,
    ALTURA: ALTURA,
    criarEstado: criarEstado,
    agendar: agendar,
    passo: passo,
    resumo: resumo
  };
})(window.GF = window.GF || {});
