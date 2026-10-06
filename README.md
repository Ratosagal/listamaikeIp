# Vigília — Sobreviva junto

Jogo de sobrevivência 3D para navegador, com criaturas originais, câmera atrás do personagem, combate em tempo real e construção livre. Feito com Three.js, JavaScript, HTML, CSS e Vite, para computador com teclado, mouse e WebGL.

## Executar

Node.js 22.12+ (validado com Node 24):

```sh
npm ci --cache /tmp/npm-cache
npm run dev
```

`npm run build` gera a versão estática em `dist/`; `npm run preview` serve esse build. Vercel, Netlify e Cloudflare Pages podem usar o preset Vite, build `npm run build` e saída `dist`. Não precisa de variáveis de ambiente.

## Jogar

Você começa ao amanhecer com Brasa, uma espada e materiais básicos. Colete recursos, construa uma bancada e uma cama, fabrique armas e cápsulas e prepare seu refúgio. A primeira horda chega no dia 5; cada dia dura 12 minutos de simulação. Sem fome ou sede. Zumbis comuns vagam pela cidade e perseguem ao avistar um alvo próximo, ouvir um ataque ou sofrer dano. Armas de fogo atraem inimigos mais distantes. As hordas procuram a base.

| Controle | Ação |
|---|---|
| WASD / Shift | Mover / correr |
| Mouse | Girar câmera; clique no cenário para capturar o mouse |
| Clique esquerdo | Atacar |
| 1 / 2 / 3 | Espada / arco / pistola |
| E | Coletar recursos ou abrir/fechar um portão próximo |
| Q | Lançar cápsula; enfraqueça a criatura até 35 PV |
| R | Reanimar uma criatura incapacitada próxima |
| C / B | Fabricar / construir |
| T / F | Girar estrutura / reparar construção próxima (2 madeiras + 1 pedra) |
| Esc | Fechar painel, cancelar construção ou pausar e liberar o mouse |

O combate usa mira assistida horizontal; o alvo e sua vida aparecem no centro da tela. O HUD indica a vida, companheira, inventário, ameaças, objetivo contextual e direção/distância do refúgio. No painel de criaturas, escolha explicitamente acompanhar, guardar área ou ocupar uma torre livre. Uma torre comporta uma sentinela. Cinco abates próximos desbloqueiam a evolução, que custa materiais.

Muralhas e construções podem ser destruídas. Armas exigem uma bancada próxima; munições, flechas e cápsulas são fabricadas com materiais. Repare estruturas próximas com F, usando 2 madeiras e 1 pedra para recuperar até 100 PV. Em segurança perto da base, o jogador recupera vida. Ao morrer, o jogador revive na base com cinco segundos de proteção e a companheira sempre retorna junto, preservando o inventário e seu estado de incapacitação. Reanime-a com R. Ao vencer uma horda, a tela de resultados entrega recursos e permite continuar a expedição.

## Menus e acessibilidade

Menu inicial, continuar, nova expedição, ajuda, pausa, retomar, reiniciar e retornar ao menu. As configurações incluem três perfis gráficos, sensibilidade, inversão da câmera, alto contraste, partículas, tremor e feedback de dano. Tremor fica desligado por padrão. Música e efeitos têm volumes separados e um botão para testar áudio. Diálogos permitem navegação por Tab/Shift+Tab e Escape. Os painéis de fabricação, construção e criaturas pausam a simulação para permitir decisões sem ataques durante a interface.

O perfil Leve desativa sombras e limita a resolução para máquinas menos potentes. Partículas têm um pool de tamanho fixo; materiais e geometrias são compartilhados; vegetação usa instâncias. Áudio só começa depois de interação do usuário. Veja [ASSETS.md](ASSETS.md) para a origem dos recursos.

## Salvamento

O progresso e as preferências ficam no localStorage deste navegador. Saves antigos do protótipo são carregados e normalizados. Recursos coletados, criaturas capturadas, ferimentos de criaturas selvagens, zumbis, hordas ativas, construções, inventário e progressão persistem. A partida salva ao pausar, nas principais ações, a cada dez segundos de simulação e ao sair. Abrir o menu inicial não substitui o save.

Reiniciar pede confirmação e guarda o progresso anterior na chave `vigilia-recovery`. Um save inválido é preservado nessa chave e um aviso explica o problema. Essas cópias são locais; limpar os dados do navegador apaga o progresso. Não há sincronização entre dispositivos ou contas.

## Testes

```sh
npm test
```

O Playwright inicia o servidor automaticamente, ou reutiliza um servidor local na porta 5173. Os testes usam Chromium em `/usr/bin/chromium` e contextos isolados. Em outro sistema, configure um Chromium instalado no `playwright.config.js` ou use o navegador do Playwright. Os cenários com saves preparados permitem validar hordas e resultados sem esperar uma hora real.

A suíte cobre movimentação, fabricação, construção, captura, evolução, retorno após morte, pausa, configurações, reinício, resultados de hordas, restauração de progresso, atribuição de torres, portões, WebGL, resolução compacta e recuperação de saves inválidos.

## Limitações atuais

- Um jogador. O estado é serializável e os sistemas de áudio, efeitos, navegação e cenário estão separados; multiplayer ainda exige servidor autoritativo e sincronização.
- Região compacta com prédios fechados, três espécies e uma evolução por espécie. Não há interiores exploráveis ou campanha com final definitivo; a vitória é sobreviver a cada horda.
- Controle por teclado e mouse. A interface se adapta a janelas menores, mas não há controles de toque ou gamepad.
- Modelos geométricos e animações procedurais. A trilha é sintetizada e o desempenho real deve ser conferido nos dispositivos de destino.
- Navegação usa A* simplificado para prédios e veículos; as defesas construídas continuam sendo obstáculos atacáveis. Não é um sistema completo de navegação física.
