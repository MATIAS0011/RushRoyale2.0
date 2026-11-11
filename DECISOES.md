# Guardiões da Fenda: regras e decisões

Jogo de navegador de defesa com cartas que se fundem. Nome, personagens e visual originais.

## Como rodar

- **Jogar:** abrir `index.html` com dois cliques. Não precisa de servidor.
- **Testes:** abrir `testes.html` com dois cliques, ou pelo terminal:
  `msedge --headless --dump-dom file:///C:/jogos/RushRoyale2.0/testes.html`
- **Reproduzir uma partida:** `index.html?semente=123`.

---

## Regras do jogo (escopo v0.1)

> Os números de balanceamento entram aqui conforme cada etapa for feita.

- Tabuleiro de **5 colunas × 3 linhas** (15 casas). Os inimigos andam por um caminho em volta dele.
- **Invocar:** coloca um guardião aleatório de nível 1 numa casa livre. O custo sobe a cada uso.
- **Fusão:** arrastar um guardião sobre outro **do mesmo tipo e do mesmo nível** gera um guardião de nível +1 e **tipo sorteado**.
- **10 ondas**, com chefe nas ondas 5 e 10. O jogador tem vida. Cada inimigo que chega ao fim do caminho tira vida.
- **Vitória:** derrotar a onda 10 inteira (chefe e lacaios). **Derrota:** a vida chega a 0.

### Ondas (em `js/dados.js`, `ONDAS`)
- Antes de cada onda há uma **preparação com contagem regressiva**: 10 s antes da onda 1, 8 s antes das ondas de chefe e 6 s antes das demais. A energia passiva continua correndo.
- **Uma onda termina** quando todos os seus inimigos já surgiram e nenhum está vivo (abatido ou escapado). Só então começa a preparação da próxima.
- **A vida de todos os inimigos da onda** (inclusive chefes e lacaios) é a vida base × o multiplicador da onda.

| Onda | Vida | Inimigos | Total |
|---|---|---|---|
| 1 | ×0,4 | 6 Fragmentos, um a cada 3,5 s | 6 |
| 2 | ×0,8 | 8 Fragmentos + 4 Faíscas | 12 |
| 3 | ×1,1 | 10 Fragmentos + 3 Rochas-ocas | 13 |
| 4 | ×1,4 | 8 Faíscas + 10 Fragmentos + 4 Rochas-ocas | 22 |
| **5** | ×1,8 | 8 Fragmentos + **Colosso da Fenda** | 9 |
| 6 | ×2,2 | 12 Fragmentos + 8 Faíscas + 5 Rochas-ocas | 25 |
| 7 | ×2,6 | 8 Rochas-ocas + 12 Faíscas | 20 |
| 8 | ×3,1 | 16 Fragmentos + 8 Rochas-ocas + 10 Faíscas | 34 |
| 9 | ×3,6 | 16 Faíscas + 10 Rochas-ocas + 16 Fragmentos | 42 |
| **10** | ×4,2 | 6 Rochas-ocas + **Coração da Fenda** (+ lacaios) | 7+ |

### Chefes
| Chefe | Onda | Vida base (na onda) | Velocidade | Dano ao escapar | Energia | Habilidade |
|---|---|---|---|---|---|---|
| Colosso da Fenda (rocha espinhosa com rachadura) | 5 | 2500 (4500) | 22 px/s | 10 | 60 | resiste a metade da lentidão |
| Coração da Fenda (cristal-coração pulsante) | 10 | 3000 (12 600) | 18 px/s | 20 (derrota na hora) | 100 | a cada 4 s solta 2 Fragmentos onde está, com a vida da onda |

Enquanto um chefe está vivo, uma barra de vida com o nome dele aparece no topo.

### Fim de partida
- As telas de **Vitória** e **Derrota** mostram a onda alcançada, a vida restante, os abates, as fusões e o tempo.
- **Só o botão "Jogar de novo" reinicia.** Tocar em outro lugar não faz nada.

### Jogador e caminho
- **Vida inicial: 20.** Cada inimigo que chega ao fim tira o seu `dano`. A vida nunca fica negativa.
- **Caminho em U, com 940 px:** entra embaixo à esquerda (a fenda), sobe, cruza por cima do tabuleiro e desce até a saída embaixo à direita (o cristal).

