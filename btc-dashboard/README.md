# 📊 BTC Dashboard — Dashboard de Métricas do Bitcoin

Dashboard completo para visualização de métricas on-chain, de mercado e indicadores fundamentais do Bitcoin.

## Estrutura do Projeto

```
btc-dashboard/
├── frontend/              # Next.js app (deploy no Vercel)
│   └── src/
│       ├── components/    # Layout, Sidebar, TopBar, componentes de gráficos
│       ├── pages/         # Rotas Next.js
│       ├── hooks/         # React hooks (usePriceData, useMining, etc.)
│       ├── utils/         # Formatadores, helpers
│       └── styles/        # CSS global
│
├── backend/               # Express + SQLite (deploy separado ou Vercel Serverless)
│   └── src/
│       ├── collectors/    # Download de dados das APIs externas
│       ├── calculators/   # Cálculo de indicadores derivados
│       ├── api/           # Rotas REST para o frontend
│       ├── db/            # Schema SQLite e conexão
│       ├── scripts/       # collectAll.ts (sync inicial) + dailyUpdate.ts
│       └── utils/         # Logger, helpers
│
└── shared/                # Tipos TypeScript compartilhados (futuro)
```

## Filosofia de Dados

A arquitetura foi desenhada para **minimizar requests às APIs externas**:

1. **Sync inicial** (`npm run collect:all`): baixa TODO o histórico disponível de cada fonte, de uma vez.
2. **Atualização diária** (`npm run collect:daily`): apenas busca dados do dia mais recente (1 request por fonte).
3. **Cálculos**: todos os indicadores derivados (MVRV, NVT, Puell, S2F) são calculados localmente a partir dos dados brutos.
4. **Frontend**: serve dados do banco SQLite local — resposta rápida, sem latência de API.

## Fontes de Dados

| Fonte | Dados | API Key |
|-------|-------|---------|
| CoinGecko | Preço, Volume, Market Cap | Opcional (tier gratuito) |
| Blockchain.info | On-chain, Hashrate, Endereços | Não necessária |
| Glassnode | MVRV, NUPL, Flows avançados | Necessária (tier gratuito disponível) |

## Setup

### Frontend
```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
```

### Backend
```bash
cd backend
npm install
cp .env.example .env      # Configure suas API keys
npm run collect:all       # Sync histórico completo (rode uma vez)
npm run dev               # Inicia servidor + cron diário
```

### Variáveis de Ambiente

**frontend/.env.local**
```
BACKEND_URL=http://localhost:3001
```

**backend/.env**
```
PORT=3001
FRONTEND_URL=http://localhost:3000
COINGECKO_API_KEY=         # opcional
GLASSNODE_API_KEY=         # recomendado
DATA_DIR=./data
LOG_LEVEL=info
```

## Deploy (Vercel)

- **Frontend**: deploy direto no Vercel como Next.js app
- **Backend**: deploy separado (Railway, Fly.io, ou Vercel Serverless Functions)
  - O banco SQLite fica num volume persistente (Railway) ou migrado para Turso/LibSQL no futuro

## Indicadores Planejados

### Preço & Mercado
- [ ] Preço histórico (candlestick + TradingView Lightweight Charts)
- [ ] Volume de negociação
- [ ] Market Cap e dominância BTC

### On-Chain
- [ ] Transações por dia
- [ ] Endereços ativos e novos
- [ ] UTXO Set
- [ ] Lightning Network (capacidade, canais, nós)

### Mineração
- [ ] Hashrate histórico
- [ ] Dificuldade e ajustes
- [ ] Receita dos mineradores
- [ ] Distribuição de pools

### Indicadores de Valor
- [ ] MVRV Z-Score
- [ ] Stock-to-Flow e desvio do modelo
- [ ] NVT Ratio e NVT Signal
- [ ] Realized Price
- [ ] Puell Multiple
- [ ] NUPL
- [ ] Reserve Risk
- [ ] RHODL Ratio

### Holders & Supply
- [ ] Distribuição por wallet size
- [ ] LTH vs STH supply
- [ ] Exchange flows
- [ ] Illiquid supply

### Ciclos
- [ ] Halvings e countdown
- [ ] Comparativo de ciclos
- [ ] Bull/Bear market histórico
