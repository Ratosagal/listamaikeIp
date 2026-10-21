# Origem dos recursos

## Gisele — O Véu Partido

O modo atual tem identidade própria. Gisele, Íria, Oren, Nara, as regiões, os guardiões, os votos, os diálogos, as armas e a história foram criados para este projeto. Não foram usados personagens, sprites, modelos, músicas, diálogos, mapas, logotipos ou interfaces extraídos de Hades ou Hades II.

- Retrato vetorial original de Gisele: SVG criado em `src/rogue/main.js`.
- Heroína articulada, cabelo, roupa, bastão, lâminas e arco: `src/rogue/hero.js`.
- Arquitetura, textura de piso desenhada em canvas, inimigos e efeitos geométricos: `src/rogue/world.js`.
- Interface original: `index.html`, `src/rogue/style.css`; favicon original: `public/favicon.svg`.
- Música e efeitos reutilizam o sintetizador original do projeto em `src/systems/audio.js`.
- Animação utiliza os cálculos procedurais do projeto em `src/systems/character.js`; partículas utilizam o pool de `src/systems/effects.js`.

## Recursos dos modos arquivados


Todos os personagens, criaturas, construções, veículos, vegetação, montanhas, ícones SVG e efeitos visuais deste projeto são originais e construídos por código. Nenhum modelo, personagem, nome de criatura ou recurso gráfico de Pokémon, Palworld, Project Zomboid ou Attack on Titan foi usado.

- Instâncias de recursos coletáveis: `src/systems/resource-batches.js`.
- Colossos originais e animações de impacto: `src/systems/colossi.js`. Cabos e física de manobra: `src/systems/aerial.js`.
- Humanoide original articulado e textura de tecido: `src/systems/character.js`.
- Céu, textura de fachada, detalhes urbanos e agrupamento de superfícies: `src/systems/presentation.js`.
- Modelos e animações: `src/main.js` (geometria Three.js).
- Arte do menu: SVG original em `index.html`; favicon em `public/favicon.svg`.
- Textura de terreno, vegetação instanciada e objetos de cenário: `src/systems/scenery.js`. A textura é desenhada em um canvas local.
- Partículas: `src/systems/effects.js`, com um pool de tamanho fixo.
- Música ambiente e efeitos: `src/systems/audio.js`, síntese original Web Audio. Não usa gravações ou amostras externas. É uma trilha procedural simples, não uma gravação musical profissional.
- Tipografia: fontes do sistema; não há download de fontes.
- Three.js é uma dependência sob licença MIT. Consulte `node_modules/three/LICENSE`. As demais dependências mantêm suas próprias licenças.

Não há serviços externos, chaves, telemetria, carregamento de recursos de CDN ou dependência de imagens remotas durante o jogo.

O modo atual usa plantas e zumbis originais, criados em `src/defense/main.js`, com interface e mapa vetorial em `index.html` e `src/defense/style.css`. A simulação de defesa está em `src/defense/simulation.js`. Nenhum recurso de Plants vs. Zombies foi utilizado.
