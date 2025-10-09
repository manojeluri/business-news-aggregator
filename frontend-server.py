#!/usr/bin/env python3
"""
Simple HTTP server to serve the React frontend build files
Run this to make your frontend accessible on the network
"""

import http.server
import socketserver
import os
import sys

PORT = 8000
DIRECTORY = "react-frontend/build"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Add CORS headers for API calls
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        # Serve index.html for all routes (SPA routing)
        if not os.path.exists(os.path.join(DIRECTORY, self.path.lstrip('/'))):
            if not self.path.startswith('/static/'):
                self.path = '/index.html'
        return super().do_GET()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 Frontend server running at:")
        print(f"   Local:    http://localhost:{PORT}")
        print(f"   Network:  http://0.0.0.0:{PORT}")
        print(f"   Directory: {DIRECTORY}")
        print("\n📱 Your Business Agent app is now accessible!")
        print("   - News loads automatically (no refresh needed)")
        print("   - Connected to backend API")
        print("   - 50 fresh Indian business stories")
        print("\nPress Ctrl+C to stop the server")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")
            sys.exit(0)