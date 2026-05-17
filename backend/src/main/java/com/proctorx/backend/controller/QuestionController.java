package com.proctorx.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.proctorx.backend.dto.AIGeneratedQuestionDTO;
import com.proctorx.backend.dto.AIRequestDTO;
import com.proctorx.backend.dto.AITestCaseRequest;
import com.proctorx.backend.dto.TestCaseDTO;
import com.proctorx.backend.entity.QuestionDSA;
import com.proctorx.backend.entity.QuestionMCQ;
import com.proctorx.backend.entity.TestCase;
import com.proctorx.backend.service.GroqService;
import com.proctorx.backend.service.QuestionService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/questions")
@CrossOrigin(origins = "*")
public class QuestionController {

    @Autowired
    private QuestionService questionService;
    @Autowired
    private GroqService groqService;

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

    @PostMapping("/ai/generate-dsa")
    public ResponseEntity<?> generateDSAQuestionWithAI(@Valid @RequestBody AIRequestDTO request) {
        try {
            // Validate request
            if (request.getProblemStatement() == null || request.getProblemStatement().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Problem statement is required"));
            }

            if (request.getInputFormat() == null || request.getInputFormat().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Input format is required"));
            }

            if (request.getOutputFormat() == null || request.getOutputFormat().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Output format is required"));
            }

            if (request.getNumberOfTestCases() == null || request.getNumberOfTestCases() <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Number of test cases must be greater than 0"));
            }

            // Call Groq service to generate question
            AIGeneratedQuestionDTO generatedQuestion = groqService.generateDSAQuestion(request);

            return ResponseEntity.ok(generatedQuestion);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate question: " + e.getMessage()));
        }
    }
    @PostMapping("/ai/test-json")
    public ResponseEntity<?> testJsonParsing(@RequestBody String rawJson) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            Object json = mapper.readValue(rawJson, Object.class);
            return ResponseEntity.ok(Map.of(
                    "status", "valid",
                    "parsed", json
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "invalid",
                    "error", e.getMessage()
            ));
        }
    }
    @PostMapping("/ai/generate-test-cases")
    public ResponseEntity<?> generateTestCases(@RequestBody Map<String, Object> requestMap) {
        try {
            System.out.println("Received request: " + requestMap);

            // Manually extract values to avoid deserialization issues
            String problemStatement = (String) requestMap.get("problemStatement");
            String inputFormat = (String) requestMap.getOrDefault("inputFormat", "");
            String outputFormat = (String) requestMap.getOrDefault("outputFormat", "");
            String constraints = (String) requestMap.getOrDefault("constraints", "");

            List<Map<String, Object>> existingCasesList = (List<Map<String, Object>>) requestMap.getOrDefault("existingTestCases", new ArrayList<>());
            Integer numberOfTestCases = (Integer) requestMap.getOrDefault("numberOfTestCases", 5);

            // Build the request object manually
            AITestCaseRequest request = new AITestCaseRequest();
            request.setProblemStatement(problemStatement);
            request.setInputFormat(inputFormat);
            request.setOutputFormat(outputFormat);
            request.setConstraints(constraints);
            request.setNumberOfTestCases(numberOfTestCases);

            List<AITestCaseRequest.ExistingTestCaseDTO> existingCases = new ArrayList<>();
            for (Map<String, Object> caseMap : existingCasesList) {
                AITestCaseRequest.ExistingTestCaseDTO dto = new AITestCaseRequest.ExistingTestCaseDTO();
                dto.setInput((String) caseMap.getOrDefault("input", ""));
                dto.setExpectedOutput((String) caseMap.getOrDefault("expectedOutput", ""));
                dto.setIsHidden((Boolean) caseMap.getOrDefault("isHidden", true));
                existingCases.add(dto);
            }
            request.setExistingTestCases(existingCases);

            List<TestCaseDTO> generatedTestCases = groqService.generateAdditionalTestCases(request);

            return ResponseEntity.ok(Map.of(
                    "testCases", generatedTestCases,
                    "count", generatedTestCases.size()
            ));

        } catch (Exception e) {
            System.err.println("Error generating test cases: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to generate test cases: " + e.getMessage()
            ));
        }
    }

}