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
    energia: '#ffd84d',
    botaoInvocar: '#5a3fb0',
    botaoInvocarBorda: '#b49cff',
    botaoApagado: '#2a2438',
    botaoApagadoBorda: '#463d5e',
    inimigo: {
      comum:  { corpo: '#8a4fd6', borda: '#c9a2ff' },
      rapido: { corpo: '#2fb3d6', borda: '#a8ecff' },
      tanque: { corpo: '#5b4a3f', borda: '#a8907c' },
      colosso: { corpo: '#4a3550', borda: '#d48cff', brilho: '#ff7be0' },
      coracao: { corpo: '#7a1636', borda: '#ff6b8f', brilho: '#ffb0c4' }
    },
    // fundo = tom escuro da carta; forma = cor viva do símbolo
    guardiao: {
      lanca:  { fundo: '#4a2a14', forma: '#ff9a3c' },
      geada:  { fundo: '#173548', forma: '#8fe0ff' },
      brasa:  { fundo: '#4a1714', forma: '#ff5a4a' },
      tambor: { fundo: '#1a3d1c', forma: '#72de6a' },
      sorte:  { fundo: '#463a10', forma: '#ffd34d' }
    }
  };

  // Botões da interface em coordenadas lógicas (usados também para o clique).
  var BOTAO_INVOCAR = { x: 115, y: 478, w: 130, h: 64 };
  var BOTAO_VELOCIDADE = { x: 268, y: 490, w: 64, h: 40 };
  var BOTAO_REINICIAR = { x: 90, y: 430, w: 180, h: 54 }; // só na tela de fim

  // escala: px CSS por unidade lógica; ox/oy: deslocamento (px CSS) do mundo 360x640
  // centralizado no canvas; visivel: retângulo lógico que aparece na tela inteira.
  var vista = { escala: 1, dpr: 1, cssW: W, cssH: H, ox: 0, oy: 0,
                visivel: { x: 0, y: 0, w: W, h: H } };

  // O canvas ocupa a tela inteira (CSS). O mundo lógico é escalado para caber
  // (maior escala que cabe) e centralizado; a sobra mostra o fundo do jogo.
  function ajustar(canvas) {
    var r = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var escala = Math.min(r.width / W, r.height / H);

    vista.cssW = r.width;
    vista.cssH = r.height;
    vista.escala = escala;
    vista.dpr = dpr;
    vista.ox = (r.width - W * escala) / 2;
    vista.oy = (r.height - H * escala) / 2;
    vista.visivel = { x: -vista.ox / escala, y: -vista.oy / escala, w: r.width / escala, h: r.height / escala };

    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }

  // Converte um ponto do evento (pixels da página) para coordenadas lógicas.
  function paraLogico(canvas, clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - vista.ox) / vista.escala,
      y: (clientY - r.top - vista.oy) / vista.escala
    };
  }

  function dentro(p, ret) {
    return p.x >= ret.x && p.x <= ret.x + ret.w && p.y >= ret.y && p.y <= ret.y + ret.h;
  }

  // ---------- Partes ----------
  // O fundo cobre a área visível inteira (inclusive a sobra fora do 360x640).
  function desenharFundo(ctx) {
    var v = vista.visivel;
    var g = ctx.createLinearGradient(0, v.y, 0, v.y + v.h);
    g.addColorStop(0, CORES.fundo1);
    g.addColorStop(1, CORES.fundo2);
    ctx.fillStyle = g;
    ctx.fillRect(v.x, v.y, v.w, v.h);
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

  // Desenha o símbolo do guardião centrado em (0,0), com "raio" r.
  function formaGuardiao(ctx, tipo, r) {
    ctx.beginPath();
    if (tipo === 'lanca') {
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.87, r * 0.6); ctx.lineTo(-r * 0.87, r * 0.6);
      ctx.closePath();
    } else if (tipo === 'geada') {
      for (var k = 0; k < 6; k++) {
        var a = -Math.PI / 2 + k * Math.PI / 3;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    } else if (tipo === 'brasa') {
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    } else if (tipo === 'tambor') {
      retArredondado(ctx, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.25);
    } else { // sorte
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.75, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.75, 0);
      ctx.closePath();
    }
  }

  // Detalhe interno, para cada forma não ser só um bloco de cor.
  function detalheGuardiao(ctx, tipo, r) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    if (tipo === 'brasa') {
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    } else if (tipo === 'tambor') {
      ctx.rect(-r * 0.5, -r * 0.08, r, r * 0.16);
      ctx.rect(-r * 0.08, -r * 0.5, r * 0.16, r);
    } else if (tipo === 'geada') {
      for (var k = 0; k < 6; k++) {
        var a = -Math.PI / 2 + k * Math.PI / 3;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    } else if (tipo === 'lanca') {
      ctx.moveTo(0, -r * 0.45); ctx.lineTo(r * 0.3, r * 0.35); ctx.lineTo(-r * 0.3, r * 0.35);
    } else {
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Carta de guardião centrada em (cx, cy). escala anima a entrada.
  function desenharCarta(ctx, g, cx, cy, escala) {
    var cor = CORES.guardiao[g.tipo];
    var t = (L.CASA - 8) * escala;
    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = cor.fundo;
    ctx.strokeStyle = cor.forma;
    ctx.lineWidth = 2;
    retArredondado(ctx, -t / 2, -t / 2, t, t, 9 * escala);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(0, -4 * escala);
    ctx.fillStyle = cor.forma;
    formaGuardiao(ctx, g.tipo, 14 * escala);
    ctx.fill();
    detalheGuardiao(ctx, g.tipo, 14 * escala);
    ctx.restore();

    // Nível: pontinhos na base
    var n = g.nivel, esp = 7 * escala;
    ctx.fillStyle = '#fff';
    for (var i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc((i - (n - 1) / 2) * esp, t / 2 - 7 * escala, 2.2 * escala, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function desenharGuardioes(ctx, estado, alfa, arraste) {
    var pulso = 0.5 + 0.5 * Math.sin(estado.tick / 6);
    for (var i = 0; i < estado.tabuleiro.length; i++) {
      var g = estado.tabuleiro[i];
      if (!g) continue;
      var c = L.casa(i);

      // Destinos válidos da fusão brilham; o que está sob o dedo brilha mais.
      if (arraste && GF.sim.podeFundir(estado, arraste.casa, i)) {
        var sob = arraste.alvo === i;
        ctx.save();
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = sob ? 18 : 8 + 6 * pulso;
        ctx.strokeStyle = sob ? '#ffffff' : 'rgba(255,255,255,' + (0.45 + 0.4 * pulso) + ')';
        ctx.lineWidth = sob ? 4 : 2.5;
        retArredondado(ctx, c.x + 1, c.y + 1, c.w - 2, c.h - 2, 10);
        ctx.stroke();
        ctx.restore();
      }

      // Carta de origem do arraste fica apagada no lugar.
      if (arraste && arraste.casa === i) ctx.globalAlpha = 0.3;

      // Entrada com leve "salto" nos primeiros 12 ticks
      var t = Math.min(1, (estado.tick - g.criadoTick + alfa) / 12);
      var escala = t < 1 ? 1 + 0.25 * Math.sin(t * Math.PI) - 0.6 * (1 - t) : 1;
      desenharCarta(ctx, g, c.cx, c.cy, Math.max(0.1, escala));
      ctx.globalAlpha = 1;

      // Marca de buff: setinha verde no canto (vizinho de um Tambor)
      if (g.tipo !== 'tambor' && GF.combate.buffEm(estado, i) > 0) {
        ctx.fillStyle = CORES.guardiao.tambor.forma;
        ctx.beginPath();
        ctx.moveTo(c.x + c.w - 12, c.y + 7);
        ctx.lineTo(c.x + c.w - 6, c.y + 14);
        ctx.lineTo(c.x + c.w - 18, c.y + 14);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function desenharProjeteis(ctx, estado, alfa) {
    for (var i = 0; i < estado.projeteis.length; i++) {
      var p = estado.projeteis[i];
      var x = p.xAnt + (p.x - p.xAnt) * alfa;
      var y = p.yAnt + (p.y - p.yAnt) * alfa;
      var ang = Math.atan2(p.y - p.yAnt, p.x - p.xAnt);
      var cor = CORES.guardiao[p.tipo].forma;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = cor;
      ctx.strokeStyle = cor;
      ctx.beginPath();
      if (p.tipo === 'lanca') {
        ctx.rotate(ang);
        ctx.lineWidth = 3;
        ctx.moveTo(-8, 0); ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(9, 0); ctx.lineTo(3, -4); ctx.lineTo(3, 4);
        ctx.closePath();
        ctx.fill();
      } else if (p.tipo === 'brasa') {
        ctx.shadowColor = cor; ctx.shadowBlur = 10;
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.tipo === 'geada') {
        ctx.shadowColor = cor; ctx.shadowBlur = 8;
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else { // sorte
        var s = p.critico ? 7 : 4.5;
        if (p.critico) { ctx.shadowColor = cor; ctx.shadowBlur = 12; }
        ctx.rotate(estado.tick * 0.3);
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function desenharEfeitos(ctx, estado, alfa) {
    var dur = GF.combate.DURACAO_EFEITO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < estado.efeitos.length; i++) {
      var e = estado.efeitos[i];
      var t = Math.min(1, (estado.tick - e.tick + alfa) / dur); // 0 → 1
      ctx.globalAlpha = 1 - t;
      if (e.tipo === 'fusao') {
        // Anel que se abre + 8 faíscas, na cor do guardião que nasceu
        var corF = CORES.guardiao[e.cor].forma;
        ctx.strokeStyle = corF;
        ctx.lineWidth = 3 * (1 - t) + 1;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 18 + 26 * t, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        for (var k = 0; k < 8; k++) {
          var ang = k * Math.PI / 4 + t;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(ang) * (20 + 30 * t), e.y + Math.sin(ang) * (20 + 30 * t), 2.5 * (1 - t) + 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.tipo === 'explosao') {
        ctx.fillStyle = 'rgba(255, 120, 60, 0.35)';
        ctx.strokeStyle = CORES.guardiao.brasa.forma;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * (0.4 + 0.6 * Math.sqrt(t)), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (e.tipo === 'critico') {
        ctx.fillStyle = CORES.guardiao.sorte.forma;
        ctx.font = 'bold ' + Math.round(15 + 5 * (1 - t)) + 'px system-ui, sans-serif';
        ctx.fillText(e.valor + '!', e.x, e.y - 14 - 18 * t);
      } else if (t < 0.4) { // acerto comum: faísca curta
        ctx.globalAlpha = 1 - t / 0.4;
        ctx.fillStyle = CORES.guardiao[e.cor].forma;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 3 + 6 * t, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
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
      } else if (ini.tipo === 'colosso') {
        // Rocha espinhosa com uma rachadura brilhante
        ctx.beginPath();
        for (var k2 = 0; k2 < 14; k2++) {
          var a2 = k2 * Math.PI / 7 + estado.tick * 0.004;
          var rr = k2 % 2 ? r * 0.78 : r;
          ctx.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = cor.brilho;
        ctx.shadowColor = cor.brilho;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -r * 0.6); ctx.lineTo(r * 0.15, -r * 0.1);
        ctx.lineTo(-r * 0.1, r * 0.2); ctx.lineTo(r * 0.2, r * 0.6);
        ctx.stroke();
      } else if (ini.tipo === 'coracao') {
        // Cristal-coração pulsante com estilhaços orbitando
        var pul = 1 + 0.08 * Math.sin(estado.tick / 8);
        ctx.save();
        ctx.scale(pul, pul);
        ctx.shadowColor = cor.borda;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, -r * 0.2); ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.8, -r * 0.2); ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = cor.brilho;
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = cor.borda;
        for (var k3 = 0; k3 < 3; k3++) {
          var a3 = estado.tick * 0.05 + k3 * Math.PI * 2 / 3;
          ctx.beginPath();
          ctx.arc(Math.cos(a3) * (r + 8), Math.sin(a3) * (r + 8), 3, 0, Math.PI * 2);
          ctx.fill();
        }
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

      // Lento: anel gelado em volta
      if (ini.lentoTicks > 0) {
        ctx.strokeStyle = CORES.guardiao.geada.forma;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Barra de vida (só quando ferido; chefes usam a barra grande do topo)
      if (!ini.chefe && ini.vida < ini.vidaMax) {
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

    // Onda atual no centro
    var o = estado.ondas, total = GF.dados.ONDAS.length;
    ctx.textAlign = 'center';
    if (o) {
      ctx.fillStyle = CORES.texto;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('Onda ' + Math.max(1, o.atual) + '/' + total, W / 2, 41);
    }

    // Barra do chefe vivo
    var chefe = null;
    for (var i = 0; i < estado.inimigos.length; i++) if (estado.inimigos[i].chefe) { chefe = estado.inimigos[i]; break; }
    if (chefe) {
      var bx = 40, by = 74, bw = W - 80, bh = 10;
      ctx.fillStyle = CORES.inimigo[chefe.tipo].borda;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(GF.dados.INIMIGOS[chefe.tipo].nome, W / 2, by - 10);
      ctx.fillStyle = CORES.barraFundo;
      retArredondado(ctx, bx, by, bw, bh, 5);
      ctx.fill();
      ctx.fillStyle = CORES.vida;
      var frac = Math.max(0, chefe.vida / chefe.vidaMax);
      if (frac > 0) {
        retArredondado(ctx, bx, by, Math.max(bh, bw * frac), bh, 5);
        ctx.fill();
      }
    }
  }

  // Avisos no meio do tabuleiro: contagem antes da onda e nome dela ao começar.
  function desenharAvisoOnda(ctx, estado) {
    var o = estado.ondas;
    if (!o || estado.fase !== 'jogando') return;
    var texto = null, sub = null, cor = CORES.texto, alfa = 1;
    var proxima = GF.dados.ONDAS[o.atual]; // definição da próxima (preparo)
    if (o.fase === 'preparo') {
      var falta = Math.ceil((o.proximaTick - estado.tick) / GF.sim.TICKS_POR_SEG);
      texto = 'Onda ' + (o.atual + 1) + ' em ' + falta;
      if (proxima.chefe) { sub = 'Chefe à vista!'; cor = CORES.vida; }
      else if (o.atual === 0) sub = 'Invoque guardiões e funda cartas iguais';
    } else {
      var desde = estado.tick - o.inicioTick;
      if (desde < 90) {
        var def = GF.dados.ONDAS[o.atual - 1];
        texto = 'Onda ' + o.atual;
        if (def.chefe) { sub = 'Chefe!'; cor = CORES.vida; }
        alfa = desde < 60 ? 1 : 1 - (desde - 60) / 30;
      }
    }
    if (!texto) return;
    ctx.save();
    ctx.globalAlpha = alfa * 0.85;
    ctx.fillStyle = 'rgba(10, 8, 18, 0.8)';
    retArredondado(ctx, 60, 400 - 24, W - 120, sub ? 68 : 48, 12);
    ctx.fill();
    ctx.globalAlpha = alfa;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cor;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(texto, W / 2, 400);
    if (sub) {
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = sub.indexOf('Chefe') === 0 ? cor : CORES.textoFraco;
      ctx.fillText(sub, W / 2, 426);
    }
    ctx.restore();
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

  function desenharIconeEnergia(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = CORES.energia;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, -s);
    ctx.lineTo(-s * 0.6, s * 0.15);
    ctx.lineTo(-s * 0.05, s * 0.15);
    ctx.lineTo(-s * 0.2, s);
    ctx.lineTo(s * 0.6, -s * 0.15);
    ctx.lineTo(s * 0.05, -s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function desenharControles(ctx, laco, estado, info) {
    ctx.textBaseline = 'middle';

    // Energia
    desenharIconeEnergia(ctx, 30, 510, 13);
    ctx.fillStyle = CORES.energia;
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(String(estado.energia), 46, 511);

    // Botão Invocar (treme quando o toque é negado)
    var bi = BOTAO_INVOCAR;
    var ativo = GF.sim.podeInvocar(estado);
    var tremor = info.negado > 0 ? Math.sin(info.negado * 40) * 5 * info.negado : 0;
    ctx.save();
    ctx.translate(tremor, 0);
    ctx.fillStyle = ativo ? CORES.botaoInvocar : CORES.botaoApagado;
    ctx.strokeStyle = ativo ? CORES.botaoInvocarBorda : CORES.botaoApagadoBorda;
    ctx.lineWidth = 2.5;
    retArredondado(ctx, bi.x, bi.y, bi.w, bi.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = ativo ? CORES.texto : CORES.textoFraco;
    ctx.font = 'bold 19px system-ui, sans-serif';
    var cheio = GF.sim.casasLivres(estado).length === 0;
    ctx.fillText(cheio ? 'Cheio' : 'Invocar', bi.x + bi.w / 2, bi.y + 22);
    desenharIconeEnergia(ctx, bi.x + bi.w / 2 - 14, bi.y + 45, 8);
    ctx.fillStyle = estado.energia >= estado.custoInvocar ? CORES.energia : CORES.vida;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(estado.custoInvocar), bi.x + bi.w / 2 - 4, bi.y + 46);
    ctx.restore();

    // Botão de velocidade
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

    // Depuração: só com ?debug=1 na URL
    if (info.debug) {
      ctx.textAlign = 'left';
      ctx.fillStyle = CORES.textoFraco;
      ctx.font = '11px monospace';
      ctx.fillText('tick ' + estado.tick + ' · ' + info.fps + ' fps · ' + estado.inimigos.length +
                   ' inim. · semente ' + estado.semente, 12, H - 34);
    }
  }

  function desenharFim(ctx, estado) {
    if (estado.fase === 'jogando') return;
    var vitoria = estado.fase === 'vitoria';
    var v = vista.visivel;
    ctx.fillStyle = 'rgba(8, 6, 14, 0.82)';
    ctx.fillRect(v.x, v.y, v.w, v.h); // escurece a tela inteira, não só o 360x640

    // Painel
    ctx.fillStyle = '#1b1530';
    ctx.strokeStyle = vitoria ? CORES.base : CORES.vida;
    ctx.lineWidth = 2.5;
    retArredondado(ctx, 40, 150, W - 80, 350, 18);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = vitoria ? CORES.base : CORES.vida;
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText(vitoria ? 'Vitória!' : 'Derrota', W / 2, 200);
    ctx.fillStyle = CORES.textoFraco;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(vitoria ? 'A fenda foi selada.' : 'A fenda venceu desta vez.', W / 2, 234);

    // Estatísticas
    var o = estado.ondas;
    var seg = Math.floor(estado.tick / GF.sim.TICKS_POR_SEG);
    var linhas = [
      ['Onda alcançada', (o ? Math.max(1, o.atual) : 0) + '/' + GF.dados.ONDAS.length],
      ['Vida restante', String(estado.vida)],
      ['Inimigos abatidos', String(estado.abates)],
      ['Fusões', String(estado.fusoes)],
      ['Tempo', Math.floor(seg / 60) + ':' + ('0' + seg % 60).slice(-2)]
    ];
    ctx.font = '15px system-ui, sans-serif';
    for (var i = 0; i < linhas.length; i++) {
      var y = 274 + i * 28;
      ctx.textAlign = 'left';
      ctx.fillStyle = CORES.textoFraco;
      ctx.fillText(linhas[i][0], 70, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = CORES.texto;
      ctx.fillText(linhas[i][1], W - 70, y);
    }

    // Botão "Jogar de novo"
    var b = BOTAO_REINICIAR;
    ctx.fillStyle = CORES.botaoInvocar;
    ctx.strokeStyle = CORES.botaoInvocarBorda;
    retArredondado(ctx, b.x, b.y, b.w, b.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = CORES.texto;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('Jogar de novo', b.x + b.w / 2, b.y + b.h / 2 + 1);
  }

  function desenhar(ctx, estado, laco, info) {
    var k = vista.escala * vista.dpr;
    ctx.setTransform(k, 0, 0, k, vista.ox * vista.dpr, vista.oy * vista.dpr);

    // Partida parada: não interpola (os inimigos ficam onde pararam).
    var alfa = estado.fase === 'jogando' ? GF.loop.alfa(laco) : 1;

    desenharFundo(ctx);
    desenharCaminho(ctx, estado.tick);
    desenharTabuleiro(ctx);
    desenharGuardioes(ctx, estado, alfa, info.arraste);
    desenharInimigos(ctx, estado, alfa);
    desenharProjeteis(ctx, estado, alfa);
    desenharEfeitos(ctx, estado, alfa);

    // Carta arrastada: por cima de tudo, um pouco maior e com sombra
    var a = info.arraste;
    if (a && estado.tabuleiro[a.casa]) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      desenharCarta(ctx, estado.tabuleiro[a.casa], a.x, a.y, 1.12);
      ctx.restore();
    }
    desenharHud(ctx, estado);
    desenharControles(ctx, laco, estado, info);
    desenharAvisoOnda(ctx, estado);
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
    desenharCarta: desenharCarta,
    BOTAO_INVOCAR: BOTAO_INVOCAR,
    BOTAO_VELOCIDADE: BOTAO_VELOCIDADE,
    BOTAO_REINICIAR: BOTAO_REINICIAR
  };
})(window.GF = window.GF || {});
