package com.proctorx.backend.service;

import com.proctorx.backend.dto.ExecutionRequest;
import com.proctorx.backend.dto.ExecutionResponse;
import com.proctorx.backend.entity.*;
import com.proctorx.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class SubmissionService {

    @Autowired
    private DockerService dockerService;

    @Autowired
    private QuestionDSARepository questionRepository;

    @Autowired
    private TestCaseRepository testCaseRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ContestRepository contestRepository;

    public ExecutionResponse runCode(ExecutionRequest request) {
        ExecutionResponse response = new ExecutionResponse();

        try {
            QuestionDSA question = questionRepository.findById(request.getQuestionId())
                    .orElseThrow(() -> new RuntimeException("Question not found"));

            // --- SMART TIME LIMIT LOGIC ---
            // 1. Get Base Limit (Default to 2.0s if Admin didn't set one)
            Double timeLimit = question.getTimeLimitSec();
            if (timeLimit == null || timeLimit <= 0) timeLimit = 2.0;

            // 2. Apply Language Multiplier (Python is slower, give it 3x time)
            if ("PYTHON".equalsIgnoreCase(request.getLanguage())) {
                timeLimit = timeLimit * 3.0;
            }

            List<TestCase> testCases = testCaseRepository.findByQuestionDSA_QuestionId(request.getQuestionId());

            if (testCases.isEmpty()) {
                response.setVerdict("Error");
                response.setOutput("No test cases found for this problem.");
                return response;
            }

            int passed = 0;
            long totalTime = 0;

            for (TestCase tc : testCases) {
                long start = System.currentTimeMillis();

                // Pass the calculated timeLimit to Docker
                String actualOutput = dockerService.runCode(request.getCode(), request.getLanguage(), tc.getInputData(), timeLimit);

                long end = System.currentTimeMillis();
                totalTime += (end - start);

                if (actualOutput.startsWith("TLE:")) {
                    return saveAndReturn(request, "TLE", "Time Limit Exceeded", 0.0);
                }

                String expected = tc.getExpectedOutput().trim();
                String actual = actualOutput.trim();

                if (!expected.equals(actual)) {
                    return saveAndReturn(request, "WA",
                            "Wrong Answer on Input:\n" + tc.getInputData() +
                                    "\n\nExpected:\n" + expected +
                                    "\n\nActual:\n" + actual,
                            (double)totalTime);
                }
                passed++;
            }

            return saveAndReturn(request, "AC", "All Test Cases Passed!", (double)totalTime);

        } catch (Exception e) {
            e.printStackTrace();
            return saveAndReturn(request, "RE", "Runtime Error: " + e.getMessage(), 0.0);
        }
    }

    private ExecutionResponse saveAndReturn(ExecutionRequest req, String verdict, String output, Double time) {
        Submission sub = new Submission();
        sub.setCode(req.getCode());
        sub.setLanguage(req.getLanguage());
        sub.setVerdict(verdict);
        sub.setExecutionTime(time);
        sub.setSubmittedAt(LocalDateTime.now());

        if(req.getUserId() != null) sub.setUser(userRepository.findById(req.getUserId()).orElse(null));
        if(req.getContestId() != null) sub.setContest(contestRepository.findById(req.getContestId()).orElse(null));
        if(req.getQuestionId() != null) sub.setQuestion(questionRepository.findById(req.getQuestionId()).orElse(null));

        submissionRepository.save(sub);

        ExecutionResponse res = new ExecutionResponse();
        res.setVerdict(verdict);
        res.setOutput(output);
        res.setExecutionTime(time);
        return res;
    }
}