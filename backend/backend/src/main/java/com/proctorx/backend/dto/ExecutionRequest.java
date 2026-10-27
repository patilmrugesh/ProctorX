package com.proctorx.backend.dto;

import lombok.Data;

@Data
public class ExecutionRequest {
    private String code;
    private String language; // "CPP", "PYTHON"
    private Long questionId; // Backend uses this to fetch Test Cases
    private Long userId;
    private Long contestId;
}