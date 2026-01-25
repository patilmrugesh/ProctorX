package com.proctorx.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class DockerService {

    @Value("${proctorx.code.temp-dir}")
    private String tempDirBase;

    // Free Code Execution API (Piston)
    private static final String PISTON_API_URL = "https://emkc.org/api/v2/piston/execute";

    public String runCode(String code, String language, String inputData, Double timeLimitSec) {

        // --- LOGIC: CHECK DAEMON STATUS ---
        // If Docker Daemon is actually running (accepting commands), use it.
        if (isDockerDaemonRunning()) {
            System.out.println("✅ Docker Daemon is UP. Running locally...");
            try {
                return runLocalDocker(code, language, inputData, timeLimitSec);
            } catch (Exception e) {
                System.err.println("❌ Docker crashed during execution. Falling back to API. Error: " + e.getMessage());
                // Fallthrough to API logic below
            }
        } else {
            System.out.println("⚠️ Docker Daemon is DOWN or Missing. Using Piston API...");
        }

        // --- FALLBACK: PISTON API ---
        return runPistonApi(code, language, inputData);
    }

    // ==========================================
    // STRATEGY 1: PISTON API (Cloud/Fallback)
    // ==========================================
    private String runPistonApi(String code, String language, String input) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            String pistonLang;
            String version;

            if ("PYTHON".equalsIgnoreCase(language)) {
                pistonLang = "python";
                version = "3.10.0";
            } else if ("CPP".equalsIgnoreCase(language)) {
                pistonLang = "c++";
                version = "10.2.0";
            } else if ("JAVA".equalsIgnoreCase(language)) {
                pistonLang = "java";
                version = "15.0.2";
            } else {
                return "Error: Unsupported Language";
            }

            Map<String, Object> payload = new HashMap<>();
            payload.put("language", pistonLang);
            payload.put("version", version);

            List<Map<String, String>> files = new ArrayList<>();
            Map<String, String> file = new HashMap<>();
            file.put("content", code);
            files.add(file);
            payload.put("files", files);

            payload.put("stdin", input != null ? input : "");

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(PISTON_API_URL, request, Map.class);
            Map<String, Object> body = response.getBody();

            if (body != null && body.containsKey("run")) {
                Map<String, Object> run = (Map<String, Object>) body.get("run");
                String stdout = (String) run.get("stdout");
                String stderr = (String) run.get("stderr");

                if (stderr != null && !stderr.isEmpty()) {
                    return "Runtime Error:\n" + stderr;
                }
                return stdout != null ? stdout.trim() : "";
            }
            return "Error: External API failed to execute code.";

        } catch (Exception e) {
            e.printStackTrace();
            return "Server Error: Could not connect to Execution API.";
        }
    }

    // ==========================================
    // STRATEGY 2: LOCAL DOCKER (Localhost)
    // ==========================================
    private String runLocalDocker(String code, String language, String inputData, Double timeLimitSec) throws IOException, InterruptedException {
        String folderName = UUID.randomUUID().toString();
        Path folderPath = Paths.get(tempDirBase, folderName);
        Files.createDirectories(folderPath);

        File codeFile;
        if ("CPP".equalsIgnoreCase(language)) {
            codeFile = new File(folderPath.toFile(), "Solution.cpp");
        } else if ("JAVA".equalsIgnoreCase(language)) {
            codeFile = new File(folderPath.toFile(), "Main.java");
        } else {
            codeFile = new File(folderPath.toFile(), "Solution.py");
        }
        Files.writeString(codeFile.toPath(), code);

        String absolutePath = folderPath.toAbsolutePath().toString();
        ProcessBuilder builder = new ProcessBuilder();

        if ("PYTHON".equalsIgnoreCase(language)) {
            builder.command("docker", "run", "-i", "--rm", "-v", absolutePath + ":/app", "python:3.9-alpine", "python", "/app/Solution.py");
        } else if ("CPP".equalsIgnoreCase(language)) {
            builder.command("docker", "run", "-i", "--rm", "-v", absolutePath + ":/app", "gcc:latest", "sh", "-c", "g++ -o /app/out /app/Solution.cpp && /app/out");
        } else if ("JAVA".equalsIgnoreCase(language)) {
            builder.command("docker", "run", "-i", "--rm", "-v", absolutePath + ":/app", "openjdk:17-alpine", "sh", "-c", "javac /app/Main.java && java -cp /app Main");
        } else {
            return "Error: Unsupported Language";
        }

        builder.redirectErrorStream(true);
        Process process = builder.start();

        if (inputData != null) {
            try (OutputStream os = process.getOutputStream();
                 BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(os))) {
                writer.write(inputData);
                writer.flush();
            } catch (IOException e) {
                // Ignore broken pipe if process finished early
            }
        }

        // Add 5s overhead buffer for Docker startup
        long totalWaitTime = (long) Math.ceil(timeLimitSec + 5);
        boolean finished = process.waitFor(totalWaitTime, TimeUnit.SECONDS);

        if (!finished) {
            process.destroy();
            return "TLE: Time Limit Exceeded";
        }

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        try { deleteDirectory(folderPath.toFile()); } catch (Exception e) {}
        return output.toString().trim();
    }

    // ==========================================
    // CHECKER: IS DOCKER DAEMON RUNNING?
    // ==========================================
    private boolean isDockerDaemonRunning() {
        try {
            // 'docker info' actually talks to the daemon.
            // 'docker -v' only checks if CLI is installed.
            Process process = new ProcessBuilder("docker", "info").start();
            boolean finished = process.waitFor(2, TimeUnit.SECONDS);
            return finished && process.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private void deleteDirectory(File directory) {
        File[] allContents = directory.listFiles();
        if (allContents != null) {
            for (File file : allContents) {
                deleteDirectory(file);
            }
        }
        directory.delete();
    }
}