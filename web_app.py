#!/usr/bin/env python3
"""
Business Agent - Web Application
Flask server for Pinterest-style news cards
"""

import os
import json
from datetime import datetime
from flask import Flask, render_template, jsonify
from app import main as run_news_aggregation

app = Flask(__name__)

def get_latest_news_data():
    """Get the latest processed news data"""
    today = datetime.now().strftime("%Y-%m-%d")
    json_file = f"run_{today}.json"

    if os.path.exists(json_file):
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('llm_output', [])

    return []

def group_news_by_category(news_items):
    """Group news items by their primary category"""
    categories = {
        'policy': {'name': 'Policy', 'articles': [], 'color': '#3B82F6'},
        'markets': {'name': 'Markets', 'articles': [], 'color': '#10B981'},
        'startups': {'name': 'Startups', 'articles': [], 'color': '#8B5CF6'},
        'infra': {'name': 'Infrastructure', 'articles': [], 'color': '#F59E0B'},
        'energy': {'name': 'Energy', 'articles': [], 'color': '#EF4444'},
        'misc': {'name': 'Other', 'articles': [], 'color': '#6B7280'}
    }

    for item in news_items:
        primary_label = item.get('labels', ['misc'])[0]
        if primary_label in categories:
            categories[primary_label]['articles'].append(item)

    # Filter out empty categories
    return {k: v for k, v in categories.items() if v['articles']}

@app.route('/')
def index():
    """Main page with Pinterest-style news cards"""
    news_items = get_latest_news_data()
    categorized_news = group_news_by_category(news_items)

    return render_template('index.html',
                         categorized_news=categorized_news,
                         total_items=len(news_items),
                         last_updated=datetime.now().strftime("%Y-%m-%d %H:%M"))

@app.route('/api/news')
def api_news():
    """API endpoint to get news data as JSON"""
    news_items = get_latest_news_data()
    categorized_news = group_news_by_category(news_items)

    return jsonify({
        'categorized_news': categorized_news,
        'total_items': len(news_items),
        'last_updated': datetime.now().strftime("%Y-%m-%d %H:%M")
    })

@app.route('/refresh')
def refresh_news():
    """Refresh news data by running the aggregation"""
    try:
        # Run the news aggregation
        run_news_aggregation()
        return jsonify({'status': 'success', 'message': 'News data refreshed successfully'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)