package com.proctorx.backend.repository;

import com.proctorx.backend.entity.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, Long> {
    List<TestCase> findByQuestionDSA_QuestionId(Long questionId);
}