package com.proctorx.backend.dto;

import lombok.Data;
import java.util.Map;

@Data
public class SubmitExamRequest {
    private Long userId;
    private Long contestId;
    private Map<Long, String> mcqAnswers; // { questionId: "A" }
}