import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { addDSAQuestion, addMCQQuestion, addTestCase } from '../../services/api';
import './ContestQuestions.css';

const ContestQuestions = () => {
  const { contestId } = useParams();
  const [activeTab, setActiveTab] = useState('list'); 
  const [questionType, setQuestionType] = useState('DSA'); 
  
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Modal State ---
  const [showModal, setShowModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [tcForm, setTcForm] = useState({ inputData: '', expectedOutput: '', isHidden: true });

  // Form State
  const [dsaForm, setDsaForm] = useState({
    title: '', problemStatement: '', difficulty: 'EASY', constraints: '', 
    inputFormat: '', outputFormat: ''
  });

  const [mcqForm, setMcqForm] = useState({
    questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', 
    correctOption: 'A', marks: 1
  });

  useEffect(() => {
    fetchQuestions();
  }, [contestId]);

  const fetchQuestions = async () => {
    try {
      const dsaRes = await api.get(`/questions/dsa/contest/${contestId}`);
      const mcqRes = await api.get(`/questions/mcq/contest/${contestId}`);
      
      const combined = [
        ...dsaRes.data.map(q => ({ ...q, type: 'DSA', qId: q.questionId })), 
        ...mcqRes.data.map(q => ({ ...q, type: 'MCQ', title: q.questionText, qId: q.mcqId }))
      ];
      setQuestions(combined);
    } catch (err) {
      console.error("Error fetching questions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDSASubmit = async (e) => {
    e.preventDefault();
    try {
      await addDSAQuestion(contestId, dsaForm);
      alert('DSA Question Added!');
      setDsaForm({ title: '', problemStatement: '', difficulty: 'EASY', constraints: '', inputFormat: '', outputFormat: '' });
      fetchQuestions(); 
      setActiveTab('list');
    } catch (err) {
      alert('Failed to add question');
    }
  };

  const handleMCQSubmit = async (e) => {
    e.preventDefault();
    try {
      await addMCQQuestion(contestId, mcqForm);
      alert('MCQ Added!');
      setMcqForm({ questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'A', marks: 1 });
      fetchQuestions();
      setActiveTab('list');
    } catch (err) {
      alert('Failed to add MCQ');
    }
  };

  // --- Test Case Handlers ---
  const openTestCaseModal = (question) => {
    setSelectedQuestion(question);
    setShowModal(true);
  };

  const handleTestCaseSubmit = async (e) => {
    e.preventDefault();
    try {
        await addTestCase(selectedQuestion.questionId, tcForm);
        alert("Test Case Added Successfully!");
        setShowModal(false);
        setTcForm({ inputData: '', expectedOutput: '', isHidden: true });
    } catch (err) {
        alert("Failed to add test case.");
    }
  };

  return (
    <div className="questions-container">
      <div className="page-header">
        <h2>Manage Contest Questions</h2>
        <Link to="/admin/dashboard" className="back-btn">← Back to Dashboard</Link>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          View All Questions
        </button>
        <button className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`} onClick={() => setActiveTab('add')}>
          + Add New Question
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="question-list">
          {loading ? <p>Loading...</p> : questions.length === 0 ? <p>No questions yet.</p> : (
            questions.map((q, idx) => (
              <div key={idx} className="question-item">
                <div>
                  <span className={`q-badge ${q.difficulty?.toLowerCase() || 'medium'}`}>
                    {q.type}
                  </span>
                  <strong>{q.title || q.questionText.substring(0, 50) + "..."}</strong>
                </div>
                <div>
                    {q.type === 'DSA' && (
                        <button 
                            className="tc-btn"
                            onClick={() => openTestCaseModal(q)}
                        >
                            + Test Cases
                        </button>
                    )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* --- ADD QUESTION FORM (Tab) --- */}
      {activeTab === 'add' && (
        <div className="add-form">
          <div className="form-group" style={{marginBottom: '20px'}}>
            <label>Question Type</label>
            <select 
              value={questionType} 
              onChange={(e) => setQuestionType(e.target.value)}
              style={{padding: '10px', borderRadius: '4px', border: '1px solid #ccc'}}
            >
              <option value="DSA">DSA (Coding Problem)</option>
              <option value="MCQ">MCQ (Multiple Choice)</option>
            </select>
          </div>

          {questionType === 'DSA' ? (
            <form onSubmit={handleDSASubmit} className="form-grid">
              <div className="form-group full-width">
                <label>Problem Title</label>
                <input required type="text" value={dsaForm.title} onChange={e => setDsaForm({...dsaForm, title: e.target.value})} />
              </div>
              <div className="form-group full-width">
                <label>Problem Statement</label>
                <textarea required value={dsaForm.problemStatement} onChange={e => setDsaForm({...dsaForm, problemStatement: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Difficulty</label>
                <select value={dsaForm.difficulty} onChange={e => setDsaForm({...dsaForm, difficulty: e.target.value})}>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                </select>
              </div>
              <div className="form-group">
                <label>Constraints</label>
                <input type="text" value={dsaForm.constraints} onChange={e => setDsaForm({...dsaForm, constraints: e.target.value})} />
              </div>
              <button type="submit" className="login-btn full-width">Save DSA Question</button>
            </form>
          ) : (
            <form onSubmit={handleMCQSubmit} className="form-grid">
              <div className="form-group full-width">
                <label>Question Text</label>
                <textarea required value={mcqForm.questionText} onChange={e => setMcqForm({...mcqForm, questionText: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Option A</label>
                <input required type="text" value={mcqForm.optionA} onChange={e => setMcqForm({...mcqForm, optionA: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Option B</label>
                <input required type="text" value={mcqForm.optionB} onChange={e => setMcqForm({...mcqForm, optionB: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Option C</label>
                <input required type="text" value={mcqForm.optionC} onChange={e => setMcqForm({...mcqForm, optionC: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Option D</label>
                <input required type="text" value={mcqForm.optionD} onChange={e => setMcqForm({...mcqForm, optionD: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Correct Option</label>
                <select value={mcqForm.correctOption} onChange={e => setMcqForm({...mcqForm, correctOption: e.target.value})}>
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                </select>
              </div>
              <button type="submit" className="login-btn full-width">Save MCQ Question</button>
            </form>
          )}
        </div>
      )}

      {/* --- TEST CASE MODAL --- */}
      {showModal && (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Add Test Case for: {selectedQuestion?.title}</h3>
                <form onSubmit={handleTestCaseSubmit}>
                    <div className="form-group">
                        <label>Input Data</label>
                        <textarea 
                            required 
                            placeholder="Enter input..." 
                            value={tcForm.inputData}
                            onChange={e => setTcForm({...tcForm, inputData: e.target.value})}
                        />
                    </div>
                    <div className="form-group">
                        <label>Expected Output</label>
                        <textarea 
                            required 
                            placeholder="Enter output..." 
                            value={tcForm.expectedOutput}
                            onChange={e => setTcForm({...tcForm, expectedOutput: e.target.value})}
                        />
                    </div>
                    <div className="form-group">
                        <label>
                            <input 
                                type="checkbox" 
                                checked={tcForm.isHidden} 
                                onChange={e => setTcForm({...tcForm, isHidden: e.target.checked})}
                            />
                            &nbsp; Hidden Case? (Student won't see this)
                        </label>
                    </div>
                    <div className="button-group">
                        <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">Close</button>
                        <button type="submit" className="submit-btn">Save Case</button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default ContestQuestions;