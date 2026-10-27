package com.proctorx.backend.repository;

import com.proctorx.backend.entity.QuestionMCQ;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuestionMCQRepository extends JpaRepository<QuestionMCQ, Long> {
    List<QuestionMCQ> findByContest_ContestId(Long contestId);
}