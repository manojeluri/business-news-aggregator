import React from 'react';
import ThemeToggle from './ThemeToggle';

const Header = ({ stats, onRefresh, refreshing, user, onLogout, onProfileClick }) => {
  const getCurrentDate = () => {
    const today = new Date();
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return today.toLocaleDateString('en-US', options);
  };
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <div className="header-icon">
            📰
          </div>
          <div className="header-text">
            <h1>AI Veritas</h1>
          </div>
        </div>

        <div className="header-center">
          <div className="current-date">{getCurrentDate()}</div>
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search news..."
            />
            <span className="search-icon">🔍</span>
          </div>
        </div>

        <div className="header-right">
          <button
            className="refresh-btn"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh News'}
          </button>

          <ThemeToggle />

          {user && (
            <div className="user-menu">
              <button className="user-profile-btn" onClick={onProfileClick}>
                <span className="user-icon">👤</span>
                <span className="user-name">{user.name}</span>
              </button>
              <button className="logout-btn" onClick={onLogout}>
                Logout
              </button>
            </div>
          )}

          <div className="header-meta">
            <span className="header-updated-label">Last updated</span>
            <span className="header-updated-value">{stats.last_updated}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
