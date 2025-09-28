#!/usr/bin/env python3
"""
Development server startup script
Runs both the API server and React development server with hot reload
"""

import subprocess
import sys
import os
import time

def start_api_server():
    """Start the API server"""
    print("🚀 Starting API server on port 5001...")
    return subprocess.Popen(
        [sys.executable, 'api_server.py'],
        cwd=os.getcwd(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

def start_react_dev_server():
    """Start the React development server"""
    print("⚛️  Starting React dev server on port 3000...")
    return subprocess.Popen(
        ['npm', 'start'],
        cwd=os.path.join(os.getcwd(), 'react-frontend'),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

def main():
    print("🔥 Starting development servers with hot reload...")
    print("📡 API Server: http://localhost:5001/api")
    print("⚛️  React App: http://localhost:3000")
    print("Press Ctrl+C to stop both servers")

    api_process = None
    react_process = None

    try:
        # Start API server
        api_process = start_api_server()
        time.sleep(2)  # Give it time to start

        # Start React dev server
        react_process = start_react_dev_server()
        time.sleep(3)  # Give it time to start

        print("\n✅ Both servers are running!")
        print("🌐 Open http://localhost:3000 for development with hot reload")
        print("🌐 Open http://localhost:5001 for production build")

        # Wait for both processes
        while True:
            if api_process.poll() is not None:
                print("❌ API server stopped")
                break
            if react_process.poll() is not None:
                print("❌ React server stopped")
                break
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n🛑 Stopping servers...")

    finally:
        # Clean up processes
        if api_process:
            api_process.terminate()
            api_process.wait()
        if react_process:
            react_process.terminate()
            react_process.wait()
        print("✅ All servers stopped")

if __name__ == "__main__":
    main()