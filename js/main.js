// Ponto de entrada: liga canvas, entrada do jogador e o laço de quadros.
(function (GF) {
  'use strict';

  var canvas = document.getElementById('tela');
  var ctx = canvas.getContext('2d');

  // Semente: ?semente=123 na URL reproduz uma partida; senão, uma aleatória.
  var param = /[?&]semente=(\d+)/.exec(location.search);
  var semente = param ? parseInt(param[1], 10) : (Date.now() % 1000000000);

  var estado = GF.sim.criarEstado(semente);
  var laco = GF.loop.criar();

  function recomecar() {
    semente = (semente * 7919 + 12345) % 1000000000; // próxima semente, também reproduzível
    estado = GF.sim.criarEstado(semente);
    laco.acumulador = 0;
    ui.arraste = null;
    GF.jogo.estado = estado;
  }

  GF.render.ajustar(canvas);
  window.addEventListener('resize', function () { GF.render.ajustar(canvas); });

  // Estado só da interface (não afeta a simulação).
  //   arraste: carta sendo arrastada { pointerId, casa, id, x, y, elevar }
  var ui = { negado: 0, arraste: null };

  // No toque, a carta arrastada fica um pouco acima do dedo para continuar visível.
  var ELEVAR_TOQUE = 28;

  // Entrada (mouse e toque pelos Pointer Events)
  canvas.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    if (ui.arraste) return; // um arraste por vez (ignora o segundo dedo)
    var p = GF.render.paraLogico(canvas, ev.clientX, ev.clientY);
    if (GF.render.dentro(p, GF.render.BOTAO_VELOCIDADE)) {
      laco.velocidade = laco.velocidade === 1 ? 2 : 1;
      return;
    }
    if (estado.fase !== 'jogando') {
      // Tela de fim: só o botão reinicia (evita recomeçar sem querer).
      if (GF.render.dentro(p, GF.render.BOTAO_REINICIAR)) recomecar();
      return;
    }
    if (GF.render.dentro(p, GF.render.BOTAO_INVOCAR)) {
      // A simulação valida de novo ao aplicar; aqui é só para o aviso visual.
      if (GF.sim.podeInvocar(estado)) GF.sim.agendar(estado, { tipo: 'invocar' });
      else ui.negado = 1;
      return;
    }
    var casa = GF.layout.casaEm(p.x, p.y);
    if (casa >= 0 && estado.tabuleiro[casa]) {
      var elevar = ev.pointerType === 'mouse' ? 0 : ELEVAR_TOQUE;
      ui.arraste = { pointerId: ev.pointerId, casa: casa, id: estado.tabuleiro[casa].id,
                     x: p.x, y: p.y - elevar, elevar: elevar };
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* sem captura: segue funcionando */ }
    }
  });

  canvas.addEventListener('pointermove', function (ev) {
    var a = ui.arraste;
    if (!a || ev.pointerId !== a.pointerId) return;
    ev.preventDefault();
    var p = GF.render.paraLogico(canvas, ev.clientX, ev.clientY);
    a.x = p.x;
    a.y = p.y - a.elevar;
  });

  // Casa sob a carta arrastada (onde ela seria solta), ou -1.
  function alvoDoArraste(a) {
    return GF.layout.casaEm(a.x, a.y);
  }

  canvas.addEventListener('pointerup', function (ev) {
    var a = ui.arraste;
    if (!a || ev.pointerId !== a.pointerId) return;
    ev.preventDefault();
    var p = GF.render.paraLogico(canvas, ev.clientX, ev.clientY);
    a.x = p.x;
    a.y = p.y - a.elevar;
    var para = alvoDoArraste(a);
    var alvo = para >= 0 ? estado.tabuleiro[para] : null;
    if (alvo && GF.sim.podeFundir(estado, a.casa, para, a.id, alvo.id)) {
      GF.sim.agendar(estado, { tipo: 'fundir', de: a.casa, para: para, idDe: a.id, idPara: alvo.id });
    }
    ui.arraste = null; // inválido: a carta simplesmente volta para a casa
  });

  canvas.addEventListener('pointercancel', function (ev) {
    if (ui.arraste && ev.pointerId === ui.arraste.pointerId) ui.arraste = null;
  });

  canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

  // Laço de quadros
  var ultimo = null;
  var fps = 0, quadros = 0, tempoFps = 0;

  function quadro(agora) {
    var dt = ultimo === null ? 0 : (agora - ultimo) / 1000;
    ultimo = agora;

    GF.loop.avancar(laco, estado, dt);

    quadros++;
    tempoFps += dt;
    if (tempoFps >= 0.5) {
      fps = Math.round(quadros / tempoFps);
      quadros = 0;
      tempoFps = 0;
    }

    ui.negado = Math.max(0, ui.negado - dt * 3);

    // A carta arrastada pode ter deixado de existir (fusão já aplicada, partida reiniciada).
    var a = ui.arraste;
    if (a && (!estado.tabuleiro[a.casa] || estado.tabuleiro[a.casa].id !== a.id)) ui.arraste = a = null;

    GF.render.desenhar(ctx, estado, laco, {
      fps: fps,
      negado: ui.negado,
      arraste: a ? { casa: a.casa, x: a.x, y: a.y, alvo: alvoDoArraste(a) } : null
    });
    requestAnimationFrame(quadro);
  }

  // Ao voltar de outra aba, recomeça a contagem de tempo sem "pular".
  document.addEventListener('visibilitychange', function () { ultimo = null; });

  requestAnimationFrame(quadro);

  // Acesso pelo console para depuração.
  GF.jogo = { estado: estado, laco: laco, ui: ui };
})(window.GF = window.GF || {});
