import React from 'react';

const Header = ({ stats, onRefresh, refreshing }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="stat-item">
          <span className="stat-number">{stats.last_updated}</span>
          <span className="stat-label">Last Updated</span>
        </div>

        <button
          className="refresh-btn"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? '🔄 Refreshing...' : '🔄 Refresh News'}
        </button>
      </div>
    </header>
  );
};

export default Header;