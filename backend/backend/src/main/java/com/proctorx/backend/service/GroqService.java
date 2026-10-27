package com.proctorx.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.proctorx.backend.dto.AIRequestDTO;
import com.proctorx.backend.dto.AIGeneratedQuestionDTO;
import com.proctorx.backend.dto.AITestCaseRequest;
import com.proctorx.backend.dto.TestCaseDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class GroqService {

    @Value("${groq.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    // ── gemma2-9b-it is decommissioned; replaced with mixtral ──
    private final List<String> WORKING_MODELS = Arrays.asList(
            "llama-3.3-70b-versatile",
            "mixtral-8x7b-32768",       // large context, good fallback
            "llama-3.1-8b-instant"      // last resort — prompt is trimmed for this one
    );

    // Cap test cases per API call to avoid blowing the free-tier TPM limit
    private static final int MAX_TC_PER_CALL  = 5;
    private static final int MAX_PARSE_RETRIES = 2;

    public GroqService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    // ─────────────────────────────────────────────
    // PUBLIC ENTRY POINT
    // ─────────────────────────────────────────────
    public AIGeneratedQuestionDTO generateDSAQuestion(AIRequestDTO request) {
        int total = request.getNumberOfTestCases();
        int batch = Math.min(total, MAX_TC_PER_CALL);

        // First call — always capped at MAX_TC_PER_CALL to stay within TPM
        AIRequestDTO trimmed = cloneWithTestCaseCount(request, batch);
        String prompt = buildPrompt(trimmed, batch);
        AIGeneratedQuestionDTO result = callWithRetry(prompt, trimmed);

        // If more test cases were requested, fetch the remainder in a smaller call
        if (total > batch) {
            List<TestCaseDTO> extra = fetchExtraTestCases(result, total - batch);
            result.getTestCases().addAll(extra);
            enforceTestCaseRules(result.getTestCases());
            if (result.getTestCases().size() > total) {
                result.setTestCases(new ArrayList<>(result.getTestCases().subList(0, total)));
            }
        }

        return result;
    }

    // ─────────────────────────────────────────────
    // PROMPT  — compact to stay under token limits
    // ─────────────────────────────────────────────
    private String buildPrompt(AIRequestDTO req, int tcCount) {
        int visible = Math.min(2, tcCount);
        int hidden  = tcCount - visible;

        return "Generate a DSA problem as JSON.\n" +
                "RULES (read carefully):\n" +
                "1. Output ONLY a valid JSON object — no markdown, no prose, no code fences.\n" +
                "2. Every JSON value must be a plain string or boolean — NEVER a nested object or array.\n" +
                "3. testCases[].input and testCases[].expectedOutput MUST be plain strings.\n" +
                "4. First " + visible + " test case(s): isHidden=false. Next " + hidden + ": isHidden=true (edge cases).\n\n" +
                "Problem topic  : " + req.getProblemStatement() + "\n" +
                "Input format   : " + req.getInputFormat() + "\n" +
                "Output format  : " + req.getOutputFormat() + "\n" +
                (notEmpty(req.getConstraints())   ? "Constraints    : " + req.getConstraints()   + "\n" : "") +
                (notEmpty(req.getExampleInput())  ? "Example input  : " + req.getExampleInput()  + "\n" : "") +
                (notEmpty(req.getExampleOutput()) ? "Example output : " + req.getExampleOutput() + "\n" : "") +
                "Test cases needed: " + tcCount + "\n\n" +
                "JSON schema to follow exactly:\n" +
                "{\n" +
                "  \"title\": \"string\",\n" +
                "  \"problemStatement\": \"string\",\n" +
                "  \"inputFormat\": \"string\",\n" +
                "  \"outputFormat\": \"string\",\n" +
                "  \"constraints\": \"string\",\n" +
                "  \"testCases\": [\n" +
                "    {\"input\": \"<real input data string>\", \"expectedOutput\": \"<real output string>\", \"isHidden\": false},\n" +
                "    {\"input\": \"<real input data string>\", \"expectedOutput\": \"<real output string>\", \"isHidden\": true}\n" +
                "  ]\n" +
                "}\n";
    }

    private String buildExtraTestCasesPrompt(AIGeneratedQuestionDTO existing, int count) {
        return "Problem: \"" + existing.getTitle() + "\"\n" +
                existing.getProblemStatement() + "\n" +
                "Input: " + existing.getInputFormat() + "\n" +
                "Output: " + existing.getOutputFormat() + "\n\n" +
                "Generate " + count + " hidden edge-case test cases as a JSON ARRAY ONLY:\n" +
                "[{\"input\": \"string\", \"expectedOutput\": \"string\", \"isHidden\": true}]\n" +
                "All values must be plain strings. Output ONLY the array.";
    }

    // ─────────────────────────────────────────────
    // RETRY ORCHESTRATION
    // ─────────────────────────────────────────────
    private AIGeneratedQuestionDTO callWithRetry(String originalPrompt, AIRequestDTO request) {
        Exception lastException = null;

        for (String model : WORKING_MODELS) {
            String prompt = model.equals("llama-3.1-8b-instant")
                    ? trimPromptForSmallModel(originalPrompt)
                    : originalPrompt;

            for (int attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
                try {
                    System.out.printf("🤖 Model: %s  |  Attempt: %d%n", model, attempt);
                    String raw = callGroqAPI(prompt, model);
                    AIGeneratedQuestionDTO result = parseAndValidate(raw, request);
                    System.out.printf("✅ Success — model: %s, attempt: %d%n", model, attempt);
                    return result;

                } catch (JsonParseException e) {
                    System.err.printf("⚠️  JSON parse failed [%s, attempt %d]: %s%n",
                            model, attempt, e.getMessage());
                    lastException = e;
                    if (attempt < MAX_PARSE_RETRIES) {
                        prompt = buildRepairPrompt(e.getRawResponse());
                    }

                } catch (HttpClientErrorException e) {
                    String body = e.getResponseBodyAsString();
                    System.err.printf("❌ HTTP %s [%s]: %s%n",
                            e.getStatusCode(), model,
                            body.length() > 300 ? body.substring(0, 300) : body);
                    lastException = e;
                    if (e.getStatusCode().value() == 429) sleepQuietly(2000);
                    break; // try next model

                } catch (Exception e) {
                    System.err.printf("❌ Model %s failed: %s%n", model, e.getMessage());
                    lastException = e;
                    break;
                }
            }
        }

        throw new RuntimeException("All Groq models exhausted. Last error: " +
                (lastException != null ? lastException.getMessage() : "unknown"), lastException);
    }

    private List<TestCaseDTO> fetchExtraTestCases(AIGeneratedQuestionDTO existing, int count) {
        try {
            String prompt = buildExtraTestCasesPrompt(existing, count);
            String raw    = callGroqAPI(prompt, WORKING_MODELS.get(0));
            return parseTestCaseArray(raw);
        } catch (Exception e) {
            System.err.println("⚠️ Extra test-case fetch failed: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    // ─────────────────────────────────────────────
    // GROQ API CALL
    // ─────────────────────────────────────────────
    private String callGroqAPI(String prompt, String model) throws Exception {
        String url = "https://api.groq.com/openai/v1/chat/completions";

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("temperature", 0.3);
        body.put("max_tokens", 2048);  // was 8192 — reduced to prevent token-limit errors
        body.put("response_format", Map.of("type", "json_object")); // forces JSON mode

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system",
                "content", "You generate DSA problems as JSON. " +
                        "All testCases[].input and testCases[].expectedOutput values are plain strings. " +
                        "Never use nested objects or arrays inside testCases."));
        messages.add(Map.of("role", "user", "content", prompt));
        body.put("messages", messages);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST,
                new HttpEntity<>(objectMapper.writeValueAsString(body), headers),
                String.class);

        Map<String, Object> responseMap = objectMapper.readValue(response.getBody(), Map.class);
        List<Map<String, Object>> choices = (List<Map<String, Object>>) responseMap.get("choices");
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        return (String) message.get("content");
    }

    // ─────────────────────────────────────────────
    // JSON CLEANING
    // ─────────────────────────────────────────────
    private String cleanJsonResponse(String raw) {
        if (raw == null) return "";
        String s = raw.trim()
                .replaceAll("(?s)```json\\s*", "")
                .replaceAll("(?s)```\\s*", "");

        int depth = 0, start = -1, end = -1;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if      (c == '{') { if (depth == 0) start = i; depth++; }
            else if (c == '}') { depth--; if (depth == 0 && start != -1) { end = i; break; } }
        }
        if (start != -1 && end != -1) s = s.substring(start, end + 1);

        return s.replaceAll(",\\s*([}\\]])", "$1").trim();
    }

    // ─────────────────────────────────────────────
    // PARSE + VALIDATE
    // THE KEY FIX: flattenToString() handles nested objects before DTO binding
    // ─────────────────────────────────────────────
    private AIGeneratedQuestionDTO parseAndValidate(String raw, AIRequestDTO request)
            throws JsonParseException {

        String cleaned = cleanJsonResponse(raw);
        if (cleaned.isEmpty() || !cleaned.startsWith("{")) {
            throw new JsonParseException("Response is not a JSON object", raw);
        }

        // Step 1: parse into a tree
        JsonNode root;
        try {
            root = objectMapper.readTree(cleaned);
        } catch (Exception e) {
            throw new JsonParseException("readTree failed: " + e.getMessage(), raw);
        }

        // Step 2: flatten any nested input/expectedOutput objects BEFORE binding
        if (root.has("testCases") && root.get("testCases").isArray()) {
            ArrayNode fixedArr = objectMapper.createArrayNode();
            for (JsonNode tc : root.get("testCases")) {
                ObjectNode fixedTc = objectMapper.createObjectNode();
                fixedTc.put("input",          flattenToString(tc.get("input")));
                fixedTc.put("expectedOutput", flattenToString(tc.get("expectedOutput")));
                fixedTc.put("isHidden",
                        tc.has("isHidden") && tc.get("isHidden").isBoolean()
                                && tc.get("isHidden").booleanValue());
                fixedArr.add(fixedTc);
            }
            ((ObjectNode) root).set("testCases", fixedArr);
        }

        // Step 3: bind to DTO
        AIGeneratedQuestionDTO result;
        try {
            result = objectMapper.treeToValue(root, AIGeneratedQuestionDTO.class);
        } catch (Exception e) {
            throw new JsonParseException("DTO bind failed: " + e.getMessage(), raw);
        }

        // Step 4: fill defaults
        if (isBlank(result.getTitle()))            result.setTitle(deriveTitleFrom(request.getProblemStatement()));
        if (isBlank(result.getProblemStatement()))  result.setProblemStatement(request.getProblemStatement());
        else                                        result.setProblemStatement(stripMarkdown(result.getProblemStatement()));
        if (isBlank(result.getInputFormat()))       result.setInputFormat(request.getInputFormat());
        if (isBlank(result.getOutputFormat()))      result.setOutputFormat(request.getOutputFormat());
        if (isBlank(result.getConstraints()))       result.setConstraints(
                notEmpty(request.getConstraints()) ? request.getConstraints() : "1 <= N <= 10^5");

        // Step 5: normalise test cases
        int expected = request.getNumberOfTestCases();
        List<TestCaseDTO> tcs = result.getTestCases() == null ? new ArrayList<>() : new ArrayList<>(result.getTestCases());
        tcs.removeIf(this::isPlaceholder);
        while (tcs.size() < expected) tcs.add(emptyTestCase(tcs.size()));
        if (tcs.size() > expected)    tcs = tcs.subList(0, expected);
        enforceTestCaseRules(tcs);
        result.setTestCases(tcs);

        System.out.printf("📊 Test cases — total: %d | visible: %d | hidden: %d%n",
                tcs.size(),
                tcs.stream().filter(tc -> !tc.getIsHidden()).count(),
                tcs.stream().filter(TestCaseDTO::getIsHidden).count());

        return result;
    }

    /**
     * Converts a JsonNode (which may be a String, Number, nested Object, or Array)
     * into a flat plain string.  This is the core fix for the
     * "Cannot deserialize String from Object" error.
     */
    private String flattenToString(JsonNode node) {
        if (node == null || node.isNull())   return "";
        if (node.isTextual())                return node.asText();
        if (node.isNumber() || node.isBoolean()) return node.asText();

        if (node.isObject()) {
            // Try common field names the LLM uses for nested inputs
            for (String key : new String[]{"value", "data", "input", "text", "content", "string"}) {
                if (node.has(key) && node.get(key).isTextual()) return node.get(key).asText();
            }
            // Grab first text-valued field
            Iterator<Map.Entry<String, JsonNode>> it = node.fields();
            while (it.hasNext()) {
                JsonNode v = it.next().getValue();
                if (v.isTextual()) return v.asText();
            }
            return node.toString(); // last resort: serialize object as string
        }

        if (node.isArray()) {
            // Multi-line inputs are sometimes returned as arrays — join with newline
            StringBuilder sb = new StringBuilder();
            for (JsonNode el : node) {
                if (sb.length() > 0) sb.append("\n");
                sb.append(flattenToString(el));
            }
            return sb.toString();
        }

        return node.toString();
    }

    // ─────────────────────────────────────────────
    // PARSE EXTRA TEST CASES (array-only response)
    // ─────────────────────────────────────────────
    private List<TestCaseDTO> parseTestCaseArray(String raw) {
        try {
            String s = raw.trim()
                    .replaceAll("(?s)```json\\s*", "")
                    .replaceAll("(?s)```\\s*", "");
            int start = s.indexOf('['), end = s.lastIndexOf(']');
            if (start == -1 || end == -1) return new ArrayList<>();
            s = s.substring(start, end + 1).replaceAll(",\\s*]", "]");

            List<TestCaseDTO> result = new ArrayList<>();
            for (JsonNode n : objectMapper.readTree(s)) {
                TestCaseDTO tc = new TestCaseDTO();
                tc.setInput(flattenToString(n.get("input")));
                tc.setExpectedOutput(flattenToString(n.get("expectedOutput")));
                tc.setIsHidden(true);
                if (!isPlaceholder(tc)) result.add(tc);
            }
            return result;
        } catch (Exception e) {
            System.err.println("⚠️ parseTestCaseArray failed: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
    private void enforceTestCaseRules(List<TestCaseDTO> tcs) {
        for (int i = 0; i < tcs.size(); i++) {
            if (tcs.get(i) == null) tcs.set(i, emptyTestCase(i));
            tcs.get(i).setIsHidden(i >= 2);
        }
    }

    private boolean isPlaceholder(TestCaseDTO tc) {
        if (tc == null) return true;
        String in  = tc.getInput()          == null ? "" : tc.getInput().toLowerCase();
        String out = tc.getExpectedOutput() == null ? "" : tc.getExpectedOutput().toLowerCase();
        return in.contains("<real input") || in.contains("test input")   || in.contains("hidden input")  ||
                in.contains("<string>")   || in.contains("sample input") || in.contains("input data") ||
                out.contains("<correct")  || out.contains("test output") || out.contains("hidden output") ||
                (in.trim().isEmpty() && out.trim().isEmpty());
    }

    private TestCaseDTO emptyTestCase(int index) {
        TestCaseDTO tc = new TestCaseDTO();
        tc.setInput("1");
        tc.setExpectedOutput("1");
        tc.setIsHidden(index >= 2);
        return tc;
    }

    private String buildRepairPrompt(String brokenJson) {
        String snippet = brokenJson.length() > 2000 ? brokenJson.substring(0, 2000) : brokenJson;
        return "Fix this malformed JSON and return ONLY the corrected JSON object. No prose.\n" +
                "IMPORTANT: testCases[].input and testCases[].expectedOutput must be plain strings.\n\n" +
                "BROKEN:\n" + snippet;
    }

    private String trimPromptForSmallModel(String prompt) {
        return prompt.length() <= 1500 ? prompt : prompt.substring(0, 1500) + "\nReturn JSON as specified.";
    }

    private String stripMarkdown(String text) {
        if (text == null) return "";
        return text.replaceAll("#{1,6}\\s?", "").replaceAll("\\*{1,2}", "")
                .replaceAll("\\\\n", " ").replaceAll("Problem Statement:\\s*", "").trim();
    }

    private String deriveTitleFrom(String ps) {
        if (isBlank(ps)) return "DSA Problem";
        StringBuilder sb = new StringBuilder();
        int n = 0;
        for (String w : ps.split("\\s+")) {
            if (w.length() > 3 && n++ < 5)
                sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1).toLowerCase()).append(" ");
        }
        String t = sb.toString().trim();
        return t.isEmpty() ? "DSA Problem" : t;
    }

    private AIRequestDTO cloneWithTestCaseCount(AIRequestDTO src, int count) {
        AIRequestDTO c = new AIRequestDTO();
        c.setProblemStatement(src.getProblemStatement());
        c.setInputFormat(src.getInputFormat());
        c.setOutputFormat(src.getOutputFormat());
        c.setConstraints(src.getConstraints());
        c.setExampleInput(src.getExampleInput());
        c.setExampleOutput(src.getExampleOutput());
        c.setNumberOfTestCases(count);
        return c;
    }

    private void sleepQuietly(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) {}
    }

    private boolean isBlank(String s)  { return s == null || s.trim().isEmpty(); }
    private boolean notEmpty(String s) { return s != null && !s.trim().isEmpty(); }

    // ─────────────────────────────────────────────
    // CUSTOM EXCEPTION
    // ─────────────────────────────────────────────
    private static class JsonParseException extends Exception {
        private final String rawResponse;
        JsonParseException(String msg, String raw) { super(msg); this.rawResponse = raw; }
        String getRawResponse() { return rawResponse; }
    }

    // Add to GroqService.java
    public List<TestCaseDTO> generateAdditionalTestCases(AITestCaseRequest request) {
        List<TestCaseDTO> result = new ArrayList<>();
        try {
            System.out.println("🤖 Starting test case generation for question: " + request.getQuestionId());

            if (request.getProblemStatement() == null || request.getProblemStatement().trim().isEmpty()) {
                System.err.println("❌ Problem statement is null or empty");
                return result;
            }

            // Ensure existingTestCases is not null
            if (request.getExistingTestCases() == null) {
                request.setExistingTestCases(new ArrayList<>());
            }

            // Clean existing test cases - handle null values
            for (AITestCaseRequest.ExistingTestCaseDTO tc : request.getExistingTestCases()) {
                if (tc.getInput() == null) tc.setInput("");
                if (tc.getExpectedOutput() == null) tc.setExpectedOutput("");
                if (tc.getIsHidden() == null) tc.setIsHidden(true);
            }

            String prompt = buildTestCaseGenerationPrompt(request);
            System.out.println("📝 Prompt built, length: " + prompt.length());

            String rawResponse = callGroqAPI(prompt, WORKING_MODELS.get(0));
            System.out.println("✅ Received response from Groq");

            result = parseTestCaseArray(rawResponse);
            System.out.println("📊 Parsed " + result.size() + " test cases");

            // Ensure all test cases have isHidden = true
            for (TestCaseDTO tc : result) {
                if (tc.getIsHidden() == null) {
                    tc.setIsHidden(true);
                }
            }

        } catch (Exception e) {
            System.err.println("❌ Error in generateAdditionalTestCases: " + e.getMessage());
            e.printStackTrace();
        }

        return result;
    }
    private String buildTestCaseGenerationPrompt(AITestCaseRequest request) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Generate additional test cases for this DSA problem.\n\n");

        prompt.append("PROBLEM STATEMENT:\n");
        prompt.append(request.getProblemStatement()).append("\n\n");

        prompt.append("INPUT FORMAT:\n");
        prompt.append(request.getInputFormat()).append("\n\n");

        prompt.append("OUTPUT FORMAT:\n");
        prompt.append(request.getOutputFormat()).append("\n\n");

        if (request.getConstraints() != null && !request.getConstraints().trim().isEmpty()) {
            prompt.append("CONSTRAINTS:\n");
            prompt.append(request.getConstraints()).append("\n\n");
        }

        if (request.getExistingTestCases() != null && !request.getExistingTestCases().isEmpty()) {
            prompt.append("EXISTING TEST CASES (for reference):\n");
            for (int i = 0; i < Math.min(request.getExistingTestCases().size(), 10); i++) {
                AITestCaseRequest.ExistingTestCaseDTO tc = request.getExistingTestCases().get(i);
                prompt.append((i + 1)).append(". Input: ").append(tc.getInput())
                        .append("\n   Output: ").append(tc.getExpectedOutput())
                        .append(" [").append(tc.getIsHidden() != null && tc.getIsHidden() ? "HIDDEN" : "PUBLIC").append("]\n");
            }
            prompt.append("\n");
        }

        int numberOfCases = request.getNumberOfTestCases() != null ? request.getNumberOfTestCases() : 5;

        prompt.append("TASK: Generate ").append(numberOfCases).append(" NEW test cases that test DIFFERENT scenarios.\n");
        prompt.append("REQUIREMENTS:\n");
        prompt.append("1. Include edge cases (minimum values, maximum values, empty inputs when applicable)\n");
        prompt.append("2. Include boundary value tests\n");
        prompt.append("3. Include large inputs to test performance (within constraints)\n");
        prompt.append("4. Include negative scenarios and invalid cases where applicable\n");
        prompt.append("5. Test cases should be progressively more complex\n");
        prompt.append("6. ALL test cases should have isHidden = true (for evaluation only)\n\n");

        prompt.append("Return ONLY a JSON array. Example format:\n");
        prompt.append("[\n");
        prompt.append("  {\n");
        prompt.append("    \"input\": \"5\\n1 2 3 4 5\",\n");
        prompt.append("    \"expectedOutput\": \"15\",\n");
        prompt.append("    \"isHidden\": true\n");
        prompt.append("  }\n");
        prompt.append("]\n\n");
        prompt.append("IMPORTANT: Return ONLY the JSON array, no other text, no markdown formatting.");

        return prompt.toString();
    }
}