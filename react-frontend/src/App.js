import React, { useState, useEffect } from 'react';
import { apiCall } from './config/api';
import Header from './components/Header';
import CategorySection from './components/CategorySection';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import Notification from './components/Notification';

function App() {
  const [newsData, setNewsData] = useState({});
  const [stats, setStats] = useState({ total_stories: 0, total_categories: 0, last_updated: '-' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const loadNews = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiCall('/api/cards');

      if (response.success) {
        setNewsData(response.data.categories);
        setStats(response.data.stats);
      } else {
        throw new Error(response.error || 'Failed to load news');
      }
    } catch (err) {
      console.error('Failed to load news:', err);
      setError(err.message || 'Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  const refreshNews = async () => {
    try {
      setRefreshing(true);

      // Trigger refresh on backend
      const refreshResponse = await apiCall('/api/refresh');

      if (!refreshResponse.success) {
        throw new Error(refreshResponse.error || 'Refresh failed');
      }

      // Reload the news data
      await loadNews();
      showNotification('News refreshed successfully!', 'success');

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

  useEffect(() => {
    // Automatically refresh news on page load for fresh content
    console.log('Auto-refreshing news on page load...');
    handleRefresh();

    // Auto-refresh every 30 minutes
    const interval = setInterval(async () => {
      try {
        const response = await apiCall('/api/refresh');
        if (response.success) {
          await loadNews();
          showNotification('News updated automatically');
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <Header
        stats={stats}
        onRefresh={refreshNews}
        refreshing={refreshing}
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
            Object.entries(newsData).map(([categoryKey, categoryData]) => (
              <CategorySection
                key={categoryKey}
                categoryData={categoryData}
              />
            ))
          )}
        </main>
      )}

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
}

export default App;