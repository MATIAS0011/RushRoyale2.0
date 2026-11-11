// Testes automáticos. Abra testes.html no navegador (dois cliques) ou rode em
// modo headless: msedge --headless --dump-dom file:///.../testes.html
(function (GF) {
  'use strict';

  var linhas = [];
  var falhas = 0;

  function teste(nome, fn) {
    try {
      fn();
      linhas.push('<span class="ok">OK    </span> ' + nome);
    } catch (e) {
      falhas++;
      linhas.push('<span class="falha">FALHOU</span> ' + nome + '\n       ' + e.message);
    }
  }

  function afirmar(cond, msg) {
    if (!cond) throw new Error(msg || 'afirmação falsa');
  }

  // ---------- Utilitário de replay ----------
  // Roda uma partida pelo laço real (GF.loop.avancar), alimentando quadros com
  // os tempos dados por geradorDt. As ações do roteiro entram exatamente no tick
  // indicado, como aconteceria num replay.
  function rodarPartida(opcoes) {
    var estado = GF.sim.criarEstado(opcoes.semente);
    var laco = GF.loop.criar();
    laco.velocidade = opcoes.velocidade || 1;
    var roteiro = opcoes.roteiro || [];

    var passoOriginal = GF.sim.passo;
    GF.sim.passo = function (e) {
      for (var i = 0; i < roteiro.length; i++) {
        if (roteiro[i].tick === e.tick) GF.sim.agendar(e, roteiro[i].acao);
      }
      passoOriginal(e);
    };
    try {
      var quadros = 0;
      while (estado.tick < opcoes.ticks) {
        GF.loop.avancar(laco, estado, opcoes.geradorDt(quadros++));
        if (quadros > 1e6) throw new Error('laço não terminou');
      }
    } finally {
      GF.sim.passo = passoOriginal;
    }
    // Completa até o tick exato pedido (o último quadro pode ter passado do alvo).
    return { estado: estado, quadros: quadros };
  }

  // Avança passo a passo até exatamente N ticks (referência, sem laço).
  function rodarDireto(semente, roteiro, ticks) {
    var estado = GF.sim.criarEstado(semente);
    while (estado.tick < ticks) {
      for (var i = 0; i < roteiro.length; i++) {
        if (roteiro[i].tick === estado.tick) GF.sim.agendar(estado, roteiro[i].acao);
      }
      GF.sim.passo(estado);
    }
    return estado;
  }

  // ---------- RNG ----------
  teste('RNG: mesma semente gera a mesma sequência', function () {
    var a = GF.rng.criar(42), b = GF.rng.criar(42);
    for (var i = 0; i < 1000; i++) afirmar(GF.rng.proximo(a) === GF.rng.proximo(b), 'divergiu em ' + i);
  });

  teste('RNG: sementes diferentes geram sequências diferentes', function () {
    var a = GF.rng.criar(1), b = GF.rng.criar(2), iguais = 0;
    for (var i = 0; i < 100; i++) if (GF.rng.proximo(a) === GF.rng.proximo(b)) iguais++;
    afirmar(iguais < 5, iguais + ' valores iguais');
  });

  teste('RNG: valores em [0,1) e inteiro(n) em [0,n)', function () {
    var r = GF.rng.criar(7);
    for (var i = 0; i < 10000; i++) {
      var v = GF.rng.proximo(r);
      afirmar(v >= 0 && v < 1, 'fora do intervalo: ' + v);
      var k = GF.rng.inteiro(r, 15);
      afirmar(k >= 0 && k < 15 && k === Math.floor(k), 'inteiro inválido: ' + k);
    }
  });

  // ---------- Determinismo ----------
  var SEMENTE = 12345;
  var TICKS = 60 * 30; // 30 s de jogo
  var ROTEIRO = [
    { tick: 10, acao: { tipo: 'pulso', x: 100, y: 200 } },
    { tick: 333, acao: { tipo: 'pulso', x: 250, y: 500 } },
    { tick: 334, acao: { tipo: 'pulso', x: 50, y: 50 } },
    { tick: 1200, acao: { tipo: 'pulso', x: 180, y: 320 } }
  ];

  var referencia = rodarDireto(SEMENTE, ROTEIRO, TICKS);
  var resumoRef = GF.sim.resumo(referencia);

  function cenario(nome, velocidade, geradorDt) {
    teste('Determinismo: ' + nome, function () {
      // Roda pelo laço até passar do alvo e compara no mesmo tick:
      // reexecuta direto até o tick alcançado para ter a referência equivalente.
      var r = rodarPartida({ semente: SEMENTE, roteiro: ROTEIRO, ticks: TICKS, velocidade: velocidade, geradorDt: geradorDt });
      var ref = r.estado.tick === TICKS ? resumoRef : GF.sim.resumo(rodarDireto(SEMENTE, ROTEIRO, r.estado.tick));
      afirmar(GF.sim.resumo(r.estado) === ref, 'estado final diferente no tick ' + r.estado.tick);
      afirmar(r.estado.registro.length === ROTEIRO.length, 'ações registradas: ' + r.estado.registro.length);
      for (var i = 0; i < ROTEIRO.length; i++) {
        afirmar(r.estado.registro[i].tick === ROTEIRO[i].tick, 'ação ' + i + ' aplicada no tick ' + r.estado.registro[i].tick);
      }
    });
  }

  cenario('30 FPS, 1x', 1, function () { return 1 / 30; });
  cenario('60 FPS, 1x', 1, function () { return 1 / 60; });
  cenario('144 FPS, 1x', 1, function () { return 1 / 144; });
  cenario('60 FPS, 2x', 2, function () { return 1 / 60; });
  cenario('20 FPS, 2x', 2, function () { return 1 / 20; });
  var jitter = GF.rng.criar(999);
  cenario('FPS irregular (5 a 200 FPS), 1x', 1, function () { return 1 / 200 + GF.rng.proximo(jitter) * (1 / 5 - 1 / 200); });

  teste('Determinismo: 2x leva metade do tempo real de 1x', function () {
    var q1 = rodarPartida({ semente: 1, ticks: 600, velocidade: 1, geradorDt: function () { return 1 / 60; } }).quadros;
    var q2 = rodarPartida({ semente: 1, ticks: 600, velocidade: 2, geradorDt: function () { return 1 / 60; } }).quadros;
    afirmar(Math.abs(q1 - 2 * q2) <= 2, '1x=' + q1 + ' quadros, 2x=' + q2 + ' quadros');
  });

  teste('Laço: salto de tempo gigante é limitado (sem espiral de travamento)', function () {
    var estado = GF.sim.criarEstado(1);
    var laco = GF.loop.criar();
    var passos = GF.loop.avancar(laco, estado, 10); // 10 s de uma vez
    afirmar(passos === 15, 'esperava 15 passos (0,25 s), rodou ' + passos);
  });

  teste('Laço: pausado não avança', function () {
    var estado = GF.sim.criarEstado(1);
    var laco = GF.loop.criar();
    laco.pausado = true;
    GF.loop.avancar(laco, estado, 1);
    afirmar(estado.tick === 0, 'tick=' + estado.tick);
  });

  // ---------- Resultado ----------
  var total = linhas.length;
  linhas.push('');
  linhas.push(falhas === 0
    ? '<span class="ok">TODOS OS ' + total + ' TESTES PASSARAM</span>'
    : '<span class="falha">' + falhas + ' DE ' + total + ' TESTES FALHARAM</span>');
  document.getElementById('resultado').innerHTML = linhas.join('\n');
  document.title = (falhas === 0 ? 'OK' : 'FALHOU') + ' · testes';
})(window.GF = window.GF || {});
