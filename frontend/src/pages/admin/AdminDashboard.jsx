import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminContests, deleteContest, updateContestStatus, uploadContestUsers } from '../../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  // Initialize as empty array to prevent map errors
  const [contests, setContests] = useState([]); 
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const fileInputRef = useRef(null); 
  const [selectedContestId, setSelectedContestId] = useState(null);
  
  const user = JSON.parse(localStorage.getItem('user')) || {};

  useEffect(() => {
    fetchContests();
  }, [user?.userId]);

  const fetchContests = () => {
    if (user?.userId) {
      getAdminContests(user.userId)
        .then((res) => {
          // SAFETY CHECK: Ensure response data is actually an array
          if (Array.isArray(res.data)) {
            setContests(res.data);
          } else {
            console.error("API returned non-array data:", res.data);
            setContests([]); 
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch contests", err);
          setContests([]); // Fallback to empty array on error
          setLoading(false);
        });
    } else {
        setLoading(false);
    }
  };

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

  if (loading) return <div className="dashboard-container">Loading...</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="credits-badge">
            Wallet Credits: <span className="credits-count">{user?.walletCredits || 0}</span>
          </p>
        </div>
        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
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

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{display: 'none'}} 
        accept=".csv,.txt"
        onChange={handleFileChange}
      />

      <div className="contest-grid">
        {/* SAFETY CHECK: Check if array exists and has length */}
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
                    title={contest.status}
                    style={{cursor: 'pointer'}}
                    onClick={() => handleStatusToggle(contest)}
                ></div>
              </div>

              <p className="card-desc">{contest.description || "No description provided."}</p>
              
              <div style={{marginBottom: '10px', fontSize: '0.85rem', color: '#666'}}>
                Status: <strong>{contest.status}</strong> 
                {contest.status === 'DRAFT' && <span style={{fontSize:'0.7rem', marginLeft:'5px'}}>(Click dot to go Live)</span>}
              </div>

              <div className="token-box">
                <div 
                    className="token-row" 
                    title="Click to copy"
                    style={{cursor: 'pointer'}}
                    onClick={() => copyToClipboard(contest.studentToken, "Student Token")}
                >
                  <span>Student Token:</span>
                  <span className="token-code">{contest.studentToken}</span>
                </div>
                <div 
                    className="token-row"
                    title="Click to copy"
                    style={{cursor: 'pointer'}}
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
                  style={{color: '#27ae60', borderColor: '#27ae60'}}
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
                    style={{color: '#e74c3c', borderColor: '#e74c3c'}}
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