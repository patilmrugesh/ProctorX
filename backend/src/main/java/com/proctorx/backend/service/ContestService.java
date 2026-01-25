package com.proctorx.backend.service;

import com.proctorx.backend.dto.SubmitExamRequest;
import com.proctorx.backend.entity.*;
import com.proctorx.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.*;

@Service
public class ContestService {

    @Autowired private ContestRepository contestRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private QuestionMCQRepository mcqRepository;
    @Autowired private SubmissionRepository submissionRepository;
    @Autowired private ContestResultRepository resultRepository;

    @Transactional
    public Contest createContest(Long adminId, Contest contest) {
        User admin = userRepository.findById(adminId).orElseThrow(() -> new RuntimeException("Admin not found"));
        if (admin.getWalletCredits() < 1) throw new RuntimeException("Insufficient credits!");

        admin.setWalletCredits(admin.getWalletCredits() - 1);
        userRepository.save(admin);

        contest.setStudentToken(UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        contest.setJudgeToken(UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        contest.setAdmin(admin);
        contest.setStatus("DRAFT");

        return contestRepository.save(contest);
    }

    public List<Contest> getContestsByAdmin(Long adminId) {
        return contestRepository.findByAdmin_UserId(adminId);
    }

    @Transactional
    public void deleteContest(Long contestId) {
        contestRepository.deleteById(contestId);
    }


    public Contest updateStatus(Long contestId, String status) {
        Contest contest = contestRepository.findById(contestId).orElseThrow(() -> new RuntimeException("Contest not found"));
        contest.setStatus(status);
        return contestRepository.save(contest);
    }

    public Contest uploadAllowedEmails(Long contestId, MultipartFile file) {
        Contest contest = contestRepository.findById(contestId).orElseThrow(() -> new RuntimeException("Contest not found"));
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            List<String> emails = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.contains("@")) emails.add(line.trim().toLowerCase());
            }
            contest.setAllowedEmails(emails);
            return contestRepository.save(contest);
        } catch (Exception e) { throw new RuntimeException("Failed to parse CSV"); }
    }

    public Contest joinContest(String token, String studentEmail) {
        Contest contest = contestRepository.findByStudentToken(token).orElseThrow(() -> new RuntimeException("Invalid Token"));
        if (!"LIVE".equalsIgnoreCase(contest.getStatus())) throw new RuntimeException("Contest is not active yet.");
        if (!contest.getAllowedEmails().isEmpty() && !contest.getAllowedEmails().contains(studentEmail.trim().toLowerCase())) {
            throw new RuntimeException("Access Denied: Email not verified.");
        }
        return contest;
    }

    public Contest joinContestAsJudge(String token) {
        Contest contest = contestRepository.findByJudgeToken(token).orElseThrow(() -> new RuntimeException("Invalid Judge Token"));
        if (!"LIVE".equalsIgnoreCase(contest.getStatus())) throw new RuntimeException("Contest is not active yet.");
        return contest;
    }

    public Optional<Contest> getContestByStudentToken(String token) {
        return contestRepository.findByStudentToken(token);
    }

    // --- NEW: Submit Exam & Calculate Score ---
    public ContestResult submitExam(SubmitExamRequest request) {
        if (resultRepository.existsByContest_ContestIdAndUser_UserId(request.getContestId(), request.getUserId())) {
            throw new RuntimeException("You have already submitted this exam!");
        }

        int mcqScore = 0;
        int dsaScore = 0;

        // 1. Calculate MCQ Score
        if (request.getMcqAnswers() != null) {
            for (Map.Entry<Long, String> entry : request.getMcqAnswers().entrySet()) {
                QuestionMCQ mcq = mcqRepository.findById(entry.getKey()).orElse(null);
                if (mcq != null && mcq.getCorrectOption().equalsIgnoreCase(entry.getValue())) {
                    mcqScore += mcq.getMarks();
                }
            }
        }

        // 2. Calculate DSA Score (10 pts per AC)
        List<Submission> submissions = submissionRepository.findByUser_UserIdAndContest_ContestId(request.getUserId(), request.getContestId());
        Set<Long> solvedQuestions = new HashSet<>();
        for (Submission sub : submissions) {
            if ("AC".equals(sub.getVerdict())) {
                solvedQuestions.add(sub.getQuestion().getQuestionId());
            }
        }
        dsaScore = solvedQuestions.size() * 10;

        // 3. Save Result
        ContestResult result = new ContestResult();
        result.setContest(contestRepository.findById(request.getContestId()).get());
        result.setUser(userRepository.findById(request.getUserId()).get());
        result.setMcqScore(mcqScore);
        result.setDsaScore(dsaScore);
        result.setTotalScore(mcqScore + dsaScore);

        return resultRepository.save(result);
    }

    // --- NEW: Get Leaderboard ---
    public List<ContestResult> getLeaderboard(Long contestId) {
        return resultRepository.findByContest_ContestIdOrderByTotalScoreDesc(contestId);
    }
}