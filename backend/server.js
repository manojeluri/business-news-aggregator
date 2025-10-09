const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// User management helpers
async function loadUsers() {
  try {
    const usersPath = path.join(__dirname, 'users.json');
    const content = await fs.readFile(usersPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading users:', error);
    return [];
  }
}

async function saveUsers(users) {
  try {
    const usersPath = path.join(__dirname, 'users.json');
    await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
    throw error;
  }
}

function generateToken(userId) {
  return crypto.randomBytes(32).toString('hex') + '_' + userId;
}

// In-memory token store (in production, use Redis or database)
const activeSessions = new Map();

/**
 * Load the latest digest from pre-processed file
 */
async function loadLatestDigest() {
  try {
    const digestPath = path.join(__dirname, 'latest_digest.json');
    const content = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading digest:', error);
    return null;
  }
}

/**
 * GET /api/news
 * Returns pre-processed digest (instant response)
 */
app.get('/api/news', async (req, res) => {
  try {
    console.log('📥 GET /api/news - Fetching digest...');

    const digestData = await loadLatestDigest();

    if (!digestData) {
      return res.status(404).json({
        success: false,
        error: 'No news data available. Service may still be processing.'
      });
    }

    console.log(`✅ Loaded ${digestData.total_items || 0} news items`);

    res.json({
      success: true,
      data: digestData,
      timestamp: digestData.last_updated
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to format categories for frontend
 */
function formatCategoriesForFrontend(categories) {
  const colorMap = {
    'Policy & Regulation': '#3B82F6',
    'Markets': '#10B981',
    'Startups & Innovation': '#8B5CF6',
    'Infrastructure & Real Estate': '#F59E0B',
    'Energy & Resources': '#EF4444',
    'Business News': '#6B7280'
  };

  const formatted = {};
  for (const [name, articles] of Object.entries(categories)) {
    formatted[name] = {
      name: name,
      articles: articles,
      color: colorMap[name] || '#6B7280'
    };
  }

  return formatted;
}

/**
 * GET /api/cards
 * Returns categorized news cards (instant response from pre-processed digest)
 */
app.get('/api/cards', async (req, res) => {
  try {
    console.log('📥 GET /api/cards - Fetching categorized news...');

    const digestData = await loadLatestDigest();

    if (!digestData) {
      return res.status(404).json({
        success: false,
        error: 'No news data available. Service may still be processing.'
      });
    }

    // Format categories for frontend
    const categorized_news = formatCategoriesForFrontend(digestData.categories);

    // Calculate stats
    const total_stories = digestData.total_items || 0;
    const total_categories = Object.keys(categorized_news).length;
    const last_updated_date = new Date(digestData.last_updated);
    const last_updated = `${String(last_updated_date.getHours()).padStart(2, '0')}:${String(last_updated_date.getMinutes()).padStart(2, '0')}`;

    console.log(`✅ Loaded ${total_stories} stories across ${total_categories} categories`);

    res.json({
      success: true,
      data: {
        categories: categorized_news,
        stats: {
          total_stories,
          total_categories,
          last_updated
        }
      },
      timestamp: digestData.last_updated
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/refresh
 * Just reads the latest digest (service.py handles actual processing)
 */
app.post('/api/refresh', async (req, res) => {
  try {
    console.log('🔄 POST /api/refresh - Fetching latest digest...');

    const digestData = await loadLatestDigest();

    if (!digestData) {
      return res.status(404).json({
        success: false,
        error: 'No digest available. Service may still be processing.'
      });
    }

    console.log('✅ Refresh completed');

    res.json({
      success: true,
      message: 'News refreshed successfully',
      itemsProcessed: digestData.total_items || 0,
      digest_timestamp: digestData.last_updated,  // When digest was last generated
      refresh_timestamp: new Date().toISOString()  // Current time when refresh was clicked
    });
  } catch (error) {
    console.error('Error refreshing news:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/login
 * Authenticate user and return token
 */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    const users = await loadUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user.id);
    activeSessions.set(token, {
      userId: user.id,
      email: user.email,
      createdAt: new Date().toISOString()
    });

    console.log(`✅ User logged in: ${user.email}`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        interests: user.interests
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/signup
 * Create new user account
 */
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, name, interests } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name required'
      });
    }

    const users = await loadUsers();

    // Check if user exists
    if (users.find(u => u.email === email)) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Create new user
    const newUser = {
      id: `user_${Date.now()}`,
      email,
      password, // In production, hash this!
      name,
      interests: interests || [],
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await saveUsers(users);

    // Generate token
    const token = generateToken(newUser.id);
    activeSessions.set(token, {
      userId: newUser.id,
      email: newUser.email,
      createdAt: new Date().toISOString()
    });

    console.log(`✅ New user created: ${newUser.email}`);

    res.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        interests: newUser.interests
      }
    });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/profile
 * Get user profile (requires auth)
 */
app.get('/api/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token || !activeSessions.has(token)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const session = activeSessions.get(token);
    const users = await loadUsers();
    const user = users.find(u => u.id === session.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        interests: user.interests
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/profile
 * Update user profile (requires auth)
 */
app.put('/api/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token || !activeSessions.has(token)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const session = activeSessions.get(token);
    const users = await loadUsers();
    const userIndex = users.findIndex(u => u.id === session.userId);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update user
    const { name, interests } = req.body;
    if (name) users[userIndex].name = name;
    if (interests) users[userIndex].interests = interests;

    await saveUsers(users);

    console.log(`✅ Profile updated: ${users[userIndex].email}`);

    res.json({
      success: true,
      user: {
        id: users[userIndex].id,
        email: users[userIndex].email,
        name: users[userIndex].name,
        interests: users[userIndex].interests
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/personalized-digest
 * Get articles filtered by user interests (requires auth)
 */
app.get('/api/personalized-digest', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token || !activeSessions.has(token)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const session = activeSessions.get(token);
    const users = await loadUsers();
    const user = users.find(u => u.id === session.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const digestData = await loadLatestDigest();

    if (!digestData) {
      return res.status(404).json({
        success: false,
        error: 'No digest available'
      });
    }

    // Filter categories based on user interests
    const filteredCategories = {};
    const userInterests = user.interests || [];

    if (userInterests.length === 0) {
      // No interests set, show everything
      Object.assign(filteredCategories, digestData.categories);
    } else {
      // Filter by interests
      for (const interest of userInterests) {
        if (digestData.categories[interest]) {
          filteredCategories[interest] = digestData.categories[interest];
        }
      }
    }

    // Calculate total items
    const totalItems = Object.values(filteredCategories).reduce(
      (sum, articles) => sum + articles.length,
      0
    );

    console.log(`✅ Personalized digest for ${user.email}: ${totalItems} articles`);

    res.json({
      success: true,
      data: {
        date: digestData.date,
        last_updated: digestData.last_updated,
        categories: filteredCategories,
        total_items: totalItems,
        user_interests: userInterests
      }
    });
  } catch (error) {
    console.error('Error fetching personalized digest:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/logout
 * Logout user
 */
app.post('/api/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token && activeSessions.has(token)) {
      activeSessions.delete(token);
      console.log('✅ User logged out');
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/status
 * Returns service status and digest info
 */
app.get('/api/status', async (req, res) => {
  try {
    // Load service status
    let serviceStatus = null;
    try {
      const statusPath = path.join(__dirname, 'service_status.json');
      const statusContent = await fs.readFile(statusPath, 'utf-8');
      serviceStatus = JSON.parse(statusContent);
    } catch (err) {
      // Service status file may not exist yet
    }

    // Load digest
    const digestData = await loadLatestDigest();

    res.json({
      service: serviceStatus || { status: 'unknown', message: 'Service status unavailable' },
      digest: digestData ? {
        available: true,
        total_items: digestData.total_items,
        last_updated: digestData.last_updated,
        categories: Object.keys(digestData.categories || {})
      } : {
        available: false
      }
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  const digestData = await loadLatestDigest();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    digest_available: !!digestData
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Node.js Backend Server Running
📡 Port: ${PORT}
🌐 API: http://localhost:${PORT}
📰 News: http://localhost:${PORT}/api/news
📊 Cards: http://localhost:${PORT}/api/cards
📈 Status: http://localhost:${PORT}/api/status
🔄 Refresh: POST http://localhost:${PORT}/api/refresh
💚 Health: http://localhost:${PORT}/health

🔐 Authentication:
   Login: POST http://localhost:${PORT}/api/login
   Signup: POST http://localhost:${PORT}/api/signup
   Profile: GET/PUT http://localhost:${PORT}/api/profile
   Personalized: GET http://localhost:${PORT}/api/personalized-digest
   Logout: POST http://localhost:${PORT}/api/logout

⚠️  NOTE: Start service.py in a separate terminal for background processing
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
