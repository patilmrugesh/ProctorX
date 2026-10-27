package com.proctorx.backend.dto;

import lombok.Data;

@Data
public class ExecutionResponse {
    private String verdict; // "AC", "WA", "TLE", "CE", "RE"
    private String output;  // The actual output (or error message)
    private Double executionTime;
    private int casesPassed;
    private int totalCases;
}