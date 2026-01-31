package com.proctorx.backend.service;

import com.proctorx.backend.entity.Contest;
import com.proctorx.backend.entity.QuestionDSA;
import com.proctorx.backend.entity.QuestionMCQ;
import com.proctorx.backend.entity.TestCase;
import com.proctorx.backend.repository.ContestRepository;
import com.proctorx.backend.repository.QuestionDSARepository;
import com.proctorx.backend.repository.QuestionMCQRepository;
import com.proctorx.backend.repository.TestCaseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class QuestionService {

    @Autowired private QuestionDSARepository questionDSARepository;
    @Autowired private QuestionMCQRepository questionMCQRepository;
    @Autowired private ContestRepository contestRepository;
    @Autowired private TestCaseRepository testCaseRepository;

    // --- DSA Logic ---
    public QuestionDSA addDSAQuestion(Long contestId, QuestionDSA question) {
        Contest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new RuntimeException("Contest not found"));
        question.setContest(contest);
        if (question.getMarks() == null) question.setMarks(5);
        return questionDSARepository.save(question);
    }

    public QuestionDSA updateDSAQuestion(Long questionId, QuestionDSA updated) {
        QuestionDSA existing = questionDSARepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        existing.setTitle(updated.getTitle());
        existing.setProblemStatement(updated.getProblemStatement());
        existing.setInputFormat(updated.getInputFormat());
        existing.setOutputFormat(updated.getOutputFormat());
        existing.setConstraints(updated.getConstraints());
        existing.setDifficulty(updated.getDifficulty());

        if(updated.getTimeLimitSec() != null) existing.setTimeLimitSec(updated.getTimeLimitSec());
        if(updated.getMemoryLimitMb() != null) existing.setMemoryLimitMb(updated.getMemoryLimitMb());
        if(updated.getMarks() != null) existing.setMarks(updated.getMarks());

        return questionDSARepository.save(existing);
    }

    public List<QuestionDSA> getQuestionsByContest(Long contestId) {
        return questionDSARepository.findByContest_ContestId(contestId);
    }

    // --- NEW: Delete DSA Question ---
    public void deleteDSAQuestion(Long questionId) {
        questionDSARepository.deleteById(questionId);
    }

    public TestCase addTestCase(Long questionId, TestCase testCase) {
        QuestionDSA question = questionDSARepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));
        testCase.setQuestionDSA(question);
        return testCaseRepository.save(testCase);
    }

    public List<TestCase> getTestCases(Long questionId) {
        return testCaseRepository.findByQuestionDSA_QuestionId(questionId);
    }

    public void deleteTestCase(Long testCaseId) {
        testCaseRepository.deleteById(testCaseId);
    }

    // --- MCQ Logic ---
    public QuestionMCQ addMCQQuestion(Long contestId, QuestionMCQ question) {
        Contest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new RuntimeException("Contest not found"));

        if (!"A".equals(question.getCorrectOption()) &&
                !"B".equals(question.getCorrectOption()) &&
                !"C".equals(question.getCorrectOption()) &&
                !"D".equals(question.getCorrectOption())) {
            throw new RuntimeException("Correct option must be A, B, C, or D");
        }
        if (question.getMarks() == null) question.setMarks(2);

        question.setContest(contest);
        return questionMCQRepository.save(question);
    }

    public QuestionMCQ updateMCQQuestion(Long questionId, QuestionMCQ updated) {
        QuestionMCQ existing = questionMCQRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        existing.setQuestionText(updated.getQuestionText());
        existing.setOptionA(updated.getOptionA());
        existing.setOptionB(updated.getOptionB());
        existing.setOptionC(updated.getOptionC());
        existing.setOptionD(updated.getOptionD());
        existing.setCorrectOption(updated.getCorrectOption());
        existing.setMarks(updated.getMarks());

        return questionMCQRepository.save(existing);
    }

    public List<QuestionMCQ> getMCQQuestionsByContest(Long contestId) {
        return questionMCQRepository.findByContest_ContestId(contestId);
    }

    // --- NEW: Delete MCQ Question ---
    public void deleteMCQQuestion(Long questionId) {
        questionMCQRepository.deleteById(questionId);
    }

    // --- NEW: Delete All Questions for a Contest ---
    @Transactional
    public void deleteAllQuestions(Long contestId) {
        List<QuestionDSA> dsaList = questionDSARepository.findByContest_ContestId(contestId);
        if (!dsaList.isEmpty()) {
            questionDSARepository.deleteAll(dsaList);
        }

        List<QuestionMCQ> mcqList = questionMCQRepository.findByContest_ContestId(contestId);
        if (!mcqList.isEmpty()) {
            questionMCQRepository.deleteAll(mcqList);
        }
    }
}