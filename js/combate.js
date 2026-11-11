// Combate: guardiões escolhem alvo e disparam; projéteis voam e aplicam efeitos.
// Faz parte da simulação: mesmas regras (passo fixo, RNG do estado, sem relógio).
(function (GF) {
  'use strict';

  var D = GF.dados;
  var L = GF.layout;

  // ---------- Atributos por nível ----------
  function dano(tipo, nivel) {
    // Multiplicativo: cada nível vale MULT_DANO_NIVEL vezes o anterior (> 2 = fundir compensa).
    return D.GUARDIOES[tipo].dano * Math.pow(D.MULT_DANO_NIVEL, nivel - 1);
  }
  function lentidao(nivel) {
    var g = D.GUARDIOES.geada;
    return Math.min(g.lentoMax, g.lento + g.lentoPorNivel * (nivel - 1));
  }
  function raioExplosao(nivel) {
    var g = D.GUARDIOES.brasa;
    return g.raio + g.raioPorNivel * (nivel - 1);
  }
  function chanceCritico(nivel) {
    var g = D.GUARDIOES.sorte;
    return Math.min(1, g.critChance + g.critPorNivel * (nivel - 1));
  }
  function forcaTambor(nivel) {
    var g = D.GUARDIOES.tambor;
    return g.buff + g.buffPorNivel * (nivel - 1);
  }

  // Bônus de velocidade de ataque da casa i: o MAIOR entre os Tambores vizinhos
  // (cima, baixo, esquerda, direita). Tambores não se somam.
  function buffEm(estado, i) {
    var col = i % L.COLUNAS, lin = Math.floor(i / L.COLUNAS);
    var viz = [];
    if (col > 0) viz.push(i - 1);
    if (col < L.COLUNAS - 1) viz.push(i + 1);
    if (lin > 0) viz.push(i - L.COLUNAS);
    if (lin < L.LINHAS - 1) viz.push(i + L.COLUNAS);
    var melhor = 0;
    for (var k = 0; k < viz.length; k++) {
      var g = estado.tabuleiro[viz[k]];
      if (g && g.tipo === 'tambor') melhor = Math.max(melhor, forcaTambor(g.nivel));
    }
    return melhor;
  }

  // ---------- Alvo ----------
  // Regra geral: o inimigo mais avançado no caminho (empate: menor id).
  // Geada prefere o mais avançado que ainda não está lento.
  function escolherAlvo(estado, tipo) {
    var melhor = null, melhorLivre = null;
    for (var i = 0; i < estado.inimigos.length; i++) {
      var ini = estado.inimigos[i];
      if (ini.vida <= 0) continue;
      if (!melhor || ini.dist > melhor.dist || (ini.dist === melhor.dist && ini.id < melhor.id)) melhor = ini;
      if (ini.lentoTicks <= 0 &&
          (!melhorLivre || ini.dist > melhorLivre.dist || (ini.dist === melhorLivre.dist && ini.id < melhorLivre.id))) melhorLivre = ini;
    }
    if (tipo === 'geada' && melhorLivre) return melhorLivre;
    return melhor;
  }

  function buscarInimigo(estado, id) {
    for (var i = 0; i < estado.inimigos.length; i++) if (estado.inimigos[i].id === id) return estado.inimigos[i];
    return null;
  }

  // ---------- Guardiões ----------
  function atualizarGuardioes(estado) {
    for (var i = 0; i < estado.tabuleiro.length; i++) {
      var g = estado.tabuleiro[i];
      if (!g || g.tipo === 'tambor') continue;

      // Recarga: o buff do Tambor faz o tempo correr mais rápido para este guardião.
      if (g.recarga > 0) g.recarga -= 1 + buffEm(estado, i);
      if (g.recarga > 0) continue;

      var alvo = escolherAlvo(estado, g.tipo);
      if (!alvo) continue; // pronto, esperando inimigo
      disparar(estado, i, g, alvo);
      g.recarga += D.GUARDIOES[g.tipo].intervaloTicks;
    }
  }

  function disparar(estado, casa, g, alvo) {
    var c = L.casa(casa);
    var p = {
      id: estado.proximoId++,
      tipo: g.tipo,
      nivel: g.nivel,
      x: c.cx, y: c.cy, xAnt: c.cx, yAnt: c.cy,
      alvoId: alvo.id,
      dano: dano(g.tipo, g.nivel),
      critico: false
    };
    if (g.tipo === 'sorte' && GF.rng.proximo(estado.rng) < chanceCritico(g.nivel)) {
      p.critico = true;
      p.dano *= D.GUARDIOES.sorte.critMult;
    }
    estado.projeteis.push(p);
  }

  // ---------- Projéteis ----------
  function atualizarProjeteis(estado) {
    var passo = D.VEL_PROJETIL * GF.sim.DT;
    for (var i = estado.projeteis.length - 1; i >= 0; i--) {
      var p = estado.projeteis[i];
      p.xAnt = p.x; p.yAnt = p.y;
      var alvo = buscarInimigo(estado, p.alvoId);
      if (!alvo) { // alvo morreu ou escapou antes: o projétil some
        estado.projeteis.splice(i, 1);
        continue;
      }
      var pos = L.posicao(alvo.dist);
      var dx = pos.x - p.x, dy = pos.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d <= passo + alvo.raio) {
        p.x = pos.x; p.y = pos.y;
        estado.projeteis.splice(i, 1);
        acertar(estado, p, alvo, pos);
      } else {
        p.x += dx / d * passo;
        p.y += dy / d * passo;
      }
    }
  }

  function acertar(estado, p, alvo, pos) {
    if (p.tipo === 'brasa') {
      var r = raioExplosao(p.nivel);
      // Cópia: causarDano remove inimigos da lista original.
      var atingidos = [];
      for (var i = 0; i < estado.inimigos.length; i++) {
        var ini = estado.inimigos[i];
        var q = L.posicao(ini.dist);
        var dx = q.x - pos.x, dy = q.y - pos.y;
        if (dx * dx + dy * dy <= (r + ini.raio) * (r + ini.raio)) atingidos.push(ini);
      }
      for (var k = 0; k < atingidos.length; k++) GF.sim.causarDano(estado, atingidos[k], p.dano);
      efeito(estado, { tipo: 'explosao', x: pos.x, y: pos.y, r: r });
      return;
    }

    if (p.tipo === 'geada') {
      // Chefes podem resistir a parte da lentidão (Colosso: metade).
      var f = lentidao(p.nivel) * (1 - (D.INIMIGOS[alvo.tipo].resistLento || 0));
      alvo.lentoFator = Math.max(alvo.lentoTicks > 0 ? alvo.lentoFator : 0, f);
      alvo.lentoTicks = D.GUARDIOES.geada.lentoTicks;
    }

    GF.sim.causarDano(estado, alvo, p.dano);
    efeito(estado, { tipo: p.critico ? 'critico' : 'acerto', x: pos.x, y: pos.y, cor: p.tipo, valor: Math.round(p.dano) });
  }

  // Efeitos visuais vivem no estado (determinísticos) e expiram sozinhos.
  var DURACAO_EFEITO = 30;
  function efeito(estado, e) {
    e.tick = estado.tick;
    estado.efeitos.push(e);
  }
  function limparEfeitos(estado) {
    while (estado.efeitos.length && estado.tick - estado.efeitos[0].tick >= DURACAO_EFEITO) estado.efeitos.shift();
  }

  GF.combate = {
    dano: dano,
    lentidao: lentidao,
    raioExplosao: raioExplosao,
    chanceCritico: chanceCritico,
    forcaTambor: forcaTambor,
    buffEm: buffEm,
    escolherAlvo: escolherAlvo,
    atualizarGuardioes: atualizarGuardioes,
    atualizarProjeteis: atualizarProjeteis,
    limparEfeitos: limparEfeitos,
    DURACAO_EFEITO: DURACAO_EFEITO
  };
})(window.GF = window.GF || {});
