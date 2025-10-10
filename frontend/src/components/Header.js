import React, { useState } from 'react';
import ThemeToggle from './ThemeToggle';

const Header = ({ stats, onRefresh, refreshing, user, onLogout, onProfileClick }) => {
  const [menuOpen, setMenuOpen] = useState(false);

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

  const handleMenuToggle = () => {
    setMenuOpen(!menuOpen);
  };

  const handleMenuAction = (action) => {
    setMenuOpen(false);
    action();
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
          {/* Desktop View - Full Buttons */}
          <div className="header-desktop-actions">
            <button
              className="refresh-btn"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <span className="refresh-btn-icon">🔄</span>
              <span className="refresh-btn-text">{refreshing ? 'Refreshing...' : 'Refresh News'}</span>
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

          {/* Mobile View - Hamburger Menu */}
          <div className="header-mobile-actions">
            <button
              className={`mobile-menu-button ${menuOpen ? 'active' : ''}`}
              onClick={handleMenuToggle}
              aria-label="Menu"
            >
              <span className="hamburger-icon">
                {menuOpen ? '✕' : '☰'}
              </span>
            </button>

            {menuOpen && (
              <>
                <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)} />
                <div className="mobile-menu-dropdown">
                  <div className="mobile-menu-header">
                    <span className="mobile-menu-user">👤 {user?.name || 'User'}</span>
                    <span className="mobile-menu-updated">Updated: {stats.last_updated}</span>
                  </div>

                  <button
                    className="mobile-menu-item"
                    onClick={() => handleMenuAction(onRefresh)}
                    disabled={refreshing}
                  >
                    <span className="mobile-menu-icon">🔄</span>
                    <span>{refreshing ? 'Refreshing...' : 'Refresh News'}</span>
                  </button>

                  <button
                    className="mobile-menu-item"
                    onClick={() => handleMenuAction(onProfileClick)}
                  >
                    <span className="mobile-menu-icon">👤</span>
                    <span>My Profile</span>
                  </button>

                  <div className="mobile-menu-item mobile-menu-theme">
                    <span className="mobile-menu-icon">🌙</span>
                    <span>Dark Mode</span>
                    <ThemeToggle />
                  </div>

                  <button
                    className="mobile-menu-item mobile-menu-logout"
                    onClick={() => handleMenuAction(onLogout)}
                  >
                    <span className="mobile-menu-icon">🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
