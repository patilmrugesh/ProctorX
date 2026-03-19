import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api, { runCode, submitExam, WS_URL } from "../../services/api";
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import "./ExamArena.css";

const ExamArena = () => {
  const [visitedQuestionIds, setVisitedQuestionIds] = useState(new Set());
  const [examTimeLeft, setExamTimeLeft] = useState(null);
  const [submittedQuestionIds, setSubmittedQuestionIds] = useState(new Set());

  // Store REMAINING time per question to persist during navigation
  const questionRemainingTimeRef = useRef({});

  const { contestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const contest = location.state?.contest || {};

  // --- Exam State ---
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // --- Question Timer & Locking State ---
  const [qTimeLeft, setQTimeLeft] = useState(null);
  const [lockedQuestionIds, setLockedQuestionIds] = useState(new Set());

  // --- Warning/Judge Action State ---
  const [warningCount, setWarningCount] = useState(0);
  const [warningMessage, setWarningMessage] = useState("");

  // --- Coding State ---
  const [code, setCode] = useState(
    "# Write your Python code here...\n\nimport sys\n\n# Read input from stdin\ndata = sys.stdin.read().split()\n\n# Logic here\n"
  );
  const [language, setLanguage] = useState("PYTHON");
  const [output, setOutput] = useState("");
  const [verdict, setVerdict] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // --- MCQ State ---
  const [mcqAnswers, setMcqAnswers] = useState({});

  // --- Refs ---
  const stompClientRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraIntervalRef = useRef(null);

  // --- Helper: get the ID for a question regardless of type ---
  const getQId = useCallback((q) => {
    if (!q) return null;
    return q.qType === "DSA" ? q.questionId : q.mcqId;
  }, []);

  // --- Overall Exam Timer Countdown ---
  useEffect(() => {
    if (examTimeLeft == null) return;
    if (examTimeLeft <= 0) {
      handleFinishExam(true); 
      return;
    }
    const id = setInterval(() => {
      setExamTimeLeft((t) => t - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [examTimeLeft]);

  // Initialize exam timer once from contest duration
  useEffect(() => {
    if (contest?.durationMinutes && examTimeLeft == null) {
      setExamTimeLeft(contest.durationMinutes * 60);
    }
  }, [contest, examTimeLeft]);

  // --- Main Setup Effect ---
  useEffect(() => {
    if (!user.userId) {
      alert("Please login to take the exam.");
      navigate("/login", { replace: true });
      return;
    }

    fetchQuestions();
    startWebcam();

    const socket = new SockJS(WS_URL || "http://localhost:8080/ws");
    const client = Stomp.over(socket);
    client.debug = null;

    client.connect(
      {},
      () => {
        stompClientRef.current = client;
        sendAlert("ONLINE", "User joined the exam");

        client.subscribe(
          `/topic/contest/${contestId}/student/${user.userId}`,
          (message) => {
            const payload = JSON.parse(message.body);
            handleJudgeAction(payload);
          }
        );

        cameraIntervalRef.current = setInterval(captureAndSendFrame, 2000);
      },
      (error) => console.error("WS Error", error)
    );

    document.addEventListener("fullscreenchange", checkFullscreen);
    document.addEventListener("visibilitychange", handleTabSwitch);

    return () => {
      document.removeEventListener("fullscreenchange", checkFullscreen);
      document.removeEventListener("visibilitychange", handleTabSwitch);

      if (cameraIntervalRef.current) {
        clearInterval(cameraIntervalRef.current);
        cameraIntervalRef.current = null;
      }

      if (client && client.connected) {
        if (user.userId) {
          const payload = {
            type: "OFFLINE",
            userId: user.userId,
            username: user.username,
            contestId: contestId,
            message: "User left the exam",
          };
          try {
            client.send(
              `/app/contest/${contestId}/alert`,
              {},
              JSON.stringify(payload)
            );
          } catch (e) {
            console.error(e);
          }
        }
        setTimeout(() => {
          try {
            client.disconnect();
          } catch (e) {}
        }, 500);
      }
    };
  }, [contestId, navigate]);

  // --- Per-Question Timer Initialization ---
  useEffect(() => {
    if (questions.length === 0) return;
    const currentQ = questions[currentQIndex];
    if (!currentQ) return;

    const qId = getQId(currentQ);

    if (lockedQuestionIds.has(qId)) {
      setQTimeLeft(null);
      return;
    }

    if (questionRemainingTimeRef.current[qId] == null) {
      const limit = currentQ.solveTime || (contest.timerType === 'PER_QUESTION' ? contest.questionTimerSeconds : null);
      questionRemainingTimeRef.current[qId] = limit ? Number(limit) : null;
    }

    setQTimeLeft(questionRemainingTimeRef.current[qId]);
  }, [currentQIndex, questions, lockedQuestionIds, getQId, contest.timerType, contest.questionTimerSeconds]);

  // --- Per-Question Timer Countdown ---
  useEffect(() => {
    if (qTimeLeft === null) return;
    if (qTimeLeft <= 0) {
      handleQuestionTimeout();
      return;
    }

    const timerId = setInterval(() => {
      setQTimeLeft((t) => {
        const newTime = t - 1;
        if (questions.length > 0) {
          const currentQ = questions[currentQIndex];
          if (currentQ) {
            const qId = getQId(currentQ);
            questionRemainingTimeRef.current[qId] = newTime;
          }
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [qTimeLeft, questions, currentQIndex, getQId]);

  // --- Question Timeout Handler ---
  const handleQuestionTimeout = () => {
    if (questions.length === 0) return;
    const currentQ = questions[currentQIndex];
    const qId = getQId(currentQ);

    setLockedQuestionIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(qId);
      return newSet;
    });

    setQTimeLeft(null);

    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((i) => i + 1);
    }
  };

  const handleJudgeAction = (action) => {
    if (action.type === "WARN") {
      setWarningCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= 3) {
          terminateExam("You have exceeded 3 warnings. You are disqualified.");
        } else {
          setWarningMessage(
            `WARNING ${newCount}/3: Please focus on the screen.`
          );
          setTimeout(() => setWarningMessage(""), 5000);
        }
        return newCount;
      });
    } else if (action.type === "SUSPEND") {
      terminateExam("You have been suspended by the Proctor.");
    }
  };

  const terminateExam = (reason) => {
    alert(reason);
    handleFinishExam(true);
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 160, height: 120 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        await new Promise(resolve => {
           if (videoRef.current.readyState >= 3) resolve();
           else videoRef.current.oncanplay = resolve;
        });
      }
    } catch (err) {
      console.warn("Camera permission denied", err);
      alert("Camera access is required. Please allow permission.");
    }
  };

  const captureAndSendFrame = () => {
    if (!stompClientRef.current?.connected) return;
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.paused || video.ended || video.videoWidth === 0 || video.readyState < 2) return;

    try {
        const ctx = canvas.getContext('2d');
        canvas.width = 320;
        canvas.height = 240;
        ctx.drawImage(video, 0, 0, 320, 240);
        
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.1);

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
    if (stompClientRef.current?.connected && user.userId) {
      const payload = {
        type: type,
        userId: user.userId,
        username: user.username,
        contestId: contestId,
        message: message,
      };
      try {
        stompClientRef.current.send(
          `/app/contest/${contestId}/alert`,
          {},
          JSON.stringify(payload)
        );
      } catch (e) {
        console.error("Alert Error", e);
      }
    }
  };

  const handleTabSwitch = () => {
    if (document.hidden) {
      sendAlert("TAB_SWITCH", "User switched tabs");
    }
  };

  const handleFinishExam = async (force = false) => {
    if (!force && !confirm("Are you sure you want to submit?")) return;

    try {
      const payload = {
        userId: user.userId,
        contestId: Number(contestId),
        mcqAnswers: mcqAnswers,
      };
      await submitExam(payload);
      alert("Exam Submitted Successfully!");
      
      // FIX: Added { replace: true } to prevent the back button glitch!
      navigate("/student/dashboard", { replace: true });
    } catch (err) {
      alert("Submission End: " + (err.response?.data || "Completed"));
      // FIX: Added { replace: true } to prevent the back button glitch!
      navigate("/student/dashboard", { replace: true });
    }
  };

  const checkFullscreen = () => {
    if (!document.fullscreenElement) {
      setIsFullscreen(false);
      sendAlert("FULLSCREEN_EXIT", "User exited fullscreen");
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
        ...(dsaRes.data || []).map((q) => ({ ...q, qType: "DSA" })),
        ...(mcqRes.data || []).map((q) => ({
          ...q,
          qType: "MCQ",
          title: "MCQ Question",
          difficulty: "1 Mark",
        })),
      ];
      setQuestions(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    if (lang === "PYTHON") {
      setCode("# Python Solution\nimport sys\n\n# Read input\ndata = sys.stdin.read().split()\n# Logic here\n");
    } else if (lang === "CPP") {
      setCode("// C++ Solution\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // code here\n    return 0;\n}");
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
      contestId: Number(contestId),
    };

    try {
      const res = await runCode(payload);
      setVerdict(res.data.verdict);
      setOutput(res.data.output);
    } catch (err) {
      setVerdict("Error");
      if (err.response && err.response.status === 400) {
        setOutput("Bad Request: Data mismatch.");
      } else {
        setOutput("Server Error or Compilation Failed.");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmitQuestion = async () => {
    const currentQ = questions[currentQIndex];
    if (!currentQ) return;

    const qId = getQId(currentQ);

    if (submittedQuestionIds.has(qId)) return;

    if (currentQ.qType === "MCQ") {
      const selectedAnswer = mcqAnswers[qId];
      if (!selectedAnswer) {
        alert("Please select an answer before submitting.");
        return;
      }
    }

    setSubmittedQuestionIds((prev) => {
      const s = new Set(prev);
      s.add(qId);
      return s;
    });
    setLockedQuestionIds((prev) => {
      const s = new Set(prev);
      s.add(qId);
      return s;
    });
    setQTimeLeft(null); 

    sendAlert("QUESTION_SUBMITTED", `Submitted question ${qId}`);

    if (contest.timerType === 'PER_QUESTION' && currentQIndex < questions.length - 1) {
      setCurrentQIndex((i) => i + 1);
    }
  };

  const handleMCQSelect = (option) => {
    const currentQ = questions[currentQIndex];
    if (!currentQ) return;
    const qId = getQId(currentQ);
    const isCurrentlyLocked = lockedQuestionIds.has(qId) || submittedQuestionIds.has(qId);
    if (isCurrentlyLocked) return;

    setMcqAnswers({ ...mcqAnswers, [qId]: option });
  };

  if (loading) return <div>Loading...</div>;

  if (questions.length === 0) {
    return (
      <div>
        <p>No questions found.</p>
        <button onClick={() => navigate("/student/dashboard", { replace: true })}>Return</button>
      </div>
    );
  }

  if (!isFullscreen) {
    return (
      <div className="fullscreen-overlay">
        <h1>⚠️ Security Check</h1>
        <p>This exam requires Fullscreen Mode.</p>
        <button className="submit-exam-btn" onClick={enterFullscreen}>Enable Fullscreen</button>
        
        {/* Admin Emergency Exit from Fullscreen Blocker */}
        {user.role === 'ADMIN' && (
             <button 
                onClick={() => navigate("/admin/dashboard", { replace: true })} 
                style={{ marginTop: '20px', background: 'transparent', color: '#ccc', border: '1px solid #ccc', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' }}
             >
                Cancel Test (Return to Admin Panel)
             </button>
        )}
      </div>
    );
  }

  const currentQ = questions[currentQIndex];
  if (!currentQ) return <div>Error loading question.</div>;

  const currQId = getQId(currentQ);
  const isSubmitted = submittedQuestionIds.has(currQId);
  const isLocked = lockedQuestionIds.has(currQId) || isSubmitted;

  const formatTime = (s) => {
    if (s == null || s < 0) return "0:00";
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <div className="exam-container">
      <video ref={videoRef} autoPlay muted style={{ display: "none" }} />
      <canvas ref={canvasRef} width={320} height={240} style={{ display: "none" }} />

      {warningMessage && (
        <div className="warning-modal">
          <h3>⚠️ Warning</h3>
          <p>{warningMessage}</p>
        </div>
      )}

      <div className="exam-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h3>ProctorX Exam Arena</h3>
            
            {/* FIX: Admin Return Button inside the Header */}
            {user.role === 'ADMIN' && (
                <button
                    style={{ background: '#34495e', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                    onClick={() => {
                        if (window.confirm("Exit test mode and return to Admin Dashboard?")) {
                            navigate('/admin/dashboard', { replace: true });
                        }
                    }}
                >
                    ← Back to Admin Panel
                </button>
            )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="timer-box">
                {qTimeLeft !== null ? (
                    <span style={{ 
                        color: qTimeLeft <= 3 ? '#ff4d4d' : 'inherit',
                        fontWeight: qTimeLeft <= 3 ? 'bold' : 'normal'
                    }}>
                        Q: {formatTime(qTimeLeft)}
                    </span>
                ) : (
                    <span>Exam: {formatTime(examTimeLeft)}</span>
                )}
            </div>

            <span style={{
                background: warningCount > 0 ? "#e74c3c" : "#27ae60",
                color: "white", padding: "6px 12px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: 600
            }}>
              Warnings: {warningCount}/3
            </span>

            <button className="submit-exam-btn" onClick={() => handleFinishExam(false)}>Finish Exam</button>
        </div>
      </div>

      <div className="exam-body">
        <div className="question-sidebar">
          <div className="sidebar-header">Questions</div>
          <div className="q-nav-grid">
            {questions.map((q, idx) => {
              const qId = getQId(q);
              const qLocked = lockedQuestionIds.has(qId) || submittedQuestionIds.has(qId);
              const qVisited = visitedQuestionIds.has(qId);
              let stateClass = "not-visited";
              if (qLocked) stateClass = "submitted"; 
              else if (qVisited) stateClass = "visited";

              const navDisabled = contest.timerType === 'PER_QUESTION' && idx !== currentQIndex;

              return (
                <button
                  key={qId}
                  className={`q-nav-btn ${stateClass} ${idx === currentQIndex ? "active" : ""}`}
                  disabled={navDisabled}
                  style={navDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  onClick={() => {
                    setVisitedQuestionIds((prev) => new Set(prev).add(qId));
                    setCurrentQIndex(idx);
                  }}
                >
                  {idx + 1} {qLocked ? "🔒" : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="problem-area">
          {isLocked && (
            <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px", padding: "10px", marginBottom: "16px", color: "#856404" }}>
              ⛔ This question is locked.
            </div>
          )}

          {qTimeLeft !== null && (
            <div style={{ marginBottom: "12px" }}>
              <span className="badge" style={{
                background: qTimeLeft <= 3 ? "#fadbd8" : "#d5f5e3",
                color: qTimeLeft <= 3 ? "#e74c3c" : "#27ae60",
                fontWeight: "bold",
                transition: "all 0.3s ease"
              }}>
                {formatTime(qTimeLeft)} left
              </span>
            </div>
          )}

          <h2 className="problem-title">{currentQ.title || currentQ.questionText}</h2>

          {currentQ.qType === "DSA" && (
            <div className="problem-desc">
              <p>{currentQ.problemStatement}</p>
              {currentQ.inputFormat && <><h4>Input</h4><p>{currentQ.inputFormat}</p></>}
              {currentQ.constraints && <><h4>Constraints</h4><p>{currentQ.constraints}</p></>}
              {verdict && (
                <div style={{ marginTop: "1.5rem" }}>
                  <h4>Result</h4>
                  <p>Verdict: <strong style={{ color: verdict === "AC" ? "#27ae60" : "#e74c3c" }}>{verdict}</strong></p>
                  <pre style={{ background: "#f6f8fa", padding: "12px", borderRadius: "6px" }}>{output}</pre>
                </div>
              )}
            </div>
          )}

          {currentQ.qType === "MCQ" && (
            <>
              <p className="problem-desc">{currentQ.questionText}</p>
              <div className="mcq-options">
                {["A", "B", "C", "D"].map((opt) => {
                  const optKey = `option${opt}`;
                  if (!currentQ[optKey]) return null;
                  return (
                    <button
                      key={opt}
                      className={`mcq-option ${mcqAnswers[currQId] === opt ? "selected" : ""}`}
                      onClick={() => !isLocked && handleMCQSelect(opt)}
                      disabled={isLocked}
                    >
                      <strong>{opt}.</strong> {currentQ[optKey]}
                    </button>
                  );
                })}
              </div>
              <button
                className="submit-code-btn"
                disabled={isSubmitted || isLocked}
                onClick={handleSubmitQuestion}
                style={{ marginTop: "24px", opacity: isSubmitted || isLocked ? 0.5 : 1, cursor: isSubmitted || isLocked ? "not-allowed" : "pointer" }}
              >
                {isSubmitted ? "✓ Submitted" : "Submit Answer"}
              </button>
            </>
          )}
        </div>

        {currentQ.qType === "DSA" && (
          <div className="answer-area">
            <textarea
              className="code-editor"
              value={code}
              onChange={(e) => !isLocked && setCode(e.target.value)}
              readOnly={isLocked}
              style={{ opacity: isLocked ? 0.6 : 1 }}
            />
            <div className="editor-footer">
              <select value={language} onChange={handleLanguageChange} disabled={isLocked} style={{ marginRight: "auto", opacity: isLocked ? 0.5 : 1 }}>
                <option value="PYTHON">Python</option>
                <option value="CPP">C++</option>
              </select>
              <button className="run-btn" onClick={handleRunCode} disabled={isRunning || isLocked}>
                {isRunning ? "Running..." : "▶ Run"}
              </button>
              <button className="submit-code-btn" disabled={isSubmitted || isLocked} onClick={handleSubmitQuestion} style={{ opacity: isSubmitted || isLocked ? 0.5 : 1 }}>
                {isSubmitted ? "✓ Submitted" : "Submit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamArena;