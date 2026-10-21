# Vigília — Jardim de Resistência

Defesa urbana 3D para navegador, com personagem controlável e planejamento por tablet 2D. Explore um bairro abandonado, plante defesas nas três ruas e impeça os zumbis de alcançar o refúgio. Esta é a versão atual do jogo: plantas substituem captura e criaturas companheiras. Os modelos e interfaces são originais.

## Executar

Requer Node.js 22 ou superior.

```sh
npm ci
npm run dev
```

Para gerar o site:

```sh
npm run build
```

No Vercel: preset Vite, comando `npm run build`, diretório de saída `dist`. O jogo não precisa de servidor de aplicação, chaves ou serviços externos.

## Jogar

O bairro tem três rotas de ataque e quinze canteiros. O jogador começa no refúgio com 180 de energia, espada, arco e materiais. A primeira onda chega após 60 segundos de simulação; é possível antecipá-la. Vencer uma onda dá 50 de energia e oito sucatas, com 40 segundos para preparar a próxima. As ondas aumentam em número de inimigos, resistência e dano. Cada zumbi derrotado rende 12 de energia.

| Planta | Função | Custo |
|---|---|---|
| Brotadora | Dispara projéteis na rua | 40 energia |
| Casca | Bloqueia zumbis com muita vida | 30 energia |
| Estopim | Explode quando inimigos se aproximam; uso único | 70 energia |
| Névoa | Dispara e desacelera inimigos | 60 energia |
| Aurora | Gera energia periodicamente | 50 energia |

Todas as plantas podem ser melhoradas até o nível três. Melhorias aumentam vida, dano ou produção; reparos custam dez de energia e duas madeiras. Remover uma planta recupera 40% do custo inicial. Zumbis mordem plantas no caminho. Inimigos que atravessam a defesa causam 35 de dano ao refúgio, que começa com 500 de integridade. Quando ele cai, a expedição termina e pode ser reiniciada.

| Controle | Ação |
|---|---|
| WASD / Shift | Mover / correr |
| Espaço | Saltar |
| Mouse / botão direito | Mirar com mouse capturado / arrastar para olhar ao redor |
| Roda do mouse | Ajustar distância da câmera |
| Clique esquerdo | Atacar; segurar repete golpes ou disparos |
| 1 / 2 / 3 | Espada / arco / pistola fabricada |
| E | Plantar no canteiro próximo ou coletar recursos |
| Q | Alternar a semente selecionada |
| R / F | Melhorar / reparar a planta próxima |
| Tab ou T | Abrir tablet |
| Escape ou T | Fechar tablet; Escape também pausa o jogo |
| C | Abrir bancada; fabricação exige proximidade do refúgio |

Selecione sementes pela barra inferior ou pelo tablet. A prévia no chão indica o canteiro próximo. No tablet, escolha a semente e um canteiro explorado, veja alcance e custo e confirme. Canteiros ocupados oferecem melhoria, reparo e remoção. Ambos os métodos usam o mesmo sistema de custos e validação. O tablet pausa a simulação; Tab navega pelos seus controles, e Escape ou T retorna ao jogo.

Explorar revela novos canteiros. O mapa mostra edifícios, ruas, refúgio, posição do jogador e inimigos em regiões reveladas. A bancada também afia a espada até o nível três, aumentando o dano. Recursos de madeira, pedra e sucata ficam nas áreas verdes laterais. O inventário pertence ao jogador. Ao morrer, ele retorna ao refúgio com inventário intacto e cinco segundos de proteção; o refúgio perde 20 de integridade. Perto dele, a vida recupera gradualmente.

## Visual e desempenho

Humanoide articulado original com rosto, cabelo, vestuário, mochila e equipamento. Animações procedurais misturam caminhada, corrida, respiração, ataque, salto e aterrissagem. Cidade com fachadas desgastadas, iluminação atmosférica, árvores, asfalto molhado, sombras e plantas tridimensionais. Os perfis Leve, Equilibrado e Alta estão no menu de pausa. Leve desativa sombras e reduz a resolução. Arquitetura imóvel é agrupada por material e região; partículas têm um pool limitado. Modelos são estilizados e procedurais, não recursos fotográficos.

## Salvamento

Progresso salvo automaticamente no localStorage, em `vigilia-city-defense-v1`. Plantas, níveis, danos, canteiros explorados, recursos coletados, ondas ativas, inimigos, energia e inventário persistem. O save de sobrevivência anterior permanece intacto em `vigilia-v1`; materiais compatíveis são importados uma vez ao iniciar o novo modo. Um save inválido é preservado em uma chave de recuperação antes de iniciar uma partida limpa.

## Verificação

```sh
npm test
```

Playwright usa Chromium em `/usr/bin/chromium`, servido por Vite. `tests/defense.spec.js` verifica custos, exploração, efeitos das cinco plantas, ondas, tablet, fabricação, combate e salvamento. Os testes anteriores acessam `legacy.html`, mantido para regressão do humanoide, ganchos e sistemas anteriores. O build de produção publica somente o novo modo pela página principal. A documentação anterior está em [docs/legacy-game.md](legacy-game.md).

## Limites desta versão

Um jogador, um bairro, três ruas e cinco plantas. Plantio restrito a canteiros; edifícios não têm interiores. Teclado e mouse, sem comandos de toque ou gamepad. A simulação é separada da renderização e serializável; multiplayer ainda exige servidor e sincronização. O desempenho deve ser conferido nos dispositivos de destino.
