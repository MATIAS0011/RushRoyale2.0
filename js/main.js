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
    GF.jogo.estado = estado;
  }

  GF.render.ajustar(canvas);
  window.addEventListener('resize', function () { GF.render.ajustar(canvas); });

  // Entrada (mouse e toque pelos Pointer Events)
  canvas.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    var p = GF.render.paraLogico(canvas, ev.clientX, ev.clientY);
    if (GF.render.dentro(p, GF.render.BOTAO_VELOCIDADE)) {
      laco.velocidade = laco.velocidade === 1 ? 2 : 1;
      return;
    }
    if (estado.fase !== 'jogando') {
      recomecar();
      return;
    }
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

    GF.render.desenhar(ctx, estado, laco, { fps: fps });
    requestAnimationFrame(quadro);
  }

  // Ao voltar de outra aba, recomeça a contagem de tempo sem "pular".
  document.addEventListener('visibilitychange', function () { ultimo = null; });

  requestAnimationFrame(quadro);

  // Acesso pelo console para depuração.
  GF.jogo = { estado: estado, laco: laco };
})(window.GF = window.GF || {});