### Inimigos (em `js/dados.js`)
| Tipo | Nome | Vida | Velocidade | Dano ao escapar | Tempo para cruzar |
|---|---|---|---|---|---|
| comum | Fragmento (bolha roxa com olho) | 100 | 45 px/s | 1 | ~21 s |
| rapido | Faísca (gota azul) | 60 | 75 px/s | 1 | ~12,5 s |
| tanque | Rocha-oca (octógono marrom) | 300 | 30 px/s | 2 | ~31 s |

Os inimigos não se bloqueiam: os rápidos ultrapassam os lentos.

### Os 5 guardiões

| Guardião | Papel | Visual |
|---|---|---|
| Lança | dano único, tiro rápido | triângulo laranja |
| Geada | deixa o alvo mais lento | hexágono azul-claro |
| Brasa | dano em área | círculo vermelho |
| Tambor | buff de velocidade de ataque nos vizinhos | quadrado verde |
| Sorte | chance alta de crítico | losango amarelo |

Cada carta mostra a forma do guardião sobre um fundo escuro da mesma cor. O **nível** aparece em pontinhos brancos na base (1 a 7).

### Energia e invocação (em `js/dados.js`)
- A partida começa com **60 de energia**. A energia é sempre um número inteiro.
- **Energia passiva:** +1 a cada 0,5 s (120 por minuto).
- **Abates:** Fragmento +5, Faísca +4, Rocha-oca +10. Dano parcial não dá nada.
- **Custo da invocação:** começa em **20** e sobe **+10 a cada invocação** (20, 30, 40…). Preencher as 15 casas custa 1350 no total. O custo só sobe ao invocar, nunca ao fundir.
- **Invocar:** escolhe uma casa livre ao acaso e um dos 5 guardiões ao acaso (chances iguais), sempre de nível 1.
- **Não dá para invocar** sem energia suficiente, com o tabuleiro cheio ou com a partida encerrada. Nesses casos nada é gasto, e o botão aparece apagado (com "Cheio" quando o tabuleiro está lotado) e treme se for tocado.

### Fusão
- **Como fundir:** arraste uma carta (toque ou mouse) e solte sobre outra **do mesmo tipo e do mesmo nível**.
- **Resultado:** a carta arrastada some. Na casa de destino nasce um guardião **de nível +1, com tipo sorteado** entre os 5 (chances iguais, inclusive o tipo original), pronto para atacar.
- **Nível máximo: 7.** Dois guardiões de nível 7 não se fundem.
- A fusão **não gasta energia** e **não muda o custo de invocar**.
- **Soltar em lugar inválido** (carta diferente, casa vazia, fora do tabuleiro) faz a carta voltar para o lugar, sem nenhum efeito.
- **Durante o arraste:** a carta de origem fica apagada, todas as cartas compatíveis brilham e a que está sob a carta arrastada brilha mais forte. Ao fundir, um anel e faíscas na cor do novo guardião.

### Combate (em `js/dados.js` e `js/combate.js`)
- **Alcance:** todo guardião alcança o caminho inteiro.
- **Alvo:** o inimigo **mais avançado** no caminho (empate: o que surgiu primeiro). Exceção: a **Geada prefere o mais avançado que ainda não está lento**. Se todos estiverem lentos, mira o mais avançado.
- **Dano por nível (multiplicativo):** `dano base × 2,5^(nível − 1)`. Ou seja, nível 2 = 2,5×, nível 3 = 6,25×, nível 4 ≈ 15,6×, nível 5 ≈ 39×, nível 6 ≈ 98×, nível 7 ≈ 244×. **Regra:** um guardião de nível n+1 causa pelo menos o dobro do dano do nível n, então fundir duas cartas nunca diminui o dano (ver D26).
- **Projéteis** voam a 420 px/s, perseguindo o alvo. Se o alvo morrer ou escapar antes, o projétil some sem efeito.
- Um guardião recém-invocado já está pronto e dispara assim que houver um inimigo.

