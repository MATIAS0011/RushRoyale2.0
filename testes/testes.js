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
  // Uma entrada do roteiro tem uma ação fixa ({ tipo: ... }) ou uma função que
  // calcula a ação a partir do estado naquele tick (como um robô jogando).
  function acaoDoRoteiro(entrada, estado) {
    return typeof entrada.acao === 'function' ? entrada.acao(estado) : entrada.acao;
  }

  // Robô: funde o primeiro par válido que encontrar (ou manda uma fusão inválida).
  function roboFundir(estado) {
    for (var de = 0; de < estado.tabuleiro.length; de++) {
      for (var para = 0; para < estado.tabuleiro.length; para++) {
        if (GF.sim.podeFundir(estado, de, para)) {
          return { tipo: 'fundir', de: de, para: para, idDe: estado.tabuleiro[de].id, idPara: estado.tabuleiro[para].id };
        }
      }
    }
    return { tipo: 'fundir', de: -1, para: -1 };
  }

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
        if (roteiro[i].tick === e.tick) GF.sim.agendar(e, acaoDoRoteiro(roteiro[i], e));
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
        if (roteiro[i].tick === estado.tick) GF.sim.agendar(estado, acaoDoRoteiro(roteiro[i], estado));
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
  // Semente 7 com este roteiro: sorteia os 5 tipos de guardião, tem dezenas de
  // abates e termina em derrota. Se o balanceamento mudar, confira o 1º teste abaixo.
  var SEMENTE = 7;
  var TICKS = 60 * 120; // até 2 min de jogo (a partida de demonstração termina antes, em derrota)
  // Invocações reais. A do tick 334 acontece sem energia suficiente e precisa
  // ser recusada do mesmo jeito em todas as execuções.
  // Fusões do robô em alguns ticks: o par é escolhido no momento, pelo estado.
  var ROTEIRO = [10, 333, 334, 600, 900, 1200, 1500, 1800, 2000, 2001, 2400, 3000, 3600, 4200]
    .map(function (t) { return { tick: t, acao: { tipo: 'invocar' } }; })
    .concat([1000, 1300, 1700, 2100, 2500, 2700, 3300, 3900, 4400].map(function (t) { return { tick: t, acao: roboFundir }; }))
    .sort(function (a, b) { return a.tick - b.tick; });

  var referencia = rodarDireto(SEMENTE, ROTEIRO, TICKS);
  var resumoRef = GF.sim.resumo(referencia);

  teste('Determinismo: a partida de referência tem os 5 guardiões, combate e chega à derrota', function () {
    // Tipos que estiveram no tabuleiro em algum momento (as fusões trocam tipos).
    var tipos = {};
    var e = GF.sim.criarEstado(SEMENTE);
    while (e.tick < TICKS && e.fase === 'jogando') {
      for (var i = 0; i < ROTEIRO.length; i++) if (ROTEIRO[i].tick === e.tick) GF.sim.agendar(e, acaoDoRoteiro(ROTEIRO[i], e));
      GF.sim.passo(e);
      e.tabuleiro.forEach(function (g) { if (g) tipos[g.tipo] = true; });
    }
    afirmar(Object.keys(tipos).length === 5, 'tipos que lutaram: ' + Object.keys(tipos).join(','));
    afirmar(referencia.abates > 10, 'abates=' + referencia.abates);
    afirmar(referencia.fusoes >= 2, 'fusões=' + referencia.fusoes);
    afirmar(referencia.fase === 'derrota', 'fase=' + referencia.fase + ' tick=' + referencia.tick);
  });

  teste('Determinismo: o roteiro tem invocações aceitas e recusadas', function () {
    var ocupadas = 15 - GF.sim.casasLivres(referencia).length;
    afirmar(ocupadas >= 2 && ocupadas < ROTEIRO.length, ocupadas + ' guardiões para ' + ROTEIRO.length + ' pedidos');
  });

  function cenario(nome, velocidade, geradorDt) {
    teste('Determinismo: ' + nome, function () {
      // Roda pelo laço até passar do alvo e compara no mesmo tick:
      // reexecuta direto até o tick alcançado para ter a referência equivalente.
      var r = rodarPartida({ semente: SEMENTE, roteiro: ROTEIRO, ticks: TICKS, velocidade: velocidade, geradorDt: geradorDt });
      var ref = r.estado.tick === TICKS ? resumoRef : GF.sim.resumo(rodarDireto(SEMENTE, ROTEIRO, r.estado.tick));
      afirmar(GF.sim.resumo(r.estado) === ref, 'estado final diferente no tick ' + r.estado.tick);
      // Só contam as ações cujo tick chegou antes do fim da partida.
      var esperadas = ROTEIRO.filter(function (a) { return a.tick < r.estado.tick; });
      afirmar(r.estado.registro.length === esperadas.length, 'ações registradas: ' + r.estado.registro.length + ' de ' + esperadas.length);
      for (var i = 0; i < esperadas.length; i++) {
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

  // ---------- Etapa 3: energia e invocação ----------
  var EN = GF.dados.ENERGIA;

  function cheio(estado) { return GF.sim.casasLivres(estado).length === 0; }

  teste('Invocar: estado inicial com energia e custo configurados', function () {
    var e = GF.sim.criarEstado(1, { semDemo: true });
    afirmar(e.energia === EN.inicial && e.custoInvocar === EN.custoInicial, 'energia=' + e.energia + ' custo=' + e.custoInvocar);
    afirmar(GF.sim.casasLivres(e).length === 15, 'tabuleiro não começa vazio');
  });

  teste('Invocar: gasta o custo, o custo sobe e um guardião nível 1 aparece numa casa livre', function () {
    var e = GF.sim.criarEstado(3, { semDemo: true });
    var casa = GF.sim.invocar(e);
    afirmar(casa >= 0 && casa < 15, 'casa=' + casa);
    var g = e.tabuleiro[casa];
    afirmar(g && g.nivel === 1 && GF.dados.TIPOS_GUARDIAO.indexOf(g.tipo) >= 0, 'guardião inválido ' + JSON.stringify(g));
    afirmar(e.energia === EN.inicial - EN.custoInicial, 'energia=' + e.energia);
    afirmar(e.custoInvocar === EN.custoInicial + EN.aumentoCusto, 'custo=' + e.custoInvocar);
    var casa2 = GF.sim.invocar(e);
    afirmar(casa2 >= 0 && casa2 !== casa, 'segunda invocação na mesma casa');
    afirmar(e.custoInvocar === EN.custoInicial + 2 * EN.aumentoCusto, 'custo após 2 = ' + e.custoInvocar);
  });

  teste('Invocar: sem energia suficiente nada muda (nem o RNG)', function () {
    var e = GF.sim.criarEstado(4, { semDemo: true });
    e.energia = EN.custoInicial - 1;
    var antes = GF.sim.resumo(e);
    afirmar(GF.sim.invocar(e) === -1, 'deveria recusar');
    afirmar(GF.sim.resumo(e) === antes, 'estado mudou');
    e.energia = EN.custoInicial; // exatamente o custo: pode
    afirmar(GF.sim.invocar(e) >= 0 && e.energia === 0, 'com energia exata deveria invocar');
  });

  teste('Invocar: 15 invocações preenchem as 15 casas; a 16ª é recusada sem gastar', function () {
    var e = GF.sim.criarEstado(5, { semDemo: true });
    e.energia = 1e6;
    var vistas = {};
    for (var i = 0; i < 15; i++) {
      var c = GF.sim.invocar(e);
      afirmar(c >= 0 && !vistas[c], 'casa repetida ou recusa na invocação ' + (i + 1));
      vistas[c] = true;
    }
    afirmar(cheio(e), 'tabuleiro não ficou cheio');
    var energia = e.energia, custo = e.custoInvocar;
    afirmar(GF.sim.invocar(e) === -1 && e.energia === energia && e.custoInvocar === custo, 'invocou com tabuleiro cheio');
    afirmar(!GF.sim.podeInvocar(e), 'podeInvocar deveria ser falso');
  });

  teste('Invocar: os 5 tipos e as 15 casas são sorteados de forma equilibrada', function () {
    var porTipo = {}, porCasa = {}, n = 0;
    for (var s = 1; s <= 600; s++) {
      var e = GF.sim.criarEstado(s, { semDemo: true });
      var c = GF.sim.invocar(e);
      porTipo[e.tabuleiro[c].tipo] = (porTipo[e.tabuleiro[c].tipo] || 0) + 1;
      porCasa[c] = (porCasa[c] || 0) + 1;
      n++;
    }
    GF.dados.TIPOS_GUARDIAO.forEach(function (t) {
      var f = (porTipo[t] || 0) / n;
      afirmar(f > 0.12 && f < 0.28, t + ' saiu em ' + (f * 100).toFixed(1) + '%');
    });
    for (var k = 0; k < 15; k++) afirmar((porCasa[k] || 0) >= 15, 'casa ' + k + ' saiu ' + (porCasa[k] || 0) + ' vezes em 600');
  });

  teste('Invocar: pela fila de ações, num passo de jogo', function () {
    var e = GF.sim.criarEstado(6, { semDemo: true });
    GF.sim.agendar(e, { tipo: 'invocar' });
    afirmar(GF.sim.casasLivres(e).length === 15, 'agendar não pode aplicar na hora');
    GF.sim.passo(e);
    afirmar(GF.sim.casasLivres(e).length === 14, 'não invocou no passo');
    afirmar(e.registro.length === 1 && e.registro[0].tick === 0, 'registro errado');
  });

  teste('Invocar: recusado depois da derrota', function () {
    var e = GF.sim.criarEstado(7, { semDemo: true });
    e.fase = 'derrota';
    afirmar(GF.sim.invocar(e) === -1, 'invocou após a derrota');
  });

  teste('Energia: +1 a cada 0,5 s (120 por minuto), sempre inteira', function () {
    var e = GF.sim.criarEstado(8, { semDemo: true });
    for (var t = 0; t < 60 * 60; t++) GF.sim.passo(e);
    afirmar(e.energia === EN.inicial + 119 || e.energia === EN.inicial + 120, 'energia=' + e.energia);
    afirmar(e.energia === Math.floor(e.energia), 'energia não inteira');
  });

  teste('Energia: abater um inimigo dá a recompensa do tipo; dano parcial não dá', function () {
    var e = GF.sim.criarEstado(9, { semDemo: true });
    var ini = GF.sim.criarInimigo(e, 'tanque');
    var en = e.energia;
    afirmar(GF.sim.causarDano(e, ini, 100) === false, 'morreu com dano parcial');
    afirmar(ini.vida === 200 && e.energia === en && e.inimigos.length === 1, 'dano parcial errado');
    afirmar(GF.sim.causarDano(e, ini, 500) === true, 'não morreu com dano letal');
    afirmar(e.inimigos.length === 0, 'inimigo não removido');
    afirmar(e.energia === en + GF.dados.INIMIGOS.tanque.energia, 'energia=' + e.energia);
    afirmar(GF.sim.causarDano(e, ini, 500) === false && e.energia === en + GF.dados.INIMIGOS.tanque.energia, 'recompensa dada duas vezes');
  });

  // ---------- Etapa 4: combate dos 5 papéis ----------
  var C = GF.combate;
  var G = GF.dados.GUARDIOES;

  // Estado sem demo com guardiões nas casas indicadas: { casa: [tipo, nivel] }
  function cenarioCombate(guardioes, semente) {
    var e = GF.sim.criarEstado(semente || 1, { semDemo: true });
    for (var casa in guardioes) {
      e.tabuleiro[casa] = GF.sim.criarGuardiao(e, guardioes[casa][0], guardioes[casa][1] || 1);
    }
    return e;
  }
  function rodar(e, ticks) { for (var t = 0; t < ticks; t++) GF.sim.passo(e); }
  function inimigoEm(e, tipo, dist, vida) {
    var ini = GF.sim.criarInimigo(e, tipo);
    ini.dist = ini.distAnt = dist;
    if (vida !== undefined) ini.vida = ini.vidaMax = vida;
    return ini;
  }

  teste('Combate: dano por nível = base × (1 + 0,8 × (nível − 1))', function () {
    afirmar(C.dano('lanca', 1) === 20, 'n1=' + C.dano('lanca', 1));
    afirmar(perto(C.dano('lanca', 3), 52, 1e-9), 'n3=' + C.dano('lanca', 3));
    afirmar(perto(C.dano('sorte', 7), 12 * 5.8, 1e-9), 'sorte n7=' + C.dano('sorte', 7));
  });

  teste('Lança: abate um Fragmento (100 de vida) com 5 disparos e recebe a energia', function () {
    var e = cenarioCombate({ 7: ['lanca'] });
    var ini = inimigoEm(e, 'comum', 200);
    var en = e.energia, t = 0;
    while (e.inimigos.length && t < 600) { GF.sim.passo(e); t++; }
    afirmar(e.inimigos.length === 0 && e.abates === 1, 'não abateu');
    afirmar(e.vida === GF.dados.JOGADOR.vidaInicial, 'inimigo escapou');
    // 5 disparos: o último sai em 4×36 = 144 ticks, mais o voo
    afirmar(t > 144 && t < 144 + 60, 'levou ' + t + ' ticks');
    var passiva = Math.floor(t / GF.dados.ENERGIA.ticksPorPonto);
    afirmar(e.energia - en - passiva === GF.dados.INIMIGOS.comum.energia, 'energia do abate errada');
  });

  teste('Alvo: todos miram o inimigo mais avançado no caminho', function () {
    var e = cenarioCombate({});
    inimigoEm(e, 'comum', 100);
    var frente = inimigoEm(e, 'comum', 300);
    inimigoEm(e, 'tanque', 250);
    ['lanca', 'geada', 'brasa', 'sorte'].forEach(function (t) {
      afirmar(C.escolherAlvo(e, t) === frente, t + ' escolheu outro alvo');
    });
  });

  teste('Geada: aplica 30% de lentidão por 2 s e depois o inimigo volta ao normal', function () {
    var e = cenarioCombate({ 7: ['geada'] });
    var ini = inimigoEm(e, 'comum', 300, 1e6);
    var t = 0;
    while (ini.lentoTicks === 0 && t < 120) { GF.sim.passo(e); t++; }
    afirmar(ini.lentoTicks > 0 && perto(ini.lentoFator, 0.30, 1e-9), 'não ficou lento: ' + ini.lentoFator);
    e.tabuleiro[7] = null; // tira a Geada para medir sem novos acertos
    var d0 = ini.dist;
    rodar(e, 60);
    afirmar(perto(ini.dist - d0, 45 * 0.7, 1e-6), 'andou ' + (ini.dist - d0) + ' em 1 s lento (esperado 31,5)');
    rodar(e, 60);
    afirmar(ini.lentoTicks === 0 && ini.lentoFator === 0, 'lentidão não acabou');
    d0 = ini.dist;
    rodar(e, 60);
    afirmar(perto(ini.dist - d0, 45, 1e-6), 'velocidade normal não voltou: ' + (ini.dist - d0));
  });

  teste('Geada: lentidão não se acumula; vale a mais forte e a duração renova', function () {
    afirmar(perto(C.lentidao(1), 0.30, 1e-9) && perto(C.lentidao(3), 0.40, 1e-9) && perto(C.lentidao(7), 0.60, 1e-9), 'tabela errada');
    var e = cenarioCombate({ 0: ['geada', 1], 1: ['geada', 1], 2: ['geada', 3] });
    var ini = inimigoEm(e, 'tanque', 300, 1e6);
    rodar(e, 60);
    afirmar(perto(ini.lentoFator, 0.40, 1e-9), 'fator=' + ini.lentoFator + ' (esperado 0,40, não a soma)');
  });

  teste('Geada: prefere o inimigo mais avançado que ainda não está lento', function () {
    var e = cenarioCombate({});
    var frente = inimigoEm(e, 'comum', 400);
    var atras = inimigoEm(e, 'comum', 200);
    frente.lentoTicks = 50; frente.lentoFator = 0.3;
    afirmar(C.escolherAlvo(e, 'geada') === atras, 'Geada não trocou de alvo');
    afirmar(C.escolherAlvo(e, 'lanca') === frente, 'Lança deveria seguir no mais avançado');
    atras.lentoTicks = 50;
    afirmar(C.escolherAlvo(e, 'geada') === frente, 'todos lentos: Geada deveria mirar o mais avançado');
  });

  teste('Brasa: explosão atinge todos no raio e poupa quem está longe', function () {
    var e = cenarioCombate({ 7: ['brasa'] });
    var a = inimigoEm(e, 'tanque', 400, 1000);
    var b = inimigoEm(e, 'tanque', 380, 1000);
    var c = inimigoEm(e, 'tanque', 360, 1000);
    var longe = inimigoEm(e, 'tanque', 150, 1000);
    a.vel = b.vel = c.vel = longe.vel = 0; // parados, para medir só a explosão
    var t = 0;
    while (a.vida === 1000 && t < 120) { GF.sim.passo(e); t++; }
    afirmar(a.vida === 985 && b.vida === 985 && c.vida === 985, 'vidas ' + a.vida + '/' + b.vida + '/' + c.vida);
    afirmar(longe.vida === 1000, 'atingiu o inimigo longe');
    afirmar(e.efeitos.some(function (x) { return x.tipo === 'explosao'; }), 'sem efeito de explosão');
  });

  teste('Brasa: explosão que mata vários paga cada abate uma vez só', function () {
    var e = cenarioCombate({ 7: ['brasa'] });
    for (var k = 0; k < 4; k++) inimigoEm(e, 'comum', 400 - k * 5, 10).vel = 0;
    var en = e.energia;
    rodar(e, 90);
    afirmar(e.abates === 4 && e.inimigos.length === 0, 'abates=' + e.abates);
    afirmar(e.energia - en - 2 === 4 * GF.dados.INIMIGOS.comum.energia, 'energia=' + (e.energia - en));
  });

  function contarDisparos(guardioes, casaAtirador, ticks) {
    var e = cenarioCombate(guardioes);
    var ini = inimigoEm(e, 'tanque', 300, 1e9);
    ini.vel = 0;
    var vidaAntes = ini.vida;
    rodar(e, ticks);
    return Math.round((vidaAntes - ini.vida) / C.dano('lanca', guardioes[casaAtirador][1] || 1));
  }

  teste('Tambor: vizinhos atacam 20% mais rápido; diagonal não conta; Tambores não se somam', function () {
    var base = contarDisparos({ 7: ['lanca'] }, 7, 600);
    var comBuff = contarDisparos({ 7: ['lanca'], 6: ['tambor'] }, 7, 600);
    var diagonal = contarDisparos({ 7: ['lanca'], 1: ['tambor'] }, 7, 600);
    var dois = contarDisparos({ 7: ['lanca'], 6: ['tambor'], 8: ['tambor'] }, 7, 600);
    var razao = comBuff / base;
    afirmar(razao > 1.12 && razao < 1.28, 'base=' + base + ' com buff=' + comBuff);
    afirmar(diagonal === base, 'diagonal deu buff: ' + diagonal + ' vs ' + base);
    afirmar(dois === comBuff, 'dois Tambores somaram: ' + dois + ' vs ' + comBuff);
    var e = cenarioCombate({ 7: ['lanca'], 6: ['tambor', 1], 2: ['tambor', 3] });
    afirmar(perto(C.buffEm(e, 7), 0.40, 1e-9), 'deveria valer o Tambor mais forte (0,40): ' + C.buffEm(e, 7));
  });

  teste('Tambor: não ataca', function () {
    var e = cenarioCombate({ 7: ['tambor', 7] });
    var ini = inimigoEm(e, 'comum', 300);
    rodar(e, 300);
    afirmar(ini.vida === ini.vidaMax && e.projeteis.length === 0, 'Tambor causou dano');
  });

  teste('Sorte: ~25% de críticos com 2,5× de dano (sorteados pelo RNG do estado)', function () {
    var crits = 0, total = 0, danosOk = true;
    for (var s = 1; s <= 40; s++) {
      var e = cenarioCombate({ 7: ['sorte'] }, s);
      var ini = inimigoEm(e, 'tanque', 300, 1e9);
      ini.vel = 0;
      for (var t = 0; t < 600; t++) {
        GF.sim.passo(e);
        for (var k = 0; k < e.efeitos.length; k++) {
          var ef = e.efeitos[k];
          if (ef.tick !== e.tick - 1) continue;
          total++;
          if (ef.tipo === 'critico') { crits++; if (ef.valor !== 30) danosOk = false; }
          else if (ef.valor !== 12) danosOk = false;
        }
      }
    }
    var f = crits / total;
    afirmar(total > 400, 'poucos disparos: ' + total);
    afirmar(f > 0.20 && f < 0.30, 'críticos: ' + (f * 100).toFixed(1) + '% de ' + total);
    afirmar(danosOk, 'valor de dano errado (esperado 12 normal / 30 crítico)');
  });

  teste('Projétil some se o alvo morrer antes (sem dano nem recompensa extra)', function () {
    var e = cenarioCombate({ 6: ['lanca'], 8: ['lanca'] });
    inimigoEm(e, 'comum', 300, 15).vel = 0; // um disparo basta
    var en = e.energia;
    rodar(e, 60); // ticks 0..59: energia passiva só no tick 30 (+1)
    afirmar(e.abates === 1 && e.projeteis.length === 0, 'abates=' + e.abates + ' projéteis=' + e.projeteis.length);
    afirmar(e.energia - en - 1 === GF.dados.INIMIGOS.comum.energia, 'energia ganha=' + (e.energia - en));
  });

  teste('Guardião sem alvo fica pronto e dispara assim que um inimigo aparece', function () {
    var e = cenarioCombate({ 7: ['lanca'] });
    rodar(e, 200);
    afirmar(e.projeteis.length === 0, 'disparou sem alvo');
    inimigoEm(e, 'comum', 300);
    GF.sim.passo(e);
    afirmar(e.projeteis.length === 1, 'não disparou de imediato');
  });

  // ---------- Etapa 5: fusão ----------
  // Estado com cartas fixas: { casa: [tipo, nivel] }
  function tabuleiroCom(cartas, semente) {
    return cenarioCombate(cartas, semente);
  }

  teste('Fusão: duas cartas iguais viram uma de nível +1 na casa de destino; a origem fica livre', function () {
    var e = tabuleiroCom({ 2: ['lanca', 1], 9: ['lanca', 1], 4: ['geada', 1] });
    var idA = e.tabuleiro[2].id, idB = e.tabuleiro[9].id;
    var novo = GF.sim.fundir(e, 2, 9, idA, idB);
    afirmar(novo && e.tabuleiro[9] === novo, 'não fundiu');
    afirmar(e.tabuleiro[2] === null, 'origem não ficou livre');
    afirmar(novo.nivel === 2 && GF.dados.TIPOS_GUARDIAO.indexOf(novo.tipo) >= 0, 'novo inválido ' + JSON.stringify(novo));
    afirmar(novo.id !== idA && novo.id !== idB && novo.recarga === 0, 'novo deveria ser uma carta nova, pronta');
    afirmar(e.tabuleiro[4].tipo === 'geada', 'mexeu em outra casa');
    afirmar(e.fusoes === 1 && e.efeitos.some(function (x) { return x.tipo === 'fusao'; }), 'sem contagem/efeito');
  });

  teste('Fusão: não gasta energia nem muda o custo de invocar', function () {
    var e = tabuleiroCom({ 0: ['brasa', 3], 1: ['brasa', 3] });
    var en = e.energia, custo = e.custoInvocar;
    afirmar(GF.sim.fundir(e, 0, 1).nivel === 4, 'nível errado');
    afirmar(e.energia === en && e.custoInvocar === custo, 'energia/custo mudaram');
  });

  teste('Fusão inválida não muda nada (nem o RNG): tipo, nível, casa, ids, nível máximo, fim de jogo', function () {
    var casos = [
      ['tipos diferentes', { 0: ['lanca', 1], 1: ['sorte', 1] }, 0, 1],
      ['níveis diferentes', { 0: ['lanca', 1], 1: ['lanca', 2] }, 0, 1],
      ['mesma casa', { 0: ['lanca', 1] }, 0, 0],
      ['destino vazio', { 0: ['lanca', 1] }, 0, 5],
      ['origem vazia', { 5: ['lanca', 1] }, 0, 5],
      ['fora do tabuleiro', { 0: ['lanca', 1] }, 0, 15],
      ['nível máximo (7+7)', { 0: ['tambor', 7], 1: ['tambor', 7] }, 0, 1]
    ];
    casos.forEach(function (c) {
      var e = tabuleiroCom(c[1]);
      var antes = GF.sim.resumo(e);
      afirmar(GF.sim.fundir(e, c[2], c[3]) === null, c[0] + ': fundiu');
      afirmar(GF.sim.resumo(e) === antes, c[0] + ': estado mudou');
    });
    // ids desatualizados: a carta da casa foi trocada desde o início do arraste
    var e2 = tabuleiroCom({ 0: ['lanca', 1], 1: ['lanca', 1] });
    var idVelho = e2.tabuleiro[0].id;
    e2.tabuleiro[0] = GF.sim.criarGuardiao(e2, 'lanca', 1);
    afirmar(GF.sim.fundir(e2, 0, 1, idVelho, e2.tabuleiro[1].id) === null, 'fundiu com id desatualizado');
    var e3 = tabuleiroCom({ 0: ['lanca', 1], 1: ['lanca', 1] });
    e3.fase = 'derrota';
    afirmar(GF.sim.fundir(e3, 0, 1) === null, 'fundiu após a derrota');
    var e4 = tabuleiroCom({ 0: ['lanca', 6], 1: ['lanca', 6] });
    afirmar(GF.sim.fundir(e4, 0, 1).nivel === 7, '6+6 deveria virar 7');
  });

  teste('Fusão: o tipo do resultado é sorteado entre os 5, de forma equilibrada', function () {
    var porTipo = {}, mesmo = 0, n = 500;
    for (var s = 1; s <= n; s++) {
      var e = tabuleiroCom({ 0: ['geada', 2], 1: ['geada', 2] }, s);
      var t = GF.sim.fundir(e, 0, 1).tipo;
      porTipo[t] = (porTipo[t] || 0) + 1;
      if (t === 'geada') mesmo++;
    }
    GF.dados.TIPOS_GUARDIAO.forEach(function (t) {
      var f = (porTipo[t] || 0) / n;
      afirmar(f > 0.12 && f < 0.28, t + ' saiu em ' + (f * 100).toFixed(1) + '%');
    });
    afirmar(mesmo > 0, 'o próprio tipo também deveria poder sair');
  });

  teste('Fusão: pela fila de ações; duas fusões com a mesma carta no mesmo passo → só a primeira vale', function () {
    var e = tabuleiroCom({ 0: ['sorte', 1], 1: ['sorte', 1], 2: ['sorte', 1] });
    var ids = [e.tabuleiro[0].id, e.tabuleiro[1].id, e.tabuleiro[2].id];
    GF.sim.agendar(e, { tipo: 'fundir', de: 0, para: 1, idDe: ids[0], idPara: ids[1] });
    GF.sim.agendar(e, { tipo: 'fundir', de: 2, para: 1, idDe: ids[2], idPara: ids[1] }); // casa 1 já mudou
    afirmar(e.tabuleiro[0] !== null, 'agendar não pode aplicar na hora');
    GF.sim.passo(e);
    afirmar(e.fusoes === 1, 'fusões=' + e.fusoes);
    afirmar(e.tabuleiro[0] === null && e.tabuleiro[1].nivel === 2 && e.tabuleiro[2].nivel === 1, 'resultado errado');
    afirmar(e.registro.length === 2, 'as duas ações deveriam ficar registradas');
  });

  teste('Fusão: carta nova ataca normalmente (com o dano do novo nível)', function () {
    var e = tabuleiroCom({ 0: ['lanca', 1], 1: ['lanca', 1] }, 3);
    var novo = GF.sim.fundir(e, 0, 1);
    novo.tipo = 'lanca'; // fixa o tipo para medir o dano
    var ini = inimigoEm(e, 'tanque', 300, 1e6);
    ini.vel = 0;
    rodar(e, 30);
    afirmar(perto(ini.vidaMax - ini.vida, C.dano('lanca', 2), 1e-9), 'dano=' + (ini.vidaMax - ini.vida));
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
