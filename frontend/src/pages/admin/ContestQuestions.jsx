import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, {
  addDSAQuestion, addMCQQuestion, addTestCase,
  updateDSAQuestion, updateMCQQuestion,
  getAdminContests, getTestCases, deleteTestCase,
  deleteDSAQuestion, deleteMCQQuestion,
} from "../../services/api";
import "./ContestQuestions.css";

const diff2class = (d) => {
  if (!d) return 'badge-warning';
  const dl = d.toLowerCase();
  return dl === 'easy' ? 'badge-success' : dl === 'hard' ? 'badge-danger' : 'badge-warning';
};

const ContestQuestions = () => {
  const [quickForwarding, setQuickForwarding] = useState(false);
  const [globalTimer, setGlobalTimer]         = useState(60);
  const { contestId }                          = useParams();
  const [activeTab, setActiveTab]              = useState("list");
  const [questionType, setQuestionType]        = useState("DSA");
  const [contestType, setContestType]          = useState(null);
  const [contestData, setContestData]          = useState(null);
  const [questions, setQuestions]              = useState([]);
  const [loading, setLoading]                  = useState(true);
  const [selectedIds, setSelectedIds]          = useState([]);
  const [isEditing, setIsEditing]              = useState(false);
  const [editId, setEditId]                    = useState(null);
  const [showModal, setShowModal]              = useState(false);
  const [selectedQuestion, setSelectedQuestion]= useState(null);
  const [tcForm, setTcForm]                    = useState({ inputData: "", expectedOutput: "", isHidden: true });
  const [existingCases, setExistingCases]      = useState([]);

  const [dsaForm, setDsaForm] = useState({
    title: "", problemStatement: "", difficulty: "EASY",
    constraints: "", inputFormat: "", outputFormat: "",
    timeLimitSec: 1.0, marks: 5, timer: 60,
  });
  const [mcqForm, setMcqForm] = useState({
    questionText: "", optionA: "", optionB: "", optionC: "", optionD: "",
    correctOption: "A", marks: 2, timer: 60,
  });

  useEffect(() => { fetchContestDetails(); fetchQuestions(); }, [contestId]);

  const fetchContestDetails = async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user?.userId) return;
    try {
      const res = await getAdminContests(user.userId);
      const c = res.data.find(x => x.contestId === Number(contestId));
      if (c) {
        setContestType(c.type); setContestData(c);
        if (c.type === "DSA") setQuestionType("DSA");
        else if (c.type === "MCQ") setQuestionType("MCQ");
        else setQuestionType("DSA");
      }
    } catch {}
  };

  const fetchQuestions = async () => {
    try {
      const [dsaRes, mcqRes] = await Promise.all([
        api.get(`/questions/dsa/contest/${contestId}`).catch(() => ({ data: [] })),
        api.get(`/questions/mcq/contest/${contestId}`).catch(() => ({ data: [] })),
      ]);
      const combined = [
        ...(Array.isArray(dsaRes.data) ? dsaRes.data : []).map(q => ({ ...q, type: "DSA", qId: q.questionId })),
        ...(Array.isArray(mcqRes.data) ? mcqRes.data : []).map(q => ({ ...q, type: "MCQ", title: q.questionText, qId: q.mcqId })),
      ];
      setQuestions(combined);
    } catch {} finally { setLoading(false); }
  };

  const handleDeleteQuestion = async (q) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      if (q.type === "DSA") await deleteDSAQuestion(q.qId); else await deleteMCQQuestion(q.qId);
      fetchQuestions(); setSelectedIds(prev => prev.filter(id => id !== q.qId));
    } catch { alert("Failed to delete."); }
  };

  const handleSelect    = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const handleSelectAll = () => setSelectedIds(selectedIds.length === questions.length ? [] : questions.map(q => q.qId));

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} questions?`)) return;
    try {
      await Promise.all(selectedIds.map(id => {
        const q = questions.find(x => x.qId === id);
        if (!q) return Promise.resolve();
        return q.type === "DSA" ? deleteDSAQuestion(id) : deleteMCQQuestion(id);
      }));
      setSelectedIds([]); fetchQuestions();
    } catch { alert("Some deletions failed."); }
  };

  const handleContestTypeChange = async (e) => {
    const newType = e.target.value;
    if (newType === contestType) return;
    const msg = newType === "HYBRID"
      ? "Switch to Hybrid? You can add both types. Continue?"
      : "Switching type may remove incompatible questions. Continue?";
    if (!window.confirm(msg)) return;
    try {
      setContestType(newType);
      if (newType === "DSA") setQuestionType("DSA");
      else if (newType === "MCQ") setQuestionType("MCQ");
      if (contestData) { await api.put(`/contests/${contestData.contestId}`, { ...contestData, type: newType }); fetchQuestions(); resetForms(); }
    } catch { alert("Update failed."); setContestType(contestType); }
  };

  const handleEditClick = (q) => {
    setIsEditing(true); setEditId(q.qId); setQuestionType(q.type); setActiveTab("add");
    if (q.type === "DSA") setDsaForm({ title: q.title, problemStatement: q.problemStatement, difficulty: q.difficulty, constraints: q.constraints, inputFormat: q.inputFormat, outputFormat: q.outputFormat, timeLimitSec: q.timeLimitSec || 1.0, marks: q.marks || 5, timer: q.timer || 60 });
    else setMcqForm({ questionText: q.questionText || q.title, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, correctOption: q.correctOption, marks: q.marks || 2, timer: q.timer || 60 });
  };

  const resetForms = () => {
    setIsEditing(false); setEditId(null);
    if (contestType === "DSA") setQuestionType("DSA");
    else if (contestType === "MCQ") setQuestionType("MCQ");
    setDsaForm({ title: "", problemStatement: "", difficulty: "EASY", constraints: "", inputFormat: "", outputFormat: "", timeLimitSec: 1.0, marks: 5, timer: 60 });
    setMcqForm({ questionText: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A", marks: 2, timer: 60 });
  };

  const handleDSASubmit = async (e) => {
    e.preventDefault();
    const payload = { ...dsaForm, timer: quickForwarding ? globalTimer : dsaForm.timer };
    try {
      if (isEditing) await updateDSAQuestion(editId, payload); else await addDSAQuestion(contestId, payload);
      resetForms(); fetchQuestions(); setActiveTab("list");
    } catch { alert("Failed to save question"); }
  };

  const handleMCQSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...mcqForm, timer: quickForwarding ? globalTimer : mcqForm.timer };
    try {
      if (isEditing) await updateMCQQuestion(editId, payload); else await addMCQQuestion(contestId, payload);
      resetForms(); fetchQuestions(); setActiveTab("list");
    } catch { alert("Failed to save MCQ"); }
  };

  const openTestCaseModal = (q) => { setSelectedQuestion(q); setShowModal(true); fetchCases(q.qId); };
  const fetchCases = async (qId) => {
    try { const res = await getTestCases(qId); setExistingCases(Array.isArray(res.data) ? res.data : []); }
    catch { setExistingCases([]); }
  };
  const handleTestCaseSubmit = async (e) => {
    e.preventDefault();
    try { await addTestCase(selectedQuestion.qId, tcForm); alert("Test Case Added!"); setTcForm({ inputData:"", expectedOutput:"", isHidden:true }); fetchCases(selectedQuestion.qId); }
    catch { alert("Failed to add case."); }
  };
  const handleDeleteCase = async (caseId) => {
    if (!window.confirm("Delete this test case?")) return;
    try { await deleteTestCase(caseId); fetchCases(selectedQuestion.qId); }
    catch { alert("Failed to delete."); }
  };

  const showTypeSelector = !isEditing && contestType === "HYBRID";

  return (
    <div className="cq-page">
      {/* Toolbar */}
      <div className="cq-toolbar">
        <div className="cq-toolbar-left">
          <Link to="/admin/dashboard" className="btn-ghost" style={{ textDecoration:'none', fontSize:'0.82rem', padding:'6px 14px' }}>
            ← Dashboard
          </Link>
          <span className="cq-title">Manage Questions</span>
          <select value={contestType || ""} onChange={handleContestTypeChange} className="type-selector field-input"
            style={{ width:'auto', padding:'6px 12px', fontSize:'0.82rem' }}>
            <option value="DSA">📟 DSA</option>
            <option value="MCQ">📋 MCQ</option>
            <option value="HYBRID">🔀 Hybrid</option>
          </select>
        </div>

        <div className="cq-toolbar-right">
          {selectedIds.length > 0 && (
            <button onClick={handleDeleteSelected} className="btn-danger" style={{ padding:'6px 14px', fontSize:'0.8rem' }}>
              🗑 Delete ({selectedIds.length})
            </button>
          )}

          {contestData && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="number" min="1" className="field-input" value={contestData.durationMinutes || ""} placeholder="Mins"
                style={{ width:80, padding:'6px 10px', fontSize:'0.82rem' }}
                onChange={e => setContestData({ ...contestData, durationMinutes: Number(e.target.value) })} />
              <button onClick={async () => { try { await api.put(`/contests/${contestData.contestId}`, contestData); alert("Duration saved"); } catch { alert("Failed"); } }}
                className="btn-primary" style={{ padding:'6px 14px', fontSize:'0.8rem' }}>
                Save Mins
              </button>
            </div>
          )}

          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.82rem', color:'var(--text-secondary)', cursor:'pointer' }}>
            <input type="checkbox" checked={quickForwarding} onChange={e => setQuickForwarding(e.target.checked)} />
            Quick Mode
          </label>
          {quickForwarding && (
            <input type="number" min="1" className="field-input" value={globalTimer}
              onChange={e => setGlobalTimer(Number(e.target.value))}
              placeholder="Secs" style={{ width:80, padding:'6px 10px', fontSize:'0.82rem' }} />
          )}
        </div>
      </div>

      <div className="cq-content">
        {quickForwarding && (
          <div className="qf-banner">
            ⚡ Quick Mode active – all questions use {globalTimer}s timer
          </div>
        )}

        {/* Tabs */}
        <div className="cq-tabs">
          <button id="tab-list-btn" className={`cq-tab ${activeTab === "list" ? "active" : ""}`}
            onClick={() => { setActiveTab("list"); resetForms(); }}>
            📋 Questions ({questions.length})
          </button>
          <button id="tab-add-btn" className={`cq-tab ${activeTab === "add" ? "active" : ""}`}
            onClick={() => { setActiveTab("add"); resetForms(); }}>
            + Add Question
          </button>
        </div>

        {/* Question list */}
        {activeTab === "list" && (
          <div className="q-list">
            {questions.length > 0 && (
              <div className="q-list-header">
                <input type="checkbox" checked={selectedIds.length === questions.length && questions.length > 0}
                  onChange={handleSelectAll} style={{ cursor:'pointer' }} />
                <span>Select All</span>
                <span style={{ marginLeft:'auto' }}>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            {loading ? (
              <div style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div>
            ) : questions.length === 0 ? (
              <div className="q-empty">
                <div className="icon">📝</div>
                <p>No questions yet. Click "+ Add Question" to start.</p>
              </div>
            ) : (
              questions.map((q, idx) => (
                <div key={idx} className="q-item" id={`q-item-${idx+1}`}>
                  <div className="q-item-left">
                    <input type="checkbox" checked={selectedIds.includes(q.qId)}
                      onChange={() => handleSelect(q.qId)} style={{ cursor:'pointer', flexShrink:0 }} />
                    <span className={`badge ${q.type === 'DSA' ? 'badge-primary' : 'badge-accent'}`}>{q.type}</span>
                    {q.difficulty && <span className={`badge ${diff2class(q.difficulty)}`}>{q.difficulty}</span>}
                    <div>
                      <div className="q-item-title">{q.title || (q.questionText ? q.questionText.substring(0,60) + '…' : 'Untitled')}</div>
                      <div className="q-item-meta">{q.marks} pts {q.type === 'DSA' ? `• ${q.timeLimitSec}s limit` : ''}</div>
                    </div>
                  </div>
                  <div className="q-item-actions">
                    {q.type === "DSA" && (
                      <button id={`cases-btn-${idx+1}`} className="q-action-btn"
                        style={{ background:'rgba(0,212,255,0.1)', color:'var(--accent)', borderColor:'rgba(0,212,255,0.3)' }}
                        onClick={() => openTestCaseModal(q)}>
                        📁 Cases
                      </button>
                    )}
                    <button id={`edit-btn-${idx+1}`} className="q-action-btn"
                      style={{ background:'rgba(255,184,77,0.1)', color:'var(--warning)', borderColor:'rgba(255,184,77,0.3)' }}
                      onClick={() => handleEditClick(q)}>
                      Edit
                    </button>
                    <button id={`delete-btn-${idx+1}`} className="q-action-btn"
                      style={{ background:'rgba(255,77,106,0.1)', color:'var(--danger)', borderColor:'rgba(255,77,106,0.3)' }}
                      onClick={() => handleDeleteQuestion(q)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Add/Edit form */}
        {activeTab === "add" && (
          <div className="add-form-card">
            <h3>{isEditing ? `✏️ Edit ${questionType} Question` : `➕ Add ${questionType} Question`}</h3>

            {showTypeSelector && (
              <div className="field-group" style={{ marginBottom:20 }}>
                <label className="field-label">Question Type</label>
                <div className="role-tabs" style={{ maxWidth:300 }}>
                  <button type="button" className={`role-tab ${questionType === 'DSA' ? 'active' : ''}`}
                    onClick={() => setQuestionType('DSA')} style={{ fontFamily:'Inter,sans-serif' }}>💻 DSA</button>
                  <button type="button" className={`role-tab ${questionType === 'MCQ' ? 'active' : ''}`}
                    onClick={() => setQuestionType('MCQ')} style={{ fontFamily:'Inter,sans-serif' }}>📋 MCQ</button>
                </div>
              </div>
            )}

            {/* DSA Form */}
            {(contestType === "DSA" || (contestType === "HYBRID" && questionType === "DSA")) && (
              <form onSubmit={handleDSASubmit} id="dsa-form">
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <div className="field-group">
                    <label className="field-label">Title</label>
                    <input required className="field-input" value={dsaForm.title} onChange={e => setDsaForm({...dsaForm, title: e.target.value})} placeholder="e.g. Two Sum" />
                  </div>
                  <div className="form-grid-2">
                    <div className="field-group">
                      <label className="field-label">Difficulty</label>
                      <select className="field-input" value={dsaForm.difficulty} onChange={e => setDsaForm({...dsaForm, difficulty: e.target.value})}>
                        <option value="EASY">Easy</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HARD">Hard</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Marks</label>
                      <input required className="field-input" type="number" value={dsaForm.marks} onChange={e => setDsaForm({...dsaForm, marks: e.target.value})} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Timer (seconds)</label>
                      <input type="number" min="1" className="field-input"
                        value={quickForwarding ? globalTimer : dsaForm.timer}
                        disabled={quickForwarding}
                        onChange={e => setDsaForm({...dsaForm, timer: Number(e.target.value)})} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Time Limit (sec)</label>
                      <input type="number" step="0.5" className="field-input" value={dsaForm.timeLimitSec} onChange={e => setDsaForm({...dsaForm, timeLimitSec: e.target.value})} />
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Problem Statement</label>
                    <textarea required className="field-input" value={dsaForm.problemStatement} onChange={e => setDsaForm({...dsaForm, problemStatement: e.target.value})} placeholder="Describe the problem…" style={{ minHeight:120 }} />
                  </div>
                  <div className="form-grid-2">
                    <div className="field-group">
                      <label className="field-label">Input Format</label>
                      <textarea className="field-input" value={dsaForm.inputFormat} onChange={e => setDsaForm({...dsaForm, inputFormat: e.target.value})} style={{ minHeight:70 }} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Output Format</label>
                      <textarea className="field-input" value={dsaForm.outputFormat} onChange={e => setDsaForm({...dsaForm, outputFormat: e.target.value})} style={{ minHeight:70 }} />
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Constraints</label>
                    <input className="field-input" value={dsaForm.constraints} onChange={e => setDsaForm({...dsaForm, constraints: e.target.value})} placeholder="e.g. 1 ≤ n ≤ 10⁵" />
                  </div>
                  <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                    <button type="button" className="btn-ghost" onClick={() => { resetForms(); setActiveTab('list'); }}>Cancel</button>
                    <button id="save-dsa-btn" type="submit" className="btn-primary">💾 Save Question</button>
                  </div>
                </div>
              </form>
            )}

            {/* MCQ Form */}
            {(contestType === "MCQ" || (contestType === "HYBRID" && questionType === "MCQ")) && (
              <form onSubmit={handleMCQSubmit} id="mcq-form">
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <div className="field-group">
                    <label className="field-label">Question Text</label>
                    <textarea required className="field-input" value={mcqForm.questionText} onChange={e => setMcqForm({...mcqForm, questionText: e.target.value})} placeholder="Enter your question…" style={{ minHeight:90 }} />
                  </div>
                  <div className="form-grid-2">
                    <div className="field-group">
                      <label className="field-label">Marks</label>
                      <input required type="number" className="field-input" value={mcqForm.marks} onChange={e => setMcqForm({...mcqForm, marks: e.target.value})} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Timer (seconds)</label>
                      <input type="number" min="1" className="field-input"
                        value={quickForwarding ? globalTimer : mcqForm.timer}
                        disabled={quickForwarding}
                        onChange={e => setMcqForm({...mcqForm, timer: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="form-grid-2">
                    {['A','B','C','D'].map(opt => (
                      <div className="field-group" key={opt}>
                        <label className="field-label">Option {opt}</label>
                        <input required className="field-input" value={mcqForm[`option${opt}`]}
                          onChange={e => setMcqForm({...mcqForm, [`option${opt}`]: e.target.value})}
                          placeholder={`Option ${opt}…`} />
                      </div>
                    ))}
                  </div>
                  <div className="field-group">
                    <label className="field-label">Correct Answer</label>
                    <select className="field-input" value={mcqForm.correctOption} onChange={e => setMcqForm({...mcqForm, correctOption: e.target.value})}
                      style={{ width:'auto', maxWidth:200 }}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                    <button type="button" className="btn-ghost" onClick={() => { resetForms(); setActiveTab('list'); }}>Cancel</button>
                    <button id="save-mcq-btn" type="submit" className="btn-primary">💾 Save MCQ</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Test Case Modal */}
      {showModal && (
        <div className="tc-modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="tc-modal">
            <div className="tc-modal-head">
              <h3>📁 Test Cases – {selectedQuestion?.title}</h3>
              <button className="btn-ghost" onClick={() => setShowModal(false)} style={{ padding:'5px 12px', fontSize:'0.82rem' }}>✕ Close</button>
            </div>
            <div className="tc-modal-body">
              {/* Existing cases */}
              {existingCases.length === 0 ? (
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>No test cases yet.</p>
              ) : (
                <div className="tc-list">
                  {existingCases.map((tc, i) => (
                    <div key={tc.id} className="tc-row">
                      <div className="tc-row-content">
                        <span style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>IN: </span>{tc.inputData.substring(0,40)}{tc.inputData.length>40?'…':''}<br/>
                        <span style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>OUT: </span>{tc.expectedOutput.substring(0,40)}{tc.expectedOutput.length>40?'…':''}
                        <div className="tc-badge-hidden">
                          <span className={`badge ${tc.isHidden ? 'badge-danger' : 'badge-accent'}`} style={{ fontSize:'0.65rem' }}>
                            {tc.isHidden ? '🔒 Hidden' : '👁 Public'}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteCase(tc.id)} style={{ background:'none', border:'none', color:'var(--danger)', cursor:'pointer', fontSize:'1.1rem', padding:'0 4px' }} title="Delete">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="divider" />

              {/* Add new case */}
              <form onSubmit={handleTestCaseSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="field-group">
                  <label className="field-label">Input Data</label>
                  <textarea required className="field-input" placeholder="Enter input…" value={tcForm.inputData}
                    onChange={e => setTcForm({...tcForm, inputData: e.target.value})} style={{ minHeight:70, fontFamily:'JetBrains Mono, monospace', fontSize:'0.82rem' }} />
                </div>
                <div className="field-group">
                  <label className="field-label">Expected Output</label>
                  <textarea required className="field-input" placeholder="Enter expected output…" value={tcForm.expectedOutput}
                    onChange={e => setTcForm({...tcForm, expectedOutput: e.target.value})} style={{ minHeight:70, fontFamily:'JetBrains Mono, monospace', fontSize:'0.82rem' }} />
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.85rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                  <input type="checkbox" checked={tcForm.isHidden} onChange={e => setTcForm({...tcForm, isHidden: e.target.checked})} />
                  Hidden (not shown to students)
                </label>
                <button id="add-tc-btn" type="submit" className="btn-primary" style={{ alignSelf:'flex-end', padding:'10px 24px' }}>
                  + Add Test Case
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContestQuestions;
