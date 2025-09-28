import React from 'react';
import NewsCard from './NewsCard';

const CategorySection = ({ categoryData }) => {
  return (
    <section className="category-section">
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