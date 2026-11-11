// Geometria do mundo lógico (360 x 640): caminho e tabuleiro.
// Usado pela simulação (posições, alcance) e pelo desenho/toque.
(function (GF) {
  'use strict';

  // ---------- Caminho (em U, contornando o tabuleiro) ----------
  // Entra embaixo à esquerda, sobe, cruza por cima e desce até a saída à direita.
  var PONTOS = [
    { x: 20,  y: 440 },
    { x: 20,  y: 130 },
    { x: 340, y: 130 },
    { x: 340, y: 440 }
  ];
  var LARGURA_CAMINHO = 32;

  // Comprimento acumulado no início de cada segmento.
  var acumulado = [0];
  for (var i = 1; i < PONTOS.length; i++) {
    var dx = PONTOS[i].x - PONTOS[i - 1].x;
    var dy = PONTOS[i].y - PONTOS[i - 1].y;
    acumulado.push(acumulado[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  var COMPRIMENTO = acumulado[acumulado.length - 1];

  // Ponto do caminho a uma distância d do início (limitada a [0, COMPRIMENTO]).
  function posicao(d) {
    if (d <= 0) return { x: PONTOS[0].x, y: PONTOS[0].y };
    for (var i = 1; i < PONTOS.length; i++) {
      if (d <= acumulado[i]) {
        var a = PONTOS[i - 1], b = PONTOS[i];
        var t = (d - acumulado[i - 1]) / (acumulado[i] - acumulado[i - 1]);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    var fim = PONTOS[PONTOS.length - 1];
    return { x: fim.x, y: fim.y };
  }

  // ---------- Tabuleiro 5 colunas x 3 linhas ----------
  var COLUNAS = 5;
  var LINHAS = 3;
  var CASA = 56;
  var TAB_X = 40;
  var TAB_Y = 160;

  // Retângulo da casa i (0..14, linha a linha, da esquerda para a direita).
  function casa(i) {
    var col = i % COLUNAS;
    var lin = Math.floor(i / COLUNAS);
    return { x: TAB_X + col * CASA, y: TAB_Y + lin * CASA, w: CASA, h: CASA,
             cx: TAB_X + col * CASA + CASA / 2, cy: TAB_Y + lin * CASA + CASA / 2 };
  }

  // Índice da casa sob o ponto (coordenadas lógicas), ou -1.
  function casaEm(x, y) {
    var col = Math.floor((x - TAB_X) / CASA);
    var lin = Math.floor((y - TAB_Y) / CASA);
    if (col < 0 || col >= COLUNAS || lin < 0 || lin >= LINHAS) return -1;
    return lin * COLUNAS + col;
  }

  GF.layout = {
    PONTOS: PONTOS,
    LARGURA_CAMINHO: LARGURA_CAMINHO,
    COMPRIMENTO: COMPRIMENTO,
    posicao: posicao,
    COLUNAS: COLUNAS,
    LINHAS: LINHAS,
    CASAS: COLUNAS * LINHAS,
    CASA: CASA,
    TABULEIRO: { x: TAB_X, y: TAB_Y, w: COLUNAS * CASA, h: LINHAS * CASA },
    casa: casa,
    casaEm: casaEm
  };
})(window.GF = window.GF || {});
