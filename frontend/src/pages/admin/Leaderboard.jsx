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
      .then(res => { setResults(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [contestId]);

  const MEDALS = ['🥇', '🥈', '🥉'];
  const POD_CLASS = ['gold', 'silver', 'bronze'];

  const top3   = results.slice(0, 3);
  const rest   = results.slice(3);

  // Reorder podium: 2nd, 1st, 3rd (for nicer visual)
  const podiumOrder = [1, 0, 2].map(i => top3[i]).filter(Boolean);

  return (
    <div className="lb-page">
      <div className="lb-content">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Link to="/admin/dashboard" className="btn-ghost" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, marginBottom:20 }}>
            ← Back to Dashboard
          </Link>
          <div className="lb-header">
            <h1>🏆 Leaderboard</h1>
            <p>Final results and rankings for Contest #{contestId}</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:200, gap:12, color:'var(--text-secondary)' }}>
            <span className="spinner" /> Loading results…
          </div>
        ) : results.length === 0 ? (
          <div className="lb-table-wrap">
            <div className="lb-empty">
              <div className="icon">📊</div>
              <p>No submissions yet. Results will appear after students submit.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <div className="podium">
                {[1, 0, 2].map(i => {
                  const r = top3[i];
                  if (!r) return <div key={i} />;
                  return (
                    <div key={i} className={`podium-item ${POD_CLASS[i]}`} id={`podium-${i+1}`}>
                      <div className="podium-medal">{MEDALS[i]}</div>
                      <div className="podium-name">{r.user?.username || 'Anonymous'}</div>
                      <div className="podium-score">{r.totalScore}</div>
                      <div className="podium-sub">
                        DSA: {r.dsaScore} | MCQ: {r.mcqScore}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full table */}
            <div className="lb-table-wrap">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ textAlign:'center' }}>Rank</th>
                    <th>Student Name</th>
                    <th style={{ textAlign:'center' }}>DSA Score</th>
                    <th style={{ textAlign:'center' }}>MCQ Score</th>
                    <th style={{ textAlign:'center' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((res, i) => (
                    <tr key={res.id || i} id={`lb-row-${i+1}`}>
                      <td className="rank-cell">
                        {i < 3 ? MEDALS[i] : `#${i+1}`}
                      </td>
                      <td className="name-cell">{res.user?.username || 'Anonymous'}</td>
                      <td className="score-cell">{res.dsaScore}</td>
                      <td className="score-cell">{res.mcqScore}</td>
                      <td className="score-cell total">{res.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;