package com.proctorx.backend.controller;

import com.proctorx.backend.entity.User;
import com.proctorx.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserService userService;

    // --- NEW: Fetch Fresh User Data (Sync Credits) ---
    @GetMapping("/user/{id}")
    public ResponseEntity<?> getUserProfile(@PathVariable Long id) {
        User user = userService.getUserById(id); // Ensure this method exists in your UserService
        if (user != null) {
            Map<String, Object> response = new HashMap<>();
            response.put("userId", user.getUserId());
            response.put("walletCredits", user.getWalletCredits());
            response.put("username", user.getUsername());
            response.put("email", user.getEmail());
            response.put("role", user.getRole());
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(404).body("User not found");
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        try {
            User newUser = userService.registerUser(user);
            return ResponseEntity.ok(newUser);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> loginData) {
        String email = loginData.get("email");
        String password = loginData.get("password");

        User user = userService.loginUser(email, password);

        if (user != null) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Login Successful");
            response.put("role", user.getRole());
            response.put("userId", user.getUserId());
            response.put("walletCredits", user.getWalletCredits());
            // --- FIX: Send Email to Frontend ---
            response.put("username", user.getUsername());
            response.put("email", user.getEmail());

            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(401).body("Invalid Credentials");
        }
    }
}