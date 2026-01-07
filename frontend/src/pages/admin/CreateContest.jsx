import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createContest } from '../../services/api';
import './CreateContest.css';

const CreateContest = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'DSA',
    durationMinutes: 90
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await createContest(user.userId, form);
      // Success! Update local credit count visually (optional) and redirect
      if (user.walletCredits > 0) {
          user.walletCredits -= 1;
          localStorage.setItem('user', JSON.stringify(user));
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data || 'Failed to create contest. Check credits.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-container">
      <div className="create-card">
        <h2>Create New Assessment</h2>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Contest Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Google Hiring Challenge 2025"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              placeholder="Instructions for students..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="form-col form-group">
              <label>Contest Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px'}}
              >
                <option value="DSA">DSA (Coding)</option>
                <option value="MCQ">MCQ (Aptitude)</option>
                <option value="HYBRID">Hybrid (Both)</option>
              </select>
            </div>

            <div className="form-col form-group">
              <label>Duration (Minutes)</label>
              <input
                type="number"
                required
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </div>
          </div>

          <div className="warning-box">
            ⚠️ Creating this contest will deduct <strong>1 Credit</strong> from your wallet.
          </div>

          <div className="button-group">
            <button type="button" onClick={() => navigate('/admin/dashboard')} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Creating...' : 'Create Contest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateContest;