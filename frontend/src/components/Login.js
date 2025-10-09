import React, { useState } from 'react';
import API_BASE_URL from '../config/api';

const Login = ({ onLoginSuccess }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    interests: []
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const availableInterests = [
    'Policy & Regulation',
    'Markets',
    'Startups & Innovation',
    'Infrastructure & Real Estate',
    'Energy & Resources',
    'Business News'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isSignup ? '/api/signup' : '/api/login';
      const body = isSignup
        ? formData
        : { email: formData.email, password: formData.password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store token and user info
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleDemoLogin = async (demoEmail) => {
    setFormData({ email: demoEmail, password: 'password123', name: '', interests: [] });
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: 'password123' })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{isSignup ? 'Create Account' : 'Welcome Back'}</h2>
        <p className="login-subtitle">
          {isSignup ? 'Sign up to personalize your news feed' : 'Sign in to access your personalized feed'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Your name"
              />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="••••••••"
            />
          </div>

          {isSignup && (
            <div className="form-group">
              <label>Interests (optional)</label>
              <div className="interests-grid">
                {availableInterests.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    className={`interest-tag ${formData.interests.includes(interest) ? 'selected' : ''}`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Loading...' : (isSignup ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <div className="demo-accounts">
          <p className="demo-title">Try a demo account:</p>
          <div className="demo-buttons">
            <button
              className="demo-button"
              onClick={() => handleDemoLogin('demo1@example.com')}
              disabled={loading}
            >
              Demo 1 <span>(Policy & Markets)</span>
            </button>
            <button
              className="demo-button"
              onClick={() => handleDemoLogin('demo2@example.com')}
              disabled={loading}
            >
              Demo 2 <span>(Startups & Energy)</span>
            </button>
            <button
              className="demo-button"
              onClick={() => handleDemoLogin('demo3@example.com')}
              disabled={loading}
            >
              Demo 3 <span>(Infra & Business)</span>
            </button>
          </div>
        </div>

        <p className="login-toggle">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <button type="button" onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
