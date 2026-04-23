import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import './JudgeDashboard.css';

const JudgeDashboard = () => {
  const { state }    = useLocation();
  const { contestId }= useParams();
  const navigate     = useNavigate();
  const contest      = state?.contest;

  const [students, setStudents] = useState([]);
  const [menuPos, setMenuPos]   = useState({ x: 0, y: 0, visible: false, studentId: null });
  const stompClientRef = useRef(null);

  useEffect(() => {
    if (!contest) { navigate('/student/dashboard'); return; }

    const socket = new SockJS('http://localhost:8080/ws');
    const client = Stomp.over(socket);
    client.debug = null;

    client.connect({}, () => {
      stompClientRef.current = client;
      client.subscribe(`/topic/contest/${contestId}/judge`, (message) => {
        handleIncomingEvent(JSON.parse(message.body));
      });
    }, err => console.log("WS Error:", err));

    return () => { if (client?.connected) client.disconnect(); };
  }, [contestId]);

  const handleIncomingEvent = (event) => {
    if (event.type === 'CAMERA_FRAME') {
      setStudents(prev => prev.map(s => s.userId == event.userId ? { ...s, image: event.image } : s));
      return;
    }
    setStudents(prev => {
      if (event.type === 'OFFLINE') return prev.filter(s => s.userId != event.userId);
      const idx = prev.findIndex(s => s.userId == event.userId);
      const list = [...prev];
      if (idx === -1) {
        list.push({ userId: event.userId, name: event.username, status: 'clean', violations: event.type === 'TAB_SWITCH' ? 1 : 0, image: event.image || null });
      } else {
        const upd = { ...list[idx] };
        if (event.type === 'TAB_SWITCH' || event.type === 'FULLSCREEN_EXIT') {
          upd.violations += 1;
          upd.status = 'suspicious';
        }
        list[idx] = upd;
      }
      return list;
    });
  };

  const handleContextMenu = (e, studentId) => {
    e.preventDefault();
    setMenuPos({ x: e.pageX, y: e.pageY, visible: true, studentId });
  };

  const handleAction = (actionType) => {
    if (stompClientRef.current && menuPos.studentId) {
      try {
        stompClientRef.current.send(`/app/contest/${contestId}/judge-action`, {}, JSON.stringify({ type: actionType, targetUserId: menuPos.studentId }));
      } catch {}
    }
    setMenuPos({ ...menuPos, visible: false });
  };

  useEffect(() => {
    const close = () => setMenuPos(m => ({ ...m, visible: false }));
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const totalViolations = students.reduce((s, st) => s + st.violations, 0);
  const suspicious      = students.filter(s => s.status === 'suspicious').length;

  return (
    <div className="judge-page">
      {/* Header */}
      <div className="judge-header">
        <div className="judge-brand">⚖️ ProctorX Judge Panel</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text-secondary)', fontSize:'0.875rem' }}>
          📋 {contest?.title}
        </div>
        <div className="live-badge">
          <span className="live-dot" />
          Live Monitoring
        </div>
      </div>

      <div className="judge-content">
        {/* Stats */}
        <div className="judge-stats">
          <div className="j-stat">
            <div className="j-stat-label">Active Students</div>
            <div className="j-stat-value" style={{ color:'var(--success)' }}>{students.length}</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-label">Suspicious</div>
            <div className="j-stat-value" style={{ color:'var(--warning)' }}>{suspicious}</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-label">Total Violations</div>
            <div className="j-stat-value" style={{ color:'var(--danger)' }}>{totalViolations}</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-label">Contest</div>
            <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--primary-light)', marginTop:4 }}>
              #{contestId}
            </div>
          </div>
        </div>

        {/* Student grid */}
        <div className="monitoring-grid">
          {students.length === 0 ? (
            <div className="judge-empty">
              <div className="icon">📷</div>
              <h3>Waiting for students to join…</h3>
              <p>Students' camera feeds will appear here in real time.</p>
            </div>
          ) : (
            students.map(student => (
              <div
                key={student.userId}
                id={`student-card-${student.userId}`}
                className={`student-card ${student.status}`}
                onContextMenu={e => handleContextMenu(e, student.userId)}
              >
                <div className="camera-feed">
                  {student.image ? (
                    <img src={student.image} alt="Live feed" />
                  ) : (
                    <div className="camera-feed-placeholder">
                      <div className="cam-icon">📷</div>
                      <span>No Signal</span>
                    </div>
                  )}
                </div>
                <div className="student-info">
                  <span className="student-name">{student.name}</span>
                  {student.violations > 0 && (
                    <span className={`violation-badge ${student.violations >= 3 ? 'high' : ''}`}>
                      ⚠ {student.violations}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Context menu */}
      {menuPos.visible && (
        <div className="ctx-menu" style={{ top: menuPos.y, left: menuPos.x }}>
          <div className="ctx-item warn" id="ctx-warn-btn" onClick={() => handleAction('WARN')}>⚠️ Send Warning</div>
          <div className="ctx-divider" />
          <div className="ctx-item danger" id="ctx-suspend-btn" onClick={() => handleAction('SUSPEND')}>🚫 Suspend Student</div>
        </div>
      )}
    </div>
  );
};

export default JudgeDashboard;