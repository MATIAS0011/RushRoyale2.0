# Guardiões da Fenda: regras de trabalho

Jogo de navegador de defesa com cartas que se fundem. Nome, personagens e visual originais (nada copiado de jogos existentes). As regras do jogo e as decisões técnicas ficam em `DECISOES.md`.

## Comunicação
- Responder sempre em **português**.

## Fluxo de trabalho
- Trabalhar em **etapas curtas**. **Esperar o ok do usuário antes de começar cada etapa.**
- Ao fim de cada etapa:
  1. **Testar** e dizer ao usuário exatamente o que foi testado e o resultado.
  2. **Atualizar o `DECISOES.md`** (regras, números de balanceamento, decisões e histórico da etapa).
  3. Fazer um **commit em português**.
- **Nunca fazer push** (nem criar PR) sem o usuário pedir.

## Restrições técnicas (não quebrar)
- HTML, CSS e JavaScript puro, **sem framework e sem etapa de build**.
- O jogo **abre com dois cliques no `index.html`**, sem servidor. Nada de módulos ES: usar scripts clássicos que penduram no namespace global `window.GF`. A ordem dos `<script>` importa.
- **Simulação com passo de tempo fixo** (`GF.sim.DT = 1/60`): o resultado é o mesmo em qualquer FPS e velocidade.
  - A simulação (`js/sim.js`) não lê relógio, DOM, canvas nem `Math.random`. Toda aleatoriedade vem de `estado.rng`.
  - As ações do jogador entram pela fila (`GF.sim.agendar`) e são aplicadas no próximo passo.
  - O desenho (`js/render.js`) só lê o estado.
- Gráficos desenhados em código (formas e cores), sem imagens externas por enquanto.
- O jogo é para celular em pé: mundo lógico de 360×640.

## Testes
- Os testes ficam em `testes.html` + `testes/testes.js` e rodam no navegador. A máquina não tem Node.
- Rodar pelo terminal:
  `"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless --disable-gpu --user-data-dir="$TEMP/gf-edge" --dump-dom "file:///C:/jogos/RushRoyale2.0/testes.html"`
- Toda mecânica nova ganha testes. O teste de determinismo (vários FPS e 2x) precisa continuar passando.
- Para conferir o visual: o Edge headless tem largura mínima de ~492 px, então use uma página auxiliar com um `<iframe>` de 390×844 e `--screenshot`.
