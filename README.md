# Economize! - Mobile App

Aplicativo de finanças pessoais desenvolvido com **React Native** e **Expo**. O Economize! combina cotações em tempo real, carteira de investimentos, extratos bancários, assistente financeiro com IA e notícias de mercado, consumindo uma API BFF desenvolvida em Java Spring Boot.

> **Projeto desenvolvido com foco em performance, arquitetura escalável e Clean Code.**

## 📱 Download e Demonstração

A mesma base gera três superfícies: Android, iOS e navegador.

- **Web (mesmo app, sem instalar):** [economize-web.onrender.com](https://economize-web.onrender.com)
- **Download do APK (Versão Mais Recente):** [Acessar Releases do GitHub](https://github.com/n33miaz/economize-app/releases)
- **Builds (Expo):** [Projeto no Expo Dashboard](https://expo.dev/accounts/n33miaz/projects/economize)

> No iPhone, abra a versão web pelo Safari e use "Adicionar à Tela de Início":
> o app roda em tela cheia, respeitando o notch e a barra de gestos.

---

## 🛠 Tecnologias Utilizadas

Este projeto utiliza uma stack moderna focada no ecossistema React Native:

- **Core:** React Native, Expo SDK 52.
- **Linguagem:** TypeScript.
- **Gerenciamento de Estado:** Zustand (Persistência local e store global).
- **Navegação:** React Navigation (Drawer, Bottom Tabs e Material Top Tabs).
- **Requisições HTTP:** Axios (com tratamento de erros e timeouts).
- **UI/UX:** NativeWind, tokens tipados, Reanimated (animações fluidas), Vector Icons.
- **Gráficos:** React Native Chart Kit (Visualização de dados históricos e alocação).
- **Armazenamento Local:** Async Storage (Persistência de carteira e favoritos).

## 🚀 Funcionalidades

1.  **Dashboard de Mercado:**
    - Monitoramento em tempo real de moedas (Dólar, Euro, etc.) e criptoativos.
    - Indicadores econômicos e índices de bolsas.
2.  **Conversor de Moedas:**
    - Ferramenta integrada para cálculo de câmbio com cotação atualizada.
3.  **Carteira de Investimentos (Wallet):**
    - Simulação de compra de ativos.
    - Gráfico de alocação de carteira (Pie Chart).
    - Cálculo automático de rentabilidade baseada na cotação do momento.
    - Persistência de dados offline.
4.  **Notícias Financeiras:**
    - Feed de notícias consumindo API externa via Backend.
5.  **Análise Histórica:**
    - Gráficos lineares com a variação de preços nos últimos 7 dias.

---

## 🏗 Arquitetura e Estrutura

O projeto segue uma arquitetura modular baseada em responsabilidades:

```text
src/
├── components/   # Componentes reutilizáveis (Cards, Charts, Modals)
├── screens/      # Telas da aplicação
├── services/     # Configuração de API (Axios) e tipos
├── store/        # Gerenciamento de estado global (Zustand)
├── hooks/        # Custom Hooks (Logic separation)
├── routes/       # Configuração de Navegação (Drawer + Tabs)
└── theme/        # Design Tokens (Cores, Fontes)
```

## 🔗 Integração com Backend

Este aplicativo não consome APIs públicas diretamente para todas as funções. Ele se comunica com um **Backend for Frontend (BFF)** intermediário, garantindo segurança de chaves de API, cacheamento de dados e tratamento de erros centralizado.

- **Repositório da API (Java/Spring Boot):** [economize-api](https://github.com/n33miaz/economize-api)

## ⚙️ Como rodar o projeto localmente

### Pré-requisitos

- Node.js (LTS)
- Gerenciador de pacotes (npm ou yarn)
- Dispositivo físico com **Expo Go** ou Emulador Android/iOS.

### Passos

1. Clone o repositório:

   ```bash
   git clone https://github.com/n33miaz/economize-app.git
   cd economize-app
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   Copie `.env.example` para `.env` na raiz. Sem a variável, o app deriva a URL do host do Metro em dev e usa a URL de produção embutida nos builds.

   ```env
   # Exemplo para backend local
   EXPO_PUBLIC_API_BASE_URL=http://SEU_IP_LOCAL:8080/api/v1

   # Exemplo para backend em produção
   EXPO_PUBLIC_API_BASE_URL=https://sua-api-em-producao.example.com/api/v1
   ```

4. Execute o projeto:
   ```bash
   npx expo start
   ```

---

## 📄 Licença

Este projeto foi desenvolvido para fins acadêmicos e de portfólio.

**Desenvolvedor:** [Neemias Cormino Manso](https://www.linkedin.com/in/neemiasmanso/)
