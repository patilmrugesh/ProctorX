import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinContest } from '../../services/api';
import './StudentDashboard.css';

const StudentDashboard = () => {
  const [token, setToken] = useState('');
  const [contest, setContest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!token) return;
    
    setLoading(true);
    setError('');
    setContest(null);

    try {
      // Pass the user's email for whitelist verification
      const response = await joinContest(token, user.email);
      setContest(response.data);
    } catch (err) {
      // Backend now sends specific errors (e.g., "Contest is not active", "Access Denied")
      setError(err.response?.data || 'Invalid Token or Access Denied.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    navigate(`/exam/${contest.contestId}`, { state: { contest } });
  };

  return (
    <div className="student-container">
      <div className="welcome-banner">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
          <div>
            <h1>Welcome, {user?.username}</h1>
            <p>Ready to prove your skills? Enter your exam token below.</p>
          </div>
          <button 
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.2)', 
              border: '1px solid rgba(255,255,255,0.4)', 
              color: 'white', 
              padding: '8px 16px', 
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="join-section">
        <h3>Join an Assessment</h3>
        <p style={{color: '#666', marginBottom: '1rem'}}>Ask your administrator for the unique Student Token.</p>
        
        <form onSubmit={handleJoin}>
          <div className="token-input-group">
            <input 
              type="text" 
              className="token-input"
              placeholder="TOKEN"
              maxLength="6"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
            />
            <button type="submit" className="join-btn" disabled={loading}>
              {loading ? '...' : 'Verify'}
            </button>
          </div>
        </form>

        {error && <p style={{color: 'red', marginTop: '1rem', fontWeight: 'bold'}}>{error}</p>}

        {contest && (
          <div className="contest-details">
            <h2 style={{borderBottom: '1px solid #eee', paddingBottom: '10px'}}>{contest.title}</h2>
            
            <div className="details-grid">
              <div className="detail-item">
                <label>Type</label>
                <p>{contest.type}</p>
              </div>
              <div className="detail-item">
                <label>Duration</label>
                <p>{contest.durationMinutes} Mins</p>
              </div>
              <div className="detail-item">
                <label>Status</label>
                <p style={{color: contest.status === 'LIVE' ? 'green' : 'orange', fontWeight: 'bold'}}>
                    {contest.status}
                </p>
              </div>
            </div>

            <p style={{marginBottom: '1rem', color: '#555'}}>{contest.description}</p>
            
            <div style={{background: '#fff3cd', padding: '10px', borderRadius: '4px', fontSize: '0.9rem', marginBottom: '1rem'}}>
              ⚠️ <strong>Warning:</strong> Fullscreen mode is enforced. Tab switching is monitored.
            </div>

            <button className="start-btn" onClick={handleStartExam}>
              Start Exam Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;