| Guardião | Dano base | Intervalo | Efeito | Por nível |
|---|---|---|---|---|
| Lança | 20 | 0,6 s | — | só o dano |
| Geada | 8 | 1,0 s | lentidão de 30% por 2 s | +5% de lentidão (máx. 60%) |
| Brasa | 15 | 1,2 s | explosão de raio 40 px, atinge todos no raio | +4 px de raio |
| Tambor | — | — | não ataca; vizinhos (cima, baixo, esquerda, direita) atacam 20% mais rápido | +10% de buff |
| Sorte | 12 | 0,8 s | 25% de chance de crítico com 2,5× de dano | +5% de chance |

- **A lentidão não se acumula:** vale a mais forte ativa, e um novo acerto renova a duração para 2 s.
- **O buff do Tambor não se acumula:** vale o Tambor vizinho mais forte. A diagonal não conta.

---

## Pendências de balanceamento

> Os números **não** foram alterados por causa disto. Revisão prevista para as etapas 6 (ondas de verdade) e 7 (balanceamento).

**QA após a etapa 4:** 50 partidas automáticas, com um robô que invoca sempre que pode, o fluxo de demonstração (D13) e limite de 10 min por partida.

| Baralho | Sobreviveu aos 10 min |
|---|---|
| Só Lança | 10/10 |
| Só Brasa | 7/10 |
| Baralho normal (os 5 guardiões) | 4/10 |
| Só Sorte | 1/10 |
| Só Geada | 0/10 (morre em ~48 s) |

**Conclusões**
- **A Lança domina em dano por segundo.** Precisa ser comparada com Sorte e Brasa e reequilibrada.
- **O começo da partida é apertado demais.** As derrotas acontecem entre 45 e 76 s, com só 4 ou 5 cartas no tabuleiro. Isso se liga à D22: um começo sem guardiões de dano perde.

**QA da etapa 5:** 60 partidas, mesmo robô, sem fundir contra fundindo sempre.
- **Antes:** a fusão enfraquecia o jogador. Sem fundir sobreviveram 8/20; fundindo sempre, só 3/20. **Resolvido pela D26.**
- **Depois da D26** (QA interno, sementes 1 a 40): fundindo sempre 24/40, sem fundir 15/40.
- **Ainda pendente:** mesmo fundindo, as derrotas restantes caem entre 45 e 64 s. É o começo apertado de cima, que a fusão não resolve.

**QA da etapa 6** (ondas de verdade, sementes 1 a 40): fundindo sempre 17/40, sem fundir 0/40, e ninguém que só invoca perde vida na onda 1 (ver D28 e D29). Ainda pendente: o robô que funde sempre perdeu vida na onda 1 em 2/40 partidas. Nos dois casos ele fundiu as **duas únicas cartas de dano** que tinha e o sorteio deu um Tambor de nível 2, que não ataca. Um humano dificilmente faz isso, mas é o mesmo risco do Tambor descrito abaixo.

**O Tambor não escala com o nível.** O dano multiplicativo não o afeta, porque ele não causa dano. Testei o buff por nível em +10%, +20% e +30% e não houve diferença mensurável (24, 23 e 23 de 40 vitórias fundindo), então ele ficou em +10%. Rever na etapa 7: fundir e sortear um Tambor ainda pode enfraquecer o tabuleiro.

---

## Decisões técnicas

### D1. JavaScript puro, scripts clássicos e um namespace global
Os arquivos usam `<script src>` comuns, sem `type="module"`. Navegadores bloqueiam módulos ES via `file://`, e a regra é abrir o jogo com dois cliques. Cada arquivo é um IIFE que pendura sua parte em `window.GF` (`GF.rng`, `GF.sim`, `GF.loop`, `GF.render`). Por isso a ordem dos scripts no HTML importa.

### D2. A simulação fica separada do desenho
- `js/sim.js` tem toda a lógica. Não toca no DOM, no canvas, no relógio nem em `Math.random`.
- `js/render.js` só lê o estado.
- `js/main.js` liga entrada, laço e desenho.

Isso permite testar a lógica sem tela.

