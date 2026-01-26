import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { runCode, submitExam } from '../../services/api'; // 1. Added submitExam import
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import './ExamArena.css';

const ExamArena = () => {
  const { contestId } = useParams();
  const navigate = useNavigate();
  // Safe user access
  const user = JSON.parse(localStorage.getItem('user')) || {};
  
  // --- Exam State ---
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // --- Warning/Judge Action State ---
  const [warningCount, setWarningCount] = useState(0);
  const [warningMessage, setWarningMessage] = useState('');

  // --- Coding State ---
  const [code, setCode] = useState('# Write your Python code here...\n\nimport sys\n\n# Read input from stdin\ndata = sys.stdin.read().split()\n\n# Logic here\n');
  const [language, setLanguage] = useState('PYTHON');
  const [output, setOutput] = useState(''); 
  const [verdict, setVerdict] = useState(''); 
  const [isRunning, setIsRunning] = useState(false);
  
  // --- MCQ State ---
  const [mcqAnswers, setMcqAnswers] = useState({});
  
  // --- Refs ---
  const stompClientRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!user.userId) {
        alert("Please login to take the exam.");
        navigate('/login');
        return;
    }

    fetchQuestions();
    
    let frameInterval;
    
    const initExam = async () => {
        await startWebcam();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const socket = new SockJS('http://localhost:8080/ws');
        const client = Stomp.over(socket);
        client.debug = null;
        
        client.connect({}, () => {
            stompClientRef.current = client;
            sendAlert('ONLINE', 'User joined the exam');
            
            client.subscribe(`/topic/contest/${contestId}/student/${user.userId}`, (message) => {
                const payload = JSON.parse(message.body);
                handleJudgeAction(payload);
            });

            frameInterval = setInterval(captureAndSendFrame, 3000); // 3 seconds
        }, (error) => {
            console.error("WS Error", error);
            alert("Connection failed. Please refresh.");
        });
    };

    initExam();

    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('visibilitychange', handleTabSwitch);

    return () => {
        document.removeEventListener('fullscreenchange', checkFullscreen);
        document.removeEventListener('visibilitychange', handleTabSwitch);
        
        // Clear interval
        if (frameInterval) {
            clearInterval(frameInterval);
        }
        
        // Stop webcam
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        
        // Disconnect WebSocket
        const client = stompClientRef.current;
        if (client?.connected) {
            try {
                client.send(`/app/contest/${contestId}/alert`, {}, JSON.stringify({
                    type: 'OFFLINE',
                    userId: user.userId,
                    username: user.username,
                    contestId: contestId,
                    message: 'User left the exam'
                }));
            } catch(e) { 
                console.error("Cleanup error:", e); 
            }
            client.disconnect();
        }
    };
}, [contestId, navigate]); // Add dependencies

