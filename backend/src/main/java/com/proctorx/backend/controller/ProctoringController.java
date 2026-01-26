package com.proctorx.backend.controller;
import com.proctorx.backend.dto.ProctorEvent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.time.LocalDateTime;

@Controller
@CrossOrigin(origins = "*")
public class ProctoringController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/contest/{contestId}/alert")
    public void handleAlert(@DestinationVariable Long contestId, @Payload ProctorEvent event) {
        try {
            event.setTimestamp(LocalDateTime.now().toString());
            event.setContestId(contestId);

            if (!"CAMERA_FRAME".equals(event.getType())) {
                System.out.println("ALERT: " + event.getType() + " from " + event.getUsername());
            } else {
                // Log image size to debug
                if (event.getImage() != null) {
                    System.out.println("Frame size: " + event.getImage().length() + " bytes");
                }
            }

            messagingTemplate.convertAndSend("/topic/contest/" + contestId + "/judge", event);
        } catch (Exception e) {
            System.err.println("Error handling alert: " + e.getMessage());
            e.printStackTrace();
        }
    }
    // --- NEW: Handle Judge Actions (Warn/Suspend) ---
    @MessageMapping("/contest/{contestId}/judge-action")
    public void handleJudgeAction(@DestinationVariable Long contestId, @org.springframework.messaging.handler.annotation.Payload java.util.Map<String, Object> action) {
        // action contains: type (WARN/SUSPEND), targetUserId
        // We broadcast this to a specific student's topic
        if (action.containsKey("targetUserId")) {
            String targetUserId = action.get("targetUserId").toString();
            messagingTemplate.convertAndSend("/topic/contest/" + contestId + "/student/" + targetUserId, (Object) action);
        }
    }

}
