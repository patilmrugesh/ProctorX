import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import './JudgeDashboard.css';

const JudgeDashboard = () => {
  const { state } = useLocation();
  const { contestId } = useParams();
  const navigate = useNavigate();
  const contest = state?.contest;

  const [students, setStudents] = useState([]); 
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0, visible: false, studentId: null });

  useEffect(() => {
    if (!contest) {
        navigate('/student/dashboard');
        return;
    }

    const socket = new SockJS('http://localhost:8080/ws');
    const stompClient = Stomp.over(socket);
    
    stompClient.debug = null; 

    stompClient.connect({}, () => {
        stompClient.subscribe(`/topic/contest/${contestId}/judge`, (message) => {
            const event = JSON.parse(message.body);
            handleIncomingEvent(event);
        });
    }, (error) => {
        console.log("WS Error:", error);
    });

    return () => {
        if (stompClient && stompClient.connected) {
            stompClient.disconnect();
        }
    };
  }, [contestId]);

  const handleIncomingEvent = (event) => {
    setStudents((prev) => {
        // --- NEW: Remove student if OFFLINE ---
        if (event.type === 'OFFLINE') {
            // Use loose equality (!=) to match string ID (from WS) with number ID (from State)
            return prev.filter(s => s.userId != event.userId);
        }

        const existingIndex = prev.findIndex(s => s.userId == event.userId);
        let newList = [...prev];

        if (existingIndex === -1) {
            newList.push({
                userId: event.userId,
                name: event.username,
                status: 'Clean',
                violations: event.type === 'TAB_SWITCH' ? 1 : 0
            });
        } else {
            if (event.type === 'TAB_SWITCH') {
                newList[existingIndex].violations += 1;
                newList[existingIndex].status = 'Suspicious'; 
            }
        }
        return newList;
    });
  };

  const handleContextMenu = (e, studentId) => {
    e.preventDefault();
    setMenuPos({ x: e.pageX, y: e.pageY, visible: true, studentId });
  };

  useEffect(() => {
    const handleClick = () => setMenuPos({ ...menuPos, visible: false });
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuPos]);

  return (
    <div className="judge-container">
      <div className="judge-header">
        <div>
          <h2 style={{margin: 0}}>ProctorX Judge Panel</h2>
          <span style={{color: '#aaa', fontSize: '0.9rem'}}>{contest?.title}</span>
        </div>
        <div className="live-badge">● LIVE MONITORING</div>
      </div>

      <div className="monitoring-grid">
        {students.length === 0 ? (
            <div style={{gridColumn: '1/-1', textAlign:'center', padding:'2rem', color:'#666'}}>
                Waiting for students to join or trigger events...
            </div>
        ) : (
            students.map((student) => (
            <div 
                key={student.userId} 
                className={`student-card ${student.status.toLowerCase()}`}
                onContextMenu={(e) => handleContextMenu(e, student.userId)}
            >
                <div className="camera-feed">
                [Live Feed: {student.name}]
                </div>
                <div className="student-info">
                <span style={{fontWeight: 'bold'}}>{student.name}</span>
                {student.violations > 0 && (
                    <span className="violation-count">{student.violations} Violations</span>
                )}
                </div>
            </div>
            ))
        )}
      </div>

      {menuPos.visible && (
        <div className="context-menu" style={{ top: menuPos.y, left: menuPos.x }}>
            <div className="menu-item">⚠️ Send Warning</div>
            <div className="menu-item danger">🚫 Suspend User</div>
        </div>
      )}
    </div>
  );
};

export default JudgeDashboard;