import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const API_URL = `${API_BASE_URL}/api`;

export const WS_URL = `${API_BASE_URL}/ws`;

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Add a response interceptor to extract error messages
api.interceptors.response.use(
    (response) => response,
    (error) => {
        let message = 'An unexpected error occurred';
        
        if (error.response) {
            // The server responded with a status code outside the 2xx range
            const data = error.response.data;
            if (typeof data === 'string') {
                message = data;
            } else if (data && data.message) {
                message = data.message;
            } else if (data && data.error) {
                message = data.error;
            } else if (data && typeof data === 'object') {
                // If it's the Spring Boot default error object
                message = data.message || data.error || JSON.stringify(data);
            }
        } else if (error.request) {
            // The request was made but no response was received
            message = 'No response from server. Please check if the backend is running.';
        } else {
            // Something happened in setting up the request
            message = error.message;
        }

        return Promise.reject(message);
    }
);

export const loginUser = (credentials) => api.post('/auth/login', credentials);
export const registerUser = (userData) => api.post('/auth/register', userData);

export const createContest = (adminId, data) => api.post(`/contests/create?adminId=${adminId}`, data);
export const getAdminContests = (adminId) => api.get(`/contests/admin/${adminId}`);
export const deleteContest = (contestId) => api.delete(`/contests/${contestId}`);
export const updateContestStatus = (contestId, status) => api.put(`/contests/${contestId}/status?status=${status}`);
export const uploadContestUsers = (contestId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/contests/${contestId}/upload-users`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const addDSAQuestion = (contestId, data) => api.post(`/questions/dsa/add?contestId=${contestId}`, data);
export const updateDSAQuestion = (questionId, data) => api.put(`/questions/dsa/${questionId}`, data);
export const deleteDSAQuestion = (questionId) => api.delete(`/questions/dsa/${questionId}`); // NEW

export const addMCQQuestion = (contestId, data) => api.post(`/questions/mcq/add?contestId=${contestId}`, data);
export const updateMCQQuestion = (questionId, data) => api.put(`/questions/mcq/${questionId}`, data);
export const deleteMCQQuestion = (questionId) => api.delete(`/questions/mcq/${questionId}`); // NEW

export const deleteAllQuestions = (contestId) => api.delete(`/questions/contest/${contestId}/all`); // NEW

export const addTestCase = (questionId, data) => api.post(`/questions/cases/add?questionId=${questionId}`, data);
export const getTestCases = (questionId) => api.get(`/questions/${questionId}/cases`);
export const deleteTestCase = (testCaseId) => api.delete(`/questions/cases/${testCaseId}`);

export const joinContest = (token, email) => api.get(`/contests/join/${token}?email=${email}`);
export const joinJudge = (token) => api.get(`/contests/judge/join/${token}`);

export const runCode = (data) => api.post('/submissions/run', data);
export const submitExam = (data) => api.post('/contests/submit', data);
export const getLeaderboard = (contestId) => api.get(`/contests/${contestId}/leaderboard`);

export default api;