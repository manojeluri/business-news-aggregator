# AI Veritas - Deployment Guide

## Overview
This guide explains how to deploy AI Veritas to GitHub Pages while maintaining local development capability.

## Prerequisites
- Git repository initialized
- GitHub account
- Node.js installed locally

## Setup

### 1. Environment Configuration

**Local Development:**
- Uses `.env.development` with `REACT_APP_API_URL=http://localhost:5001`
- Run: `npm start` (automatically uses development environment)

**Production (GitHub Pages):**
- Uses `.env.production` with your production backend URL
- Backend must be deployed separately (Railway, Render, Heroku, etc.)

### 2. Configure Your Repository

Update `frontend/package.json`:

```json
"homepage": "https://YOUR_USERNAME.github.io/REPO_NAME"
```

Replace:
- `YOUR_USERNAME` with your GitHub username
- `REPO_NAME` with your repository name

### 3. Update Backend URL

Update `frontend/.env.production`:

```
REACT_APP_API_URL=https://your-backend-url.com
```

Replace with your actual deployed backend URL.

### 4. Deploy Backend First

You need to deploy the backend (Python service + Node server) to a platform like:

**Option 1: Railway**
```bash
cd backend
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

**Option 2: Render**
1. Create new Web Service
2. Connect your GitHub repo
3. Build command: `cd backend && npm install`
4. Start command: `node server.js`

**Option 3: Heroku**
```bash
cd backend
heroku create your-app-name
git push heroku main
```

### 5. Deploy Frontend to GitHub Pages

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Deploy to GitHub Pages
npm run deploy
```

This will:
1. Build the production version with your backend URL
2. Deploy to `gh-pages` branch
3. Your site will be live at `https://YOUR_USERNAME.github.io/REPO_NAME`

## Local Development Workflow

```bash
# Terminal 1 - Backend
cd backend
node server.js

# Terminal 2 - Python Service
cd backend
python3 service.py

# Terminal 3 - Frontend
cd frontend
npm start
```

Access locally at: `http://localhost:3000`

## Updating Production

After making changes:

```bash
cd frontend
npm run deploy
```

## Environment Variables

### Frontend
- `REACT_APP_API_URL` - Backend API URL
  - Development: `http://localhost:5001`
  - Production: Your deployed backend URL

### Backend (.env)
- `OPENAI_API_KEY` - Your OpenAI API key
- `LLM_MODEL` - Model to use (default: gpt-4o-mini)
- `MAX_ITEMS` - Max articles to process (default: 100)
- `BATCH_SIZE` - LLM batch size (default: 2)

## Important Notes

1. **CORS**: Your backend must allow requests from your GitHub Pages domain
   - Add your GitHub Pages URL to CORS settings in `backend/server.js`

2. **API Keys**: Never commit `.env` files with real API keys
   - Add `.env` to `.gitignore`
   - Set environment variables in your hosting platform

3. **Background Service**:
   - The Python `service.py` must run continuously for automatic updates
   - Set up as a background worker in your hosting platform

4. **Database**: User data is stored in `users.json`
   - For production, consider using a real database (MongoDB, PostgreSQL)

## Troubleshooting

**Issue**: Can't connect to backend from GitHub Pages
- Check backend URL in `.env.production`
- Verify CORS settings in backend
- Check browser console for errors

**Issue**: Login not working
- Backend must be running
- Check backend logs for errors
- Verify `users.json` exists

**Issue**: Articles not updating
- Ensure `service.py` is running in background
- Check `service_status.json` for errors
- Verify OpenAI API key is valid

## Repository Structure

```
Business Agent/
├── backend/
│   ├── server.js          # Node.js API server
│   ├── service.py         # Background news processor
│   ├── app.py             # Python RSS processing
│   ├── users.json         # User database
│   ├── latest_digest.json # Current news digest
│   └── .env               # Environment variables (DO NOT COMMIT)
└── frontend/
    ├── src/
    ├── public/
    ├── package.json
    ├── .env.development   # Local dev config
    └── .env.production    # Production config (template only)
```

## GitHub Pages Limitations

- Static hosting only (frontend)
- Backend must be hosted elsewhere
- No server-side processing
- Files served over HTTPS

For questions or issues, check the logs in your backend hosting platform.
