package com.proctorx.backend.repository;

import com.proctorx.backend.entity.Contest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContestRepository extends JpaRepository<Contest, Long> {
    // Find all contests created by a specific admin
    List<Contest> findByAdmin_UserId(Long adminId);

    // Find a contest by the student token (for login)
    Optional<Contest> findByStudentToken(String token);

    // Find a contest by the judge token
    Optional<Contest> findByJudgeToken(String token);
}