### D3. Passo de tempo fixo (1/60 s) com acumulador
`js/loop.js` acumula o tempo real de cada quadro (multiplicado pela velocidade 1x/2x) e roda quantos passos fixos de `DT = 1/60 s` couberem. O FPS decide **quantos** passos rodam, nunca o **tamanho** do passo. Proteções:
- um quadro conta no máximo 0,25 s (aba em segundo plano ou travada);
- no máximo 240 passos por quadro, para evitar espiral de travamento;
- ao voltar de outra aba, a contagem de tempo recomeça.

### D4. Aleatoriedade com semente
O gerador é o mulberry32 (`js/rng.js`). Seu estado (`{ s }`) fica **dentro** do estado da simulação. Mesma semente + mesmas ações nos mesmos ticks = mesma partida.

### D5. Ações do jogador entram por fila e são registradas por tick
A entrada nunca altera o estado diretamente. Ela chama `GF.sim.agendar(estado, acao)`, e a ação é aplicada no início do próximo passo e guardada em `estado.registro` com o número do tick. Isso permite replay e testes de determinismo com ações. A velocidade (1x/2x) **não** é uma ação da simulação: só muda quanto tempo real vira passos.

### D6. Mundo lógico de 360 × 640 (retrato 9:16), escalado para a tela
Toda a lógica e o desenho usam coordenadas lógicas. O CSS dimensiona o canvas como o maior 9:16 que cabe (`min(100vw, 100dvh·9/16)`). O `dvh` acompanha a barra do navegador móvel. O JS lê o tamanho real do elemento e ajusta a resolução interna pelo `devicePixelRatio`, para ficar nítido. Em celulares mais compridos que 9:16 sobram faixas escuras em cima e embaixo. **Pendência:** isso será resolvido na etapa 7 (polimento).

### D7. Entrada por Pointer Events
Mouse e toque usam o mesmo código (`pointerdown`/`pointermove`/`pointerup`). O CSS desliga zoom, rolagem, seleção e menu de toque longo (`touch-action: none` e outros).

### D8. Testes no navegador, sem Node
A máquina de desenvolvimento não tem Node. Os testes rodam numa página (`testes.html` + `testes/testes.js`) que carrega só a lógica. Ela abre com dois cliques ou no Edge headless (`--dump-dom`). O teste de determinismo roda a mesma partida (semente e ações iguais) pelo laço real a 20, 30, 60 e 144 FPS, com FPS irregular e em 2x, e exige estado final idêntico ao da execução passo a passo.

### D9. Layout fixo do mundo lógico (`js/layout.js`)
- **HUD** no topo (y < 90).
- **Caminho:** pontos (20,440) → (20,130) → (340,130) → (340,440), 32 px de largura.
- **Tabuleiro:** casas de 56 px a partir de (40,160), indo até (320,328). As casas são numeradas de 0 a 14, linha a linha, da esquerda para a direita.
- **Abaixo de y≈470:** espaço reservado para Invocar, energia e velocidade.

A simulação e o toque usam a mesma geometria (`GF.layout.casa`, `casaEm`, `posicao`).

### D10. Inimigos guardam só a distância percorrida
A posição na tela é calculada a partir da distância (`GF.layout.posicao(dist)`). Isso facilita escolher o alvo (mais à frente = maior `dist`) e aplicar lentidão (basta mudar a velocidade).

### D11. O desenho interpola entre passos
Cada inimigo guarda `distAnt` (a distância no passo anterior). O desenho mistura `distAnt` e `dist` pela fração do acumulador (`GF.loop.alfa`). O movimento fica suave em telas de 90/120/144 Hz, sem mexer na simulação.

### D12. Fim de partida congela a simulação
Com `fase` diferente de `'jogando'`, `passo()` não faz nada (nem avança o tick). Na tela, um toque recomeça a partida com a próxima semente, que é derivada da anterior e por isso também pode ser reproduzida. A tela completa de vitória e derrota vem na etapa 6.

### D13. Fluxo de demonstração (removido na etapa 6)
Entre as etapas 2 e 5, surgia um inimigo a cada 1,2 s, com tipo sorteado. As ondas substituíram esse fluxo. Os testes agora usam `criarEstado(semente, { semOndas: true })` para cenários sem inimigos automáticos.

