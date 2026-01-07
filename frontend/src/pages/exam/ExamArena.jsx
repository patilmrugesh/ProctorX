import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './ExamArena.css';

const ExamArena = () => {
  const { contestId } = useParams();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Answers State
  const [code, setCode] = useState('// Write your C++ or Python code here...');
  const [mcqAnswers, setMcqAnswers] = useState({}); // { questionId: 'A' }

  useEffect(() => {
    fetchQuestions();
    
    // Listen for fullscreen exit (Cheating detection start)
    document.addEventListener('fullscreenchange', checkFullscreen);
    return () => document.removeEventListener('fullscreenchange', checkFullscreen);
  }, []);

  const checkFullscreen = () => {
    if (!document.fullscreenElement) {
        setIsFullscreen(false);
        alert("WARNING: You exited fullscreen! This incident has been logged.");
    } else {
        setIsFullscreen(true);
    }
  };

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen().catch((e) => {
        console.log(e);
    });
  };

  const fetchQuestions = async () => {
    try {
      const dsaRes = await api.get(`/questions/dsa/contest/${contestId}`);
      const mcqRes = await api.get(`/questions/mcq/contest/${contestId}`);
      
      const combined = [
        ...dsaRes.data.map(q => ({ ...q, qType: 'DSA' })), 
        ...mcqRes.data.map(q => ({ ...q, qType: 'MCQ', title: "MCQ Question", difficulty: "1 Mark" }))
      ];
      setQuestions(combined);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load exam", err);
    }
  };

  const handleMCQSelect = (option) => {
    const currentQ = questions[currentQIndex];
    setMcqAnswers({ ...mcqAnswers, [currentQ.mcqId]: option });
  };

  if (loading) return <div className="exam-container">Loading Exam...</div>;

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

  return (
    <div className="exam-container">
      {/* Header */}
      <div className="exam-header">
        <h3>ProctorX Exam Arena</h3>
        <div className="timer-box">01:29:59</div>
        <button className="submit-exam-btn" onClick={() => { 
            if(confirm("Are you sure you want to finish the exam?")) navigate('/student/dashboard');
        }}>Finish Exam</button>
      </div>

      <div className="exam-body">
        {/* Sidebar */}
        <div className="question-sidebar">
            <div className="sidebar-header">Questions</div>
            <div className="q-nav-grid">
                {questions.map((_, idx) => (
                    <button 
                        key={idx} 
                        className={`q-nav-btn ${idx === currentQIndex ? 'active' : ''}`}
                        onClick={() => setCurrentQIndex(idx)}
                    >
                        {idx + 1}
                    </button>
                ))}
            </div>
        </div>

        {/* Problem Description */}
        <div className="problem-area">
            <div style={{display: 'flex', alignItems: 'center', marginBottom: '10px'}}>
                <span className="badge">{currentQ.qType}</span>
                <span className="badge" style={{background: '#fff3cd', color: '#856404'}}>{currentQ.difficulty || 'Easy'}</span>
            </div>
            
            <h2 className="problem-title">{currentQ.title || currentQ.questionText}</h2>
            
            {currentQ.qType === 'DSA' ? (
                <div>
                    <p className="problem-desc">{currentQ.problemStatement}</p>
                    
                    <h4 style={{marginTop: '20px'}}>Input Format</h4>
                    <p className="problem-desc" style={{fontSize: '0.9rem'}}>{currentQ.inputFormat}</p>
                    
                    <h4 style={{marginTop: '20px'}}>Constraints</h4>
                    <p className="problem-desc" style={{fontSize: '0.9rem'}}>{currentQ.constraints}</p>
                </div>
            ) : (
                // MCQ View
                <div className="mcq-options">
                    <div className="problem-desc">{currentQ.questionText}</div>
                    {['A', 'B', 'C', 'D'].map((opt) => (
                        currentQ[`option${opt}`] && (
                            <div 
                                key={opt}
                                className={`mcq-option ${mcqAnswers[currentQ.mcqId] === opt ? 'selected' : ''}`}
                                onClick={() => handleMCQSelect(opt)}
                            >
                                <strong>{opt}.</strong> {currentQ[`option${opt}`]}
                            </div>
                        )
                    ))}
                </div>
            )}
        </div>

        {/* Right Side: Code Editor (Only for DSA) */}
        {currentQ.qType === 'DSA' && (
            <div className="answer-area">
                <textarea 
                    className="code-editor"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    spellCheck="false"
                ></textarea>
                <div className="editor-footer">
                    <select style={{marginRight: 'auto', background: '#333', color: 'white', border: 'none', padding: '5px'}}>
                        <option>C++</option>
                        <option>Python</option>
                    </select>
                    <button className="run-btn">Run Code</button>
                    <button className="submit-code-btn" style={{marginLeft: '10px'}}>Submit</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ExamArena;