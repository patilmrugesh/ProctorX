import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLeaderboard } from '../../services/api';
import './Leaderboard.css';

const Leaderboard = () => {
  const { contestId } = useParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard(contestId)
      .then(res => {
        setResults(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch leaderboard', err);
        setLoading(false);
      });
  }, [contestId]);

  const getRankClass = (index) => {
    if (index === 0) return 'rank-gold';
    if (index === 1) return 'rank-silver';
    if (index === 2) return 'rank-bronze';
    return '';
  };

  const getRankBadge = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <div>
          <Link to="/admin/dashboard" className="back-link">← Back to Dashboard</Link>
          <h1>Contest Leaderboard</h1>
        </div>
      </div>
      
      {loading ? (
        <div className="loading-state">Loading results...</div>
      ) : (
        <div className="leaderboard-card">
          <div className="table-wrapper">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student Name</th>
                  <th>DSA Score</th>
                  <th>MCQ Score</th>
                  <th>Total Score</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      No submissions yet.
                    </td>
                  </tr>
                ) : (
                  results.map((res, index) => (
                    <tr key={res.id} className={getRankClass(index)}>
                      <td>
                        <span className="rank-badge">{getRankBadge(index)}</span>
                      </td>
                      <td className="student-name">{res.user.username}</td>
                      <td className="score-dsa">{res.dsaScore}</td>
                      <td className="score-mcq">{res.mcqScore}</td>
                      <td className="score-total">{res.totalScore}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;