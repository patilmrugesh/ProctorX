import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { joinContest, joinJudge } from "../../services/api";
import "./StudentDashboard.css";

const StudentDashboard = () => {
  const [token, setToken] = useState("");
  const [judgeToken, setJudgeToken] = useState("");
  const [contest, setContest] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation(); // Hook to access state passed from Admin
  const user = JSON.parse(localStorage.getItem("user"));

  // --- Check for Auto-Fill Token ---
  useEffect(() => {
    if (location.state?.autoToken) {
      setToken(location.state.autoToken);
    }
  }, [location.state]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError("");
    setContest(null);

    try {
      const response = await joinContest(token, user.email);
      setContest(response.data);
    } catch (err) {
      setError(err.response?.data || "Invalid Token or Access Denied.");
    } finally {
      setLoading(false);
    }
  };

  const handleJudgeJoin = async (e) => {
    e.preventDefault();
    if (!judgeToken) return;

    try {
      const response = await joinJudge(judgeToken);
      navigate(`/judge/monitor/${response.data.contestId}`, {
        state: { contest: response.data },
      });
    } catch (err) {
      alert(err.response?.data || "Invalid Judge Token or Contest not Active");
    }
  };

  const handleStartExam = () => {
    navigate(`/exam/${contest.contestId}`, { state: { contest } });
  };

  return (
    <div className="student-container">
      <div className="welcome-banner">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
          }}
        >
          <div>
            <h1>Welcome, {user?.username}</h1>
            <p>Ready to prove your skills? Enter your exam token below.</p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              position: "relative",
              zIndex: 10,
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "white",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Logout
          </button>
          {user.role === "ADMIN" && (
            <button
              style={{
                position: "relative",
              zIndex: 10,
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "white",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "600",
              }}
              onClick={() => navigate("/admin/dashboard", { replace: true })}
            >
              ← Back to Admin Panel
            </button>
          )}
        </div>
      </div>

      <div className="join-section">
        <h3>Join an Assessment</h3>
        <p style={{ color: "#666", marginBottom: "1rem" }}>
          Ask your administrator for the unique Student Token.
        </p>

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
              {loading ? "..." : "Verify"}
            </button>
          </div>
        </form>

        {error && (
          <p style={{ color: "red", marginTop: "1rem", fontWeight: "bold" }}>
            {error}
          </p>
        )}

        {contest && (
          <div className="contest-details">
            <h2
              style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}
            >
              {contest.title}
            </h2>

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
                <p
                  style={{
                    color: contest.status === "LIVE" ? "green" : "orange",
                    fontWeight: "bold",
                  }}
                >
                  {contest.status}
                </p>
              </div>
            </div>

            <p style={{ marginBottom: "1rem", color: "#555" }}>
              {contest.description}
            </p>

            <div
              style={{
                background: "#fff3cd",
                padding: "10px",
                borderRadius: "4px",
                fontSize: "0.9rem",
                marginBottom: "1rem",
              }}
            >
              ⚠️ <strong>Warning:</strong> Fullscreen mode is enforced. Tab
              switching is monitored.
            </div>

            <button className="start-btn" onClick={handleStartExam}>
              Start Exam Now
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: "3rem",
          textAlign: "center",
          borderTop: "1px solid #ddd",
          paddingTop: "2rem",
        }}
      >
        <h4 style={{ color: "#666" }}>Are you a Judge?</h4>
        <form
          onSubmit={handleJudgeJoin}
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "10px",
            marginTop: "1rem",
          }}
        >
          <input
            type="text"
            placeholder="JUDGE TOKEN"
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
            value={judgeToken}
            onChange={(e) => setJudgeToken(e.target.value.toUpperCase())}
          />
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              background: "#2c3e50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Join as Judge
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentDashboard;
