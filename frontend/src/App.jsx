import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register'; // Import Register
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateContest from './pages/admin/CreateContest';
import ContestQuestions from './pages/admin/ContestQuestions';
import StudentDashboard from './pages/student/StudentDashboard';
import ExamArena from './pages/exam/ExamArena';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} /> {/* New Route */}
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/create-contest" element={<CreateContest />} />
        <Route path="/admin/contest/:contestId/questions" element={<ContestQuestions />} />
        
        {/* Student Routes */}
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        
        {/* Exam Route */}
        <Route path="/exam/:contestId" element={<ExamArena />} />
      </Routes>
    </Router>
  );
}

export default App;