// Simulação do jogo. Regras:
//  - Só avança em passos fixos (GF.sim.DT). Nada aqui lê relógio, FPS ou Math.random.
//  - Toda aleatoriedade vem de estado.rng.
//  - Ações do jogador entram numa fila e são aplicadas no início do próximo passo,
//    ficando registradas com o número do tick (permite replay e testes).
(function (GF) {
  'use strict';

  var TICKS_POR_SEG = 60;
  var DT = 1 / TICKS_POR_SEG;

  // Dimensões lógicas do mundo (retrato 9:16). O render escala isso para a tela.
  var LARGURA = 360;
  var ALTURA = 640;

  function criarEstado(semente, opcoes) {
    opcoes = opcoes || {};
    var tabuleiro = [];
    for (var i = 0; i < GF.layout.CASAS; i++) tabuleiro.push(null);

    return {
      semente: semente,
      tick: 0,
      fase: 'jogando',          // 'jogando' | 'derrota' | 'vitoria'
      rng: GF.rng.criar(semente),
      fila: [],                 // ações aguardando o próximo passo
      registro: [],             // ações já aplicadas: { tick, acao }
      vida: GF.dados.JOGADOR.vidaInicial,
      energia: GF.dados.ENERGIA.inicial,   // sempre inteira
      custoInvocar: GF.dados.ENERGIA.custoInicial,
      invocacoes: 0,
      abates: 0,
      tabuleiro: tabuleiro,     // 15 casas; null = livre, ou { id, tipo, nivel, criadoTick }
      inimigos: [],
      projeteis: [],
      efeitos: [],              // só visuais (explosões, críticos); expiram sozinhos
      proximoId: 1,
      demo: opcoes.semDemo ? null : { proximo: GF.dados.DEMO.primeiroTick }
    };
  }

  function agendar(estado, acao) {
    estado.fila.push(acao);
  }

  // Tipos desconhecidos são ignorados, mas registrados.
  function aplicarAcao(estado, acao) {
    if (acao.tipo === 'invocar') invocar(estado);
  }

  // ---------- Energia e invocação ----------
  function casasLivres(estado) {
    var livres = [];
    for (var i = 0; i < estado.tabuleiro.length; i++) if (!estado.tabuleiro[i]) livres.push(i);
    return livres;
  }

  // Também usada pela interface para mostrar o botão apagado; mas quem decide é invocar().
  function podeInvocar(estado) {
    return estado.fase === 'jogando' &&
           estado.energia >= estado.custoInvocar &&
           casasLivres(estado).length > 0;
  }

  // Coloca um guardião aleatório de nível 1 numa casa livre aleatória.
  // Retorna o índice da casa, ou -1 se não foi possível (nada muda nesse caso).
  function invocar(estado) {
    if (!podeInvocar(estado)) return -1;
    var livres = casasLivres(estado);
    var casa = livres[GF.rng.inteiro(estado.rng, livres.length)];
    var tipos = GF.dados.TIPOS_GUARDIAO;
    var tipo = tipos[GF.rng.inteiro(estado.rng, tipos.length)];

    estado.energia -= estado.custoInvocar;
    estado.invocacoes++;
    estado.custoInvocar += GF.dados.ENERGIA.aumentoCusto;
    estado.tabuleiro[casa] = criarGuardiao(estado, tipo, 1);
    return casa;
  }

  // recarga 0 = pronto para atacar assim que houver alvo.
  function criarGuardiao(estado, tipo, nivel) {
    return { id: estado.proximoId++, tipo: tipo, nivel: nivel, criadoTick: estado.tick, recarga: 0 };
  }

  function ganharEnergiaPorTempo(estado) {
    // tick 0 não conta, para não ganhar energia de graça no início
    if (estado.tick > 0 && estado.tick % GF.dados.ENERGIA.ticksPorPonto === 0) estado.energia++;
  }

  // ---------- Inimigos ----------
  function criarInimigo(estado, tipo) {
    var def = GF.dados.INIMIGOS[tipo];
    var ini = {
      id: estado.proximoId++,
      tipo: tipo,
      dist: 0,          // distância percorrida no caminho
      distAnt: 0,       // distância no passo anterior (para interpolar o desenho)
      vida: def.vida,
      vidaMax: def.vida,
      vel: def.vel,
      dano: def.dano,
      raio: def.raio,
      lentoFator: 0,    // fração de velocidade perdida (0,3 = 30% mais lento)
      lentoTicks: 0     // quanto tempo a lentidão ainda dura
    };
    estado.inimigos.push(ini);
    return ini;
  }

  // Ponto único por onde todo dano passa (usado pelos guardiões na etapa 4).
  // Retorna true se o inimigo morreu.
  function causarDano(estado, ini, dano) {
    if (ini.vida <= 0) return false; // já morto neste passo
    ini.vida -= dano;
    if (ini.vida > 0) return false;
    ini.vida = 0;
    var idx = estado.inimigos.indexOf(ini);
    if (idx >= 0) estado.inimigos.splice(idx, 1);
    estado.energia += GF.dados.INIMIGOS[ini.tipo].energia;
    estado.abates++;
    return true;
  }

  function moverInimigos(estado) {
    var fim = GF.layout.COMPRIMENTO;
    for (var i = estado.inimigos.length - 1; i >= 0; i--) {
      var ini = estado.inimigos[i];
      ini.distAnt = ini.dist;
      var fator = 1;
      if (ini.lentoTicks > 0) {
        fator = 1 - ini.lentoFator;
        ini.lentoTicks--;
        if (ini.lentoTicks === 0) ini.lentoFator = 0;
      }
      ini.dist += ini.vel * fator * DT;
      if (ini.dist >= fim) {
        estado.inimigos.splice(i, 1);
        estado.vida -= ini.dano;
      }
    }
    if (estado.vida <= 0) {
      estado.vida = 0;
      estado.fase = 'derrota';
    }
  }

  function gerarDemo(estado) {
    var d = estado.demo;
    if (!d || estado.tick < d.proximo) return;
    var tipos = GF.dados.DEMO.tipos;
    criarInimigo(estado, tipos[GF.rng.inteiro(estado.rng, tipos.length)]);
    d.proximo += GF.dados.DEMO.intervaloTicks;
  }

  // ---------- Passo ----------
  function passo(estado) {
    // Partida encerrada: o mundo congela.
    if (estado.fase !== 'jogando') return;

    // 1) Ações do jogador
    for (var i = 0; i < estado.fila.length; i++) {
      var acao = estado.fila[i];
      aplicarAcao(estado, acao);
      estado.registro.push({ tick: estado.tick, acao: acao });
    }
    estado.fila.length = 0;

    // 2) Energia passiva
    ganharEnergiaPorTempo(estado);

    // 3) Surgimento de inimigos
    gerarDemo(estado);

    // 4) Guardiões atacam; projéteis voam e acertam
    GF.combate.atualizarGuardioes(estado);
    GF.combate.atualizarProjeteis(estado);

    // 5) Movimento e escapes
    moverInimigos(estado);

    // 6) Efeitos visuais vencidos
    GF.combate.limparEfeitos(estado);

    estado.tick++;
  }

  // Resumo do estado usado para comparar execuções nos testes.
  function resumo(estado) {
    return JSON.stringify({
      tick: estado.tick,
      fase: estado.fase,
      rng: estado.rng.s,
      vida: estado.vida,
      abates: estado.abates,
      energia: estado.energia,
      custoInvocar: estado.custoInvocar,
      tabuleiro: estado.tabuleiro,
      inimigos: estado.inimigos,
      projeteis: estado.projeteis
    });
  }

  GF.sim = {
    TICKS_POR_SEG: TICKS_POR_SEG,
    DT: DT,
    LARGURA: LARGURA,
    ALTURA: ALTURA,
    criarEstado: criarEstado,
    agendar: agendar,
    passo: passo,
    criarInimigo: criarInimigo,
    causarDano: causarDano,
    podeInvocar: podeInvocar,
    invocar: invocar,
    criarGuardiao: criarGuardiao,
    casasLivres: casasLivres,
    resumo: resumo
  };
})(window.GF = window.GF || {});
