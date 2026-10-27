package com.proctorx.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class GroqRequestDTO {
    private String model;
    private List<Message> messages;
    private double temperature = 0.7;
    private String responseFormat = "json_object";

    @Data
    public static class Message {
        private String role;
        private String content;

        public Message(String role, String content) {
            this.role = role;
            this.content = content;
        }
    }
}