import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateContest from './pages/admin/CreateContest';
import ContestQuestions from './pages/admin/ContestQuestions';
import StudentDashboard from './pages/student/StudentDashboard';
import ExamArena from './pages/exam/ExamArena';
import JudgeDashboard from './pages/judge/JudgeDashboard';
import Leaderboard from './pages/admin/Leaderboard'; // <--- ADD THIS IMPORT

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Admin */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/create-contest" element={<CreateContest />} />
        <Route path="/admin/contest/:contestId/questions" element={<ContestQuestions />} />
        <Route path="/admin/contest/:contestId/leaderboard" element={<Leaderboard />} /> {/* <--- Route is correct */}
        
        {/* Student */}
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/exam/:contestId" element={<ExamArena />} />

        {/* Judge Route */}
        <Route path="/judge/monitor/:contestId" element={<JudgeDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;