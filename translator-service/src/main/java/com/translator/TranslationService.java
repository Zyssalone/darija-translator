package com.translator;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Properties;

public class TranslationService {

    private static final Properties CONFIG = loadConfig();
    private static final String LLM_API_URL = cfg("LLM_API_URL", "http://127.0.0.1:5005/v1/chat/completions");
    private static final String LLM_API_KEY = cfg("LLM_API_KEY", "");
    private static final String LLM_MODEL = cfg("LLM_MODEL", "gpt-4");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public record Result(String translation, String transliteration, String detectedLang) {}

    public Result translate(String text, String sourceLang, String targetLang, boolean withTranslit) {
        if (LLM_API_KEY.isEmpty())
            return new Result("Error: LLM_API_KEY not set.", "", sourceLang);

        boolean autoDetect = "auto".equalsIgnoreCase(sourceLang);

        StringBuilder sysBuilder = new StringBuilder();
        sysBuilder.append("You are a translator specializing in Moroccan Arabic Dialect (Darija) and multiple languages. ");
        sysBuilder.append("RULES: 1) Output ONLY the translated text. 2) No labels, headers, pronunciation guides, alternatives, markdown, or explanation. ");
        sysBuilder.append("3) If the target is Darija, use authentic Moroccan dialect, not MSA.");

        StringBuilder userBuilder = new StringBuilder();
        if (autoDetect) {
            userBuilder.append("[Auto-detect the source language] ");
        } else {
            userBuilder.append("[Source: ").append(sourceLang).append("] ");
        }
        userBuilder.append("Translate to ").append(targetLang).append(":\n\n").append(text);

        if (withTranslit) {
            sysBuilder.append(" 4) After the translation, on a NEW LINE write TRANSLITERATION: followed by the Latin-script transliteration.");
        }
        if (autoDetect) {
            sysBuilder.append(withTranslit ? " 5)" : " 4)");
            sysBuilder.append(" On the LAST LINE write DETECTED: followed by the detected source language name (e.g. DETECTED: English).");
        }

        String requestBody = """
                {
                  "model": "%s",
                  "messages": [
                    {"role": "system", "content": "%s"},
                    {"role": "user", "content": "%s"}
                  ],
                  "temperature": 0.3,
                  "max_tokens": 2048
                }
                """.formatted(LLM_MODEL, escapeJson(sysBuilder.toString()), escapeJson(userBuilder.toString()));

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(LLM_API_URL))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + LLM_API_KEY)
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                return new Result("LLM API error (HTTP " + response.statusCode() + ")", "", sourceLang);
            }

            String raw = extractContent(response.body());
            return parseResult(raw, sourceLang, autoDetect, withTranslit);
        } catch (Exception e) {
            return new Result("Translation failed: " + e.getMessage(), "", sourceLang);
        }
    }

    private Result parseResult(String raw, String sourceLang, boolean autoDetect, boolean withTranslit) {
        String translation = raw;
        String transliteration = "";
        String detectedLang = sourceLang;

        if (autoDetect && raw.contains("DETECTED:")) {
            int di = raw.lastIndexOf("DETECTED:");
            detectedLang = raw.substring(di + 9).trim();
            translation = raw.substring(0, di).trim();
        }

        if (withTranslit && translation.contains("TRANSLITERATION:")) {
            int ti = translation.indexOf("TRANSLITERATION:");
            transliteration = translation.substring(ti + 16).trim();
            translation = translation.substring(0, ti).trim();
        }

        return new Result(translation, transliteration, detectedLang);
    }

    private String extractContent(String json) {
        // ponytail: manual parse, avoids extra dep for one field
        int idx = json.indexOf("\"content\":");
        if (idx == -1) return "Could not parse LLM response";
        int start = json.indexOf("\"", idx + 10) + 1;
        int end = json.indexOf("\"", start);
        while (end > 0 && json.charAt(end - 1) == '\\') {
            end = json.indexOf("\"", end + 1);
        }
        if (end <= start) return "Could not parse LLM response";
        return json.substring(start, end)
                .replace("\\n", "\n")
                .replace("\\\"", "\"")
                .replace("\\t", "\t")
                .replace("\\\\", "\\");
    }

    private String escapeJson(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private static String cfg(String key, String fallback) {
        String env = System.getenv(key);
        if (env != null && !env.isEmpty()) return env;
        return CONFIG.getProperty(key, fallback);
    }

    private static Properties loadConfig() {
        Properties p = new Properties();
        Path f = Path.of("translator.properties");
        if (Files.exists(f)) {
            try (var in = Files.newInputStream(f)) { p.load(in); }
            catch (IOException e) { System.err.println("Warning: could not read translator.properties"); }
        }
        return p;
    }
}
