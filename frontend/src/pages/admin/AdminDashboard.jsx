import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminContests, deleteContest, updateContestStatus, uploadContestUsers } from '../../services/api';
import api from '../../services/api'; 
import './AdminDashboard.css';

const AdminDashboard = () => {
  // --- States ---
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletCredits, setWalletCredits] = useState(0); 
  const [selectedContestId, setSelectedContestId] = useState(null);

  // --- Settings Modal States ---
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});

  // --- Hooks & Refs ---
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user')) || {};

  // --- Effects ---
  useEffect(() => {
    if (!user.userId) {
      navigate('/login');
      return;
    }
    fetchContests();
    fetchWalletCredits();
  }, [user?.userId]);

  // --- Data Fetching Logic ---
  const fetchWalletCredits = async () => {
    const userId = user.userId || user.id; 
    if (!userId) return;

    try {
        const res = await api.get(`/auth/user/${Number(userId)}`); 
        if (res.data && res.data.walletCredits !== undefined) {
            setWalletCredits(res.data.walletCredits);
            const updatedUser = { ...user, walletCredits: res.data.walletCredits };
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
    } catch (err) {
        setWalletCredits(user.walletCredits || 0);
    }
  };

  const fetchContests = () => {
    if (user?.userId) {
      getAdminContests(user.userId)
        .then((res) => {
          if (Array.isArray(res.data)) {
            setContests(res.data);
          } else {
            setContests([]);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch contests:", err);
          setContests([]);
        })
        .finally(() => setLoading(false));
    }
  };

  // --- Action Handlers ---
  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleDelete = async (contestId) => {
    if (window.confirm("Are you sure you want to delete this contest?")) {
      try {
        await deleteContest(contestId);
        fetchContests();
      } catch (err) {
        alert("Failed to delete contest: " + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleStatusToggle = async (contest) => {
    const newStatus = contest.status === 'LIVE' ? 'DRAFT' : 'LIVE';
    
    // --- Token Calculation & Warning for going live ---
    if (newStatus === 'LIVE') {
        if (!contest.startTime || !contest.endTime) {
            alert("Action Denied: You must click 'Settings' and set both 'Start Time' and 'End Time' before going LIVE.");
            return;
        }

        const start = new Date(contest.startTime);
        const end = new Date(contest.endTime);
        const diffMins = (end - start) / (1000 * 60);

        if (diffMins <= 0) {
            alert("Action Denied: End Time must be strictly after Start Time.");
            return;
        }

        const tokensRequired = Math.ceil(diffMins / 120);

        if (!window.confirm(`Going LIVE for a window of ${Math.round(diffMins)} minutes will deduct ${tokensRequired} Token(s) from your wallet. Continue?`)) {
            return;
        }
    }

    try {
      await updateContestStatus(contest.contestId, newStatus);
      fetchContests();
      fetchWalletCredits(); 
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data || "Failed to update status");
    }
  };

  // --- File Upload Logic ---
  const handleUploadClick = (contestId) => {
    setSelectedContestId(contestId);
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedContestId) return;

    try {
      await uploadContestUsers(selectedContestId, file);
      alert("Student whitelist uploaded successfully!");
    } catch (err) {
      alert("Failed to upload CSV. Ensure format is correct.");
    } finally {
      e.target.value = null;
      setSelectedContestId(null);
    }
  };

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  const handleTestContest = (token) => {
      navigate('/student/dashboard', { state: { autoToken: token } });
  };

  // --- Settings Modal Logic ---
  const openSettingsModal = (contest) => {
      // Format dates for the datetime-local input (YYYY-MM-DDTHH:mm)
      const formatForInput = (dateString) => {
          if (!dateString) return '';
          return dateString.substring(0, 16); 
      };

      setSettingsForm({
          ...contest,
          startTime: formatForInput(contest.startTime),
          endTime: formatForInput(contest.endTime),
          durationMinutes: contest.durationMinutes || 60
      });
      setIsSettingsModalOpen(true);
  };

  const handleSettingsSubmit = async (e) => {
      e.preventDefault();
      try {
          // Format dates to append seconds (:00) so Java's LocalDateTime parses them correctly
          const formattedPayload = {
              ...settingsForm,
              startTime: settingsForm.startTime && settingsForm.startTime.length === 16 
                  ? `${settingsForm.startTime}:00` 
                  : settingsForm.startTime,
              endTime: settingsForm.endTime && settingsForm.endTime.length === 16 
                  ? `${settingsForm.endTime}:00` 
                  : settingsForm.endTime,
              durationMinutes: parseInt(settingsForm.durationMinutes, 10) || 60
          };

          // Sending updated settings back to the backend
          await api.put(`/contests/${settingsForm.contestId}`, formattedPayload);
          alert("Contest Settings Updated Successfully!");
          setIsSettingsModalOpen(false);
          fetchContests(); // Refresh list to show new data
      } catch (err) {
          console.error(err);
          alert("Failed to update settings. Check backend logs.");
      }
  };

  // --- Render Logic ---
  if (loading) return <div className="dashboard-container">Loading Dashboard...</div>;

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="credits-badge">
            Wallet Credits: <span className="credits-count">{walletCredits}</span>
            <button 
              onClick={fetchWalletCredits} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '10px', fontSize: '0.8rem', color: '#3498db' }}
              title="Refresh Credits"
            >
              🔄
            </button>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link to="/admin/create-contest" className="create-btn">
            + Create New Contest
          </Link>
          <button
            onClick={handleLogout}
            className="action-btn"
            style={{
              padding: '10px 20px',
              color: '#e74c3c',
              borderColor: '#e74c3c',
              fontWeight: 'bold',
              background: 'white'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Hidden File Input for CSV Upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".csv,.txt"
        onChange={handleFileChange}
      />

      {/* Contests Grid */}
      <div className="contest-grid">
        {!Array.isArray(contests) || contests.length === 0 ? (
          <div className="empty-state">
            <h3>No contests found</h3>
            <p>Create your first contest to get started!</p>
          </div>
        ) : (
          contests.map((contest) => (
            <div key={contest.contestId} className="contest-card">
              <div className="card-header">
                <div>
                  <h3>{contest.title}</h3>
                  <span className="type-badge">{contest.type}</span>
                </div>
                
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <button 
                        className="action-btn"
                        style={{padding: '4px 8px', fontSize: '0.8rem', height: 'auto', color: '#3498db', borderColor: '#3498db'}}
                        onClick={() => handleTestContest(contest.studentToken)}
                        title="Simulate Student View"
                    >
                        Test
                    </button>

                    <div
                      className={`status-dot ${contest.status === 'LIVE' ? 'live' : ''}`}
                      title={`Status: ${contest.status} (Click to toggle)`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleStatusToggle(contest)}
                    ></div>
                </div>
              </div>

              <p className="card-desc">{contest.description || "No description provided."}</p>

              <div style={{ marginBottom: '10px', fontSize: '0.85rem', color: '#666' }}>
                Status: <strong>{contest.status}</strong>
                {contest.status === 'DRAFT' && <span style={{ fontSize: '0.7rem', marginLeft: '5px' }}>(Click dot to go Live)</span>}
              </div>
              
              <div style={{ marginBottom: '10px', fontSize: '0.8rem', color: '#888' }}>
                Window: {contest.startTime ? new Date(contest.startTime).toLocaleString() : 'Not Set'} <br/>
                To: {contest.endTime ? new Date(contest.endTime).toLocaleString() : 'Not Set'}
              </div>

              <div className="token-box">
                <div
                  className="token-row"
                  title="Click to copy"
                  style={{ cursor: 'pointer' }}
                  onClick={() => copyToClipboard(contest.studentToken, "Student Token")}
                >
                  <span>Student Token:</span>
                  <span className="token-code">{contest.studentToken}</span>
                </div>
                <div
                  className="token-row"
                  title="Click to copy"
                  style={{ cursor: 'pointer' }}
                  onClick={() => copyToClipboard(contest.judgeToken, "Judge Token")}
                >
                  <span>Judge Token:</span>
                  <span className="token-code">{contest.judgeToken || "N/A"}</span>
                </div>
              </div>

              <div className="card-actions" style={{ flexWrap: 'wrap' }}>
                <button
                  className="action-btn"
                  style={{ color: '#f39c12', borderColor: '#f39c12' }}
                  onClick={() => openSettingsModal(contest)}
                >
                  Settings
                </button>

                <button
                  className="action-btn"
                  style={{ color: 'blue', borderColor: 'blue' }}
                  onClick={() => navigate(`/admin/contest/${contest.contestId}/questions`)}
                >
                  Questions
                </button>

                <button
                  className="action-btn"
                  style={{ color: '#27ae60', borderColor: '#27ae60' }}
                  onClick={() => navigate(`/admin/contest/${contest.contestId}/leaderboard`)}
                >
                  Results
                </button>

                <button
                  className="action-btn"
                  style={{ color: 'black', borderColor: 'black' }}
                  title="Upload Allowed Emails (CSV)"
                  onClick={() => handleUploadClick(contest.contestId)}
                >
                  Users
                </button>
                
                <button
                  className="action-btn"
                  style={{ color: '#e74c3c', borderColor: '#e74c3c' }}
                  onClick={() => handleDelete(contest.contestId)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- Settings Modal --- */}
      {isSettingsModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="modal-content" style={{ background: 'white', padding: '25px', borderRadius: '10px', width: '400px', maxWidth: '90%' }}>
                <h3 style={{ marginTop: 0, color: '#2c3e50' }}>Contest Settings</h3>
                <form onSubmit={handleSettingsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Title</label>
                        <input 
                            required 
                            type="text" 
                            value={settingsForm.title || ''} 
                            onChange={(e) => setSettingsForm({...settingsForm, title: e.target.value})}
                            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Description</label>
                        <textarea 
                            value={settingsForm.description || ''} 
                            onChange={(e) => setSettingsForm({...settingsForm, description: e.target.value})}
                            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', minHeight: '60px' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Start Time (Window Open)</label>
                        <input 
                            required 
                            type="datetime-local" 
                            value={settingsForm.startTime || ''} 
                            onChange={(e) => setSettingsForm({...settingsForm, startTime: e.target.value})}
                            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>End Time (Window Close)</label>
                        <input 
                            required 
                            type="datetime-local" 
                            value={settingsForm.endTime || ''} 
                            onChange={(e) => setSettingsForm({...settingsForm, endTime: e.target.value})}
                            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Individual Duration (Minutes)</label>
                        <input 
                            required 
                            type="number" 
                            min="1"
                            value={settingsForm.durationMinutes || ''} 
                            onChange={(e) => setSettingsForm({...settingsForm, durationMinutes: e.target.value})}
                            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                            placeholder="e.g. 60"
                        />
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>Time given to a student once they start the exam.</span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setIsSettingsModalOpen(false)} style={{ padding: '8px 16px', background: '#ecf0f1', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" style={{ padding: '8px 16px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Save Settings</button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;