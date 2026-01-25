import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../../services/api'; 
import './Login.css'; 

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      if (user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await loginUser(formData);
      const { role, userId, walletCredits, email, username } = response.data;
      
      localStorage.setItem('user', JSON.stringify({ role, userId, walletCredits, email, username }));

      if (role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2 className="login-title">ProctorX</h2>
          <p className="login-subtitle">Sign in to your account</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>
          
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="login-footer">
          Don't have an account? <Link to="/register" className="register-link">Create one</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;