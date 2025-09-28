import React from 'react';

const Notification = ({ show, message, type }) => {
  return (
    <div className={`notification ${show ? 'show' : ''} ${type === 'error' ? 'error' : ''}`}>
      {message}
    </div>
  );
};

export default Notification;