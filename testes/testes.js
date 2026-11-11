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
      while (estado.tick < opcoes.ticks && estado.fase === 'jogando') {
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
    while (estado.tick < ticks && estado.fase === 'jogando') {
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
  var TICKS = 60 * 120; // até 2 min de jogo (a partida de demonstração termina antes, em derrota)
  // Etapa 2 ainda não tem ações reais: 'teste' é ignorada pela simulação, mas
  // passa pela fila e pelo registro, o que valida o tick em que é aplicada.
  var ROTEIRO = [
    { tick: 10, acao: { tipo: 'teste', n: 1 } },
    { tick: 333, acao: { tipo: 'teste', n: 2 } },
    { tick: 334, acao: { tipo: 'teste', n: 3 } },
    { tick: 1200, acao: { tipo: 'teste', n: 4 } }
  ];

  var referencia = rodarDireto(SEMENTE, ROTEIRO, TICKS);
  var resumoRef = GF.sim.resumo(referencia);

  teste('Determinismo: a partida de referência chega à derrota (cobre o fim de jogo)', function () {
    afirmar(referencia.fase === 'derrota', 'fase=' + referencia.fase + ' tick=' + referencia.tick);
  });

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

  // ---------- Etapa 2: caminho, tabuleiro, inimigos, vida ----------
  var L = GF.layout;

  function perto(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-9); }

  teste('Caminho: começa na entrada, termina na saída, passa pelos cantos', function () {
    var p = L.PONTOS;
    var ini = L.posicao(0), fim = L.posicao(L.COMPRIMENTO);
    afirmar(ini.x === p[0].x && ini.y === p[0].y, 'início ' + JSON.stringify(ini));
    afirmar(fim.x === p[3].x && fim.y === p[3].y, 'fim ' + JSON.stringify(fim));
    var c1 = L.posicao(310), c2 = L.posicao(630);
    afirmar(perto(c1.x, 20) && perto(c1.y, 130), 'canto 1 ' + JSON.stringify(c1));
    afirmar(perto(c2.x, 340) && perto(c2.y, 130), 'canto 2 ' + JSON.stringify(c2));
    afirmar(L.COMPRIMENTO === 940, 'comprimento ' + L.COMPRIMENTO);
    var fora = L.posicao(99999), antes = L.posicao(-5);
    afirmar(fora.x === 340 && antes.x === 20, 'limites não respeitados');
  });

  teste('Tabuleiro: 15 casas 5x3, sem sobrepor o caminho, dentro da tela', function () {
    afirmar(L.CASAS === 15 && L.COLUNAS === 5 && L.LINHAS === 3, 'dimensões erradas');
    var meia = L.LARGURA_CAMINHO / 2 + 2; // +2 da borda desenhada
    for (var i = 0; i < L.CASAS; i++) {
      var c = L.casa(i);
      afirmar(c.x >= 0 && c.y >= 0 && c.x + c.w <= GF.sim.LARGURA && c.y + c.h <= GF.sim.ALTURA, 'casa ' + i + ' fora da tela');
      // Faixas do caminho: vertical esquerda, horizontal de cima, vertical direita
      afirmar(c.x >= 20 + meia, 'casa ' + i + ' invade o caminho da esquerda');
      afirmar(c.x + c.w <= 340 - meia, 'casa ' + i + ' invade o caminho da direita');
      afirmar(c.y >= 130 + meia, 'casa ' + i + ' invade o caminho de cima');
      afirmar(L.casaEm(c.cx, c.cy) === i, 'casaEm(centro de ' + i + ') = ' + L.casaEm(c.cx, c.cy));
    }
    afirmar(L.casaEm(5, 5) === -1 && L.casaEm(200, 600) === -1, 'casaEm fora do tabuleiro deveria ser -1');
  });

  teste('Inimigo percorre o caminho no tempo certo (comprimento / velocidade)', function () {
    var e = GF.sim.criarEstado(1, { semDemo: true });
    var ini = GF.sim.criarInimigo(e, 'comum');
    var esperado = Math.ceil(L.COMPRIMENTO / ini.vel * GF.sim.TICKS_POR_SEG);
    var t = 0;
    while (e.inimigos.length > 0 && t < 10000) { GF.sim.passo(e); t++; }
    afirmar(Math.abs(t - esperado) <= 1, 'levou ' + t + ' ticks, esperado ~' + esperado);
  });

  teste('Inimigo que escapa tira vida conforme o dano do tipo e some', function () {
    var e = GF.sim.criarEstado(1, { semDemo: true });
    GF.sim.criarInimigo(e, 'comum');
    GF.sim.criarInimigo(e, 'tanque');
    var v0 = e.vida;
    for (var t = 0; t < 60 * 60; t++) GF.sim.passo(e);
    afirmar(e.inimigos.length === 0, 'restaram ' + e.inimigos.length);
    afirmar(e.vida === v0 - GF.dados.INIMIGOS.comum.dano - GF.dados.INIMIGOS.tanque.dano, 'vida=' + e.vida);
  });

  teste('Inimigos mais rápidos ultrapassam os lentos (cada um anda na sua velocidade)', function () {
    var e = GF.sim.criarEstado(1, { semDemo: true });
    var lento = GF.sim.criarInimigo(e, 'tanque');
    var rapido = GF.sim.criarInimigo(e, 'rapido');
    for (var t = 0; t < 120; t++) GF.sim.passo(e);
    afirmar(rapido.dist > lento.dist, 'rápido=' + rapido.dist + ' lento=' + lento.dist);
    afirmar(perto(lento.dist, GF.dados.INIMIGOS.tanque.vel * 2, 1e-6), 'tanque andou ' + lento.dist + ' em 2 s');
  });

  teste('Vida chega a 0 → derrota, vida não fica negativa e o mundo congela', function () {
    var e = GF.sim.criarEstado(1, { semDemo: true });
    e.vida = 1;
    GF.sim.criarInimigo(e, 'tanque'); // dano 2 > vida 1
    for (var t = 0; t < 60 * 60 && e.fase === 'jogando'; t++) GF.sim.passo(e);
    afirmar(e.fase === 'derrota', 'fase=' + e.fase);
    afirmar(e.vida === 0, 'vida=' + e.vida);
    var tick = e.tick;
    GF.sim.criarInimigo(e, 'comum');
    for (var k = 0; k < 100; k++) GF.sim.passo(e);
    afirmar(e.tick === tick && e.inimigos[0].dist === 0, 'simulação continuou após a derrota');
  });

  teste('Demo: inimigos surgem no intervalo configurado, com tipos sorteados pelo RNG', function () {
    var e = GF.sim.criarEstado(77);
    var D = GF.dados.DEMO;
    var ticks = D.primeiroTick + D.intervaloTicks * 9 + 1; // deve ter gerado 10
    for (var t = 0; t < ticks; t++) GF.sim.passo(e);
    afirmar(e.proximoId - 1 === 10, 'gerou ' + (e.proximoId - 1));
    var e2 = GF.sim.criarEstado(77), e3 = GF.sim.criarEstado(78);
    for (var k = 0; k < 60 * 20; k++) { GF.sim.passo(e2); GF.sim.passo(e3); }
    var tipos2 = e2.inimigos.map(function (i) { return i.tipo; }).join();
    var tipos3 = e3.inimigos.map(function (i) { return i.tipo; }).join();
    afirmar(tipos2 !== tipos3, 'sementes diferentes deram a mesma sequência de tipos');
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
