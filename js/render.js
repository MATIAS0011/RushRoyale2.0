// Desenho no canvas. Só LÊ o estado da simulação; nunca o altera.
// Tudo é desenhado em coordenadas lógicas (GF.sim.LARGURA x GF.sim.ALTURA)
// e escalado para caber na tela mantendo a proporção.
(function (GF) {
  'use strict';

  var W = GF.sim.LARGURA;
  var H = GF.sim.ALTURA;
  var L = GF.layout;

  var CORES = {
    fundo1: '#1d1830',
    fundo2: '#0e0c18',
    texto: '#efe9ff',
    textoFraco: '#8f86b0',
    caminho: '#2a2340',
    caminhoBorda: '#3d335e',
    tabuleiro: '#191428',
    casa: '#251e3a',
    casaBorda: '#342a52',
    fenda: '#b07cff',
    base: '#5fd4c4',
    vida: '#ff5d7a',
    barraFundo: '#3a1020',
    barraVida: '#7ee08a',
    botao: '#2c2546',
    botaoBorda: '#6f5fa8',
    inimigo: {
      comum:  { corpo: '#8a4fd6', borda: '#c9a2ff' },
      rapido: { corpo: '#2fb3d6', borda: '#a8ecff' },
      tanque: { corpo: '#5b4a3f', borda: '#a8907c' }
    }
  };

  // Botões da interface em coordenadas lógicas (usados também para o clique).
  var BOTAO_VELOCIDADE = { x: W - 76, y: H - 52, w: 64, h: 36 };

  var vista = { escala: 1, dpr: 1, cssW: W, cssH: H };

  // O CSS define o tamanho visível (9:16 que cabe na tela). Aqui só casamos a
  // resolução interna com esse tamanho, nítido em telas de alta densidade.
  function ajustar(canvas) {
    var r = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;

    vista.cssW = r.width;
    vista.cssH = r.height;
    vista.escala = r.width / W;
    vista.dpr = dpr;

    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }

  // Converte um ponto do evento (pixels da página) para coordenadas lógicas.
  function paraLogico(canvas, clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) / r.width * W,
      y: (clientY - r.top) / r.height * H
    };
  }

  function dentro(p, ret) {
    return p.x >= ret.x && p.x <= ret.x + ret.w && p.y >= ret.y && p.y <= ret.y + ret.h;
  }

  // ---------- Partes ----------
  function desenharFundo(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, CORES.fundo1);
    g.addColorStop(1, CORES.fundo2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function desenharCaminho(ctx, tick) {
    var p = L.PONTOS;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (var i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.strokeStyle = CORES.caminhoBorda;
    ctx.lineWidth = L.LARGURA_CAMINHO + 4;
    ctx.stroke();
    ctx.strokeStyle = CORES.caminho;
    ctx.lineWidth = L.LARGURA_CAMINHO;
    ctx.stroke();

    // Marcas de direção, deslizando devagar
    ctx.fillStyle = CORES.caminhoBorda;
    var passo = 40;
    var desloc = (tick * 0.5) % passo;
    for (var d = desloc; d < L.COMPRIMENTO; d += passo) {
      var a = L.posicao(d), b = L.posicao(d + 1);
      var ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-3, -5);
      ctx.lineTo(-3, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Entrada: a fenda
    var ini = p[0];
    var pulsar = 1 + 0.1 * Math.sin(tick / 15);
    ctx.save();
    ctx.translate(ini.x, ini.y + 12);
    ctx.scale(pulsar, pulsar);
    ctx.shadowColor = CORES.fenda;
    ctx.shadowBlur = 16;
    ctx.fillStyle = CORES.fenda;
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(6, -6); ctx.lineTo(-3, 2);
    ctx.lineTo(5, 10); ctx.lineTo(0, 18); ctx.lineTo(-6, 8);
    ctx.lineTo(3, 0); ctx.lineTo(-6, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Saída: o cristal guardado
    var fim = p[p.length - 1];
    ctx.save();
    ctx.translate(fim.x, fim.y + 14);
    ctx.shadowColor = CORES.base;
    ctx.shadowBlur = 14;
    ctx.fillStyle = CORES.base;
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(11, 0); ctx.lineTo(0, 16); ctx.lineTo(-11, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function desenharTabuleiro(ctx) {
    var t = L.TABULEIRO;
    ctx.fillStyle = CORES.tabuleiro;
    retArredondado(ctx, t.x - 4, t.y - 4, t.w + 8, t.h + 8, 10);
    ctx.fill();

    for (var i = 0; i < L.CASAS; i++) {
      var c = L.casa(i);
      ctx.fillStyle = CORES.casa;
      ctx.strokeStyle = CORES.casaBorda;
      ctx.lineWidth = 1.5;
      retArredondado(ctx, c.x + 3, c.y + 3, c.w - 6, c.h - 6, 8);
      ctx.fill();
      ctx.stroke();
    }
  }

  function desenharInimigos(ctx, estado, alfa) {
    for (var i = 0; i < estado.inimigos.length; i++) {
      var ini = estado.inimigos[i];
      var d = ini.distAnt + (ini.dist - ini.distAnt) * alfa;
      var p = L.posicao(d);
      var q = L.posicao(d + 1);
      var ang = Math.atan2(q.y - p.y, q.x - p.x);
      var cor = CORES.inimigo[ini.tipo];
      var r = ini.raio;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = cor.corpo;
      ctx.strokeStyle = cor.borda;
      ctx.lineWidth = 2;

      if (ini.tipo === 'rapido') {
        // Gota apontando para onde vai
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(r + 4, 0);
        ctx.quadraticCurveTo(-r, r + 2, -r, 0);
        ctx.quadraticCurveTo(-r, -r - 2, r + 4, 0);
        ctx.fill();
        ctx.stroke();
      } else if (ini.tipo === 'tanque') {
        // Bloco octogonal
        ctx.beginPath();
        for (var k = 0; k < 8; k++) {
          var a = Math.PI / 8 + k * Math.PI / 4;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = cor.borda;
        ctx.fillRect(-r * 0.4, -2, r * 0.8, 4);
      } else {
        // Bolha com um olho
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * 3, Math.sin(ang) * 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Barra de vida (só quando ferido)
      if (ini.vida < ini.vidaMax) {
        var bw = 22, bh = 4;
        ctx.fillStyle = CORES.barraFundo;
        ctx.fillRect(p.x - bw / 2, p.y - r - 9, bw, bh);
        ctx.fillStyle = CORES.barraVida;
        ctx.fillRect(p.x - bw / 2, p.y - r - 9, bw * Math.max(0, ini.vida / ini.vidaMax), bh);
      }
    }
  }

  function desenharHud(ctx, estado) {
    // Vida
    desenharCoracao(ctx, 30, 40, 11);
    ctx.fillStyle = CORES.texto;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(String(estado.vida), 48, 41);

    // Título curto no centro
    ctx.textAlign = 'center';
    ctx.fillStyle = CORES.textoFraco;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('Guardiões da Fenda', W / 2, 41);
  }

  function desenharCoracao(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = CORES.vida;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.6, -s * 1.1, 0, -s * 0.35);
    ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.4, -s * 0.1, 0, s * 0.9);
    ctx.fill();
    ctx.restore();
  }

  function desenharControles(ctx, laco, estado, info) {
    var b = BOTAO_VELOCIDADE;
    ctx.fillStyle = CORES.botao;
    ctx.strokeStyle = CORES.botaoBorda;
    ctx.lineWidth = 2;
    retArredondado(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CORES.texto;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(laco.velocidade + 'x', b.x + b.w / 2, b.y + b.h / 2 + 1);

    ctx.fillStyle = CORES.textoFraco;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('etapa 2 · o botão Invocar chega na etapa 3', W / 2, 520);

    // Depuração
    ctx.textAlign = 'left';
    ctx.font = '11px monospace';
    ctx.fillText('tick ' + estado.tick + ' · ' + info.fps + ' fps · ' + estado.inimigos.length + ' inim.', 12, H - 34);
  }

  function desenharFim(ctx, estado) {
    if (estado.fase === 'jogando') return;
    ctx.fillStyle = 'rgba(8, 6, 14, 0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = estado.fase === 'derrota' ? CORES.vida : CORES.barraVida;
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText(estado.fase === 'derrota' ? 'Derrota' : 'Vitória', W / 2, H / 2 - 20);
    ctx.fillStyle = CORES.texto;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Toque para recomeçar', W / 2, H / 2 + 22);
  }

  function desenhar(ctx, estado, laco, info) {
    var k = vista.escala * vista.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);

    // Partida parada: não interpola (os inimigos ficam onde pararam).
    var alfa = estado.fase === 'jogando' ? GF.loop.alfa(laco) : 1;

    desenharFundo(ctx);
    desenharCaminho(ctx, estado.tick);
    desenharTabuleiro(ctx);
    desenharInimigos(ctx, estado, alfa);
    desenharHud(ctx, estado);
    desenharControles(ctx, laco, estado, info);
    desenharFim(ctx, estado);
  }

  function retArredondado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  GF.render = {
    ajustar: ajustar,
    paraLogico: paraLogico,
    dentro: dentro,
    desenhar: desenhar,
    BOTAO_VELOCIDADE: BOTAO_VELOCIDADE
  };
})(window.GF = window.GF || {});
