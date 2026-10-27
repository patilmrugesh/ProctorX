package com.proctorx.backend.repository;

import com.proctorx.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Used for logging in
    Optional<User> findByEmail(String email);

    // Used for registration check
    boolean existsByEmail(String email);
}