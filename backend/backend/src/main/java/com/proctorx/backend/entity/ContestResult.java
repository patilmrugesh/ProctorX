package com.proctorx.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "contest_results")
@Data
public class ContestResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "contest_id")
    private Contest contest;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private int mcqScore;
    private int dsaScore;
    private int totalScore;

    private LocalDateTime submittedAt = LocalDateTime.now();
}