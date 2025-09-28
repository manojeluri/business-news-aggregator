import React from 'react';

const Header = ({ stats, onRefresh, refreshing }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <div className="header-icon">
            📰
          </div>
          <div className="header-text">
            <h1>Business Agent</h1>
            <p>Indian business news aggregation</p>
          </div>
        </div>

        <div className="header-right">
          <div className="stats">
            <div className="stat-item">
              <span className="stat-number">{stats.total_stories}</span>
              <span className="stat-label">Stories</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{stats.total_categories}</span>
              <span className="stat-label">Categories</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{stats.last_updated}</span>
              <span className="stat-label">Updated</span>
            </div>
          </div>

          <button
            className="refresh-btn"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh News'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;