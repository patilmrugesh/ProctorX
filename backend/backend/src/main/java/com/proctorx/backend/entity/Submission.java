package com.proctorx.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "submissions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Submission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "contest_id")
    private Contest contest;

    @ManyToOne
    @JoinColumn(name = "question_id")
    private QuestionDSA question;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String code;

    @Column(nullable = false)
    private String language; // "CPP", "PYTHON"

    private String verdict; // "AC", "WA", "TLE", "CE", "RE" (Runtime Error)

    @Column(name = "execution_time")
    private Double executionTime; // In milliseconds

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt = LocalDateTime.now();
}