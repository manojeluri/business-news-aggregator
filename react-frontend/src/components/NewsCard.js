import React from 'react';

const NewsCard = ({ article, color }) => {
  return (
    <article className="news-card" style={{ borderLeftColor: color }}>
      <div className="card-header">
        <h3 className="card-title">
          <a href={article.link} target="_blank" rel="noopener noreferrer">
            {article.title}
          </a>
        </h3>
        <div className="card-source">{article.source}</div>
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
        <div className="card-labels">
          {article.labels &&
            article.labels.map((label, index) => (
              <span key={index} className="label-tag">
                {label}
              </span>
            ))}
        </div>
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="source-link"
        >
          Read More →
        </a>
      </div>
    </article>
  );
};

export default NewsCard;