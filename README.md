# Gisele — O Véu Partido · 1.0.0

Roguelike de ação isométrico para navegador. Gisele atravessa três regiões da Fenda em busca das memórias de sua irmã. Combate em tempo real, armas com combos e golpes carregados, círculo arcano, esquiva, votos aleatórios, mercador, chefes e progressão permanente. Personagens, história, arte, modelos, interface e áudio são originais.

Esta versão entrega uma campanha de doze câmaras: nove encontros de combate, incluindo três guardiões, e três descansos. Ela substitui a defesa urbana como página principal. Não é uma reprodução integral do conteúdo ou dos recursos de Hades II; as referências são o gênero, a perspectiva e o ciclo de combate, escolhas e retorno ao refúgio.

## Executar e publicar

Requer Node.js 22.12+.

```sh
npm ci
npm run dev
```

```sh
npm run build
```

No Vercel, use preset Vite, comando `npm run build` e saída `dist`. O jogo é estático e não exige chaves, API ou servidor de aplicação. Não há downloads de modelos, fontes, imagens ou áudio durante a partida.

## A jornada

No **Átrio dos Fios**, escolha uma das três armas e converse com Íria, Oren e Nara. O botão “Preparar incursão” também dá acesso a armas, memórias e diálogos. Atravesse o Véu para iniciar uma tentativa.

| Região | Guardião |
|---|---|
| Jardins do Silêncio | O Vigia de Basalto: impactos e ondas pelo chão |
| Arquivo Submerso | A Curadora do Breu: projéteis radiais e ataques marcados |
| Coração da Fenda | O Oráculo Oco: ondas consecutivas e rajadas densas |

Cada região tem um encontro, uma batalha de elite em duas levas, um descanso com mercador e um guardião. As arenas variam os obstáculos; inimigos e escolhas de votos usam uma sequência aleatória que persiste no save. Os chefes ficam mais perigosos abaixo de metade da vida.

Ao superar um encontro, receba um voto e escolha uma passagem: 15 óbolos ou 18 de vida. No descanso, uma infusão recupera 45 de vida por 30 óbolos; um voto aleatório custa 65. Os doze votos podem ganhar até três níveis e modificam dano, alcance, mobilidade, regeneração, queimadura, lentidão, cadeia elétrica, círculo, proteção e recuperação de vida.

| Arma | Estilo |
|---|---|
| Bastão de Âmbar | Alcance corpo a corpo e combo de três golpes |
| Lâminas do Crepúsculo | Ataques rápidos e especiais em leque |
| Arco Astral | Combate à distância e disparos carregados que atravessam inimigos |

Inimigos derrotados concedem óbolos e fragmentos. Ao morrer ou vencer, os fragmentos são guardados uma única vez. Óbolos e votos terminam com a tentativa. No refúgio, compre vida máxima, magia e regeneração, dano permanente ou uma recuperação de vida por tentativa. Gisele pode então partir novamente, com outra arma e novas combinações.

## Desfecho e Ascensões

A vitória libera um epílogo de três cenas e créditos, disponíveis novamente no refúgio. Cada vitória na dificuldade mais alta libera a Ascensão seguinte, até 5: cada nível acrescenta 12% à vida e 10% ao dano dos inimigos. Escolha a intensidade antes de partir. O códice guarda as dez últimas tentativas, com arma, duração, câmara e resultado.

## Controles

| Controle | Ação |
|---|---|
| WASD | Mover na orientação da tela |
| Shift | Correr |
| Mouse | Mirar |
| Clique esquerdo ou J | Atacar; segurar 0,65s e soltar libera ataque carregado por 18 de magia |
| Clique direito ou K | Especial por 8 de magia; segurar e soltar acrescenta uma versão carregada por 25 |
| Q ou L | Círculo arcano por 20 de magia; desacelera e causa dano contínuo |
| Espaço | Esquivar; duas cargas, com recuperação automática e invulnerabilidade breve |
| E | Conversar, recolher voto ou atravessar uma passagem, conforme o contexto |
| C | Códice de Nara |
| Escape | Pausar ou fechar painel; a escolha de voto e os resultados precisam ser concluídos |
| Roda do mouse | Ajustar aproximação da câmera |

J e K usam o inimigo mais próximo quando a mira do mouse não está ativa. Correr não concede invulnerabilidade. Círculos de preparação, projéteis e marcas no chão permitem antecipar ataques. Pilares bloqueiam movimento e projéteis. O mundo pausa em painéis, configurações e escolhas.

## Salvamento e configurações

Progresso automático em `gisele-veil-v1`, no localStorage deste navegador. Vida, magia, inimigos, câmara, arma, votos, ofertas pendentes, sequência aleatória, conversas e melhorias persistem. Projéteis e marcas de ataque transitórios são descartados ao recarregar, com proteção breve para retomar. Um save inválido é preservado em uma chave de recuperação. A cópia anterior válida é recuperada automaticamente quando disponível. Em Configurações → Backup do progresso, exporte um JSON ou importe uma cópia com confirmação; dados inválidos não substituem a partida atual.

O save dos modos anteriores não é apagado nem convertido. `defense.html` e `legacy.html` permanecem no repositório para regressão e consulta; o build de produção usa a página principal de Gisele. A documentação anterior está em [docs/urban-defense.md](docs/urban-defense.md) e [docs/legacy-game.md](docs/legacy-game.md).

Qualidade Leve, Equilibrada e Alta, volumes separados, partículas, feedback de dano e alto contraste estão nas configurações. Tremor permanece desligado por padrão.

## Arquitetura e verificação

- `src/rogue/simulation.js`: combate, inimigos, padrões de chefe, progressão, economia e validação de saves; sem dependências gráficas.
- `src/rogue/hero.js`: humanoide feminino articulado original, roupa, cabelo, armas e animações.
- `src/rogue/world.js`: arenas, materiais, iluminação, inimigos, sinais de ataque e descarte de recursos gráficos.
- `src/rogue/main.js`: câmera isométrica, controles, menus, diálogos, áudio e persistência.

```sh
npm test # campanha atual e recursos da versão 1.0
npm run test:all # inclui modos arquivados
```

Playwright usa Chromium em `/usr/bin/chromium` localmente e o navegador instalado pelo Playwright no CI e inicia Vite automaticamente. A suíte do novo modo verifica combate real pelo teclado, carga, magia, invulnerabilidade, colisão, progressão pelas doze câmaras, padrões dos três chefes, compras permanentes, retorno, salvamento, diálogos, qualidade gráfica e janelas compactas. Os testes anteriores acessam as páginas arquivadas.

## Escopo atual

Campanha compacta de um jogador, três armas, doze votos, quatro arquétipos comuns e três chefes. Arte 3D e retratos estilizados procedurais/vetoriais, trilha sintetizada e diálogos em texto. Não inclui dublagem, multiplayer, comandos de toque, gamepad, romance, pesca ou a quantidade de conteúdo de um roguelike comercial. O desempenho deve ser conferido nos dispositivos de destino. Veja [ASSETS.md](ASSETS.md) para a origem dos recursos.
