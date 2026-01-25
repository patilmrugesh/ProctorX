package com.proctorx.backend.controller;

import com.proctorx.backend.dto.SubmitExamRequest;
import com.proctorx.backend.entity.Contest;
import com.proctorx.backend.service.ContestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/contests")
@CrossOrigin(origins = "*")
public class ContestController {

    @Autowired private ContestService contestService;

    @PostMapping("/create")
    public ResponseEntity<?> createContest(@RequestParam Long adminId, @RequestBody Contest contest) {
        try { return ResponseEntity.ok(contestService.createContest(adminId, contest)); }
        catch (RuntimeException e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    @GetMapping("/admin/{adminId}")
    public ResponseEntity<List<Contest>> getAdminContests(@PathVariable Long adminId) {
        return ResponseEntity.ok(contestService.getContestsByAdmin(adminId));
    }

    @DeleteMapping("/{contestId}")
    public ResponseEntity<?> deleteContest(@PathVariable Long contestId) {
        contestService.deleteContest(contestId);
        return ResponseEntity.ok("Deleted");
    }

    @PutMapping("/{contestId}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long contestId, @RequestParam String status) {
        return ResponseEntity.ok(contestService.updateStatus(contestId, status));
    }

    @PostMapping("/{contestId}/upload-users")
    public ResponseEntity<?> uploadUsers(@PathVariable Long contestId, @RequestParam("file") MultipartFile file) {
        try { return ResponseEntity.ok(contestService.uploadAllowedEmails(contestId, file)); }
        catch (Exception e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    @GetMapping("/join/{token}")
    public ResponseEntity<?> joinContest(@PathVariable String token, @RequestParam String email) {
        try { return ResponseEntity.ok(contestService.joinContest(token, email)); }
        catch (RuntimeException e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    @GetMapping("/judge/join/{token}")
    public ResponseEntity<?> joinJudge(@PathVariable String token) {
        try { return ResponseEntity.ok(contestService.joinContestAsJudge(token)); }
        catch (RuntimeException e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    // --- NEW: Submit Exam ---
    @PostMapping("/submit")
    public ResponseEntity<?> submitExam(@RequestBody SubmitExamRequest request) {
        try { return ResponseEntity.ok(contestService.submitExam(request)); }
        catch (Exception e) { return ResponseEntity.badRequest().body(e.getMessage()); }
    }

    // --- NEW: Leaderboard ---
    @GetMapping("/{contestId}/leaderboard")
    public ResponseEntity<?> getLeaderboard(@PathVariable Long contestId) {
        return ResponseEntity.ok(contestService.getLeaderboard(contestId));
    }
}