### D14. Quem valida a invocação é a simulação
A interface usa `GF.sim.podeInvocar` só para desenhar o botão e decidir se treme. A ação `invocar` sempre passa pela fila, e a simulação valida de novo ao aplicá-la, porque o estado pode mudar entre o toque e o passo. Uma invocação recusada não altera nada, nem o RNG, mas fica no registro.

### D15. Ordem dos sorteios na invocação
Primeiro a casa (entre as livres, em ordem crescente de índice), depois o tipo. Mudar essa ordem muda as partidas geradas por uma mesma semente, então qualquer mudança aqui precisa ser registrada.

### D16. Todo dano passa por `GF.sim.causarDano`
Essa função tira vida, remove o inimigo morto, conta o abate (`estado.abates`) e paga a energia uma única vez (um inimigo já morto ignora dano extra no mesmo passo). O combate usa só ela.

### D17. A Sorte é amarela
O plano inicial previa a Sorte em roxo. No jogo ela é amarela (`#ffd34d`), para não se confundir com a fenda e os inimigos, que são roxos. As cores de todos os guardiões ficam em `CORES.guardiao`, no `js/render.js`.

### D18. O combate faz parte da simulação (`js/combate.js`)
Recargas, alvos, projéteis, críticos e lentidão rodam no passo fixo. O único sorteio do combate (o crítico da Sorte) usa `estado.rng`, no momento do disparo. Ordem dentro de um passo: ações → energia passiva → surgimento de inimigos → guardiões disparam → projéteis voam e acertam → inimigos andam e escapam → limpeza de efeitos.

### D19. A recarga é contada em ticks, e o Tambor acelera o relógio
Cada guardião tem `recarga`. A cada passo ela cai `1 + buff`, e ao disparar soma `intervaloTicks`. A sobra negativa é aproveitada. Assim o buff vale exatamente +20% de ataques por segundo, e tudo continua determinístico.

### D20. Projéteis de verdade, que perseguem o alvo
Os projéteis dão leitura visual de quem atira em quem, e o tempo de voo faz parte do jogo. Se o alvo morrer antes do impacto, o projétil some. Isso causa algum desperdício quando vários guardiões miram o mesmo inimigo, um efeito aceito na v0.1 que pode ser revisto no balanceamento.

### D21. Efeitos visuais ficam no estado da simulação
Explosões, faíscas de acerto e números de crítico entram em `estado.efeitos` com o tick de criação e expiram depois de 30 ticks. Assim o desenho continua só lendo o estado. Os efeitos não entram no `resumo` dos testes.

### D22. Partida de referência dos testes de determinismo (semente 11 desde a etapa 6)
Com o roteiro de invocações e fusões, a partida de referência precisa ter os 5 tipos lutando, combate, fusões e terminar em derrota. Desde a etapa 6 ela também precisa passar do chefe da onda 5. A semente 7 cumpria isso no fluxo de demonstração. Com as ondas ela deixou de sortear a Sorte, então a referência passou a ser a semente 11 (chega à onda 8, com 110 abates). Observação de balanceamento: algumas sementes (como a 12345) sorteiam só Tambores e Geada no começo e perdem sem abater ninguém. Isso deve ser considerado nas ondas da etapa 6 e no balanceamento da etapa 7.

### D23. A ação de fundir leva casas e ids
A ação é `{ tipo: 'fundir', de, para, idDe, idPara }`. A simulação só funde se as duas casas ainda tiverem exatamente as cartas que o jogador arrastou. Isso evita fundir a carta errada quando o tabuleiro muda entre o gesto e o passo (por exemplo, duas fusões com a mesma carta no mesmo passo: só a primeira vale). Uma fusão recusada não muda nada, nem o RNG.

### D24. O arraste é só interface; quem decide é a simulação
O arraste vive em `ui.arraste`, no `js/main.js`, fora do estado da simulação. Só ao soltar sobre um destino válido a ação `fundir` entra na fila.
- **No toque**, a carta é desenhada 28 px acima do dedo, para não ficar escondida. O destino é a casa sob a **carta** (o que o jogador vê), não sob o dedo.
- **No mouse** não há essa elevação.
- Só um ponteiro arrasta por vez (o segundo dedo é ignorado). Se a carta deixar de existir durante o arraste, o arraste é cancelado.

