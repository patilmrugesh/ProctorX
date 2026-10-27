package com.proctorx.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProctorEvent {
    private String type; // "TAB_SWITCH", "ONLINE", "CAMERA_FRAME"
    private Long userId;
    private String username;
    private Long contestId;
    private String message;
    private String timestamp;

    // --- NEW: Holds the Base64 Image String ---
    private String image;
}