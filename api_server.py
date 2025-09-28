#!/usr/bin/env python3
"""
Business Agent - API Server
REST API backend for news data
"""

import os
import json
from datetime import datetime
from flask import Flask, jsonify, send_from_directory, render_template_string
from flask_cors import CORS
from app import main as run_news_aggregation

app = Flask(__name__, static_folder='react-frontend/build', static_url_path='')
CORS(app)  # Enable CORS for all routes

def get_latest_news_data():
    """Get the latest processed news data"""
    today = datetime.now().strftime("%Y-%m-%d")
    json_file = f"run_{today}.json"

    if os.path.exists(json_file):
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('llm_output', [])

    # Fallback to default data if no current data exists
    if os.path.exists('default_data.json'):
        with open('default_data.json', 'r', encoding='utf-8') as f:
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
def serve_frontend():
    """Serve the main React frontend page"""
    return send_from_directory('react-frontend/build', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files from React build directory"""
    # Handle React Router routes by serving index.html for non-API routes
    if filename.startswith('api/'):
        return None  # Let Flask handle API routes
    try:
        return send_from_directory('react-frontend/build', filename)
    except:
        # For any other routes (React Router), serve the index.html
        return send_from_directory('react-frontend/build', 'index.html')

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/news')
def get_news():
    """Get all news items"""
    try:
        news_items = get_latest_news_data()
        return jsonify({
            'success': True,
            'data': news_items,
            'count': len(news_items),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/cards')
def get_news_cards():
    """Single endpoint for all news cards data"""
    try:
        news_items = get_latest_news_data()
        categorized_news = group_news_by_category(news_items)

        # Calculate stats
        total_stories = sum(len(category['articles']) for category in categorized_news.values())
        total_categories = len(categorized_news)
        last_updated = datetime.now().strftime('%H:%M')

        return jsonify({
            'success': True,
            'data': {
                'categories': categorized_news,
                'stats': {
                    'total_stories': total_stories,
                    'total_categories': total_categories,
                    'last_updated': last_updated
                }
            },
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/news/categorized')
def get_categorized_news():
    """Get news items grouped by category (legacy endpoint)"""
    try:
        news_items = get_latest_news_data()
        categorized_news = group_news_by_category(news_items)
        return jsonify({
            'success': True,
            'data': categorized_news,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/health')
def health_check():
    """Health check endpoint for deployment platforms"""
    try:
        # Simple health check that doesn't depend on data files
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'service': 'business-agent-api',
            'version': '1.0.0'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/refresh')
def refresh_news():
    """Trigger news data refresh"""
    try:
        # Run the news aggregation
        run_news_aggregation()
        return jsonify({
            'success': True,
            'message': 'News data refreshed successfully',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    # Railway uses PORT environment variable
    port = int(os.getenv('PORT', os.getenv('API_PORT', 5001)))
    app.run(debug=True, host='0.0.0.0', port=port)