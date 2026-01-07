import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import './ExamArena.css';

const ExamArena = () => {
  const { contestId } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || {};
  
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [code, setCode] = useState('// Write your C++ or Python code here...');
  const [mcqAnswers, setMcqAnswers] = useState({});
  
  const stompClientRef = useRef(null);

  useEffect(() => {
    if (!user.userId) {
        alert("Please login to take the exam.");
        navigate('/login');
        return;
    }

    fetchQuestions();
    
    const socket = new SockJS('http://localhost:8080/ws');
    const client = Stomp.over(socket);
    client.debug = null;
    
    client.connect({}, () => {
        stompClientRef.current = client;
        sendAlert('ONLINE', 'User joined the exam');
    }, (error) => console.log("WS Error", error));

    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('visibilitychange', handleTabSwitch);

    return () => {
        document.removeEventListener('fullscreenchange', checkFullscreen);
        document.removeEventListener('visibilitychange', handleTabSwitch);
        
        // FIX: Check connection before disconnecting
        if (client && client.connected) {
            // Send OFFLINE alert before disconnecting
            if (user.userId) {
                const payload = {
                    type: 'OFFLINE',
                    userId: user.userId,
                    username: user.username,
                    contestId: contestId,
                    message: 'User left the exam'
                };
                try {
                    client.send(`/app/contest/${contestId}/alert`, {}, JSON.stringify(payload));
                } catch (e) {
                    console.error("Failed to send offline status", e);
                }
            }
            // CRITICAL FIX: Do NOT call disconnect() immediately here.
            // Calling disconnect() kills the socket before the 'OFFLINE' message is sent.
            // The browser will automatically close the socket when the page unloads.
            // client.disconnect(); 
        }
    };
  }, []);

  const sendAlert = (type, message) => {
    if (stompClientRef.current && stompClientRef.current.connected && user.userId) {
        const payload = {
            type: type,
            userId: user.userId,
            username: user.username,
            contestId: contestId,
            message: message
        };
        try {
            stompClientRef.current.send(`/app/contest/${contestId}/alert`, {}, JSON.stringify(payload));
        } catch(e) { console.error("Alert Error", e); }
    }
  };

  const handleTabSwitch = () => {
    if (document.hidden) {
        sendAlert('TAB_SWITCH', 'User switched tabs or minimized window');
    }
  };

  const checkFullscreen = () => {
    if (!document.fullscreenElement) {
        setIsFullscreen(false);
        sendAlert('FULLSCREEN_EXIT', 'User exited fullscreen');
    } else {
        setIsFullscreen(true);
    }
  };

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen().catch((e) => console.log(e));
  };

  const fetchQuestions = async () => {
    try {
      const dsaRes = await api.get(`/questions/dsa/contest/${contestId}`);
      const mcqRes = await api.get(`/questions/mcq/contest/${contestId}`);
      const combined = [
        ...(dsaRes.data || []).map(q => ({ ...q, qType: 'DSA' })), 
        ...(mcqRes.data || []).map(q => ({ ...q, qType: 'MCQ', title: "MCQ Question", difficulty: "1 Mark" }))
      ];
      setQuestions(combined);
    } catch (err) {
      console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const handleMCQSelect = (option) => {
    const currentQ = questions[currentQIndex];
    if (currentQ) setMcqAnswers({ ...mcqAnswers, [currentQ.mcqId]: option });
  };

  if (loading) return <div className="exam-container">Loading...</div>;
  
  if (questions.length === 0) {
      return (
        <div className="exam-container" style={{justifyContent:'center', alignItems:'center', flexDirection:'column'}}>
            <h2>No questions found for this exam.</h2>
            <button className="submit-exam-btn" style={{marginTop:'20px'}} onClick={() => navigate('/student/dashboard')}>Return</button>
        </div>
      );
  }

  if (!isFullscreen) {
    return (
        <div className="fullscreen-overlay">
            <h1>⚠️ Security Check</h1>
            <p>This exam must be taken in Fullscreen Mode.</p>
            <button className="submit-exam-btn" style={{marginTop: '20px', fontSize: '1.2rem'}} onClick={enterFullscreen}>
                Enable Fullscreen & Start
            </button>
        </div>
    );
  }

  const currentQ = questions[currentQIndex];
  if (!currentQ) return <div className="exam-container">Error loading question.</div>;

  return (
    <div className="exam-container">
      <div className="exam-header">
        <h3>ProctorX Exam Arena</h3>
        <div className="timer-box">01:29:59</div>
        <button className="submit-exam-btn" onClick={() => navigate('/student/dashboard')}>Finish Exam</button>
      </div>

      <div className="exam-body">
        <div className="question-sidebar">
            <div className="sidebar-header">Questions</div>
            <div className="q-nav-grid">
                {questions.map((_, idx) => (
                    <button key={idx} className={`q-nav-btn ${idx === currentQIndex ? 'active' : ''}`} onClick={() => setCurrentQIndex(idx)}>{idx+1}</button>
                ))}
            </div>
        </div>

        <div className="problem-area">
            <div style={{display: 'flex', alignItems: 'center', marginBottom: '10px'}}>
                <span className="badge">{currentQ.qType}</span>
                <span className="badge" style={{background: '#fff3cd', color: '#856404'}}>{currentQ.difficulty || 'Easy'}</span>
            </div>
            <h2 className="problem-title">{currentQ.title || currentQ.questionText}</h2>
            {currentQ.qType === 'DSA' ? (
                <div>
                    <p className="problem-desc">{currentQ.problemStatement}</p>
                    {currentQ.inputFormat && <><h4 style={{marginTop:'20px'}}>Input</h4><p className="problem-desc">{currentQ.inputFormat}</p></>}
                    {currentQ.constraints && <><h4 style={{marginTop:'20px'}}>Constraints</h4><p className="problem-desc">{currentQ.constraints}</p></>}
                </div>
            ) : (
                <div className="mcq-options">
                    <div className="problem-desc">{currentQ.questionText}</div>
                    {['A', 'B', 'C', 'D'].map((opt) => {
                        const optKey = `option${opt}`;
                        return currentQ[optKey] && (
                            <div key={opt} className={`mcq-option ${mcqAnswers[currentQ.mcqId] === opt ? 'selected' : ''}`} onClick={() => handleMCQSelect(opt)}>
                                <strong>{opt}.</strong> {currentQ[optKey]}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {currentQ.qType === 'DSA' && (
            <div className="answer-area">
                <textarea className="code-editor" value={code} onChange={(e) => setCode(e.target.value)} />
                <div className="editor-footer">
                    <button className="run-btn">Run Code</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ExamArena;