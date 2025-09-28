import React from 'react';

const NewsCard = ({ article, color }) => {
  const getCategoryTag = () => {
    const labels = article.labels || [];
    if (labels.includes('markets')) return { label: 'Markets', color: 'pending' };
    if (labels.includes('startups')) return { label: 'Startups', color: 'pending' };
    if (labels.includes('policy')) return { label: 'Policy', color: 'passed' };
    if (labels.includes('energy')) return { label: 'Energy', color: 'pending' };
    if (labels.includes('infra')) return { label: 'Infrastructure', color: 'pending' };
    return { label: 'Business News', color: 'pending' };
  };

  const categoryTag = getCategoryTag();

  return (
    <article className="news-card">
      <div className="card-header">
        <div className={`card-tag ${categoryTag.color}`}>
          📊 {categoryTag.label}
        </div>
        <h3 className="card-title">
          <a href={article.link} target="_blank" rel="noopener noreferrer">
            {article.title}
          </a>
        </h3>
        <div className="card-meta">
          <span className="card-source">SOURCE</span>
          <span className="card-source">{article.source}</span>
        </div>
      </div>

      <div className="card-content">
        <p className="card-summary">{article.one_liner}</p>

        {article.bullets && article.bullets.length > 0 && (
          <ul className="card-bullets">
            {article.bullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-footer">
        <div className="card-actions">
          <button className="action-btn">
            ❓ Ask Questions
          </button>
          <a href={article.link} target="_blank" rel="noopener noreferrer" className="action-btn">
            📖 Read More
          </a>
          <button className="action-btn share-btn">
            📤 Share
          </button>
        </div>
        <span className="card-date">Added: Today</span>
      </div>
    </article>
  );
};

export default NewsCard;