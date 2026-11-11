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
- **Vitória:** sobreviver à onda 10. **Derrota:** a vida chega a 0.

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

### Combate (em `js/dados.js` e `js/combate.js`)
- **Alcance:** todo guardião alcança o caminho inteiro.
- **Alvo:** o inimigo **mais avançado** no caminho (empate: o que surgiu primeiro). Exceção: a **Geada prefere o mais avançado que ainda não está lento**. Se todos estiverem lentos, mira o mais avançado.
- **Dano por nível:** `dano base × (1 + 0,8 × (nível − 1))`. Ou seja, nível 2 = 1,8×, nível 3 = 2,6× … nível 7 = 5,8×.
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

### D13. Fluxo de demonstração (provisório)
Até as ondas existirem (etapa 6), surge um inimigo a cada 1,2 s, com tipo sorteado pelo RNG (comum tem chance dobrada). Os testes usam `criarEstado(semente, { semDemo: true })` para cenários controlados.

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

### D22. Partida de referência dos testes de determinismo: semente 7
Com o roteiro de 14 invocações, a semente 7 sorteia os 5 tipos, tem dezenas de abates e termina em derrota. Ela cobre todo o combate. Observação de balanceamento: algumas sementes (como a 12345) sorteiam só Tambores e Geada no começo e perdem sem abater ninguém. Isso deve ser considerado nas ondas da etapa 6 e no balanceamento da etapa 7.

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
