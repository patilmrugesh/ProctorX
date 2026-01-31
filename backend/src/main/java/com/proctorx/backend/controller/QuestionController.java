package com.proctorx.backend.controller;

import com.proctorx.backend.entity.QuestionDSA;
import com.proctorx.backend.entity.QuestionMCQ;
import com.proctorx.backend.entity.TestCase;
import com.proctorx.backend.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/questions")
@CrossOrigin(origins = "*")
public class QuestionController {

    @Autowired
    private QuestionService questionService;

    // --- DSA Endpoints ---
    @PostMapping("/dsa/add")
    public ResponseEntity<?> addDSAQuestion(@RequestParam Long contestId, @RequestBody QuestionDSA question) {
        try { return ResponseEntity.ok(questionService.addDSAQuestion(contestId, question)); }
        catch (RuntimeException e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    @PutMapping("/dsa/{questionId}")
    public ResponseEntity<?> updateDSAQuestion(@PathVariable Long questionId, @RequestBody QuestionDSA question) {
        try { return ResponseEntity.ok(questionService.updateDSAQuestion(questionId, question)); }
        catch (RuntimeException e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    @GetMapping("/dsa/contest/{contestId}")
    public ResponseEntity<List<QuestionDSA>> getContestDSAQuestions(@PathVariable Long contestId) {
        return ResponseEntity.ok(questionService.getQuestionsByContest(contestId));
    }

    // --- NEW: Delete DSA Question ---
    @DeleteMapping("/dsa/{questionId}")
    public ResponseEntity<?> deleteDSAQuestion(@PathVariable Long questionId) {
        questionService.deleteDSAQuestion(questionId);
        return ResponseEntity.ok("Deleted");
    }

    // --- Test Case Endpoints ---

    @PostMapping("/cases/add")
    public ResponseEntity<?> addTestCase(@RequestParam Long questionId, @RequestBody TestCase testCase) {
        try { return ResponseEntity.ok(questionService.addTestCase(questionId, testCase)); }
        catch (RuntimeException e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    @GetMapping("/{questionId}/cases")
    public ResponseEntity<List<TestCase>> getTestCases(@PathVariable Long questionId) {
        return ResponseEntity.ok(questionService.getTestCases(questionId));
    }

    @DeleteMapping("/cases/{testCaseId}")
    public ResponseEntity<?> deleteTestCase(@PathVariable Long testCaseId) {
        questionService.deleteTestCase(testCaseId);
        return ResponseEntity.ok("Deleted");
    }

    // --- MCQ Endpoints ---
    @PostMapping("/mcq/add")
    public ResponseEntity<?> addMCQQuestion(@RequestParam Long contestId, @RequestBody QuestionMCQ question) {
        try { return ResponseEntity.ok(questionService.addMCQQuestion(contestId, question)); }
        catch (RuntimeException e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    @PutMapping("/mcq/{questionId}")
    public ResponseEntity<?> updateMCQQuestion(@PathVariable Long questionId, @RequestBody QuestionMCQ question) {
        try { return ResponseEntity.ok(questionService.updateMCQQuestion(questionId, question)); }
        catch (RuntimeException e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    @GetMapping("/mcq/contest/{contestId}")
    public ResponseEntity<List<QuestionMCQ>> getContestMCQQuestions(@PathVariable Long contestId) {
        return ResponseEntity.ok(questionService.getMCQQuestionsByContest(contestId));
    }

    // --- NEW: Delete MCQ Question ---
    @DeleteMapping("/mcq/{questionId}")
    public ResponseEntity<?> deleteMCQQuestion(@PathVariable Long questionId) {
        questionService.deleteMCQQuestion(questionId);
        return ResponseEntity.ok("Deleted");
    }

    // --- NEW: Delete All Questions for Contest ---
    @DeleteMapping("/contest/{contestId}/all")
    public ResponseEntity<?> deleteAllQuestions(@PathVariable Long contestId) {
        questionService.deleteAllQuestions(contestId);
        return ResponseEntity.ok("All questions deleted");
    }
}