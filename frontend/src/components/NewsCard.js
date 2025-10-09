import React from 'react';

const CATEGORY_STYLES = {
  policy: {
    label: 'Policy',
    color: '#3B82F6',
    background: 'rgba(59, 130, 246, 0.12)'
  },
  markets: {
    label: 'Markets',
    color: '#10B981',
    background: 'rgba(16, 185, 129, 0.12)'
  },
  startups: {
    label: 'Startups',
    color: '#8B5CF6',
    background: 'rgba(139, 92, 246, 0.12)'
  },
  infra: {
    label: 'Infrastructure',
    color: '#F59E0B',
    background: 'rgba(245, 158, 11, 0.12)'
  },
  energy: {
    label: 'Energy',
    color: '#EF4444',
    background: 'rgba(239, 68, 68, 0.12)'
  },
  misc: {
    label: 'Business News',
    color: '#6B7280',
    background: 'rgba(107, 114, 128, 0.12)'
  }
};

const SOURCE_COLOR_PALETTE = [
  '#1E3A8A', // deep azure
  '#9D174D', // bold berry
  '#0F766E', // rich teal
  '#92400E', // spiced amber
  '#5B21B6', // royal indigo
  '#155E75', // ocean slate
  '#991B1B', // crimson dusk
  '#14532D', // forest pine
  '#7C2D12', // ember brass
  '#3730A3'  // twilight violet
];

const getCategoryStyle = (labels = []) => {
  const normalizedLabels = Array.isArray(labels) ? labels : [labels];
  const categoryKey = normalizedLabels.find((label) => CATEGORY_STYLES[label]) || 'misc';
  return { key: categoryKey, ...CATEGORY_STYLES[categoryKey] };
};

const getSourceStyle = (source = '') => {
  const defaultColor = '#475569';

  if (!source) {
    return {
      textColor: defaultColor
    };
  }

  const key = source.trim().toLowerCase();
  const hash = [...key].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseColor = SOURCE_COLOR_PALETTE[hash % SOURCE_COLOR_PALETTE.length];

  return {
    textColor: baseColor
  };
};

const formatPublishedDate = (dateString) => {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return '';
  }
};

const NewsCard = ({ article }) => {
  const categoryStyle = getCategoryStyle(article.labels);
  const sourceStyle = getSourceStyle(article.source);
  const formattedDate = formatPublishedDate(article.published);

  // Get automated tags
  const autoTags = article.auto_tags || {};
  const companies = autoTags.companies || [];
  const sectors = autoTags.sectors || [];
  const financialTerms = autoTags.financial_terms || [];
  const entities = autoTags.entities || [];

  return (
    <article className="news-card">
      <div className="glass-overlay"></div>
      <div className="card-header">
        <h3 className="card-title">
          <a href={article.link} target="_blank" rel="noopener noreferrer">
            {article.title}
          </a>
        </h3>
        {formattedDate && (
          <span className="card-date">{formattedDate}</span>
        )}
      </div>

      <div className="card-content">
        {article.bullets && article.bullets.length > 0 && (
          <ul className="card-bullets">
            {article.bullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-footer">
        <a href={article.link} target="_blank" rel="noopener noreferrer" className="action-btn">
          📖 Read More
        </a>
        <div
          className="card-tag"
          style={{
            color: categoryStyle.color,
            borderColor: categoryStyle.color,
            backgroundColor: categoryStyle.background
          }}
        >
          {categoryStyle.label}
        </div>
      </div>

      {/* Automated Tags Section */}
      {(companies.length > 0 || sectors.length > 0 || financialTerms.length > 0 || entities.length > 0) && (
        <div className="card-tags-section">
          <div className="tags-container">
            {companies.map((company, index) => (
              <span key={`company-${index}`} className="auto-tag company-tag">{company}</span>
            ))}
            {sectors.map((sector, index) => (
              <span key={`sector-${index}`} className="auto-tag sector-tag">{sector}</span>
            ))}
            {financialTerms.slice(0, 3).map((term, index) => (
              <span key={`financial-${index}`} className="auto-tag financial-tag">{term}</span>
            ))}
            {entities.map((entity, index) => (
              <span key={`entity-${index}`} className="auto-tag entity-tag">{entity}</span>
            ))}
          </div>
        </div>
      )}

      {/* Source at bottom */}
      <div className="card-source-footer">
        <span className="card-source-label">Source</span>
        <span
          className="card-source-name"
          style={{ color: sourceStyle.textColor }}
        >
          {article.source}
        </span>
      </div>
    </article>
  );
};

export default NewsCard;
