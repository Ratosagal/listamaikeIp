# Origem dos recursos

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
