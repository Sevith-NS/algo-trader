from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import requests
import ml_models
import geotrade_layer
import quant_models
import news_engine
import ai_assistant
import risk_analytics
import data_source

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
        return jsonify(data_source.get_quote(symbol))
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
        hist = data_source.get_history(symbol, period="1y")

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
    try:
        return jsonify(data_source.get_trending())
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

@app.route('/api/quant-signals', methods=['GET'])
def quant_signals():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Query parameter "symbol" is required'}), 400

    return jsonify(quant_models.get_quant_signals(symbol))

@app.route('/api/news', methods=['GET'])
def global_news():
    return jsonify(news_engine.get_global_news())

@app.route('/api/news/ticker', methods=['GET'])
def ticker_news():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Query parameter "symbol" is required'}), 400

    return jsonify(news_engine.get_ticker_news(symbol))

@app.route('/api/ai-chat', methods=['POST'])
def ai_chat():
    data = request.json or {}
    messages = data.get('messages', [])
    if not messages:
        return jsonify({'error': 'JSON body must contain a non-empty "messages" list'}), 400

    result = ai_assistant.chat(
        messages=messages,
        portfolio=data.get('portfolio'),
        symbol=data.get('symbol')
    )
    return jsonify(result)

@app.route('/api/portfolio-analytics', methods=['POST'])
def portfolio_analytics():
    data = request.json or {}
    positions = data.get('positions', [])
    balance = data.get('balance', 0)
    if not positions:
        return jsonify({'error': 'JSON body must contain a "positions" list'}), 400

    return jsonify(risk_analytics.get_portfolio_analytics(positions, balance))

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
        return jsonify(data_source.get_market_overview())
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
