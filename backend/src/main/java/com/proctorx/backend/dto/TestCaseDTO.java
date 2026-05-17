package com.proctorx.backend.dto;

import lombok.Data;

@Data
public class TestCaseDTO {
    private String input;
    private String expectedOutput;
    private Boolean isHidden;  // true = hidden test case, false = sample test case
}