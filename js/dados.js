// Números de balanceamento. Mudou algo aqui? Atualize o DECISOES.md.
(function (GF) {
  'use strict';

  GF.dados = {
    JOGADOR: {
      vidaInicial: 20
    },

    ENERGIA: {
      inicial: 60,
      ticksPorPonto: 30,     // +1 de energia a cada 0,5 s (= 2/s)
      custoInicial: 20,      // custo da 1ª invocação
      aumentoCusto: 10       // cada invocação encarece as próximas em 10
    },

    // Os 5 guardiões. Alcance: o caminho inteiro.
    // dano(nível) = dano * MULT_DANO_NIVEL ^ (nível - 1)   (multiplicativo: ver D26)
    // intervaloTicks = ticks entre ataques (60 = 1 s), antes do buff do Tambor.
    TIPOS_GUARDIAO: ['lanca', 'geada', 'brasa', 'tambor', 'sorte'],
    MULT_DANO_NIVEL: 2.5,
    NIVEL_MAX: 7,      // dois guardiões de nível 7 não se fundem
    VEL_PROJETIL: 420, // px/s
    GUARDIOES: {
      lanca:  { nome: 'Lança',  papel: 'dano único',
                dano: 20, intervaloTicks: 36 },
      geada:  { nome: 'Geada',  papel: 'lentidão',
                dano: 8, intervaloTicks: 60,
                lento: 0.30, lentoPorNivel: 0.05, lentoMax: 0.60, lentoTicks: 120 },
      brasa:  { nome: 'Brasa',  papel: 'dano em área',
                dano: 15, intervaloTicks: 72,
                raio: 40, raioPorNivel: 4 },
      tambor: { nome: 'Tambor', papel: 'suporte (buff)',
                // não ataca; vizinhos ortogonais atacam mais rápido
                buff: 0.20, buffPorNivel: 0.10 },
      sorte:  { nome: 'Sorte',  papel: 'crítico',
                dano: 12, intervaloTicks: 48,
                critChance: 0.25, critPorNivel: 0.05, critMult: 2.5 }
    },

    // vel em px/s (o caminho tem 940 px); dano = vida que tira do jogador ao escapar;
    // energia = recompensa ao ser abatido.
    // A vida final de cada inimigo = vida × multiplicador de vida da onda.
    INIMIGOS: {
      comum:  { nome: 'Fragmento',  vida: 100, vel: 45, dano: 1, raio: 10, energia: 5 },
      rapido: { nome: 'Faísca',     vida: 60,  vel: 75, dano: 1, raio: 8,  energia: 4 },
      tanque: { nome: 'Rocha-oca',  vida: 300, vel: 30, dano: 2, raio: 14, energia: 10 },
      // Chefe da onda 5: resiste a metade da lentidão.
      colosso: { nome: 'Colosso da Fenda', chefe: true, vida: 2500, vel: 22, dano: 10, raio: 22,
                 energia: 60, resistLento: 0.5 },
      // Chefe da onda 10: a cada 4 s solta 2 Fragmentos onde está.
      coracao: { nome: 'Coração da Fenda', chefe: true, vida: 3000, vel: 18, dano: 20, raio: 24,
                 energia: 100, invoca: { tipo: 'comum', quantidade: 2, intervaloTicks: 240 } }
    },

    // ---------- Ondas ----------
    // preparo: segundos antes da onda começar (contagem regressiva na tela).
    // vida: multiplicador de vida de TODOS os inimigos da onda (inclusive chefe e lacaios).
    // grupos: { tipo, n, intervalo (s entre cada um), atraso (s desde o início da onda) }
    // A onda termina quando todos surgiram e não sobrou nenhum vivo.
    ONDAS: [
      { preparo: 10, vida: 0.4, grupos: [ { tipo: 'comum', n: 6, intervalo: 3.5, atraso: 0 } ] },
      { preparo: 6, vida: 0.8, grupos: [
        { tipo: 'comum', n: 8, intervalo: 2, atraso: 0 },
        { tipo: 'rapido', n: 4, intervalo: 1.5, atraso: 6 } ] },
      { preparo: 6, vida: 1.1, grupos: [
        { tipo: 'comum', n: 10, intervalo: 1.5, atraso: 0 },
        { tipo: 'tanque', n: 3, intervalo: 3, atraso: 5 } ] },
      { preparo: 6, vida: 1.4, grupos: [
        { tipo: 'rapido', n: 8, intervalo: 1, atraso: 0 },
        { tipo: 'comum', n: 10, intervalo: 1.2, atraso: 4 },
        { tipo: 'tanque', n: 4, intervalo: 2.5, atraso: 8 } ] },
      { preparo: 8, vida: 1.8, chefe: true, grupos: [
        { tipo: 'comum', n: 8, intervalo: 1, atraso: 0 },
        { tipo: 'colosso', n: 1, intervalo: 0, atraso: 6 } ] },
      { preparo: 6, vida: 2.2, grupos: [
        { tipo: 'comum', n: 12, intervalo: 1, atraso: 0 },
        { tipo: 'rapido', n: 8, intervalo: 0.8, atraso: 6 },
        { tipo: 'tanque', n: 5, intervalo: 2, atraso: 10 } ] },
      { preparo: 6, vida: 2.6, grupos: [
        { tipo: 'tanque', n: 8, intervalo: 1.5, atraso: 0 },
        { tipo: 'rapido', n: 12, intervalo: 0.7, atraso: 4 } ] },
      { preparo: 6, vida: 3.1, grupos: [
        { tipo: 'comum', n: 16, intervalo: 0.8, atraso: 0 },
        { tipo: 'tanque', n: 8, intervalo: 1.5, atraso: 5 },
        { tipo: 'rapido', n: 10, intervalo: 0.6, atraso: 12 } ] },
      { preparo: 6, vida: 3.6, grupos: [
        { tipo: 'rapido', n: 16, intervalo: 0.5, atraso: 0 },
        { tipo: 'tanque', n: 10, intervalo: 1.2, atraso: 4 },
        { tipo: 'comum', n: 16, intervalo: 0.6, atraso: 10 } ] },
      { preparo: 8, vida: 4.2, chefe: true, grupos: [
        { tipo: 'tanque', n: 6, intervalo: 1.5, atraso: 0 },
        { tipo: 'coracao', n: 1, intervalo: 0, atraso: 8 } ] }
    ]
  };
})(window.GF = window.GF || {});
