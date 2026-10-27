import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createContest } from '../../services/api';
import './CreateContest.css';

const TYPES = [
  { value: 'DSA',    icon: '💻', label: 'DSA',    sub: 'Coding Problems' },
  { value: 'MCQ',    icon: '📋', label: 'MCQ',    sub: 'Multiple Choice' },
  { value: 'HYBRID', icon: '🔀', label: 'Hybrid', sub: 'Both types' },
];

const CreateContest = () => {
  const navigate = useNavigate();
  const user  = JSON.parse(localStorage.getItem('user'));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    title: '', description: '', type: 'DSA',
    durationMinutes: 90, timerType: 'OVERALL', questionTimerSeconds: 60
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await createContest(user.userId, form);
      if (user.walletCredits > 0) {
        user.walletCredits -= 1;
        localStorage.setItem('user', JSON.stringify(user));
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="create-page">
      <div className="create-content">
        {/* Back nav */}
        <button
          className="btn-ghost"
          onClick={() => navigate('/admin/dashboard')}
          style={{ marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Dashboard
        </button>

        <div className="create-card">
          <h2>🏗️ Create New Contest</h2>
          <p className="subtitle">Configure your assessment and start evaluating candidates</p>

          {error && <div className="error-banner" style={{ marginBottom: 20 }}><span>⚠</span> {error}</div>}

          <form onSubmit={handleSubmit} className="create-form" id="create-contest-form">
            {/* Title */}
            <div className="field-group">
              <label className="field-label" htmlFor="cc-title">Contest Title</label>
              <input id="cc-title" className="field-input" required type="text"
                placeholder="e.g. Google Hiring Challenge 2025"
                value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            </div>

            {/* Description */}
            <div className="field-group">
              <label className="field-label" htmlFor="cc-desc">Description</label>
              <textarea id="cc-desc" className="field-input"
                placeholder="Instructions, rules, or details about the assessment…"
                value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>

            {/* Type picker */}
            <div className="field-group">
              <label className="field-label">Contest Type</label>
              <div className="type-grid">
                {TYPES.map(t => (
                  <button key={t.value} type="button"
                    className={`type-option ${form.type === t.value ? 'active' : ''}`}
                    onClick={() => setForm({...form, type: t.value})}
                    id={`type-${t.value.toLowerCase()}-btn`}
                  >
                    <div className="type-icon">{t.icon}</div>
                    <div>{t.label}</div>
                    <div style={{ fontSize:'0.72rem', opacity:0.7, marginTop:2 }}>{t.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration & Timer Mode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="cc-duration">Duration (Minutes)</label>
                <input id="cc-duration" className="field-input" required type="number" min="1"
                  value={form.durationMinutes} onChange={e => setForm({...form, durationMinutes: e.target.value})} />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="cc-timer-mode">Timer Mode</label>
                <select id="cc-timer-mode" className="field-input"
                  value={form.timerType} onChange={e => setForm({...form, timerType: e.target.value})}>
                  <option value="OVERALL">⏱ Overall Timer</option>
                  <option value="PER_QUESTION">⏱ Per Question Timer</option>
                </select>
              </div>
            </div>

            {form.timerType === 'PER_QUESTION' && (
              <div className="field-group">
                <label className="field-label" htmlFor="cc-q-timer">Question Timer (Seconds)</label>
                <input id="cc-q-timer" className="field-input" required type="number" min="1"
                  value={form.questionTimerSeconds} onChange={e => setForm({...form, questionTimerSeconds: e.target.value})} />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn-ghost" onClick={() => navigate('/admin/dashboard')}>
                Cancel
              </button>
              <button id="create-contest-submit-btn" type="submit" className="btn-primary" disabled={loading} style={{ minWidth: 160, padding: '12px 24px' }}>
                {loading ? <span style={{ display:'flex', alignItems:'center', gap:8 }}><span className="spinner" /> Creating…</span> : '🚀 Create Contest'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateContest;