import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminContests, deleteContest, updateContestStatus, uploadContestUsers } from '../../services/api';
import api from '../../services/api'; 
import './AdminDashboard.css';

const AdminDashboard = () => {
  // --- States ---
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletCredits, setWalletCredits] = useState(0); // State for live credits
  const [selectedContestId, setSelectedContestId] = useState(null);

  // --- Hooks & Refs ---
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user')) || {};

  // --- Effects ---
  useEffect(() => {
    // Basic Security Check
    if (!user.userId) {
      navigate('/login');
      return;
    }

    // Parallel execution for better performance
    fetchContests();
    fetchWalletCredits();
  }, [user?.userId]);

  // --- Data Fetching Logic ---

  /**
   * Fetches the latest user data from Neon via the AuthController
   * to ensure credits are always up-to-date.
   */
   const fetchWalletCredits = async () => {
    // 1. Ensure we have a valid ID
    const userId = user.userId || user.id; 
    
    if (!userId) {
        console.error("No User ID found in localStorage. Please log out and back in.");
        return;
    }

    try {
        // Use a leading slash to ensure it appends correctly to /api
        const res = await api.get(`/auth/user/${Number(userId)}`); 
        
        if (res.data && res.data.walletCredits !== undefined) {
            setWalletCredits(res.data.walletCredits);
            
            // Sync back to local storage
            const updatedUser = { ...user, walletCredits: res.data.walletCredits };
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
    } catch (err) {
        console.error("Refresh Error Status:", err.response?.status);
        console.log("Attempted URL:", err.config?.url);
        // Fallback to what we know
        setWalletCredits(user.walletCredits || 0);
    }
};

  /**
   * Fetches all contests created by this admin
   */
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
    try {
      await updateContestStatus(contest.contestId, newStatus);
      fetchContests();
    } catch (err) {
      alert("Failed to update status");
    }
  };

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
                <div
                  className={`status-dot ${contest.status === 'LIVE' ? 'live' : ''}`}
                  title={`Status: ${contest.status} (Click to toggle)`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleStatusToggle(contest)}
                ></div>
              </div>

              <p className="card-desc">{contest.description || "No description provided."}</p>

              <div style={{ marginBottom: '10px', fontSize: '0.85rem', color: '#666' }}>
                Status: <strong>{contest.status}</strong>
                {contest.status === 'DRAFT' && <span style={{ fontSize: '0.7rem', marginLeft: '5px' }}>(Click dot to go Live)</span>}
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

              <div className="card-actions">
                <button
                  className="action-btn"
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
    </div>
  );
};

export default AdminDashboard;