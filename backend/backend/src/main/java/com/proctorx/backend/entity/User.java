package com.proctorx.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    // CHANGE: Removed 'unique = true'. Now multiple users can have the same name.
    @Column(nullable = false)
    private String username;

    // KEPT: Email must still be unique for login purposes.
    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    // Role: 'ADMIN', 'STUDENT', 'JUDGE'
    @Column(nullable = false)
    private String role;

    // --- Profile Data (For Students) ---
    private String phone;
    private String gender;
    private String city;
    @Column(name = "college_name")
    private String collegeName;
    @Column(name = "graduation_year")
    private Integer graduationYear;

    // --- Business Data (For Admins) ---
    @Column(name = "wallet_credits")
    private Integer walletCredits = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        // New Admins get 5 free credits automatically
        if ("ADMIN".equalsIgnoreCase(this.role) && (this.walletCredits == null || this.walletCredits == 0)) {
            this.walletCredits = 5;
        }
    }
}