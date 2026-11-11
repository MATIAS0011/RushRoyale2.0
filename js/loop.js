// Laço de passo fixo com acumulador.
// O tempo real (que varia com o FPS) só decide QUANTOS passos rodar,
// nunca o tamanho do passo. A velocidade (1x/2x) multiplica o tempo acumulado.
(function (GF) {
  'use strict';

  var DT_MAX_QUADRO = 0.25; // ignora saltos maiores (aba em segundo plano, travadas)
  var MAX_PASSOS_QUADRO = 240;

  function criar() {
    return { acumulador: 0, velocidade: 1, pausado: false };
  }

  // Avança a simulação segundo dtReal (segundos). Retorna o nº de passos executados.
  function avancar(laco, estado, dtReal) {
    if (laco.pausado) return 0;
    if (dtReal > DT_MAX_QUADRO) dtReal = DT_MAX_QUADRO;
    if (dtReal < 0) dtReal = 0;

    laco.acumulador += dtReal * laco.velocidade;
    var passos = 0;
    while (laco.acumulador >= GF.sim.DT && passos < MAX_PASSOS_QUADRO) {
      GF.sim.passo(estado);
      laco.acumulador -= GF.sim.DT;
      passos++;
    }
    if (passos === MAX_PASSOS_QUADRO) laco.acumulador = 0; // não acumula atraso infinito
    return passos;
  }

  // Fração [0,1) entre o último passo e o próximo, para interpolar o desenho.
  function alfa(laco) {
    return laco.acumulador / GF.sim.DT;
  }

  GF.loop = { criar: criar, avancar: avancar, alfa: alfa };
})(window.GF = window.GF || {});
