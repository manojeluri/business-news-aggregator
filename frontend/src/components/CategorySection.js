import React from 'react';
import NewsCard from './NewsCard';

const CategorySection = ({ categoryData }) => {
  return (
    <>
      {categoryData.articles.map((article, index) => (
        <NewsCard
          key={`${article.link}-${index}`}
          article={article}
        />
      ))}
    </>
  );
};

export default CategorySection;
