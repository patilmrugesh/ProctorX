package com.proctorx.backend.repository;

import com.proctorx.backend.entity.ContestResult;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ContestResultRepository extends JpaRepository<ContestResult, Long> {
    // Fetch results for a contest, ordered by score descending (Leaderboard)
    List<ContestResult> findByContest_ContestIdOrderByTotalScoreDesc(Long contestId);

    // Check if user already submitted
    boolean existsByContest_ContestIdAndUser_UserId(Long contestId, Long userId);
}