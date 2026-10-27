import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../../services/api';
import './Login.css';

const FEATURES = [
  { icon: '🔒', text: 'Fullscreen mode + tab-switch monitoring' },
  { icon: '📷', text: 'Live webcam proctoring with AI alerts' },
  { icon: '⚡', text: 'Real-time judge panel & instant verdicts' },
  { icon: '🏆', text: 'Automatic leaderboard & score ranking' },
];

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) navigate(user.role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard');
  }, [navigate]);

  const handleChange  = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await loginUser(formData);
      const { role, userId, walletCredits, email, username } = res.data;
      localStorage.setItem('user', JSON.stringify({ role, userId, walletCredits, email, username }));
      navigate(role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard');
    } catch (err) {
      setError(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      {/* ── Left Panel ── */}
      <div className="login-panel-left">
        <div className="brand">
          <div className="brand-icon">🛡️</div>
          <span className="brand-name">ProctorX</span>
        </div>

        <div className="login-panel-center">
          <h1>Assess.<br/>Monitor.<br/>Excel.</h1>
          <p>
            The next-generation proctored exam platform.
            Host fair, secure assessments — from MCQs to live coding challenges.
          </p>
        </div>

        <div className="feature-list">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-item">
              <div className="feature-icon">{f.icon}</div>
              {f.text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="login-panel-right">
        <div className="auth-card">
          <h2 className="auth-card-title">Welcome back 👋</h2>
          <p className="auth-card-sub">Sign in to your ProctorX account</p>

          {error && (
            <div className="alert-error" style={{ marginBottom: 20 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label className="field-label" htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                className="field-input"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="field-input"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" />  Signing in…</>
                : 'Sign In to ProctorX →'
              }
            </button>
          </form>

          <div className="auth-footer">
            Don't have an account?{' '}
            <Link to="/register">Create one free →</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;