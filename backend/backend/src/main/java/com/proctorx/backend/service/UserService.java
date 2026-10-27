package com.proctorx.backend.service;

import com.proctorx.backend.entity.User;
import com.proctorx.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public User registerUser(User user) {
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new RuntimeException("Email already exists");
        }
        // Encrypt password before saving
        user.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        return userRepository.save(user);
    }

    public User loginUser(String email, String rawPassword) {
        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            // Match raw password with encoded hash
            if (passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
                return user;
            }
        }
        return null; // Return null if login fails
    }

    public User getUserById(Long id) {
        return userRepository.findById(id).orElse(null);
    }
}