import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api, { runCode, submitExam, WS_URL } from "../../services/api";
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import "./ExamArena.css";

const ExamArena = () => {
  const [visitedQuestionIds, setVisitedQuestionIds]   = useState(new Set());
  const [examTimeLeft, setExamTimeLeft]               = useState(null);
  const [submittedQuestionIds, setSubmittedQuestionIds] = useState(new Set());
  const questionRemainingTimeRef = useRef({});

  const { contestId } = useParams();
  const navigate      = useNavigate();
  const location      = useLocation();
  const user          = JSON.parse(localStorage.getItem("user")) || {};
  const contest       = location.state?.contest || {};

  const [questions, setQuestions]         = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [loading, setLoading]             = useState(true);
  const [isFullscreen, setIsFullscreen]   = useState(false);

  const [qTimeLeft, setQTimeLeft]               = useState(null);
  const [lockedQuestionIds, setLockedQuestionIds] = useState(new Set());

  const [warningCount, setWarningCount]     = useState(0);
  const [warningMessage, setWarningMessage] = useState("");

  const [code, setCode]       = useState("# Write your Python code here...\nimport sys\n\ndata = sys.stdin.read().split()\n\n# Logic here\n");
  const [language, setLanguage] = useState("PYTHON");
  const [output, setOutput]   = useState("");
  const [verdict, setVerdict] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const [mcqAnswers, setMcqAnswers] = useState({});

  const stompClientRef    = useRef(null);
  const videoRef          = useRef(null);
  const canvasRef         = useRef(null);
  const cameraIntervalRef = useRef(null);

  const getQId = useCallback((q) => {
    if (!q) return null;
    return q.qType === "DSA" ? q.questionId : q.mcqId;
  }, []);

  // Overall timer countdown
  useEffect(() => {
    if (examTimeLeft == null) return;
    if (examTimeLeft <= 0) { handleFinishExam(true); return; }
    const id = setInterval(() => setExamTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [examTimeLeft]);

  useEffect(() => {
    if (contest?.durationMinutes && examTimeLeft == null)
      setExamTimeLeft(contest.durationMinutes * 60);
  }, [contest, examTimeLeft]);

  // Main setup
  useEffect(() => {
    if (!user.userId) { alert("Please login to take the exam."); navigate("/login", { replace: true }); return; }
    fetchQuestions(); startWebcam();

    const socket = new SockJS(WS_URL || "http://localhost:8080/ws");
    const client = Stomp.over(socket);
    client.debug = null;
    client.connect({}, () => {
      stompClientRef.current = client;
      sendAlert("ONLINE", "User joined the exam");
      client.subscribe(`/topic/contest/${contestId}/student/${user.userId}`, (msg) => handleJudgeAction(JSON.parse(msg.body)));
      cameraIntervalRef.current = setInterval(captureAndSendFrame, 2000);
    }, err => console.error("WS Error", err));

    document.addEventListener("fullscreenchange", checkFullscreen);
    document.addEventListener("visibilitychange", handleTabSwitch);

    return () => {
      document.removeEventListener("fullscreenchange", checkFullscreen);
      document.removeEventListener("visibilitychange", handleTabSwitch);
      if (cameraIntervalRef.current) { clearInterval(cameraIntervalRef.current); cameraIntervalRef.current = null; }
      if (client?.connected && user.userId) {
        try { client.send(`/app/contest/${contestId}/alert`, {}, JSON.stringify({ type:"OFFLINE", userId:user.userId, username:user.username, contestId, message:"User left" })); } catch {}
        setTimeout(() => { try { client.disconnect(); } catch {} }, 500);
      }
    };
  }, [contestId, navigate]);

  // Per-Q timer init
  useEffect(() => {
    if (questions.length === 0) return;
    const currentQ = questions[currentQIndex]; if (!currentQ) return;
    const qId = getQId(currentQ);
    if (lockedQuestionIds.has(qId)) { setQTimeLeft(null); return; }
    if (questionRemainingTimeRef.current[qId] == null) {
      const limit = currentQ.solveTime || (contest.timerType === 'PER_QUESTION' ? contest.questionTimerSeconds : null);
      questionRemainingTimeRef.current[qId] = limit ? Number(limit) : null;
    }
    setQTimeLeft(questionRemainingTimeRef.current[qId]);
  }, [currentQIndex, questions, lockedQuestionIds, getQId, contest.timerType, contest.questionTimerSeconds]);

  // Per-Q timer countdown
  useEffect(() => {
    if (qTimeLeft === null) return;
    if (qTimeLeft <= 0) { handleQuestionTimeout(); return; }
    const timerId = setInterval(() => {
      setQTimeLeft(t => {
        const newTime = t - 1;
        const q = questions[currentQIndex];
        if (q) questionRemainingTimeRef.current[getQId(q)] = newTime;
        return newTime;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [qTimeLeft, questions, currentQIndex, getQId]);

  const handleQuestionTimeout = () => {
    const currentQ = questions[currentQIndex]; if (!currentQ) return;
    const qId = getQId(currentQ);
    setLockedQuestionIds(prev => new Set(prev).add(qId));
    setQTimeLeft(null);
    if (currentQIndex < questions.length - 1) setCurrentQIndex(i => i + 1);
  };

  const handleJudgeAction = (action) => {
    if (action.type === "WARN") {
      setWarningCount(prev => {
        const next = prev + 1;
        if (next >= 3) terminateExam("You've exceeded 3 warnings. Disqualified.");
        else { setWarningMessage(`⚠️ Warning ${next}/3: Violation detected.`); setTimeout(() => setWarningMessage(""), 5000); }
        return next;
      });
    } else if (action.type === "SUSPEND") {
      terminateExam("You have been suspended by the Proctor.");
    }
  };

  const terminateExam = (reason) => { alert(reason); handleFinishExam(true); };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        await new Promise(res => { if (videoRef.current.readyState >= 3) res(); else videoRef.current.oncanplay = res; });
      }
    } catch (err) { console.warn("Camera denied", err); alert("Camera access is required for this exam."); }
  };

  const captureAndSendFrame = () => {
    if (!stompClientRef.current?.connected || !videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    if (v.paused || v.ended || v.videoWidth === 0 || v.readyState < 2) return;
    try {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = 320; canvasRef.current.height = 240;
      ctx.drawImage(v, 0, 0, 320, 240);
      stompClientRef.current.send(`/app/contest/${contestId}/alert`, {}, JSON.stringify({ type:'CAMERA_FRAME', userId:user.userId, username:user.username, contestId, image:canvasRef.current.toDataURL('image/jpeg', 0.1) }));
    } catch {}
  };

  const sendAlert = (type, message) => {
    if (stompClientRef.current?.connected && user.userId) {
      try { stompClientRef.current.send(`/app/contest/${contestId}/alert`, {}, JSON.stringify({ type, userId:user.userId, username:user.username, contestId, message })); } catch {}
    }
  };

  const handleTabSwitch    = () => { if (document.hidden) sendAlert("TAB_SWITCH", "User switched tabs"); };
  const checkFullscreen    = () => { if (!document.fullscreenElement) { setIsFullscreen(false); sendAlert("FULLSCREEN_EXIT","Exited fullscreen"); } else setIsFullscreen(true); };
  const enterFullscreen    = () => document.documentElement.requestFullscreen().catch(e => console.log(e));

  const handleFinishExam = async (force = false) => {
    if (!force && !confirm("Are you sure you want to submit?")) return;
    try {
      await submitExam({ userId: user.userId, contestId: Number(contestId), mcqAnswers });
      alert("Exam Submitted Successfully!");
    } catch (err) { alert("Submission: " + err); }
    navigate("/student/dashboard", { replace: true });
  };

  const fetchQuestions = async () => {
    try {
      const [dsaRes, mcqRes] = await Promise.all([
        api.get(`/questions/dsa/contest/${contestId}`),
        api.get(`/questions/mcq/contest/${contestId}`)
      ]);
      const combined = [
        ...(dsaRes.data || []).map(q => ({ ...q, qType:"DSA" })),
        ...(mcqRes.data || []).map(q => ({ ...q, qType:"MCQ", title:"MCQ Question", difficulty:"1 Mark" }))
      ];
      setQuestions(combined);
    } catch {} finally { setLoading(false); }
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value; setLanguage(lang);
    if (lang === "PYTHON") setCode("# Python Solution\nimport sys\n\ndata = sys.stdin.read().split()\n# Logic here\n");
    else if (lang === "CPP")  setCode("// C++ Solution\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // code here\n    return 0;\n}");
  };

  const handleRunCode = async () => {
    const currentQ = questions[currentQIndex]; if (!currentQ) return;
    setIsRunning(true); setOutput("Running test cases…"); setVerdict("");
    try {
      const res = await runCode({ code, language, questionId: Number(currentQ.questionId), userId: Number(user.userId), contestId: Number(contestId) });
      setVerdict(res.data.verdict); setOutput(res.data.output);
    } catch (err) {
      setVerdict("Error");
      setOutput(err);
    } finally { setIsRunning(false); }
  };

  const handleSubmitQuestion = async () => {
    const currentQ = questions[currentQIndex]; if (!currentQ) return;
    const qId = getQId(currentQ);
    if (submittedQuestionIds.has(qId)) return;
    if (currentQ.qType === "MCQ" && !mcqAnswers[qId]) { alert("Please select an answer."); return; }
    setSubmittedQuestionIds(prev => new Set(prev).add(qId));
    setLockedQuestionIds(prev => new Set(prev).add(qId));
    setQTimeLeft(null);
    sendAlert("QUESTION_SUBMITTED", `Submitted Q${qId}`);
    if (contest.timerType === 'PER_QUESTION' && currentQIndex < questions.length - 1)
      setCurrentQIndex(i => i + 1);
  };

  const handleMCQSelect = (opt) => {
    const currentQ = questions[currentQIndex]; if (!currentQ) return;
    const qId = getQId(currentQ);
    if (lockedQuestionIds.has(qId) || submittedQuestionIds.has(qId)) return;
    setMcqAnswers({ ...mcqAnswers, [qId]: opt });
  };

  const formatTime = (s) => {
    if (s == null || s < 0) return "0:00";
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  };

  if (loading) return <div className="arena-loading"><span className="spinner" /> Loading exam…</div>;

  if (questions.length === 0) return (
    <div className="arena-loading" style={{ flexDirection:'column', gap:16 }}>
      <p style={{ color:'var(--text-secondary)' }}>No questions found for this contest.</p>
      <button className="btn-primary" onClick={() => navigate("/student/dashboard", { replace:true })}>Return</button>
    </div>
  );

  if (!isFullscreen) return (
    <div className="fullscreen-gate">
      <div className="gate-icon">🔒</div>
      <div className="gate-title">Security Check Required</div>
      <p className="gate-sub">This exam requires fullscreen mode to maintain integrity.<br />Please enable fullscreen to continue.</p>
      <button id="enter-fullscreen-btn" className="btn-primary" onClick={enterFullscreen} style={{ padding:'14px 40px', fontSize:'1rem' }}>
        🚀 Enable Fullscreen & Begin
      </button>
      {user.role === 'ADMIN' && (
        <button className="btn-ghost" onClick={() => navigate("/admin/dashboard", { replace:true })} style={{ marginTop:16 }}>
          Cancel Test — Return to Admin
        </button>
      )}
    </div>
  );

  const currentQ   = questions[currentQIndex];
  if (!currentQ) return <div className="arena-loading">Error loading question.</div>;

  const currQId    = getQId(currentQ);
  const isSubmitted = submittedQuestionIds.has(currQId);
  const isLocked   = lockedQuestionIds.has(currQId) || isSubmitted;
  const timerUrgent = (examTimeLeft != null && examTimeLeft < 120) || (qTimeLeft != null && qTimeLeft < 10);

  const diffLabel = (d) => {
    if (!d) return 'Medium';
    const dl = d.toLowerCase();
    if (dl === 'easy') return 'Easy';
    if (dl === 'hard') return 'Hard';
    return 'Medium';
  };

  return (
    <div className="arena-container">
      <video ref={videoRef} autoPlay muted style={{ display:"none" }} />
      <canvas ref={canvasRef} width={320} height={240} style={{ display:"none" }} />

      {warningMessage && (
        <div className="warn-modal">
          <h3>⚠️ Violation Detected</h3>
          <p>{warningMessage}</p>
        </div>
      )}

      {/* Top bar */}
      <div className="arena-topbar">
        <div className="arena-brand">🛡️ ProctorX Exam</div>

        <div style={{ flex:1, display:'flex', justifyContent:'center' }}>
          <span style={{ color:'var(--text-secondary)', fontSize:'0.875rem', fontWeight:600 }}>
            {contest.title}
          </span>
        </div>

        <div className="arena-topbar-right">
          {user.role === 'ADMIN' && (
            <button className="btn-ghost" onClick={() => { if (window.confirm("Exit test mode?")) navigate('/admin/dashboard', { replace:true }); }}
              style={{ fontSize:'0.8rem', padding:'6px 12px' }}>← Admin</button>
          )}

          <div className={`exam-timer ${timerUrgent ? 'urgent' : ''}`}>
            {qTimeLeft !== null
              ? <><span style={{ fontSize:'0.72rem', opacity:0.7 }}>Q</span> {formatTime(qTimeLeft)}</>
              : <><span style={{ fontSize:'0.72rem', opacity:0.7 }}>Exam</span> {formatTime(examTimeLeft)}</>
            }
          </div>

          <div className={`warning-chip ${warningCount > 0 ? 'flagged' : 'clear'}`}>
            {warningCount > 0 ? '⚠️' : '✓'} {warningCount}/3
          </div>

          <button id="finish-exam-btn" className="btn-danger"
            onClick={() => handleFinishExam(false)} style={{ padding:'7px 16px', fontSize:'0.82rem' }}>
            Submit Exam
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="arena-body">
        {/* Question sidebar */}
        <div className="q-sidebar">
          <div className="q-sidebar-head">Questions ({questions.length})</div>
          <div className="q-nav-list">
            {questions.map((q, idx) => {
              const qId     = getQId(q);
              const qLocked = lockedQuestionIds.has(qId) || submittedQuestionIds.has(qId);
              const qVisited= visitedQuestionIds.has(qId);
              const navDisabled = contest.timerType === 'PER_QUESTION' && idx !== currentQIndex;
              let cls = '';
              if (qLocked) cls = 'submitted';
              else if (qVisited) cls = 'visited';
              return (
                <button key={qId} id={`q-nav-${idx+1}`}
                  className={`q-nav-btn ${cls} ${idx === currentQIndex ? 'active' : ''}`}
                  disabled={navDisabled}
                  onClick={() => { setVisitedQuestionIds(prev => new Set(prev).add(getQId(questions[currentQIndex]))); setCurrentQIndex(idx); }}
                >
                  <span className="q-nav-num">Q{idx+1}</span>
                  <span style={{ fontSize:'0.72rem', opacity:0.7 }}>{q.qType}</span>
                  {qLocked && <span>🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Problem pane */}
        <div className="problem-pane">
          <div className="problem-scroll">
            {isLocked && (
              <div className="locked-banner">
                ⛔ This question has been locked — no further changes allowed.
              </div>
            )}
            {qTimeLeft !== null && (
              <div className={`q-timer-bar ${qTimeLeft <= 10 ? 'urgent' : ''}`}>
                ⏱ {formatTime(qTimeLeft)} remaining
              </div>
            )}

            <div className="problem-meta">
              <span className="badge badge-primary">{currentQ.qType}</span>
              {currentQ.difficulty && (
                <span className={`badge ${
                  diffLabel(currentQ.difficulty) === 'Easy' ? 'badge-success'
                  : diffLabel(currentQ.difficulty) === 'Hard' ? 'badge-danger'
                  : 'badge-warning'
                }`}>{currentQ.difficulty}</span>
              )}
              {currentQ.marks && <span className="badge badge-accent">{currentQ.marks} pts</span>}
            </div>

            <h2 className="problem-title">{currentQ.title || currentQ.questionText}</h2>

            {currentQ.qType === "DSA" && (
              <>
                <div className="problem-section">
                  <p className="problem-body">{currentQ.problemStatement}</p>
                </div>
                {currentQ.inputFormat && (
                  <div className="problem-section">
                    <h4>Input Format</h4>
                    <p className="problem-body">{currentQ.inputFormat}</p>
                  </div>
                )}
                {currentQ.constraints && (
                  <div className="problem-section">
                    <h4>Constraints</h4>
                    <p className="problem-body">{currentQ.constraints}</p>
                  </div>
                )}
                {verdict && (
                  <div className="verdict-box">
                    <h4>Result</h4>
                    <div className={`verdict-status ${verdict === 'AC' ? 'ac' : 'wa'}`}>
                      {verdict === 'AC' ? '✅ Accepted' : `❌ ${verdict}`}
                    </div>
                    <div className="verdict-output">{output}</div>
                  </div>
                )}
              </>
            )}

            {currentQ.qType === "MCQ" && (
              <>
                <p className="problem-body" style={{ marginBottom:24 }}>{currentQ.questionText}</p>
                <div className="mcq-list">
                  {['A','B','C','D'].map(opt => {
                    const key = `option${opt}`;
                    if (!currentQ[key]) return null;
                    const selected = mcqAnswers[currQId] === opt;
                    return (
                      <button key={opt} id={`mcq-opt-${opt}`}
                        className={`mcq-opt ${selected ? 'selected' : ''}`}
                        onClick={() => !isLocked && handleMCQSelect(opt)}
                        disabled={isLocked}
                      >
                        <span className="opt-letter">{opt}</span>
                        {currentQ[key]}
                      </button>
                    );
                  })}
                </div>
                <button id="submit-mcq-btn"
                  className="btn-primary"
                  disabled={isSubmitted || isLocked}
                  onClick={handleSubmitQuestion}
                  style={{ marginTop:24, width:'100%', padding:14, opacity: isSubmitted||isLocked ? 0.45 : 1 }}
                >
                  {isSubmitted ? '✓ Answer Submitted' : 'Submit Answer'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Code editor pane – only for DSA */}
        {currentQ.qType === "DSA" && (
          <div className="code-pane">
            <div className="code-pane-head">
              <span style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)' }}>Code Editor</span>
              <select id="language-select" className="field-input" value={language} onChange={handleLanguageChange}
                disabled={isLocked} style={{ width:'auto', padding:'5px 10px', fontSize:'0.82rem' }}>
                <option value="PYTHON">Python</option>
                <option value="CPP">C++</option>
              </select>
            </div>
            <div className="editor-area">
              <textarea
                id="code-editor"
                className="code-editor"
                value={code}
                onChange={e => !isLocked && setCode(e.target.value)}
                readOnly={isLocked}
                style={{ opacity: isLocked ? 0.55 : 1 }}
                spellCheck={false}
              />
            </div>
            <div className="code-footer">
              <button id="run-code-btn" className="btn-ghost" onClick={handleRunCode}
                disabled={isRunning || isLocked}
                style={{ fontSize:'0.82rem', padding:'8px 18px', opacity: isRunning||isLocked ? 0.5 : 1 }}>
                {isRunning ? <><span className="spinner" style={{ width:14, height:14 }} /> Running…</> : '▶ Run Code'}
              </button>
              <button id="submit-code-btn" className="btn-primary" disabled={isSubmitted || isLocked} onClick={handleSubmitQuestion}
                style={{ fontSize:'0.82rem', padding:'8px 20px', opacity: isSubmitted||isLocked ? 0.45 : 1 }}>
                {isSubmitted ? '✓ Submitted' : 'Submit →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamArena;