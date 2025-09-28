import React from 'react';

const ErrorMessage = ({ message, onRetry }) => {
  return (
    <div className="error">
      <p>Failed to load news: {message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
};

export default ErrorMessage;