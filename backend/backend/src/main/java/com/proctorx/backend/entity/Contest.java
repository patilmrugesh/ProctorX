package com.proctorx.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "contests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Contest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "contest_id")
    private Long contestId;

    @ManyToOne
    @JoinColumn(name = "admin_id", nullable = false)
    private User admin;

    @Column(nullable = false)
    private String title;

    private String description;

    @Column(nullable = false)
    private String type;

    private String status = "DRAFT";

    @Column(name = "student_token", unique = true)
    private String studentToken;

    @Column(name = "judge_token", unique = true)
    private String judgeToken;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    // --- NEW: End Time for the overall contest window ---
    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "timer_type")
    private String timerType = "OVERALL"; // "OVERALL" or "PER_QUESTION"

    @Column(name = "question_timer_seconds")
    private Integer questionTimerSeconds;

    @ElementCollection
    @CollectionTable(name = "contest_allowed_emails", joinColumns = @JoinColumn(name = "contest_id"))
    @Column(name = "email")
    private List<String> allowedEmails = new ArrayList<>();

    @OneToMany(mappedBy = "contest", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<QuestionDSA> dsaQuestions;

    @OneToMany(mappedBy = "contest", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<QuestionMCQ> mcqQuestions;

    @OneToMany(mappedBy = "contest", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Submission> submissions;

    @OneToMany(mappedBy = "contest", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<ContestResult> results;
}