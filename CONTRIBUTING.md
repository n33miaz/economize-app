# Como o trabalho anda neste repositório

Três branches, e o que separa uma da outra é **o quanto já foi provado**.

```
develop  ──►  homolog  ──►  main
   │            │             │
   │            │             └─ economize-web            (o site que o dono usa)
   │            └─ economize-web-homolog                  (fala com a API de homologação)
   └─ ninguém publica daqui; é onde o trabalho acontece
```

## develop

Onde o trabalho acontece. Aceita push direto e roda a esteira inteira: tipos,
lint, testes **com cobertura cobrada**, varredura de segredo, `npm audit` e
CodeQL.

## homolog

Recebe merge de `develop`. O Render publica em `economize-web-homolog`, que
aponta para a **API de homologação** — a URL é embutida no bundle em tempo de
build, então é ela que decide em qual banco o teste escreve.

## main

Recebe merge de `homolog`, **por pull request e com a esteira verde** — é o que
a proteção de branch exige. O Render publica em `economize-web` no mesmo
instante, e é por isso que o portão está no GitHub e não no Render.

Não há push direto em `main`.

## Cobertura

As catracas vivem no `package.json` e só são **cobradas** quando o jest roda
com `--coverage`, que é como a esteira o chama. Baixar uma catraca é decisão,
não conserto: se a cobertura caiu, ou o teste que faltava não foi escrito, ou o
código novo não precisava existir.

## Pilha de estilo

`expo`, `react-native`, `nativewind` e `react-native-css-interop` estão
**ignorados no Dependabot** de propósito. Subir qualquer um deles fora de um
upgrade planejado quebra o app inteiro — já aconteceu neste projeto. A
atualização dessas quatro é decisão, não rotina.

## Como o merge entra

**Merge commit**, e não rebase nem squash. A primeira versão da proteção exigia
histórico linear, e isso obriga o merge a reescrever os commits — o que faz `homolog`
divergir de `main` no instante seguinte ao merge. Como `homolog` também é protegido (sem
force-push, com razão), ele fica impossível de realinhar sem afrouxar a regra.

Com merge commit, `homolog` continua ancestral de `main`, tudo avança por fast-forward, e a
proteção que importa fica de pé: check verde obrigatório, sem push direto, sem force-push,
sem apagar branch.

## Commit

Conventional Commits em inglês, imperativo, minúsculas, sem ponto final.
Assunto curto (~35 caracteres, teto de 50), **só o assunto**: sem corpo e sem
rodapé. Um commit por parte lógica, com o teste no mesmo commit do código.
