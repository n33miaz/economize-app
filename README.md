# Economize! — App

Aplicativo de finanças pessoais em **React Native** com **Expo**. A mesma base gera **Android,
iOS e o site** — não há um "app" e um "web" com código separado, e é por isso que uma correção
de tela chega às três superfícies de uma vez.

- **Repositório da API:** [economize-api](https://github.com/n33miaz/economize-api)
- **Como o trabalho anda por aqui:** [CONTRIBUTING.md](CONTRIBUTING.md)

## Onde usar

- **No navegador, sem instalar:** [economize-web.onrender.com](https://economize-web.onrender.com)
- **APK:** [releases deste repositório](https://github.com/n33miaz/economize-app/releases)
- **Builds:** [projeto no Expo](https://expo.dev/accounts/n33miaz/projects/economize)

> No iPhone, abra a versão web pelo Safari e use "Adicionar à Tela de Início": o app roda em
> tela cheia, respeitando o notch e a barra de gestos.

---

## O que o app faz

- **Extrato.** Importa CSV, OFX, PDF, XLSX e TXT, ou lê as contas por Open Finance. Cada linha
  diz **por onde entrou e quando**, e a fila de revisão recebe só o que ficou em dúvida.
- **Análise.** Para onde o dinheiro foi, por mês ou pelo seu ciclo de fatura — quem recebe no
  dia 12 lê de 12 a 12, e não de 1 a 30. Com teto por categoria, que avisa quando estourou e,
  antes disso, quando o ritmo está levando lá.
- **Primeira tela.** O mês em calendário, o recorte da semana e a linha do tempo de
  compromisso: o que já tem dono nos próximos meses, separado por origem (parcela, fatura
  prevista, recorrência) em vez de somado num número só.
- **Cartões.** Faturas fechadas e a em aberto, parcelamentos com a projeção certa, e dinheiro
  separado para uma fatura sem inventar um débito que não existe.
- **Recorrências e assinaturas.** O que se repete, detectado do histórico, com o total **anual**
  na frente — ninguém cancela uma assinatura de R$ 23,90; muita gente cancela uma de R$ 286,80.
- **Vigias.** As varreduras que rodam sozinhas depois de cada importação prestam contas: quem
  são, o que mexeram e como desfazer, passada por passada.
- **Casa.** Duas pessoas lendo junto sem misturar os extratos.
- **Assistente.** Alcançado de qualquer tela, chegando sabendo de qual — e respondendo com os
  mesmos números que a tela ao lado mostra.
- **Mercado.** Cotações, índices e notícias.

## Como ele é construído

- **Nenhum total é calculado aqui.** Soma é do servidor, sempre. Duas contas para a mesma
  pergunta é como um app passa a discordar de si mesmo, e o usuário vê a contradição na mesma
  sessão.
- **Estilo por tokens tipados** (`theme/ds.ts` + NativeWind), sem `StyleSheet` espalhado. Três
  testes cobram isso na esteira: a escala tipográfica (todo `fontSize` é um degrau declarado),
  o orçamento do accent (âmbar é a cor da ação; quando tudo é destaque, nada é) e o respiro das
  folhas.
- **Escuro primeiro, claro por escolha.** Os dois temas são definidos pelos mesmos tokens.
- **Estado em Zustand**, um store por assunto, com o que é rastro da pessoa zerando no logout.
- **Erro de tela não some com a tela**: quando uma leitura de apoio falha, ela desaparece
  sozinha e o resto continua de pé.

### Estrutura

```text
src/
├── components/   # Peças reutilizáveis (Card, MetricTile, folhas, gráficos)
├── screens/      # Telas
├── services/     # Cliente HTTP e os tipos do contrato da API
├── store/        # Estado global (Zustand)
├── hooks/        # Hooks próprios
├── routes/       # Navegação: abas de baixo, abas de cima, pilha e trilho
├── theme/        # Tokens de cor, tipografia, espaçamento e movimento
└── utils/        # Regras puras (dinheiro, ciclo, recorrência, previsão)
```

## Stack

| Camada | O que é usado |
| --- | --- |
| Core | React Native 0.76, Expo SDK 52, TypeScript |
| Navegação | React Navigation 7 (bottom tabs, material top tabs, native stack) |
| Estado | Zustand, AsyncStorage |
| Estilo | NativeWind 4, tokens tipados, Reanimated 3 |
| Gráficos | react-native-gifted-charts, react-native-svg |
| Ícones | lucide-react-native |
| HTTP | Axios |
| Segurança no aparelho | expo-local-authentication (biometria) |
| Testes | Jest, Testing Library (React Native) |

## Como rodar

### Pré-requisitos

- Node.js LTS
- npm
- Expo Go no aparelho, ou emulador Android/iOS

### Passos

```bash
git clone https://github.com/n33miaz/economize-app.git
cd economize-app
npm install
cp .env.example .env
npx expo start
```

Sem a variável, o app deriva a URL do host do Metro em desenvolvimento e usa a URL embutida
nos builds. Para apontar para outro backend:

```env
# backend local
EXPO_PUBLIC_API_BASE_URL=http://SEU_IP_LOCAL:8080/api/v1

# backend publicado
EXPO_PUBLIC_API_BASE_URL=https://sua-api.example.com/api/v1
```

> `EXPO_PUBLIC_*` é lida **no momento do build** e fica embutida no pacote. Vale para endereço;
> não vale para segredo.

Para abrir só o site:

```bash
npx expo start --web
```

## Verificação

```bash
npx tsc --noEmit
npx eslint .
npx jest
```

Os três rodam na esteira a cada push, e o teste ainda roda com cobertura contra uma catraca —
cair abaixo dela reprova o build. Antes de dizer que uma tela está pronta, ela é conferida no
navegador em duas larguras: **390 px** (iPhone) e **1440 px** (desktop).

---

## Licença

Projeto desenvolvido para fins acadêmicos e de portfólio.

**Desenvolvedor:** [Neemias Cormino Manso](https://www.linkedin.com/in/neemiasmanso/)
