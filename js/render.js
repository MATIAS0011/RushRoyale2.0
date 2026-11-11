// Desenho no canvas. Só LÊ o estado da simulação; nunca o altera.
// Tudo é desenhado em coordenadas lógicas (GF.sim.LARGURA x GF.sim.ALTURA)
// e escalado para caber na tela mantendo a proporção.
(function (GF) {
  'use strict';

  var W = GF.sim.LARGURA;
  var H = GF.sim.ALTURA;

  var CORES = {
    fundo1: '#1d1830',
    fundo2: '#0e0c18',
    texto: '#efe9ff',
    textoFraco: '#8f86b0',
    fenda: '#b07cff',
    faisca: '#e6c8ff',
    botao: '#2c2546',
    botaoBorda: '#6f5fa8'
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

  function desenhar(ctx, estado, laco, info) {
    var k = vista.escala * vista.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);

    // Fundo
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, CORES.fundo1);
    g.addColorStop(1, CORES.fundo2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Título
    ctx.fillStyle = CORES.texto;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('Guardiões da Fenda', W / 2, 70);
    ctx.fillStyle = CORES.textoFraco;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('v0.1 · etapa 1: esqueleto', W / 2, 98);

    // A fenda (elemento provisório)
    var cy = H * 0.42;
    var pulsar = 1 + 0.08 * Math.sin(estado.tick / 20);
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.scale(pulsar, pulsar);
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(14, -20);
    ctx.lineTo(-6, 5);
    ctx.lineTo(12, 30);
    ctx.lineTo(0, 60);
    ctx.lineTo(-12, 25);
    ctx.lineTo(6, 0);
    ctx.lineTo(-14, -25);
    ctx.closePath();
    ctx.shadowColor = CORES.fenda;
    ctx.shadowBlur = 24;
    ctx.fillStyle = CORES.fenda;
    ctx.fill();
    ctx.restore();

    // Faíscas
    ctx.fillStyle = CORES.faisca;
    for (var i = 0; i < estado.faiscas.length; i++) {
      var f = estado.faiscas[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, f.vida / 1.5));
      ctx.beginPath();
      ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Dica
    ctx.fillStyle = CORES.textoFraco;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Toque na tela para soltar faíscas', W / 2, H * 0.72);

    // Botão de velocidade
    var b = BOTAO_VELOCIDADE;
    ctx.fillStyle = CORES.botao;
    ctx.strokeStyle = CORES.botaoBorda;
    ctx.lineWidth = 2;
    retArredondado(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CORES.texto;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(laco.velocidade + 'x', b.x + b.w / 2, b.y + b.h / 2 + 1);

    // Depuração
    ctx.textAlign = 'left';
    ctx.fillStyle = CORES.textoFraco;
    ctx.font = '11px monospace';
    ctx.fillText('tick ' + estado.tick + '  ·  ' + info.fps + ' fps', 12, H - 34);
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
