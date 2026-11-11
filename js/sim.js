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
      fusoes: 0,
      tabuleiro: tabuleiro,     // 15 casas; null = livre, ou { id, tipo, nivel, criadoTick }
      inimigos: [],
      projeteis: [],
      efeitos: [],              // só visuais (explosões, críticos); expiram sozinhos
      proximoId: 1,
      // Controle das ondas. semOndas: cenários de teste sem inimigos automáticos.
      ondas: opcoes.semOndas ? null : {
        atual: 0,                 // 0 = ainda na preparação da 1ª onda
        fase: 'preparo',          // 'preparo' (contagem) | 'ativa'
        inicioTick: 0,            // tick em que a onda atual começou
        proximaTick: segundosEmTicks(GF.dados.ONDAS[0].preparo),
        pendentes: []             // surgimentos da onda atual: { tick, tipo }
      }
    };
  }

  function segundosEmTicks(s) {
    return Math.round(s * TICKS_POR_SEG);
  }

  function agendar(estado, acao) {
    estado.fila.push(acao);
  }

  // Tipos desconhecidos são ignorados, mas registrados.
  function aplicarAcao(estado, acao) {
    if (acao.tipo === 'invocar') invocar(estado);
    else if (acao.tipo === 'fundir') fundir(estado, acao.de, acao.para, acao.idDe, acao.idPara);
  }

  // ---------- Fusão ----------
  // Duas cartas do mesmo tipo e nível, em casas diferentes, abaixo do nível máximo.
  // idDe/idPara (opcionais) garantem que são as mesmas cartas que o jogador arrastou.
  function podeFundir(estado, de, para, idDe, idPara) {
    if (estado.fase !== 'jogando' || de === para) return false;
    var a = estado.tabuleiro[de], b = estado.tabuleiro[para];
    if (!a || !b) return false;
    if (idDe !== undefined && a.id !== idDe) return false;
    if (idPara !== undefined && b.id !== idPara) return false;
    return a.tipo === b.tipo && a.nivel === b.nivel && a.nivel < GF.dados.NIVEL_MAX;
  }

  // A carta arrastada (de) some; na casa de destino (para) nasce um guardião
  // de nível +1 com tipo sorteado. Retorna o novo guardião, ou null se inválido.
  function fundir(estado, de, para, idDe, idPara) {
    if (!podeFundir(estado, de, para, idDe, idPara)) return null;
    var nivel = estado.tabuleiro[para].nivel + 1;
    var tipos = GF.dados.TIPOS_GUARDIAO;
    var tipo = tipos[GF.rng.inteiro(estado.rng, tipos.length)];
    estado.tabuleiro[de] = null;
    var novo = criarGuardiao(estado, tipo, nivel);
    estado.tabuleiro[para] = novo;
    estado.fusoes++;
    var c = GF.layout.casa(para);
    estado.efeitos.push({ tipo: 'fusao', x: c.cx, y: c.cy, tick: estado.tick, cor: tipo });
    return novo;
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
  // multVida: multiplicador de vida da onda (padrão 1).
  function criarInimigo(estado, tipo, multVida) {
    var def = GF.dados.INIMIGOS[tipo];
    var vida = def.vida * (multVida || 1);
    var ini = {
      id: estado.proximoId++,
      tipo: tipo,
      chefe: !!def.chefe,
      dist: 0,          // distância percorrida no caminho
      distAnt: 0,       // distância no passo anterior (para interpolar o desenho)
      vida: vida,
      vidaMax: vida,
      multVida: multVida || 1,
      vel: def.vel,
      dano: def.dano,
      raio: def.raio,
      lentoFator: 0,    // fração de velocidade perdida (0,3 = 30% mais lento)
      lentoTicks: 0     // quanto tempo a lentidão ainda dura
    };
    if (def.invoca) ini.recargaInvocar = def.invoca.intervaloTicks;
    estado.inimigos.push(ini);
    return ini;
  }

  // Chefes que invocam lacaios (Coração da Fenda): os lacaios surgem na posição
  // do chefe, com o mesmo multiplicador de vida.
  function habilidadesChefes(estado) {
    var n = estado.inimigos.length; // lacaios criados agora só agem no próximo passo
    for (var i = 0; i < n; i++) {
      var ini = estado.inimigos[i];
      var inv = GF.dados.INIMIGOS[ini.tipo].invoca;
      if (!inv) continue;
      if (--ini.recargaInvocar > 0) continue;
      ini.recargaInvocar = inv.intervaloTicks;
      for (var k = 0; k < inv.quantidade; k++) {
        var l = criarInimigo(estado, inv.tipo, ini.multVida);
        l.dist = l.distAnt = Math.max(0, ini.dist - 6 * k);
      }
    }
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

  // ---------- Ondas ----------
  function iniciarOnda(estado) {
    var o = estado.ondas;
    o.atual++;
    o.fase = 'ativa';
    o.inicioTick = estado.tick;
    var def = GF.dados.ONDAS[o.atual - 1];
    var lista = [];
    for (var g = 0; g < def.grupos.length; g++) {
      var gr = def.grupos[g];
      for (var k = 0; k < gr.n; k++) {
        lista.push({ tick: estado.tick + segundosEmTicks(gr.atraso + k * gr.intervalo),
                     tipo: gr.tipo, ordem: lista.length });
      }
    }
    // Ordena por tick; empate mantém a ordem de definição (sort estável manual).
    lista.sort(function (a, b) { return a.tick - b.tick || a.ordem - b.ordem; });
    o.pendentes = lista;
  }

  // Começa ondas e faz os inimigos surgirem na hora certa.
  function surgirInimigos(estado) {
    var o = estado.ondas;
    if (!o) return;
    if (o.fase === 'preparo' && estado.tick >= o.proximaTick) iniciarOnda(estado);
    if (o.fase !== 'ativa') return;
    var mult = GF.dados.ONDAS[o.atual - 1].vida;
    while (o.pendentes.length && o.pendentes[0].tick <= estado.tick) {
      criarInimigo(estado, o.pendentes.shift().tipo, mult);
    }
  }

  // Onda limpa (tudo surgiu e ninguém sobrou): vitória na última, senão preparo da próxima.
  function verificarFimDeOnda(estado) {
    var o = estado.ondas;
    if (!o || o.fase !== 'ativa' || estado.fase !== 'jogando') return;
    if (o.pendentes.length || estado.inimigos.length) return;
    if (o.atual >= GF.dados.ONDAS.length) {
      estado.fase = 'vitoria';
      return;
    }
    o.fase = 'preparo';
    o.proximaTick = estado.tick + segundosEmTicks(GF.dados.ONDAS[o.atual].preparo);
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

    // 3) Ondas: surgimento de inimigos e habilidades dos chefes
    surgirInimigos(estado);
    habilidadesChefes(estado);

    // 4) Guardiões atacam; projéteis voam e acertam
    GF.combate.atualizarGuardioes(estado);
    GF.combate.atualizarProjeteis(estado);

    // 5) Movimento e escapes (pode dar derrota)
    moverInimigos(estado);

    // 6) Fim de onda / vitória (a derrota no mesmo passo tem prioridade)
    verificarFimDeOnda(estado);

    // 7) Efeitos visuais vencidos
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
      fusoes: estado.fusoes,
      energia: estado.energia,
      custoInvocar: estado.custoInvocar,
      ondas: estado.ondas,
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
    podeFundir: podeFundir,
    fundir: fundir,
    casasLivres: casasLivres,
    resumo: resumo
  };
})(window.GF = window.GF || {});
