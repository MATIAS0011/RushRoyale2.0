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

  function criarEstado(semente, opcoes) {
    opcoes = opcoes || {};
    var tabuleiro = [];
    for (var i = 0; i < GF.layout.CASAS; i++) tabuleiro.push(null);

    return {
      semente: semente,
      tick: 0,
      fase: 'jogando',          // 'jogando' | 'derrota' | 'vitoria'
      rng: GF.rng.criar(semente),
      fila: [],                 // ações aguardando o próximo passo
      registro: [],             // ações já aplicadas: { tick, acao }
      vida: GF.dados.JOGADOR.vidaInicial,
      tabuleiro: tabuleiro,     // 15 casas; null = livre
      inimigos: [],
      proximoId: 1,
      demo: opcoes.semDemo ? null : { proximo: GF.dados.DEMO.primeiroTick }
    };
  }

  function agendar(estado, acao) {
    estado.fila.push(acao);
  }

  function aplicarAcao(estado, acao) {
    // Etapa 2 ainda não tem ações do jogador (invocar vem na etapa 3).
    // Tipos desconhecidos são ignorados, mas registrados.
  }

  // ---------- Inimigos ----------
  function criarInimigo(estado, tipo) {
    var def = GF.dados.INIMIGOS[tipo];
    var ini = {
      id: estado.proximoId++,
      tipo: tipo,
      dist: 0,          // distância percorrida no caminho
      distAnt: 0,       // distância no passo anterior (para interpolar o desenho)
      vida: def.vida,
      vidaMax: def.vida,
      vel: def.vel,
      dano: def.dano,
      raio: def.raio
    };
    estado.inimigos.push(ini);
    return ini;
  }

  function moverInimigos(estado) {
    var fim = GF.layout.COMPRIMENTO;
    for (var i = estado.inimigos.length - 1; i >= 0; i--) {
      var ini = estado.inimigos[i];
      ini.distAnt = ini.dist;
      ini.dist += ini.vel * DT;
      if (ini.dist >= fim) {
        estado.inimigos.splice(i, 1);
        estado.vida -= ini.dano;
      }
    }
    if (estado.vida <= 0) {
      estado.vida = 0;
      estado.fase = 'derrota';
    }
  }

  function gerarDemo(estado) {
    var d = estado.demo;
    if (!d || estado.tick < d.proximo) return;
    var tipos = GF.dados.DEMO.tipos;
    criarInimigo(estado, tipos[GF.rng.inteiro(estado.rng, tipos.length)]);
    d.proximo += GF.dados.DEMO.intervaloTicks;
  }

  // ---------- Passo ----------
  function passo(estado) {
    // Partida encerrada: o mundo congela.
    if (estado.fase !== 'jogando') return;

    // 1) Ações do jogador
    for (var i = 0; i < estado.fila.length; i++) {
      var acao = estado.fila[i];
      aplicarAcao(estado, acao);
      estado.registro.push({ tick: estado.tick, acao: acao });
    }
    estado.fila.length = 0;

    // 2) Surgimento de inimigos
    gerarDemo(estado);

    // 3) Movimento e escapes
    moverInimigos(estado);

    estado.tick++;
  }

  // Resumo do estado usado para comparar execuções nos testes.
  function resumo(estado) {
    return JSON.stringify({
      tick: estado.tick,
      fase: estado.fase,
      rng: estado.rng.s,
      vida: estado.vida,
      tabuleiro: estado.tabuleiro,
      inimigos: estado.inimigos
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
    criarInimigo: criarInimigo,
    resumo: resumo
  };
})(window.GF = window.GF || {});