### D25. Fusões no teste de determinismo
O roteiro aceita ações calculadas na hora, a partir do estado (um "robô" que funde o primeiro par válido). Como o estado é idêntico em todas as execuções, a ação calculada também é. A partida de referência (ver D22) tem fusões, e os 5 tipos lutam em algum momento.

### D26. Dano por nível multiplicativo (×2,5), no lugar do linear (+80%)
**Problema (QA da etapa 5):** com dano linear, duas cartas de nível 1 somavam 2,0× de dano, e a carta de nível 2 resultante dava só 1,8×. Além disso, o tipo sorteado podia sair um Tambor, que não causa dano. Fundir piorava o tabuleiro: 3/20 vitórias fundindo sempre contra 8/20 sem fundir.

**Mudança:** `dano(nível) = base × MULT_DANO_NIVEL^(nível − 1)`, com `MULT_DANO_NIVEL = 2,5` (em `js/dados.js`). O QA sugeriu ×2,5 como ponto de partida. Com ×2,5, a carta fundida vale 2,5× contra os 2,0× das duas cartas separadas: um ganho de 25% em dano, mais uma casa livre no tabuleiro.

**Resultado** (QA interno, sementes 1 a 40): fundindo sempre 24/40, sem fundir 15/40. Antes eram 3/20 contra 10/20 nas sementes 1 a 20.

**O que não mudou, e por quê:**
- **Lentidão da Geada e chance de crítico da Sorte** são porcentagens com teto. Multiplicar estouraria 100% em poucos níveis, então continuam lineares.
- **Raio da Brasa** continua linear. A Brasa já ganha com o dano multiplicativo.
- **Buff do Tambor** continua linear (+10% por nível). ×2,5 daria +4880% no nível 7, e um buff linear mais forte não mostrou efeito no QA. Ver "Pendências de balanceamento".

**Garantia:** o teste "Fusão compensa" mede na simulação, para Lança, Geada, Brasa e Sorte, nos níveis 1 a 6, que o nível n+1 causa ≥ 2× o dano do nível n em 10 s. Com a fórmula antiga ele falha.

**Consequência a acompanhar:** o nível 7 causa ≈ 244× o dano base. A vida dos inimigos e dos chefes nas ondas (etapa 6) precisa ser calibrada para isso (ver D28).

### D27. Ondas descritas como dados, simulação genérica
Cada onda em `GF.dados.ONDAS` é `{ preparo, vida, chefe?, grupos: [{ tipo, n, intervalo, atraso }] }`. Ao começar uma onda, a simulação gera a lista de surgimentos (`ondas.pendentes`) com o tick de cada um, ordenada por tick (empates na ordem de definição). Não há sorteio nas ondas: a mesma onda é sempre igual. As habilidades dos chefes ficam nos dados do inimigo (`resistLento`, `invoca`). Ordem no passo: ações → energia → ondas e habilidades dos chefes → guardiões → projéteis → movimento e escapes → fim de onda e vitória → efeitos. Uma derrota no mesmo passo tem prioridade sobre a vitória.

### D28. Curva de vida calibrada pelo poder que se alcança na prática, não pelo teto de 244×
O QA pediu que a vida crescesse o bastante para o dano multiplicativo (D26). Mas, medindo com o robô (invoca sempre que pode e funde o primeiro par), o tabuleiro chega em média **só ao nível 3,3 a 3,5** em ~6 min de partida (~15× de dano), por causa do tipo sorteado e das 15 casas. Uma curva que seguisse o teto de 244× deixaria o jogo impossível.

Curvas testadas (40 sementes cada, robô fundindo × sem fundir):

| Multiplicador de vida da onda 1 → 10 | Fundindo | Sem fundir |
|---|---|---|
| 0,5 → 26 (geométrica, ~×1,5/onda) | 0/30 | 0/30 |
| 0,5 → 10 | 0/30 | 0/30 |
| 0,5 → 4,5 | 9/30 | 0/30 |
| 0,5 → 2,4 (quase plana) | 27/30 | 10/30 (fácil demais) |
| 0,4 → 4,0 | 25/40 | 0/40 |
| **0,4 → 4,2 (escolhida)** | **17/40 (42%)** | **0/40** |

