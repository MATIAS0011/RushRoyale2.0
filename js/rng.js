// Gerador de números aleatórios com semente (mulberry32).
// O estado é um objeto simples { s }, guardado dentro do estado da simulação,
// para que a partida inteira seja reproduzível a partir da semente.
(function (GF) {
  'use strict';

  function criar(semente) {
    return { s: (semente >>> 0) || 1 };
  }

  // Retorna um número em [0, 1).
  function proximo(r) {
    r.s = (r.s + 0x6D2B79F5) >>> 0;
    var t = r.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Inteiro em [0, n).
  function inteiro(r, n) {
    return Math.floor(proximo(r) * n);
  }

  GF.rng = { criar: criar, proximo: proximo, inteiro: inteiro };
})(window.GF = window.GF || {});
