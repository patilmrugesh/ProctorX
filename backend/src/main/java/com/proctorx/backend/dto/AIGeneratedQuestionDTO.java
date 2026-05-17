package com.proctorx.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class AIGeneratedQuestionDTO {
    private String title;
    private String problemStatement;
    private String inputFormat;
    private String outputFormat;
    private String constraints;
    private List<TestCaseDTO> testCases;
}