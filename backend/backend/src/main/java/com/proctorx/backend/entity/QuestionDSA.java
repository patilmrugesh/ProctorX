package com.proctorx.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;

@Entity
@Table(name = "questions_dsa")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QuestionDSA {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "question_id")
    private Long questionId;

    @ManyToOne
    @JoinColumn(name = "contest_id", nullable = false)
    @JsonIgnore
    private Contest contest;

    @Column(nullable = false)
    private String title;

    @Column(name = "problem_statement", nullable = false, columnDefinition = "TEXT")
    private String problemStatement;

    @Column(name = "input_format", columnDefinition = "TEXT")
    private String inputFormat;

    @Column(name = "output_format", columnDefinition = "TEXT")
    private String outputFormat;

    @Column(columnDefinition = "TEXT")
    private String constraints;

    private String difficulty;

    @Column(name = "time_limit_sec")
    private Double timeLimitSec = 600.0;

    @Column(name = "timer_sec", nullable = false)
    private Integer timer = 60;


    @Column(name = "memory_limit_mb")
    private Integer memoryLimitMb = 256;

    // --- NEW: Custom Marks for DSA (Default 5) ---
    @Column(name = "marks")
    private Integer marks = 5;

    @OneToMany(mappedBy = "questionDSA", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TestCase> testCases;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Submission> submissions;
}