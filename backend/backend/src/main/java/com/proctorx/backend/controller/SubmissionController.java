package com.proctorx.backend.controller;

import com.proctorx.backend.dto.ExecutionRequest;
import com.proctorx.backend.dto.ExecutionResponse;
import com.proctorx.backend.service.SubmissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/submissions")
@CrossOrigin(origins = "*")
public class SubmissionController {

    @Autowired
    private SubmissionService submissionService;

    @PostMapping("/run")
    public ResponseEntity<ExecutionResponse> runCode(@RequestBody ExecutionRequest request) {
        return ResponseEntity.ok(submissionService.runCode(request));
    }
}