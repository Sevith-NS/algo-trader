# Vanguard OS — Quant Screener & Portfolio Intelligence

A personal stock screener and portfolio management platform with quant-grade analytics:

- **Terminal (Screener)** — candlestick charting with a systematic multi-factor **Quant Trade Plan**: limit entry, ATR/swing-based stop loss, 1.5R / 3R targets, factor vote breakdown (mean reversion, momentum, VWAP, volume flow, RSI) and **half-Kelly position sizing**.
- **Portfolio** — paper trading with live prices, **risk analytics** (95% VaR & CVaR in dollars, Sharpe, Sortino, max drawdown, beta vs S&P 500, diversification score), sector allocation, and Markowitz max-Sharpe optimization.
- **News** — global headlines across 8 market categories, each scored with NLP sentiment, plus a global market mood gauge.
- **Vanguard AI** — floating assistant (bottom-right on every page) powered by Gemini. It sees your paper portfolio, the symbol on screen, live quant signals and news sentiment, and answers grounded questions about risk, sizing and markets.
- **ML Forecasts** — XGBoost next-day direction probability, Prophet 7-day forecast, news fear/greed index.
- **Geotrade** — AI macro analysis per country on a 3D globe.

## Architecture

- `src/` — Next.js 16 (App Router, Tailwind) frontend on port 3000
- `backend/` — Flask quant/data backend on port 5000
  - `quant_models.py` — multi-factor signal engine + trade levels + Kelly sizing
  - `risk_analytics.py` — VaR/CVaR, Sharpe/Sortino, drawdown, beta, correlations
  - `news_engine.py` — Google News RSS + VADER sentiment (5-min cache)
  - `ai_assistant.py` — Gemini chat grounded in live portfolio/signal context
  - `ml_models.py` — XGBoost, Prophet, Markowitz optimization
  - `geotrade_layer.py` — country macro analysis

## Getting Started

### 1. Backend (Flask, port 5000)

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./run.sh
```

`run.sh` handles a macOS quirk: on machines behind a TLS-intercepting corporate proxy it
exports the system keychain CAs so Yahoo Finance / Google News / Gemini requests don't fail
with certificate errors. (`./venv/bin/python app.py` also works on a normal network.)
XGBoost on macOS needs OpenMP: `brew install libomp`.

Create a `.env` in the project root with your Gemini key (used by the AI assistant and Geotrade):

```
GEMINI_API_KEY=your_key_here
```

### 2. Frontend (Next.js, port 3000)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set `NEXT_PUBLIC_API_URL` if the backend runs somewhere other than `http://127.0.0.1:5000`.

## Key API Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/quant-signals?symbol=` | Multi-factor signal, entry/stop/targets, Kelly sizing |
| `POST /api/portfolio-analytics` | VaR, CVaR, Sharpe, Sortino, drawdown, beta, sectors |
| `GET /api/news` | Global news with per-headline sentiment + mood indices |
| `GET /api/news/ticker?symbol=` | Ticker-specific headlines + sentiment |
| `POST /api/ai-chat` | Portfolio-aware Gemini assistant |
| `GET /api/ml-insights?symbol=` | XGBoost direction, Prophet forecast, fear/greed |
| `POST /api/portfolio-optimization` | Markowitz max-Sharpe weights + CAPM betas |

> All trading is paper trading. Signals and analytics are educational, not financial advice.
