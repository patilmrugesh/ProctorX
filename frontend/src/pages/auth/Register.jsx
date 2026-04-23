import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../../services/api';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    username: '', email: '', passwordHash: '',
    role: 'STUDENT', city: '', gender: 'Male', phone: ''
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleRole   = (role) => setFormData({ ...formData, role });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await registerUser(formData);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="register-page">
      {/* decorative orbs */}
      <div className="orb1" />
      <div className="orb2" />

      <div className="reg-card">
        {/* Logo */}
        <div className="reg-logo">
          <div className="reg-logo-icon">🛡️</div>
          <h1>Join ProctorX</h1>
          <p>Create your account to get started</p>
        </div>

        {error   && <div className="alert-error"   style={{ marginBottom:16 }}>⚠️ {error}</div>}
        {success && <div className="alert-success" style={{ marginBottom:16 }}>✅ Account created! Redirecting to login…</div>}

        <form onSubmit={handleSubmit} className="reg-form">
          {/* Role selector */}
          <div className="field-group">
            <label className="field-label">I am a</label>
            <div className="role-tabs">
              <button type="button" id="role-student-btn"
                className={`role-tab ${formData.role === 'STUDENT' ? 'active' : ''}`}
                onClick={() => handleRole('STUDENT')}>
                🎓 Student
              </button>
              <button type="button" id="role-admin-btn"
                className={`role-tab ${formData.role === 'ADMIN' ? 'active' : ''}`}
                onClick={() => handleRole('ADMIN')}>
                ⚙️ Admin
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="field-group">
            <label className="field-label" htmlFor="reg-name">Full Name</label>
            <input id="reg-name" className="field-input" required type="text"
              name="username" placeholder="John Doe" onChange={handleChange} />
          </div>

          {/* Email */}
          <div className="field-group">
            <label className="field-label" htmlFor="reg-email">Email Address</label>
            <input id="reg-email" className="field-input" required type="email"
              name="email" placeholder="john@example.com" onChange={handleChange} />
          </div>

          {/* Password */}
          <div className="field-group">
            <label className="field-label" htmlFor="reg-password">Password</label>
            <input id="reg-password" className="field-input" required type="password"
              name="passwordHash" placeholder="Min. 8 characters" onChange={handleChange} />
          </div>

          {/* Student-only extras */}
          {formData.role === 'STUDENT' && (
            <div className="form-row">
              <div className="field-group">
                <label className="field-label" htmlFor="reg-city">City</label>
                <input id="reg-city" className="field-input" required type="text"
                  name="city" placeholder="Nagpur" onChange={handleChange} />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="reg-gender">Gender</label>
                <select id="reg-gender" className="field-input" name="gender" onChange={handleChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}

          <button id="register-submit-btn" type="submit"
            className="btn btn-primary" disabled={loading || success}
            style={{ width:'100%', padding:'14px', fontSize:'0.95rem', marginTop:6 }}>
            {loading
              ? <><span className="spinner" />  Creating account…</>
              : 'Create Account →'
            }
          </button>
        </form>

        <div className="reg-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in →</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;