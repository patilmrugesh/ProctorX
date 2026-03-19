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
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ContestService {

    @Autowired
    private ContestRepository contestRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private QuestionMCQRepository mcqRepository;
    @Autowired
    private QuestionDSARepository dsaRepository;
    @Autowired
    private SubmissionRepository submissionRepository;
    @Autowired
    private ContestResultRepository resultRepository;

    @Transactional
    public Contest createContest(Long adminId, Contest contest) {
        User admin = userRepository.findById(adminId).orElseThrow(() -> new RuntimeException("Admin not found"));

        admin.setWalletCredits(admin.getWalletCredits());
        userRepository.save(admin);

        contest.setStudentToken(UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        contest.setJudgeToken(UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        contest.setAdmin(admin);
        contest.setStatus("DRAFT");

        return contestRepository.save(contest);
    }

    @Transactional
    public Contest updateContest(Long contestId, Contest updated) {
        Contest existing = contestRepository.findById(contestId)
                .orElseThrow(() -> new RuntimeException("Contest not found"));

        String newType = updated.getType();

        existing.setTitle(updated.getTitle());
        existing.setDescription(updated.getDescription());
        existing.setType(newType);
        existing.setDurationMinutes(updated.getDurationMinutes());
        existing.setTimerType(updated.getTimerType());
        existing.setQuestionTimerSeconds(updated.getQuestionTimerSeconds());

        // --- NEW: Save start and end times ---
        existing.setStartTime(updated.getStartTime());
        existing.setEndTime(updated.getEndTime());

        if ("DSA".equals(newType)) {
            List<QuestionMCQ> mcqs = mcqRepository.findByContest_ContestId(contestId);
            if (!mcqs.isEmpty())
                mcqRepository.deleteAll(mcqs);
        } else if ("MCQ".equals(newType)) {
            List<QuestionDSA> dsas = dsaRepository.findByContest_ContestId(contestId);
            if (!dsas.isEmpty())
                dsaRepository.deleteAll(dsas);
        }

        return contestRepository.save(existing);
    }

    public List<Contest> getContestsByAdmin(Long adminId) {
        return contestRepository.findByAdmin_UserId(adminId);
    }

    @Transactional
    public void deleteContest(Long contestId) {
        contestRepository.deleteById(contestId);
    }

    @Transactional
    public Contest updateStatus(Long contestId, String status) {
        Contest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new RuntimeException("Contest not found"));

        if ("LIVE".equalsIgnoreCase(status) && !"LIVE".equalsIgnoreCase(contest.getStatus())) {
            User admin = contest.getAdmin();

            // --- NEW: Time Window & Token Logic ---
            if (contest.getStartTime() == null || contest.getEndTime() == null) {
                throw new RuntimeException("Start Time and End Time must be set before going LIVE.");
            }

            long durationMinutes = java.time.Duration.between(contest.getStartTime(), contest.getEndTime()).toMinutes();
            if (durationMinutes <= 0) {
                throw new RuntimeException("End Time must be after Start Time.");
            }

            // 1 token per 2 hours (120 mins). Math.ceil rounds up (e.g. 150 mins = 2 tokens)
            int tokensRequired = (int) Math.ceil(durationMinutes / 120.0);

            if (admin.getWalletCredits() < tokensRequired) {
                throw new RuntimeException("Insufficient tokens! You need " + tokensRequired + " tokens for a " + durationMinutes + " minute window.");
            }

            admin.setWalletCredits(admin.getWalletCredits() - tokensRequired);
            userRepository.save(admin);
        }

        contest.setStatus(status);
        return contestRepository.save(contest);
    }

    public Contest uploadAllowedEmails(Long contestId, MultipartFile file) {
        Contest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new RuntimeException("Contest not found"));
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            List<String> emails = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.contains("@"))
                    emails.add(line.trim().toLowerCase());
            }
            contest.setAllowedEmails(emails);
            return contestRepository.save(contest);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse CSV");
        }
    }

    public Contest joinContest(String token, String studentEmail) {
        Contest contest = contestRepository.findByStudentToken(token)
                .orElseThrow(() -> new RuntimeException("Invalid Token"));

        if (contest.getAdmin().getEmail().equalsIgnoreCase(studentEmail)) {
            return contest;
        }

        if (!"LIVE".equalsIgnoreCase(contest.getStatus()))
            throw new RuntimeException("Contest is not active yet.");

        // --- NEW: Check if current time is within bounds ---
        LocalDateTime now = LocalDateTime.now();
        if (contest.getStartTime() != null && now.isBefore(contest.getStartTime())) {
            throw new RuntimeException("Contest has not started yet. Please wait until " + contest.getStartTime());
        }
        if (contest.getEndTime() != null && now.isAfter(contest.getEndTime())) {
            throw new RuntimeException("Contest window has already ended.");
        }

        if (!contest.getAllowedEmails().isEmpty()
                && !contest.getAllowedEmails().contains(studentEmail.trim().toLowerCase())) {
            throw new RuntimeException("Access Denied: Email not verified.");
        }
        return contest;
    }

    public Contest joinContestAsJudge(String token) {
        Contest contest = contestRepository.findByJudgeToken(token)
                .orElseThrow(() -> new RuntimeException("Invalid Judge Token"));
        if (!"LIVE".equalsIgnoreCase(contest.getStatus()))
            throw new RuntimeException("Contest is not active yet.");
        return contest;
    }

    public Optional<Contest> getContestByStudentToken(String token) {
        return contestRepository.findByStudentToken(token);
    }

    public ContestResult submitExam(SubmitExamRequest request) {
        if (resultRepository.existsByContest_ContestIdAndUser_UserId(request.getContestId(), request.getUserId())) {
            throw new RuntimeException("You have already submitted this exam!");
        }

        int mcqScore = 0;
        int dsaScore = 0;

        if (request.getMcqAnswers() != null) {
            for (Map.Entry<Long, String> entry : request.getMcqAnswers().entrySet()) {
                QuestionMCQ mcq = mcqRepository.findById(entry.getKey()).orElse(null);
                if (mcq != null && mcq.getCorrectOption().equalsIgnoreCase(entry.getValue())) {
                    mcqScore += mcq.getMarks();
                }
            }
        }

        List<Submission> submissions = submissionRepository.findByUser_UserIdAndContest_ContestId(request.getUserId(),
                request.getContestId());
        Set<Long> solvedQuestions = new HashSet<>();

        for (Submission sub : submissions) {
            if ("AC".equals(sub.getVerdict()) && !solvedQuestions.contains(sub.getQuestion().getQuestionId())) {
                dsaScore += sub.getQuestion().getMarks();
                solvedQuestions.add(sub.getQuestion().getQuestionId());
            }
        }

        ContestResult result = new ContestResult();
        result.setContest(contestRepository.findById(request.getContestId()).get());
        result.setUser(userRepository.findById(request.getUserId()).get());
        result.setMcqScore(mcqScore);
        result.setDsaScore(dsaScore);
        result.setTotalScore(mcqScore + dsaScore);

        return resultRepository.save(result);
    }

    public List<ContestResult> getLeaderboard(Long contestId) {
        return resultRepository.findByContest_ContestIdOrderByTotalScoreDesc(contestId);
    }
}