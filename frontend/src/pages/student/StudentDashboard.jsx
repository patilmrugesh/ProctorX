import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { joinContest, joinJudge } from "../../services/api";
import "./StudentDashboard.css";

const StudentDashboard = () => {
  const [token, setToken]           = useState("");
  const [judgeToken, setJudgeToken] = useState("");
  const [contest, setContest]       = useState(null);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    if (location.state?.autoToken) setToken(location.state.autoToken);
  }, [location.state]);

  const handleLogout = () => { localStorage.removeItem("user"); navigate("/login"); };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true); setError(""); setContest(null);
    try {
      const res = await joinContest(token, user.email);
      setContest(res.data);
    } catch (err) {
      setError(err);
    } finally { setLoading(false); }
  };

  const handleJudgeJoin = async (e) => {
    e.preventDefault();
    if (!judgeToken) return;
    try {
      const res = await joinJudge(judgeToken);
      navigate(`/judge/monitor/${res.data.contestId}`, { state: { contest: res.data } });
    } catch (err) {
      alert(err);
    }
  };

  const handleStartExam = () => navigate(`/exam/${contest.contestId}`, { state: { contest } });

  const initials = (name) => name ? name.slice(0,2).toUpperCase() : 'ST';

  return (
    <div className="student-page">
      {/* Navbar */}
      <nav className="student-nav">
        <div className="student-nav-brand">🛡️ ProctorX</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user?.role === 'ADMIN' && (
            <button className="btn btn-ghost" onClick={() => navigate('/admin/dashboard', { replace: true })}
              style={{ fontSize: '0.82rem', padding: '7px 14px' }}>
              ← Admin Panel
            </button>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)', borderRadius: 30,
            fontSize: '0.85rem', color: 'var(--text-secondary)'
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--grad-accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, color: '#fff'
            }}>{initials(user?.username)}</div>
            {user?.username}
          </div>
          <button id="student-logout-btn" className="btn btn-danger" onClick={handleLogout}
            style={{ padding: '7px 16px', fontSize: '0.82rem' }}>
            Sign Out
          </button>
        </div>
      </nav>

      <main className="student-content">
        {/* Welcome */}
        <div className="welcome-hero">
          <h1>Welcome back, {user?.username} 👋</h1>
          <p>Ready to prove your skills? Enter your exam token to get started.</p>
        </div>

        {/* Join Assessment */}
        <div className="join-card">
          <h2>🎯 Join an Assessment</h2>
          <p className="hint">Ask your administrator for the 6-character token.</p>

          <form onSubmit={handleJoin}>
            <div className="token-input-row">
              <input
                id="token-input"
                className="token-input"
                type="text"
                placeholder="TOKEN"
                maxLength="6"
                value={token}
                onChange={e => setToken(e.target.value.toUpperCase())}
                autoComplete="off"
              />
              <button id="verify-token-btn" type="submit" className="btn btn-primary"
                disabled={loading || !token}
                style={{ padding: '14px 28px', fontSize: '0.9rem', minWidth: 110, flexShrink: 0 }}>
                {loading
                  ? <span style={{ display:'flex', alignItems:'center', gap:8 }}><span className="spinner" /></span>
                  : 'Verify →'
                }
              </button>
            </div>
          </form>

          {error && (
            <div className="alert-error" style={{ marginTop: 16 }}>⚠ {error}</div>
          )}

          {contest && (
            <div className="contest-reveal">
              <h3>📋 {contest.title}</h3>

              <div className="contest-meta-grid">
                <div className="contest-meta-item">
                  <label>Type</label>
                  <p><span className="badge badge-primary">{contest.type}</span></p>
                </div>
                <div className="contest-meta-item">
                  <label>Duration</label>
                  <p>{contest.durationMinutes} mins</p>
                </div>
                <div className="contest-meta-item">
                  <label>Status</label>
                  <p>
                    <span className={`badge ${contest.status === 'LIVE' ? 'badge-success' : 'badge-warning'}`}>
                      {contest.status === 'LIVE' && <span className="live-dot" style={{width:6,height:6}} />}
                      {contest.status}
                    </span>
                  </p>
                </div>
              </div>

              {contest.description && (
                <p style={{ fontSize:'0.88rem', color:'var(--text-2)', marginBottom:16, lineHeight:1.6 }}>
                  {contest.description}
                </p>
              )}

              <div className="warning-notice">
                ⚠️ <strong>Important:</strong> Fullscreen mode is enforced. Switching tabs or exiting fullscreen will be flagged as a violation.
              </div>

              {contest.status === 'LIVE' ? (
                <button id="start-exam-btn" className="btn btn-primary" onClick={handleStartExam}
                  style={{ width: '100%', padding: 16, fontSize: '1rem', fontWeight: 700 }}>
                  🚀 Enter Exam Arena
                </button>
              ) : (
                <div className="alert-error">
                  This contest is not LIVE yet. Contact your administrator.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Judge section */}
        <div className="judge-card">
          <div className="judge-icon">⚖️</div>
          <div className="judge-card-text">
            <h4>Are you a Judge / Proctor?</h4>
            <p>Enter your judge token to access the monitoring panel</p>
          </div>
          <form onSubmit={handleJudgeJoin} className="judge-inputs">
            <input
              id="judge-token-input"
              className="judge-token-input"
              type="text"
              placeholder="JUDGE TOKEN"
              value={judgeToken}
              onChange={e => setJudgeToken(e.target.value.toUpperCase())}
            />
            <button id="judge-join-btn" type="submit" className="btn btn-primary"
              style={{ padding: '11px 20px', fontSize: '0.855rem', flexShrink: 0 }}>
              Monitor →
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
