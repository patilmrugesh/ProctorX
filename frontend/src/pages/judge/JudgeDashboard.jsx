import { useState, useEffect, useRef } from 'react';
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
  
  // Ref to hold the active socket client for sending actions
  const stompClientRef = useRef(null);

  useEffect(() => {
    // Redirect if accessed directly without context
    if (!contest) {
        navigate('/student/dashboard');
        return;
    }

    const socket = new SockJS('http://localhost:8080/ws');
    const stompClient = Stomp.over(socket);
    
    // Disable debug logs to keep console clean
    stompClient.debug = null; 

    stompClient.connect({}, () => {
        stompClientRef.current = stompClient;

        // Subscribe to this contest's specific topic
        stompClient.subscribe(`/topic/contest/${contestId}/judge`, (message) => {
            const event = JSON.parse(message.body);
            handleIncomingEvent(event);
        });
    }, (error) => {
        console.log("WS Error:", error);
    });

    // Cleanup on unmount
    return () => {
        if (stompClient && stompClient.connected) {
            stompClient.disconnect();
        }
    };
  }, [contestId]);

  const handleIncomingEvent = (event) => {

    if (event.type === 'CAMERA_FRAME') {
        console.log("📷 Received frame from:", event.username, "Image length:", event.image?.length);
    }
    
    setStudents((prev) => {
        // 1. Handle User Leaving (OFFLINE)
        if (event.type === 'OFFLINE') {
            return prev.filter(s => s.userId != event.userId);
        }

        // 2. Find existing student
        const existingIndex = prev.findIndex(s => s.userId == event.userId);
        let newList = [...prev];

        if (existingIndex === -1) {
            // --- NEW STUDENT ---
            newList.push({
                userId: event.userId,
                name: event.username,
                status: 'Clean',
                violations: event.type === 'TAB_SWITCH' ? 1 : 0,
                image: event.image || null 
            });
        } else {
            // --- UPDATE EXISTING STUDENT ---
            // FIX: We must create a NEW object for React to detect the change and re-render the image
            const updatedStudent = { ...newList[existingIndex] };

            if (event.type === 'TAB_SWITCH') {
                updatedStudent.violations += 1;
                updatedStudent.status = 'Suspicious'; 
            }
            
            if (event.type === 'FULLSCREEN_EXIT') {
                updatedStudent.violations += 1;
                updatedStudent.status = 'Suspicious';
            }

            if (event.type === 'CAMERA_FRAME') {
                setStudents((prev) => 
                    prev.map(s => s.userId == event.userId 
                        ? { ...s, image: event.image } // Only update the image
                        : s
                    )
                );
            }

            newList[existingIndex] = updatedStudent;
        }
        return newList;
    });
  };

  const handleContextMenu = (e, studentId) => {
    e.preventDefault(); 
    setMenuPos({ x: e.pageX, y: e.pageY, visible: true, studentId });
  };

  // --- NEW: Handle Sending Actions ---
  const handleAction = (actionType) => {
    if (stompClientRef.current && menuPos.studentId) {
        const payload = {
            type: actionType, // 'WARN' or 'SUSPEND'
            targetUserId: menuPos.studentId
        };
        try {
            // Send to the new backend endpoint we added
            stompClientRef.current.send(`/app/contest/${contestId}/judge-action`, {}, JSON.stringify(payload));
            alert(`Action ${actionType} sent.`);
        } catch (e) {
            console.error("Failed to send action", e);
        }
    }
    setMenuPos({ ...menuPos, visible: false });
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
                    {student.image ? (
                        <img 
                            src={student.image} 
                            alt="Live" 
                            style={{width:'100%', height:'100%', objectFit:'cover'}} 
                        />
                    ) : (
                        <span style={{color:'#666'}}>[No Video Signal]</span>
                    )}
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
            <div className="menu-item" onClick={() => handleAction('WARN')}>⚠️ Send Warning</div>
            <div className="menu-item danger" onClick={() => handleAction('SUSPEND')}>🚫 Suspend User</div>
        </div>
      )}
    </div>
  );
};

export default JudgeDashboard;