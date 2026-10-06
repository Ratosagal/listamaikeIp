# Vigília

Protótipo de sobrevivência 3D para navegador, com criaturas originais, câmera atrás do personagem e combate em tempo real. Usa Three.js e Vite. Requer teclado, mouse e WebGL.

## Executar

Node.js 22.12+ (validado com 24):

```sh
npm ci --cache /tmp/npm-cache
npm run dev
```

`npm run build` gera a versão estática em `dist/`. `npm run preview` serve o build. O jogo é local e salva no localStorage do navegador.

## Jogar

WASD move, Shift corre, mouse gira a câmera após clicar no cenário, clique ataca, 1/2/3 selecionam espada/arco/pistola. E coleta recursos ou abre o gerenciamento de criaturas; Q lança uma cápsula na criatura próxima (enfraqueça até 35 PV). C fabrica; B constrói; T gira a estrutura; clique confirma; Esc cancela e libera o mouse. R reanima criaturas próximas. E também abre/fecha portões próximos.

Você começa com Brasa e uma espada. Colete recursos com sua companheira, construa uma bancada para fabricar arco e pistola, fabrique flechas e munições, construa uma cama para definir a base. O gerenciamento alterna entre companheira, guardiã e sentinela em torre próxima. Cinco abates próximos desbloqueiam a evolução, que custa recursos. Dias duram 12 minutos; hordas chegam nos dias 5, 10, 15… Zumbis também vagam pela cidade.

Ao morrer, você e sua companheira retornam à base, com o inventário protegido. A criatura incapacitada retorna incapacitada e pode ser reanimada. Não há fome ou sede.

## Escopo atual

Visual feito com geometria original, mapa compacto, três espécies e uma evolução por espécie. Construções destrutíveis, defesa automática e fabricação. O estado serializável é separado dos objetos gráficos para facilitar futura sincronização; multiplayer ainda não está implementado e exigirá servidor autoritativo. Não há navegação sofisticada em obstáculos nem interiores exploráveis. Coletas, capturas, bases, inventário, progressão e tempo persistem; posições de zumbis e de criaturas selvagens reiniciam ao recarregar.

## Validação

`npm test` executa os testes de navegador com Chromium em `/usr/bin/chromium`. O servidor de desenvolvimento deve estar ativo. Os testes usam saves próprios em contextos isolados e cobrem movimento, fabricação, construção, persistência, evolução, horda e retorno após morte.
