import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminContests, deleteContest, updateContestStatus, uploadContestUsers } from '../../services/api';
import api from '../../services/api';
import './AdminDashboard.css';

const STAT_GLOWS = ['#6366F1','#C026D3','#06B6D4','#F59E0B'];

const AdminDashboard = () => {
  const [contests, setContests]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [walletCredits, setWalletCredits] = useState(0);
  const [selectedContestId, setSelectedContestId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm]   = useState({});

  const navigate    = useNavigate();
  const fileInputRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user')) || {};

  useEffect(() => {
    if (!user.userId) { navigate('/login'); return; }
    fetchContests(); fetchWallet();
  }, [user?.userId]);

  const fetchWallet = async () => {
    try {
      const res = await api.get(`/auth/user/${Number(user.userId)}`);
      if (res.data?.walletCredits !== undefined) {
        setWalletCredits(res.data.walletCredits);
        localStorage.setItem('user', JSON.stringify({ ...user, walletCredits: res.data.walletCredits }));
      }
    } catch { setWalletCredits(user.walletCredits || 0); }
  };

  const fetchContests = () => {
    getAdminContests(user.userId)
      .then(res => setContests(Array.isArray(res.data) ? res.data : []))
      .catch(() => setContests([]))
      .finally(() => setLoading(false));
  };

  const handleLogout       = () => { localStorage.removeItem('user'); navigate('/login'); };
  const handleDelete       = async (cid) => {
    if (!window.confirm('Delete this contest? This cannot be undone.')) return;
    try { await deleteContest(cid); fetchContests(); }
    catch (err) { alert('Failed: ' + err); }
  };
  const handleStatusToggle = async (c) => {
    const ns = c.status === 'LIVE' ? 'DRAFT' : 'LIVE';
    if (ns === 'LIVE') {
      if (!c.startTime || !c.endTime) { alert('Set Start & End time in Settings before going LIVE.'); return; }
      const mins = (new Date(c.endTime) - new Date(c.startTime)) / 60000;
      if (mins <= 0) { alert('End time must be after start time.'); return; }
      const tokens = Math.ceil(mins / 120);
      if (!window.confirm(`Going LIVE will deduct ${tokens} Token(s). Continue?`)) return;
    }
    try { await updateContestStatus(c.contestId, ns); fetchContests(); fetchWallet(); }
    catch (err) { alert(err); }
  };
  const handleUploadClick  = (cid) => { setSelectedContestId(cid); fileInputRef.current.click(); };
  const handleFileChange   = async (e) => {
    const file = e.target.files[0]; if (!file || !selectedContestId) return;
    try { await uploadContestUsers(selectedContestId, file); alert('Whitelist uploaded!'); }
    catch { alert('Upload failed. Check CSV format.'); }
    finally { e.target.value = null; setSelectedContestId(null); }
  };
  const copyToken          = (text, label) => { if (!text) return; navigator.clipboard.writeText(text); };
  const handleTest         = (token) => navigate('/student/dashboard', { state: { autoToken: token } });
  const openSettings       = (c) => {
    const fmt = d => d ? d.substring(0,16) : '';
    setSettingsForm({ ...c, startTime: fmt(c.startTime), endTime: fmt(c.endTime), durationMinutes: c.durationMinutes || 60 });
    setIsSettingsOpen(true);
  };
  const handleSettingsSave = async (e) => {
    e.preventDefault();
    try {
      const p = { ...settingsForm,
        startTime: settingsForm.startTime?.length === 16 ? `${settingsForm.startTime}:00` : settingsForm.startTime,
        endTime:   settingsForm.endTime?.length   === 16 ? `${settingsForm.endTime}:00`   : settingsForm.endTime,
        durationMinutes: parseInt(settingsForm.durationMinutes, 10) || 60
      };
      await api.put(`/contests/${settingsForm.contestId}`, p);
      setIsSettingsOpen(false); fetchContests();
    } catch { alert('Failed to save settings.'); }
  };

  const initials = n => n ? n.slice(0,2).toUpperCase() : 'AD';
  const liveCount = contests.filter(c => c.status === 'LIVE').length;

  if (loading) return (
    <div className="page-loader">
      <span className="spinner" /> Loading dashboard…
    </div>
  );

  const STATS = [
    { label: 'Total Contests', value: contests.length, color: '#6366F1' },
    { label: 'Live Now',       value: liveCount,        color: '#10B981' },
    { label: 'Draft',          value: contests.filter(c => c.status === 'DRAFT').length, color: '#F59E0B' },
    { label: 'Wallet Credits', value: walletCredits,    color: '#C026D3' },
  ];

  return (
    <div className="admin-page">
      {/* Navbar */}
      <nav className="app-nav">
        <div className="nav-brand">
          <div className="nav-brand-icon">🛡️</div>
          ProctorX Admin
        </div>
        <div className="nav-actions">
          <div className="wallet-badge" onClick={fetchWallet} title="Click to refresh">
            🪙 <span className="cred">{walletCredits}</span> Credits
          </div>
          <div className="nav-pill">
            <div className="nav-avatar">{initials(user.username)}</div>
            {user.username}
          </div>
          <button id="admin-logout-btn" className="btn btn-danger" onClick={handleLogout}
            style={{ padding:'7px 18px', fontSize:'0.83rem' }}>
            Sign Out
          </button>
        </div>
      </nav>

      <div className="admin-content">
        {/* Hero */}
        <div className="page-hero">
          <h1>Dashboard</h1>
          <p>Manage contests and monitor participants in real time</p>
        </div>

        {/* Stats */}
        <div className="stats-row">
          {STATS.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-glow" style={{ background: s.color }} />
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Header row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <h2 style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--text-1)' }}>Your Contests</h2>
          <Link to="/admin/create-contest" id="create-contest-btn"
            className="btn btn-primary" style={{ textDecoration:'none', fontSize:'0.88rem', padding:'10px 22px' }}>
            ＋ Create Contest
          </Link>
        </div>

        <input type="file" ref={fileInputRef} style={{ display:'none' }} accept=".csv,.txt" onChange={handleFileChange} />

        {/* Grid */}
        <div className="contests-grid">
          {contests.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <h3>No contests yet</h3>
              <p>Create your first contest to start evaluating candidates</p>
              <Link to="/admin/create-contest" className="btn btn-primary" style={{ textDecoration:'none', marginTop:8 }}>
                ＋ Create Contest
              </Link>
            </div>
          ) : contests.map(c => (
            <div key={c.contestId} className="contest-card">
              <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start' }}>
                <div>
                  <h3 className="card-title">{c.title}</h3>
                  <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                    <span className="badge badge-primary">{c.type}</span>
                    <span className={`badge ${c.status === 'LIVE' ? 'badge-success' : 'badge-warning'}`}>
                      {c.status === 'LIVE' && <span className="live-dot" style={{width:6,height:6}} />}
                      {c.status}
                    </span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                  <button className="action-pill"
                    style={{ background:'rgba(99,102,241,0.12)', color:'var(--primary-light)', borderColor:'rgba(99,102,241,0.3)' }}
                    onClick={() => handleTest(c.studentToken)}>Test</button>
                  <div className={`status-dot ${c.status === 'LIVE' ? 'live' : ''}`}
                    title={`${c.status} – click to toggle`} onClick={() => handleStatusToggle(c)} />
                </div>
              </div>

              <p className="card-desc">{c.description || 'No description.'}</p>

              <div className="card-window">
                <strong>🕒 Window:</strong><br />
                {c.startTime ? new Date(c.startTime).toLocaleString() : 'Not Set'} → {c.endTime ? new Date(c.endTime).toLocaleString() : 'Not Set'}
              </div>

              <div className="token-box">
                <div className="token-row" onClick={() => copyToken(c.studentToken,'Student Token')} title="Copy">
                  <span className="token-key">🎓 Student</span>
                  <span className="token-val">{c.studentToken || '––'}</span>
                </div>
                <div className="token-row" onClick={() => copyToken(c.judgeToken,'Judge Token')} title="Copy">
                  <span className="token-key">⚖ Judge</span>
                  <span className="token-val">{c.judgeToken || 'N/A'}</span>
                </div>
              </div>

              <div className="card-actions">
                {[
                  { label:'⚙ Settings', cb:() => openSettings(c), bg:'rgba(245,158,11,0.12)', color:'#FCD34D', bc:'rgba(245,158,11,0.3)' },
                  { label:'📝 Questions', cb:() => navigate(`/admin/contest/${c.contestId}/questions`), bg:'rgba(99,102,241,0.12)', color:'#818CF8', bc:'rgba(99,102,241,0.3)' },
                  { label:'🏆 Results', cb:() => navigate(`/admin/contest/${c.contestId}/leaderboard`), bg:'rgba(16,185,129,0.12)', color:'#34D399', bc:'rgba(16,185,129,0.3)' },
                  { label:'👥 Users', cb:() => handleUploadClick(c.contestId), bg:'rgba(6,182,212,0.12)', color:'#22D3EE', bc:'rgba(6,182,212,0.3)' },
                  { label:'🗑 Delete', cb:() => handleDelete(c.contestId), bg:'rgba(244,63,94,0.1)', color:'#FB7185', bc:'rgba(244,63,94,0.3)' },
                ].map(a => (
                  <button key={a.label} className="action-pill" onClick={a.cb}
                    style={{ background:a.bg, color:a.color, borderColor:a.bc }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsSettingsOpen(false)}>
          <div className="modal-box">
            <h3 style={{ fontWeight:800, fontSize:'1.15rem', marginBottom:20 }}>⚙️ Contest Settings</h3>
            <form onSubmit={handleSettingsSave} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {['title','description','startTime','endTime','durationMinutes'].map(f => (
                <div key={f} className="field-group">
                  <label className="field-label">{f === 'durationMinutes' ? 'Duration (minutes)' : f.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}</label>
                  {f === 'description'
                    ? <textarea className="field-input" value={settingsForm[f]||''} onChange={e=>setSettingsForm({...settingsForm,[f]:e.target.value})} />
                    : <input required={f!=='description'} className="field-input"
                        type={f.includes('Time') ? 'datetime-local' : f==='durationMinutes' ? 'number' : 'text'}
                        value={settingsForm[f]||''} onChange={e=>setSettingsForm({...settingsForm,[f]:e.target.value})} />
                  }
                </div>
              ))}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsSettingsOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;