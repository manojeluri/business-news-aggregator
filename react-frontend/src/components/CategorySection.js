import React from 'react';
import NewsCard from './NewsCard';

const CategorySection = ({ categoryData }) => {
  return (
    <section className="category-section">
      <div className="category-header">
        <div
          className="category-icon"
          style={{ backgroundColor: categoryData.color }}
        ></div>
        <h2 className="category-title">{categoryData.name}</h2>
        <span className="category-count">
          {categoryData.articles.length} stories
        </span>
      </div>

      <div className="cards-grid">
        {categoryData.articles.map((article, index) => (
          <NewsCard
            key={`${article.link}-${index}`}
            article={article}
            color={categoryData.color}
          />
        ))}
      </div>
    </section>
  );
};

export default CategorySection;