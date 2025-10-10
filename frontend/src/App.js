import React, { useState, useEffect, useRef } from 'react';
import { apiCall } from './config/api';
import Header from './components/Header';
import CategorySection from './components/CategorySection';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import Notification from './components/Notification';
import Login from './components/Login';
import Profile from './components/Profile';
import { ThemeProvider } from './contexts/ThemeContext';
import Masonry from 'react-masonry-css';

function App() {
  const [newsData, setNewsData] = useState({});
  const [stats, setStats] = useState({ total_stories: 0, total_categories: 0, last_updated: '-' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [lastDigestTimestamp, setLastDigestTimestamp] = useState(null);

  // Use refs for values that shouldn't trigger re-renders
  const isScrollingRef = useRef(false);
  const lastDigestRef = useRef(null);

  // Authentication state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const loadNews = async (updateTimestamp = null, silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // If user is logged in, get personalized digest
      let response;
      if (user && token) {
        try {
          response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/personalized-digest`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await response.json();

          if (data.success) {
            // Format personalized data to match expected structure
            const formattedCategories = {};
            Object.entries(data.data.categories).forEach(([name, articles]) => {
              formattedCategories[name] = { name, articles, color: '#6B7280' };
            });

            setNewsData(formattedCategories);

            const displayTime = updateTimestamp || (data.data.last_updated ? new Date(data.data.last_updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-');
            setStats({
              total_stories: data.data.total_items,
              total_categories: Object.keys(data.data.categories).length,
              last_updated: displayTime
            });

            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Personalized digest failed, falling back to public feed:', err);
        }
      }

      // Fall back to public feed
      response = await apiCall('/api/cards');

      if (response.success) {
        setNewsData(response.data.categories);

        // Update stats with custom timestamp if provided (from refresh), otherwise use server timestamp
        const displayTime = updateTimestamp || response.data.stats.last_updated;
        setStats({
          ...response.data.stats,
          last_updated: displayTime
        });
      } else {
        throw new Error(response.error || 'Failed to load news');
      }
    } catch (err) {
      console.error('Failed to load news:', err);
      if (!silent) {
        setError(err.message || 'Failed to load news');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const refreshNews = async () => {
    try {
      setRefreshing(true);

      // Trigger refresh on backend
      const refreshResponse = await apiCall('/api/refresh', { method: 'POST' });

      if (!refreshResponse.success) {
        throw new Error(refreshResponse.error || 'Refresh failed');
      }

      // Check if there are new updates
      const digestTimestamp = refreshResponse.digest_timestamp;
      const hasNewUpdates = lastDigestRef.current !== digestTimestamp;

      // Update the last known digest timestamp
      setLastDigestTimestamp(digestTimestamp);
      lastDigestRef.current = digestTimestamp;

      // Format the refresh timestamp for display (HH:MM format)
      const refreshDate = new Date(refreshResponse.refresh_timestamp);
      const displayTime = `${String(refreshDate.getHours()).padStart(2, '0')}:${String(refreshDate.getMinutes()).padStart(2, '0')}`;

      // Reload the news data with the new display time
      await loadNews(displayTime);

      // Show appropriate message
      if (hasNewUpdates) {
        showNotification('New updates loaded', 'success');
      } else {
        showNotification('No new updates', 'info');
      }

    } catch (err) {
      console.error('Refresh failed:', err);
      showNotification('Failed to refresh news. Please try again.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Check for saved auth on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to restore session:', err);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Detect scrolling to prevent updates during scroll
  useEffect(() => {
    let scrollTimeout;

    const handleScroll = () => {
      isScrollingRef.current = true;

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Set scrolling to false after 150ms of no scrolling
      scrollTimeout = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, []);

  useEffect(() => {
    // Load existing data on page load
    const initLoad = async () => {
      try {
        await loadNews();

        // Get the digest timestamp from the response
        const statusResponse = await apiCall('/api/status');
        if (statusResponse.digest) {
          const timestamp = statusResponse.digest.last_updated;
          setLastDigestTimestamp(timestamp);
          lastDigestRef.current = timestamp;
        }
      } catch (error) {
        console.error('Initial load failed:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    initLoad();

    // Auto-refresh every 5 minutes (silently in the background)
    const interval = setInterval(async () => {
      // Don't refresh if user is actively scrolling
      if (isScrollingRef.current) {
        console.log('Skipping auto-refresh during scroll');
        return;
      }

      try {
        // Save scroll position before refresh
        const scrollPos = window.scrollY;

        const response = await apiCall('/api/refresh', { method: 'POST' });
        if (response.success) {
          const digestTimestamp = response.digest_timestamp;
          const hasNewUpdates = lastDigestRef.current !== digestTimestamp;
          setLastDigestTimestamp(digestTimestamp);
          lastDigestRef.current = digestTimestamp;

          const refreshDate = new Date(response.refresh_timestamp);
          const displayTime = `${String(refreshDate.getHours()).padStart(2, '0')}:${String(refreshDate.getMinutes()).padStart(2, '0')}`;

          // Silent refresh - no loading spinner, smooth update
          await loadNews(displayTime, true);

          // Restore scroll position after a brief delay for render
          setTimeout(() => {
            window.scrollTo(0, scrollPos);
          }, 100);

          // Only show notification if there are actually new updates
          if (hasNewUpdates) {
            showNotification('New articles available', 'info');
          }
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error);
        // Don't show error to user for background refresh
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, token]);

  // Authentication handlers
  const handleLoginSuccess = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    showNotification(`Welcome back, ${userData.name}!`, 'success');
    loadNews(); // Reload with personalized feed
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      showNotification('Logged out successfully', 'info');
      loadNews(); // Reload with public feed
    }
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
    showNotification('Profile updated!', 'success');
    loadNews(); // Reload with updated interests
  };

  // Combine all articles from all categories and sort by most recent
  const getAllArticles = () => {
    const allArticles = [];
    Object.entries(newsData).forEach(([categoryKey, categoryData]) => {
      if (categoryData.articles) {
        allArticles.push(...categoryData.articles);
      }
    });

    // Sort by publication date - most recent first
    return allArticles.sort((a, b) => {
      const dateA = a.published ? new Date(a.published) : new Date(0);
      const dateB = b.published ? new Date(b.published) : new Date(0);
      return dateB - dateA; // Most recent first
    });
  };

  // Show login screen if not authenticated
  if (!user) {
    return (
      <ThemeProvider>
        <Login onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="container">
        <Header
          stats={stats}
          onRefresh={refreshNews}
          refreshing={refreshing}
          user={user}
          onLogout={handleLogout}
          onProfileClick={() => setShowProfile(true)}
        />

        {loading && <LoadingSpinner />}

        {error && <ErrorMessage message={error} onRetry={loadNews} />}

        {!loading && !error && (
          <main>
            {Object.keys(newsData).length === 0 ? (
              <div className="loading">
                <p>No news available. Try refreshing to fetch the latest stories.</p>
              </div>
            ) : (
              <Masonry
                breakpointCols={{
                  default: 4,
                  1200: 3,
                  900: 2,
                  600: 1
                }}
                className="cards-grid"
                columnClassName="cards-grid-column"
              >
                {getAllArticles().map((article) => (
                  <CategorySection
                    key={article.link || article.title}
                    categoryData={{ articles: [article] }}
                  />
                ))}
              </Masonry>
            )}
          </main>
        )}

        {showProfile && (
          <Profile
            user={user}
            token={token}
            onUpdate={handleProfileUpdate}
            onClose={() => setShowProfile(false)}
          />
        )}

        <Notification
          show={notification.show}
          message={notification.message}
          type={notification.type}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;