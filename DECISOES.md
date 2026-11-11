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

### Os 5 guardiões

| Guardião | Papel | Visual |
|---|---|---|
| Lança | dano único, tiro rápido | triângulo laranja |
| Geada | deixa o alvo mais lento | hexágono azul-claro |
| Brasa | dano em área | círculo vermelho |
| Tambor | buff de velocidade de ataque nos vizinhos | quadrado verde |
| Sorte | chance alta de crítico | losango roxo |

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

---

## Histórico das etapas

### Etapa 1: esqueleto ✅
- Estrutura de arquivos, laço de passo fixo, RNG com semente, canvas responsivo em retrato e botão 1x/2x.
- Conteúdo provisório: uma "fenda" que solta faíscas sorteadas pelo RNG, e o toque solta mais faíscas (serve para validar a entrada → fila → simulação). Sai na etapa 2.
- Testes: 12 automáticos (RNG, determinismo em 6 cenários de FPS/velocidade, limite de salto de tempo, pausa).
