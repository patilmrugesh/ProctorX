package com.proctorx.backend.repository;

import com.proctorx.backend.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    // Get all submissions by a user in a specific contest (History)
    List<Submission> findByUser_UserIdAndContest_ContestId(Long userId, Long contestId);
}