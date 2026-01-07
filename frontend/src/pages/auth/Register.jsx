import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../../services/api';
import './Register.css'; // Separate CSS

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    passwordHash: '', // Backend expects 'passwordHash'
    role: 'STUDENT', // Default
    city: '',
    gender: 'Male',
    phone: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelect = (role) => {
    setFormData({ ...formData, role });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await registerUser(formData);
      alert("Registration Successful! Please Login.");
      navigate('/login');
    } catch (err) {
      console.error(err);
      setError(err.response?.data || 'Registration failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2 className="register-title">Create Account</h2>
        <p className="register-subtitle">Join ProctorX to host or take exams</p>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Role Selection */}
          <div className="role-select-group">
            <div 
                className={`role-option ${formData.role === 'STUDENT' ? 'active' : ''}`}
                onClick={() => handleRoleSelect('STUDENT')}
            >
                Student
            </div>
            <div 
                className={`role-option ${formData.role === 'ADMIN' ? 'active' : ''}`}
                onClick={() => handleRoleSelect('ADMIN')}
            >
                Admin (Organizer)
            </div>
          </div>

          <div className="form-group">
            <label>Full Name</label>
            <input required type="text" name="username" placeholder="John Doe" onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input required type="email" name="email" placeholder="john@example.com" onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input required type="password" name="passwordHash" placeholder="••••••••" onChange={handleChange} />
          </div>

          {/* Extra Fields for Students */}
          {formData.role === 'STUDENT' && (
            <div className="form-row-split">
                <div className="form-group">
                    <label>City</label>
                    <input required type="text" name="city" placeholder="Nagpur" onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label>Gender</label>
                    <select name="gender" onChange={handleChange} style={{width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px'}}>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                    </select>
                </div>
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Register Now'}
          </button>
        </form>

        <div className="register-link">
            Already have an account? <Link to="/login">Login here</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;