// --- Judge Action Handler ---
  const handleJudgeAction = (action) => {
      if (action.type === 'WARN') {
          setWarningCount(prev => {
              const newCount = prev + 1;
              if (newCount >= 3) {
                  terminateExam("You have exceeded 3 warnings. You are disqualified.");
              } else {
                  setWarningMessage(`WARNING ${newCount}/3: Please focus on the screen.`);
                  setTimeout(() => setWarningMessage(''), 5000); // Hide after 5s
              }
              return newCount;
          });
      } else if (action.type === 'SUSPEND') {
          terminateExam("You have been suspended by the Proctor.");
      }
  };

  const terminateExam = (reason) => {
      alert(reason);
      // Optional: Auto-submit on force quit
      handleFinishExam(true); 
  };

  // --- Proctoring Logic ---

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 160, height: 120 }
      });
  
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
  
        await videoRef.current.play();
  
        // 🔥 WAIT until video has real frames
        await new Promise(resolve => {
          if (videoRef.current.readyState >= 3) {
            resolve();
          } else {
            videoRef.current.oncanplay = resolve;
          }
        });
      }
    } catch (err) {
      console.error("Camera access denied", err);
      alert("Camera permission is mandatory!");
    }
  };
  
  const captureAndSendFrame = () => {
    // ✅ Add more robust checks
    if (!stompClientRef.current?.connected) {
        console.warn("WebSocket not connected, skipping frame");
        return;
    }
    
    if (!videoRef.current || !canvasRef.current) {
        console.warn("Video/Canvas refs not ready");
        return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // ✅ Better video readiness check
    if (video.paused || video.ended || video.videoWidth === 0 || video.readyState < 2) {
        console.warn("Video not ready yet");
        return;
    }

    try {
        const ctx = canvas.getContext('2d');
        canvas.width = 320;
        canvas.height = 240;
        ctx.drawImage(video, 0, 0, 320, 240);
        
        // const imageBase64 = canvas.toDataURL('image/jpeg', 0.3); // ✅ Lower quality
        const imageBase64 = canvasRef.current.toDataURL('image/jpeg', 0.6);

        stompClientRef.current.send(
            `/app/contest/${contestId}/alert`,
            {},
            JSON.stringify({
                type: 'CAMERA_FRAME',
                userId: user.userId,
                username: user.username,
                contestId,
                image: imageBase64
            })
        );
    } catch (err) {
        console.error("Frame capture error:", err);
    }
};
  

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

  // --- Data Logic ---

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

  // --- Code Execution Logic ---

  const handleLanguageChange = (e) => {
      const lang = e.target.value;
      setLanguage(lang);
      if (lang === 'PYTHON') {
          setCode('# Python Solution\nimport sys\n\n# Read input\ndata = sys.stdin.read().split()\n# Logic here\n');
      } else if (lang === 'CPP') {
          setCode('// C++ Solution\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // code here\n    return 0;\n}');
      }
  };

  const handleRunCode = async () => {
    const currentQ = questions[currentQIndex];
    if (!currentQ) return;

    setIsRunning(true);
    setOutput("Running test cases...");
    setVerdict("");

    const payload = {
        code: code,
        language: language,
        questionId: Number(currentQ.questionId), 
        userId: Number(user.userId),
        contestId: Number(contestId)
    };

    try {
        const res = await runCode(payload);
        setVerdict(res.data.verdict);
        setOutput(res.data.output);
    } catch (err) {
        setVerdict("Error");
        if(err.response && err.response.status === 400) {
             setOutput("Bad Request: Data mismatch.");
        } else {
             setOutput("Server Error or Compilation Failed.");
        }
    } finally {
        setIsRunning(false);
    }
  };

  const handleMCQSelect = (option) => {
    const currentQ = questions[currentQIndex];
    if (currentQ) setMcqAnswers({ ...mcqAnswers, [currentQ.mcqId]: option });
  };

  // --- 2. NEW: Submit Exam Logic (Leaderboard Logic) ---
  const handleFinishExam = async (force = false) => {
    if(!force && !confirm("Are you sure you want to submit? You cannot undo this.")) return;
    
    try {
        const payload = {
            userId: user.userId,
            contestId: Number(contestId),
            mcqAnswers: mcqAnswers 
        };
        await submitExam(payload);
        alert("Exam Submitted Successfully!");
        navigate('/student/dashboard');
    } catch (err) {
        // Even if submission fails (e.g. already submitted), leave the arena
        alert("Submission End: " + (err.response?.data || "Completed"));
        navigate('/student/dashboard');
    }
  };

  // --- Render ---

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
      {/* Video and Canvas for capture */}
      <video 
  ref={videoRef} 
  autoPlay 
  playsInline 
  muted 
  style={{
    position: 'absolute', 
    width: '1px', 
    height: '1px', 
    opacity: 0, 
    pointerEvents: 'none'
  }}
></video>
      <canvas ref={canvasRef} width="320" height="240" style={{display: 'none'}}></canvas>

      {/* Warning Overlay */}
      {warningMessage && (
          <div style={{
              position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', 
              background: '#e74c3c', color: 'white', padding: '15px 30px', borderRadius: '8px', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 9999, fontWeight: 'bold', fontSize: '1.2rem'
          }}>
              ⚠️ {warningMessage}
          </div>
      )}
      <div className="exam-header">
        <h3>ProctorX Exam Arena</h3>
        <div style={{display:'flex', gap:'20px', alignItems:'center'}}>
            <span style={{background: warningCount > 0 ? '#e74c3c' : '#27ae60', padding:'5px 10px', borderRadius:'4px', fontSize:'0.9rem'}}>
                Warnings: {warningCount}/3
            </span>
            {/* 3. NEW: Updated Button onClick */}
            <button className="submit-exam-btn" onClick={() => handleFinishExam(false)}>Finish Exam</button>
        </div>
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
                    
                    {verdict && (
                        <div style={{marginTop: '20px', padding: '15px', background: '#f1f1f1', borderRadius: '8px', borderLeft: `5px solid ${verdict === 'AC' ? 'green' : 'red'}`}}>
                            <h4>Verdict: <span style={{color: verdict === 'AC' ? 'green' : 'red'}}>{verdict}</span></h4>
                            <pre style={{whiteSpace: 'pre-wrap', fontSize: '0.9rem'}}>{output}</pre>
                        </div>
                    )}
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
                    <select 
                        value={language} 
                        onChange={handleLanguageChange} 
                        style={{marginRight: 'auto', background: '#333', color: 'white', border: 'none', padding: '5px'}}
                    >
                        <option value="PYTHON">Python</option>
                        <option value="CPP">C++</option>
                    </select>
                    <button 
                        className="run-btn" 
                        onClick={handleRunCode} 
                        disabled={isRunning}
                        style={{background: isRunning ? '#666' : '#2ecc71'}}
                    >
                        {isRunning ? 'Running...' : 'Run Code'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ExamArena;