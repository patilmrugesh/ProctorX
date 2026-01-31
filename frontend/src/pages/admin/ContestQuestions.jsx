import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { 
    addDSAQuestion, 
    addMCQQuestion, 
    addTestCase, 
    updateDSAQuestion, 
    updateMCQQuestion, 
    getAdminContests,
    getTestCases, 
    deleteTestCase,
    deleteDSAQuestion,  
    deleteMCQQuestion,  
    deleteAllQuestions  
} from '../../services/api';
import './ContestQuestions.css';

const ContestQuestions = () => {
  const { contestId } = useParams();
  const [activeTab, setActiveTab] = useState('list'); 
  const [questionType, setQuestionType] = useState('DSA'); 
  
  const [contestType, setContestType] = useState(null); 
  const [contestData, setContestData] = useState(null); 
  
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]); // NEW: Track selected questions

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // --- Modal State ---
  const [showModal, setShowModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [tcForm, setTcForm] = useState({ inputData: '', expectedOutput: '', isHidden: true });
  const [existingCases, setExistingCases] = useState([]); 

  const [dsaForm, setDsaForm] = useState({
    title: '', problemStatement: '', difficulty: 'EASY', constraints: '', 
    inputFormat: '', outputFormat: '', timeLimitSec: 1.0, marks: 5
  });

  const [mcqForm, setMcqForm] = useState({
    questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', 
    correctOption: 'A', marks: 2
  });

  useEffect(() => {
    fetchContestDetails();
    fetchQuestions();
  }, [contestId]);

  const fetchContestDetails = async () => {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user?.userId) {
          try {
              const res = await getAdminContests(user.userId);
              const currentContest = res.data.find(c => c.contestId === Number(contestId));
              if (currentContest) {
                  setContestType(currentContest.type);
                  setContestData(currentContest);
                  // Force question type based on contest type
                  if (currentContest.type === 'DSA') setQuestionType('DSA');
                  else if (currentContest.type === 'MCQ') setQuestionType('MCQ');
                  else if (currentContest.type === 'HYBRID') setQuestionType('DSA'); // Default for Hybrid
              }
          } catch (err) { console.error(err); }
      }
  };

  const fetchQuestions = async () => {
    try {
      const [dsaRes, mcqRes] = await Promise.all([
        api.get(`/questions/dsa/contest/${contestId}`).catch(() => ({ data: [] })),
        api.get(`/questions/mcq/contest/${contestId}`).catch(() => ({ data: [] }))
      ]);
      
      const dsaQuestions = Array.isArray(dsaRes.data) ? dsaRes.data : [];
      const mcqQuestions = Array.isArray(mcqRes.data) ? mcqRes.data : [];

      const combined = [
        ...dsaQuestions.map(q => ({ ...q, type: 'DSA', qId: q.questionId })), 
        ...mcqQuestions.map(q => ({ ...q, type: 'MCQ', title: q.questionText, qId: q.mcqId }))
      ];
      setQuestions(combined);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleDeleteQuestion = async (q) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
        if (q.type === 'DSA') await deleteDSAQuestion(q.qId);
        else await deleteMCQQuestion(q.qId);
        fetchQuestions(); 
        setSelectedIds(prev => prev.filter(id => id !== q.qId)); // Remove from selection if deleted
    } catch (err) { alert("Failed to delete question. Ensure backend is running."); }
  };

  // --- NEW: Selection Logic ---
  const handleSelect = (id) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
      if (selectedIds.length === questions.length) {
          setSelectedIds([]);
      } else {
          setSelectedIds(questions.map(q => q.qId));
      }
  };

  // --- NEW: Delete Selected Logic ---
  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected questions?`)) return;
    
    try {
        // Create an array of delete promises based on the type of each selected question
        const deletePromises = selectedIds.map(id => {
            const q = questions.find(item => item.qId === id);
            if (!q) return Promise.resolve();
            if (q.type === 'DSA') return deleteDSAQuestion(id);
            else return deleteMCQQuestion(id);
        });
        
        await Promise.all(deletePromises);
        setSelectedIds([]);
        fetchQuestions();
    } catch (err) { alert("Failed to delete selected questions. Check backend logs."); }
  };

  const handleContestTypeChange = async (e) => {
    const newType = e.target.value;
    const oldType = contestType;
    if (newType === oldType) return;

    let warningMsg = "";
    if ((oldType === 'HYBRID' && (newType === 'DSA' || newType === 'MCQ')) || 
        (oldType !== 'HYBRID' && newType !== 'HYBRID' && oldType !== newType)) {
        warningMsg = "if you select it then all the questions related to other type will be remove Do u still want to contine?";
    } else if ((oldType === 'DSA' || oldType === 'MCQ') && newType === 'HYBRID') {
        warningMsg = "You are switching to Hybrid mode. You will be able to add both question types. Continue?";
    }

    if (window.confirm(warningMsg)) {
        try {
            setContestType(newType);
            if (newType === 'DSA') setQuestionType('DSA');
            else if (newType === 'MCQ') setQuestionType('MCQ');

            if (contestData) {
                await api.put(`/contests/${contestData.contestId}`, { ...contestData, type: newType });
                fetchQuestions();
                resetForms();
            }
        } catch (err) { 
            console.error("Failed to update type", err);
            alert("Update failed. Please check connection.");
            setContestType(oldType); 
        }
    }
  };

  const handleEditClick = (q) => {
      setIsEditing(true);
      setEditId(q.qId);
      setQuestionType(q.type);
      setActiveTab('add');

      if (q.type === 'DSA') {
          setDsaForm({
              title: q.title,
              problemStatement: q.problemStatement,
              difficulty: q.difficulty,
              constraints: q.constraints,
              inputFormat: q.inputFormat,
              outputFormat: q.outputFormat,
              timeLimitSec: q.timeLimitSec || 1.0,
              marks: q.marks || 5
          });
      } else {
          setMcqForm({
              questionText: q.questionText || q.title,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              correctOption: q.correctOption,
              marks: q.marks || 2
          });
      }
  };

  const resetForms = () => {
      setIsEditing(false);
      setEditId(null);
      // Reset question type based on contest type
      if (contestType === 'DSA') setQuestionType('DSA');
      else if (contestType === 'MCQ') setQuestionType('MCQ');
      
      setDsaForm({ title: '', problemStatement: '', difficulty: 'EASY', constraints: '', inputFormat: '', outputFormat: '', timeLimitSec: 1.0, marks: 5 });
      setMcqForm({ questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'A', marks: 2 });
  };

  const handleDSASubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) { await updateDSAQuestion(editId, dsaForm); alert('DSA Question Updated!'); } 
      else { await addDSAQuestion(contestId, dsaForm); alert('DSA Question Added!'); }
      resetForms(); fetchQuestions(); setActiveTab('list');
    } catch (err) { alert('Failed to save question'); }
  };

  const handleMCQSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) { await updateMCQQuestion(editId, mcqForm); alert('MCQ Updated!'); } 
      else { await addMCQQuestion(contestId, mcqForm); alert('MCQ Added!'); }
      resetForms(); fetchQuestions(); setActiveTab('list');
    } catch (err) { alert('Failed to save MCQ'); }
  };

  const openTestCaseModal = async (question) => {
    setSelectedQuestion(question);
    setShowModal(true);
    fetchCases(question.qId); 
  };

  const fetchCases = async (qId) => {
      try {
          const res = await getTestCases(qId);
          if (Array.isArray(res.data)) {
            setExistingCases(res.data);
          } else {
            setExistingCases([]);
          }
      } catch (err) { 
          console.error(err); 
          setExistingCases([]); 
      }
  };

  const handleTestCaseSubmit = async (e) => {
    e.preventDefault();
    try {
        await addTestCase(selectedQuestion.qId, tcForm);
        alert("Test Case Added Successfully!");
        setTcForm({ inputData: '', expectedOutput: '', isHidden: true });
        fetchCases(selectedQuestion.qId); // Refresh list immediately
    } catch (err) { alert("Failed to add case."); }
  };

  const handleDeleteCase = async (caseId) => {
      if(window.confirm("Delete this test case?")) {
          try {
              await deleteTestCase(caseId);
              fetchCases(selectedQuestion.qId); 
          } catch(err) { alert("Failed to delete."); }
      }
  };

  // Helper to determine if we should show the type selector
  const showTypeSelector = !isEditing && contestType === 'HYBRID';

  return (
    <div className="questions-container">
      <div className="page-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <h2>Manage Questions</h2>
            <select 
                value={contestType || ''} 
                onChange={handleContestTypeChange}
                style={{
                    padding: '8px 12px', borderRadius: '6px', border: '1px solid #bdc3c7',
                    backgroundColor: 'white', color: '#2c3e50', fontSize: '1rem', fontWeight: '500', cursor: 'pointer'
                }}
            >
                <option value="DSA">DSA</option>
                <option value="MCQ">MCQ</option>
                <option value="HYBRID">Hybrid</option>
            </select>
        </div>
        <div style={{display: 'flex', gap: '10px'}}>
            {/* --- NEW: Delete Selected Button --- */}
            {selectedIds.length > 0 && (
                <button 
                    onClick={handleDeleteSelected}
                    style={{padding: '8px 12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
                >
                    Delete Selected ({selectedIds.length})
                </button>
            )}
            <Link to="/admin/dashboard" className="back-btn">← Back</Link>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => { setActiveTab('list'); resetForms(); }}>View Questions</button>
        <button className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`} onClick={() => { setActiveTab('add'); resetForms(); }}>+ Add Question</button>
      </div>

      {activeTab === 'list' && (
        <div className="question-list">
            {/* --- NEW: Select All Header --- */}
            {questions.length > 0 && (
                <div style={{padding: '10px 15px', background: '#f8f9fa', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px 8px 0 0'}}>
                    <input 
                        type="checkbox" 
                        checked={selectedIds.length === questions.length && questions.length > 0} 
                        onChange={handleSelectAll} 
                        style={{width:'18px', height:'18px', cursor:'pointer'}}
                    />
                    <span style={{fontWeight:'bold', color:'#555'}}>Select All</span>
                </div>
            )}

          {loading ? <p>Loading...</p> : questions.map((q, idx) => (
              <div key={idx} className="question-item">
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    {/* --- NEW: Item Checkbox --- */}
                    <input 
                        type="checkbox" 
                        checked={selectedIds.includes(q.qId)} 
                        onChange={() => handleSelect(q.qId)} 
                        style={{width:'18px', height:'18px', cursor:'pointer'}}
                    />
                    <div>
                        <span className={`q-badge ${q.difficulty?.toLowerCase() || 'medium'}`}>{q.type}</span>
                        <strong>{q.title || (q.questionText ? q.questionText.substring(0, 50) + "..." : "Untitled")}</strong>
                        <span style={{marginLeft: '10px', fontSize: '0.8rem', color: '#666'}}>({q.marks} pts {q.type === 'DSA' ? `| ${q.timeLimitSec}s` : ''})</span>
                    </div>
                </div>
                <div style={{display: 'flex', alignItems: 'center'}}>
                    {q.type === 'DSA' && <button className="tc-btn" onClick={() => openTestCaseModal(q)}>Cases</button>}
                    <button className="tc-btn" style={{borderColor: '#f39c12', color: '#f39c12', background: '#fffcf5'}} onClick={() => handleEditClick(q)}>Edit</button>
                    <button 
                        className="tc-btn" 
                        style={{borderColor: '#e74c3c', color: '#e74c3c', background: '#fff5f5', marginLeft: '5px'}} 
                        onClick={() => handleDeleteQuestion(q)}
                    >
                        Delete
                    </button>
                </div>
              </div>
          ))}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="add-form">
          <h3>{isEditing ? `Edit ${questionType}` : 'Add New Question'}</h3>
          
          {showTypeSelector && (
              <div className="form-group">
                <label>Question Type</label>
                <select 
                  value={questionType} 
                  onChange={(e) => setQuestionType(e.target.value)}
                  style={{padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width:'100%'}}
                >
                  <option value="DSA">DSA (Coding Problem)</option>
                  <option value="MCQ">MCQ (Multiple Choice)</option>
                </select>
              </div>
          )}

          {/* If DSA contest OR (Hybrid AND User selected DSA) */}
          {(contestType === 'DSA' || (contestType === 'HYBRID' && questionType === 'DSA')) && (
            <form onSubmit={handleDSASubmit} className="form-grid">
              <div className="form-group full-width"><label>Title</label><input required value={dsaForm.title} onChange={e => setDsaForm({...dsaForm, title: e.target.value})} /></div>
              <div className="form-group"><label>Time (s)</label><input type="number" step="0.1" required value={dsaForm.timeLimitSec} onChange={e => setDsaForm({...dsaForm, timeLimitSec: e.target.value})} /></div>
              <div className="form-group"><label>Marks</label><input type="number" required value={dsaForm.marks} onChange={e => setDsaForm({...dsaForm, marks: e.target.value})} /></div>
              <div className="form-group full-width"><label>Statement</label><textarea required value={dsaForm.problemStatement} onChange={e => setDsaForm({...dsaForm, problemStatement: e.target.value})} /></div>
              <div className="form-group"><label>Difficulty</label><select value={dsaForm.difficulty} onChange={e => setDsaForm({...dsaForm, difficulty: e.target.value})}><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select></div>
              <div className="form-group"><label>Constraints</label><input value={dsaForm.constraints} onChange={e => setDsaForm({...dsaForm, constraints: e.target.value})} /></div>
              <div className="form-group"><label>Input</label><textarea value={dsaForm.inputFormat} onChange={e => setDsaForm({...dsaForm, inputFormat: e.target.value})} style={{minHeight:'60px'}}/></div>
              <div className="form-group"><label>Output</label><textarea value={dsaForm.outputFormat} onChange={e => setDsaForm({...dsaForm, outputFormat: e.target.value})} style={{minHeight:'60px'}}/></div>
              <button type="submit" className="login-btn full-width">Save</button>
            </form>
          )}

          {/* If MCQ contest OR (Hybrid AND User selected MCQ) */}
          {(contestType === 'MCQ' || (contestType === 'HYBRID' && questionType === 'MCQ')) && (
            <form onSubmit={handleMCQSubmit} className="form-grid">
              <div className="form-group full-width"><label>Question</label><textarea required value={mcqForm.questionText} onChange={e => setMcqForm({...mcqForm, questionText: e.target.value})} /></div>
              <div className="form-group full-width"><label>Marks</label><input type="number" required value={mcqForm.marks} onChange={e => setMcqForm({...mcqForm, marks: e.target.value})} style={{width: '100px'}} /></div>
              <div className="form-group"><label>A</label><input required value={mcqForm.optionA} onChange={e => setMcqForm({...mcqForm, optionA: e.target.value})} /></div>
              <div className="form-group"><label>B</label><input required value={mcqForm.optionB} onChange={e => setMcqForm({...mcqForm, optionB: e.target.value})} /></div>
              <div className="form-group"><label>C</label><input required value={mcqForm.optionC} onChange={e => setMcqForm({...mcqForm, optionC: e.target.value})} /></div>
              <div className="form-group"><label>D</label><input required value={mcqForm.optionD} onChange={e => setMcqForm({...mcqForm, optionD: e.target.value})} /></div>
              <div className="form-group"><label>Correct</label><select value={mcqForm.correctOption} onChange={e => setMcqForm({...mcqForm, correctOption: e.target.value})}><option>A</option><option>B</option><option>C</option><option>D</option></select></div>
              <button type="submit" className="login-btn full-width">Save</button>
            </form>
          )}
        </div>
      )}

      {/* --- TEST CASE MODAL --- */}
      {showModal && (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Manage Test Cases</h3>
                <div style={{maxHeight:'200px', overflowY:'auto', marginBottom:'20px', border:'1px solid #eee'}}>
                    {!Array.isArray(existingCases) || existingCases.length === 0 ? <p style={{padding:'10px', color:'#999'}}>No cases yet.</p> : existingCases.map((tc, i) => (
                        <div key={tc.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid #eee', background: i%2===0?'#f9f9f9':'white'}}>
                            <div style={{fontSize:'0.85rem'}}>
                                <strong>Input:</strong> {tc.inputData.substring(0, 20)}... <br/>
                                <strong>Output:</strong> {tc.expectedOutput.substring(0, 20)}... <br/>
                                <span style={{fontSize:'0.7rem', color: tc.isHidden ? 'red' : 'green'}}>{tc.isHidden ? 'HIDDEN' : 'PUBLIC'}</span>
                            </div>
                            <button onClick={() => handleDeleteCase(tc.id)} style={{color:'red', border:'none', background:'none', cursor:'pointer', fontWeight:'bold'}}>×</button>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleTestCaseSubmit} style={{borderTop:'2px solid #eee', paddingTop:'20px'}}>
                    <div className="form-group"><label>Input</label><textarea required placeholder="Enter input..." value={tcForm.inputData} onChange={e => setTcForm({...tcForm, inputData: e.target.value})} /></div>
                    <div className="form-group"><label>Output</label><textarea required placeholder="Enter output..." value={tcForm.expectedOutput} onChange={e => setTcForm({...tcForm, expectedOutput: e.target.value})} /></div>
                    <div className="form-group"><label><input type="checkbox" checked={tcForm.isHidden} onChange={e => setTcForm({...tcForm, isHidden: e.target.checked})} /> Hidden?</label></div>
                    <div className="button-group">
                        <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">Close</button>
                        <button type="submit" className="submit-btn">Add Case</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ContestQuestions;