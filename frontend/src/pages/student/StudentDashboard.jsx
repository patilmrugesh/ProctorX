import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinContest, joinJudge } from '../../services/api'; // Import joinJudge
import './StudentDashboard.css';

const StudentDashboard = () => {
  const [token, setToken] = useState('');
  const [judgeToken, setJudgeToken] = useState(''); // New State
  const [contest, setContest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Student Join Logic
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true); setError(''); setContest(null);

    try {
      const response = await joinContest(token, user.email);
      setContest(response.data);
    } catch (err) {
      setError(err.response?.data || 'Invalid Token or Access Denied.');
    } finally {
      setLoading(false);
    }
  };

  // Judge Join Logic
  const handleJudgeJoin = async (e) => {
    e.preventDefault();
    if (!judgeToken) return;
    
    try {
        const response = await joinJudge(judgeToken);
        // Navigate to Judge Dashboard
        navigate(`/judge/monitor/${response.data.contestId}`, { state: { contest: response.data } });
    } catch (err) {
        alert("Invalid Judge Token");
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
          <button onClick={handleLogout} className="action-btn" style={{background:'rgba(255,255,255,0.2)', color:'white', border:'none'}}>Logout</button>
        </div>
      </div>

      {/* Student Join Section */}
      <div className="join-section">
        <h3>Join an Assessment</h3>
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
            <h2>{contest.title}</h2>
            <p>{contest.description}</p>
            <button className="start-btn" onClick={handleStartExam}>Start Exam Now</button>
          </div>
        )}
      </div>

      {/* --- NEW: Judge Join Section --- */}
      <div style={{marginTop: '3rem', textAlign: 'center', borderTop: '1px solid #ddd', paddingTop: '2rem'}}>
        <h4 style={{color: '#666'}}>Are you a Judge?</h4>
        <form onSubmit={handleJudgeJoin} style={{display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '1rem'}}>
             <input 
                type="text" 
                placeholder="JUDGE TOKEN" 
                style={{padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                value={judgeToken}
                onChange={(e) => setJudgeToken(e.target.value.toUpperCase())}
             />
             <button type="submit" style={{padding: '8px 16px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>
                Join as Judge
             </button>
        </form>
      </div>

    </div>
  );
};

export default StudentDashboard;