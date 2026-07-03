from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import requests
import ml_models
import geotrade_layer

app = Flask(__name__)
# Allow CORS for Next.js frontend running on port 3000
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'Query parameter "q" is required'}), 400
    
    url = f"https://query1.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=5"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quote', methods=['GET'])
def quote():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Query parameter "symbol" is required'}), 400
    
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        return jsonify({
            'symbol': symbol,
            'shortName': info.get('shortName', symbol),
            'longName': info.get('longName', symbol),
            'currency': info.get('currency', 'USD'),
            'regularMarketPrice': info.get('currentPrice', info.get('regularMarketPrice')),
            'regularMarketChangePercent': ((info.get('currentPrice', 1) - info.get('previousClose', 1)) / info.get('previousClose', 1) * 100) if info.get('currentPrice') and info.get('previousClose') else 0,
            'regularMarketVolume': info.get('volume', info.get('regularMarketVolume')),
            'averageDailyVolume3Month': info.get('averageVolume'),
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh'),
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow'),
            'marketCap': info.get('marketCap')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chart', methods=['GET'])
def chart():
    symbol = request.args.get('symbol')
    period1 = request.args.get('period1')
    interval = request.args.get('interval', '1d')
    
    if not symbol:
        return jsonify({'error': 'Query parameter "symbol" is required'}), 400
        
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1y", interval=interval)
        
        quotes = []
        for date, row in hist.iterrows():
            if pd.notna(row['Open']) and pd.notna(row['High']) and pd.notna(row['Low']) and pd.notna(row['Close']):
                quotes.append({
                    'time': date.isoformat().split('T')[0],
                    'open': row['Open'],
                    'high': row['High'],
                    'low': row['Low'],
                    'close': row['Close']
                })
            
        return jsonify({'quotes': quotes})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/trending', methods=['GET'])
def trending():
    url = "https://query1.finance.yahoo.com/v1/finance/trending/US?count=15"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        
        trending_results = data.get('finance', {}).get('result', [{}])[0].get('quotes', [])
        symbols = [q.get('symbol') for q in trending_results]
        
        if symbols:
            tickers = yf.Tickers(' '.join(symbols))
            quotes_list = []
            for sym in symbols:
                try:
                    info = tickers.tickers[sym].info
                    quotes_list.append({
                        'symbol': sym,
                        'shortName': info.get('shortName', sym),
                        'longName': info.get('longName', sym),
                        'currency': info.get('currency', 'USD'),
                        'regularMarketPrice': info.get('currentPrice', info.get('regularMarketPrice')),
                        'regularMarketChangePercent': ((info.get('currentPrice', 1) - info.get('previousClose', 1)) / info.get('previousClose', 1) * 100) if info.get('currentPrice') and info.get('previousClose') else 0,
                        'regularMarketVolume': info.get('volume', info.get('regularMarketVolume')),
                        'marketCap': info.get('marketCap')
                    })
                except Exception:
                    pass
            return jsonify(quotes_list)
        return jsonify([])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-insights', methods=['GET'])
def ml_insights():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Query parameter "symbol" is required'}), 400
    
    insights = ml_models.get_ml_insights(symbol)
    return jsonify(insights)

@app.route('/api/advanced-signals', methods=['GET'])
def advanced_signals():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Query parameter "symbol" is required'}), 400
    
    signals = ml_models.get_advanced_signals(symbol)
    return jsonify(signals)

@app.route('/api/portfolio-optimization', methods=['POST'])
def portfolio_optimization():
    data = request.json
    symbols = data.get('symbols', [])
    if not symbols or not isinstance(symbols, list):
        return jsonify({'error': 'JSON body must contain a "symbols" list'}), 400
        
    result = ml_models.portfolio_optimization(symbols)
    return jsonify(result)

@app.route('/api/market-overview', methods=['GET'])
def market_overview():
    try:
        # Example hardcoded set of important tickers for the heatmap
        # Ideally, we scrape Yahoo's gainers/losers page, but yfinance doesn't easily expose the raw screener.
        # So we fetch a mixed bag of major indices and popular tech/finance stocks to simulate the overview.
        symbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'JPM', 'V', 'WMT', 'JNJ', 'PG', 'XOM', 'BAC', 'MA']
        tickers = yf.Tickers(' '.join(symbols))
        
        results = []
        for sym in symbols:
            try:
                info = tickers.tickers[sym].fast_info
                prev_close = info.previous_close
                curr_price = info.last_price
                change_pct = ((curr_price - prev_close) / prev_close) * 100
                
                results.append({
                    'symbol': sym,
                    'price': curr_price,
                    'change': change_pct,
                    'volume': info.last_volume,
                    'marketCap': info.market_cap
                })
            except:
                pass
                
        # Sort by best performers
        results = sorted(results, key=lambda x: x['change'], reverse=True)
        
        return jsonify({
            'top_gainers': results[:5],
            'top_losers': results[-5:],
            'most_active': sorted(results, key=lambda x: x['volume'], reverse=True)[:5],
            'all_assets': results
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze-idea', methods=['POST'])
def analyze_idea():
    data = request.json
    text = data.get('title', '') + " " + data.get('content', '')
    ticker = data.get('ticker', '')
    sentiment = data.get('sentiment', 'BULLISH')
    
    # 1. Base Sentiment Analysis of user's justification
    sentiment_score = ml_models.sentiment_analyzer.polarity_scores(text)['compound']
    
    # 2. Risk Context based on Text Length & Detail
    word_count = len(text.split())
    
    # Simple algorithmic confidence heuristic substituting a full neural-net here
    # Higher word count + stronger sentiment == higher confidence
    base_confidence = 50
    confidence_modifier = (sentiment_score * 20) if sentiment == 'BULLISH' else (sentiment_score * -20)
    word_count_modifier = min(20, word_count / 10) 
    
    final_confidence = min(99, max(1, int(base_confidence + confidence_modifier + word_count_modifier)))
    
    risk_analysis = "Moderate Risk"
    if final_confidence < 30:
        risk_analysis = "High Risk: Lacking supporting rationale or conflicting text sentiment."
    elif final_confidence > 75:
        risk_analysis = "Low Risk: Strong supporting rationale aligned with directional bias."

    return jsonify({
        'confidence_score': final_confidence,
        'risk_analysis': risk_analysis
    })

@app.route('/api/geotrade', methods=['GET'])
def geotrade():
    try:
        data = geotrade_layer.get_geotrade_analysis()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/geotrade/deep', methods=['GET'])
def geotrade_deep():
    country = request.args.get('country')
    if not country:
        return jsonify({'error': 'Country code is required'}), 400
        
    try:
        data = geotrade_layer.get_deep_country_analysis(country)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
