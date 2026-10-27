package com.proctorx.backend.repository;

import com.proctorx.backend.entity.QuestionDSA;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuestionDSARepository extends JpaRepository<QuestionDSA, Long> {
    // Fetch all questions for a specific contest
    List<QuestionDSA> findByContest_ContestId(Long contestId);
}