Com a curva escolhida, quem funde vence ~40% (a maioria das derrotas é contra o **chefe final**) e quem não funde perde sempre, em geral na onda 9. A fusão é necessária, e o final é um desafio. Um jogador humano escolhe melhor o que fundir do que o robô, então deve vencer com mais frequência.

### D29. Começo leve (onda 1)
O QA apontou derrotas aos 42–56 s com o fluxo de demonstração. Agora:
- a onda 1 só começa após **10 s** de preparação;
- ela tem só **6 Fragmentos** com **40% da vida** (40 cada), um a cada 3,5 s.

Com os 60 de energia iniciais, dá para invocar 2 guardiões antes da primeira onda. Um teste garante que o robô que só invoca não perde vida na onda 1 em 20 sementes.

### D30. Reinício só pelo botão
Antes, um toque em qualquer lugar da tela de fim reiniciava a partida, o que podia acontecer sem querer no último toque da partida. Agora só o botão "Jogar de novo" reinicia.

---

## Histórico das etapas

### Etapa 1: esqueleto ✅
- Estrutura de arquivos, laço de passo fixo, RNG com semente, canvas responsivo em retrato e botão 1x/2x.
- Conteúdo provisório: uma "fenda" que solta faíscas sorteadas pelo RNG, e o toque solta mais faíscas (serve para validar a entrada → fila → simulação). Sai na etapa 2.
- Testes: 12 automáticos (RNG, determinismo em 6 cenários de FPS/velocidade, limite de salto de tempo, pausa).

### Etapa 2: tabuleiro, caminho, inimigos e vida ✅
- `dados.js` (balanceamento) e `layout.js` (geometria) separados da lógica.
- Caminho em U com fenda de entrada e cristal de saída, tabuleiro 5×3, 3 tipos de inimigo, vida do jogador e derrota com toque para recomeçar.
- A demo de faíscas da etapa 1 foi removida.
- Testes: 20 automáticos. O determinismo agora cobre uma partida inteira até a derrota.

### Etapa 3: energia e botão Invocar ✅
- Energia passiva e por abate, botão Invocar com custo crescente, cartas dos 5 guardiões com animação de entrada e níveis em pontinhos.
- Os guardiões ainda não atacam (isso vem na etapa 4). A recompensa por abate já existe em `causarDano` e é testada diretamente.
- Testes: 30 automáticos. O roteiro de determinismo agora tem invocações reais, aceitas e recusadas.

### Etapa 4: os 5 papéis em combate ✅
- Lança (dano único), Geada (lentidão), Brasa (área), Tambor (buff nos vizinhos) e Sorte (crítico) funcionando, com projéteis, explosões, números de crítico, anel de lentidão e setinha de buff.
- `CLAUDE.md` criado com as regras de trabalho do projeto.
- Testes: 43 automáticos (13 novos de combate). O determinismo agora cobre uma partida com os 5 guardiões lutando.

### Etapa 5: fusão por arrastar ✅
- Arrastar com toque ou mouse, destinos válidos destacados, carta elevada acima do dedo no toque, efeito visual de fusão.
- Fusão validada na simulação por casa + id, nível máximo 7 e tipo sorteado.
- Testes: 49 automáticos (6 novos de fusão), mais a integração com eventos de ponteiro reais (mouse, toque, destino inválido, soltar fora, toque em casa vazia).
- **Ajuste pós-QA:** dano por nível passou a ser multiplicativo (×2,5), porque a fusão enfraquecia o jogador (D26). Teste novo garante n+1 ≥ 2× o dano de n. Total: 50 testes.

### Etapa 6: 10 ondas, chefes, vitória e derrota ✅
- 10 ondas definidas em dados, com preparação e contagem regressiva, e uma curva de vida calibrada por QA (D28).
- Colosso da Fenda (onda 5, resiste à lentidão) e Coração da Fenda (onda 10, solta lacaios), com barra de vida no topo.
- Onda 1 bem mais leve (D29).
- Telas de vitória e derrota com estatísticas e botão "Jogar de novo" (D30).
- O fluxo de demonstração foi removido. A referência de determinismo passou para a semente 11 (D22).
- Testes: 59 automáticos (10 novos de ondas, chefes, vitória, derrota e começo leve).
