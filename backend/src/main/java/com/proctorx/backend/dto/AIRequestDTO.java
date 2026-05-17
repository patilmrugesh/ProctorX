package com.proctorx.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AIRequestDTO {
    @NotBlank(message = "Problem statement is required")
    private String problemStatement;

    @NotBlank(message = "Input format is required")
    private String inputFormat;

    @NotBlank(message = "Output format is required")
    private String outputFormat;

    private String constraints;

    private String exampleInput;

    private String exampleOutput;

    @NotNull(message = "Number of test cases is required")
    private Integer numberOfTestCases;
}