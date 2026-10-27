package com.proctorx.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class AITestCaseRequest {
    private Long questionId;
    private String problemStatement;
    private String inputFormat;
    private String outputFormat;
    private String constraints;
    private List<ExistingTestCaseDTO> existingTestCases;
    private Integer numberOfTestCases = 5;

    @Data
    public static class ExistingTestCaseDTO {
        private String input;
        private String expectedOutput;
        private Boolean isHidden = true; // Set default value to true
    }
}