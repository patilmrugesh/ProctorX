package com.proctorx.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnore; // Import this

@Entity
@Table(name = "questions_mcq")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QuestionMCQ {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "mcq_id")
    private Long mcqId;

    // FIX: Add @JsonIgnore to prevent recursion (Question -> Contest -> List<Question>...)
    @ManyToOne
    @JoinColumn(name = "contest_id", nullable = false)
    @JsonIgnore
    private Contest contest;

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "option_a", nullable = false)
    private String optionA;

    @Column(name = "option_b", nullable = false)
    private String optionB;

    @Column(name = "option_c")
    private String optionC;

    @Column(name = "option_d")
    private String optionD;

    @Column(name = "correct_option", nullable = false, length = 1)
    private String correctOption;

    private Integer marks = 2; // Default marks

    @Column(name = "timer_sec", nullable = false)
    private Integer timer = 60;

}