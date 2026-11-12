package com.translator;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Path("/translate")
public class TranslatorResource {

    private final TranslationService translationService = new TranslationService();

    // ponytail: in-memory history, swap to DB if persistence matters
    private static final List<HistoryEntry> history =
            Collections.synchronizedList(new ArrayList<>());

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response translate(TranslationRequest request) {
        if (request.getText() == null || request.getText().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(new TranslationResponse("", "", "Error: text is required"))
                    .build();
        }

        String sourceLang = request.getSourceLang() != null ? request.getSourceLang() : "auto";
        String targetLang = request.getTargetLang() != null ? request.getTargetLang() : "Darija";
        boolean withTranslit = request.isTransliterate();

        TranslationService.Result result = translationService.translate(
                request.getText(), sourceLang, targetLang, withTranslit);

        history.add(0, new HistoryEntry(
                request.getText(), result.translation(), result.transliteration(),
                result.detectedLang(), targetLang, Instant.now().toString()));
        if (history.size() > 100) history.remove(history.size() - 1);

        return Response.ok(new TranslationResponse(
                result.translation(), result.transliteration(), null
        ).withDetectedLang(result.detectedLang())).build();
    }

    @POST
    @Path("/batch")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response batchTranslate(BatchRequest request) {
        if (request.getTexts() == null || request.getTexts().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"texts array is required\"}").build();
        }
        if (request.getTexts().size() > 20) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"max 20 texts per batch\"}").build();
        }

        String src = request.getSourceLang() != null ? request.getSourceLang() : "auto";
        String tgt = request.getTargetLang() != null ? request.getTargetLang() : "Darija";
        boolean tl = request.isTransliterate();

        List<TranslationResponse> results = new ArrayList<>();
        for (String text : request.getTexts()) {
            TranslationService.Result r = translationService.translate(text, src, tgt, tl);
            results.add(new TranslationResponse(r.translation(), r.transliteration(), null)
                    .withDetectedLang(r.detectedLang()));
        }
        return Response.ok(results).build();
    }

    @OPTIONS
    public Response preflight() { return Response.ok().build(); }

    @OPTIONS
    @Path("{any:.*}")
    public Response preflightAll() { return Response.ok().build(); }

    @GET
    @Path("/history")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getHistory(@QueryParam("limit") @DefaultValue("20") int limit) {
        int n = Math.min(limit, history.size());
        return Response.ok(history.subList(0, n)).build();
    }

    @DELETE
    @Path("/history")
    public Response clearHistory() {
        history.clear();
        return Response.ok("{\"status\":\"cleared\"}").build();
    }

    @GET
    @Path("/languages")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getLanguages() {
        return Response.ok(List.of(
                new LangOption("auto", "Auto-Detect"),
                new LangOption("en", "English"),
                new LangOption("fr", "French"),
                new LangOption("es", "Spanish"),
                new LangOption("de", "German"),
                new LangOption("tr", "Turkish"),
                new LangOption("ar", "Arabic (MSA)"),
                new LangOption("darija", "Moroccan Darija")
        )).build();
    }

    @GET
    @Path("/health")
    @Produces(MediaType.APPLICATION_JSON)
    public Response health() {
        return Response.ok("{\"status\":\"ok\",\"version\":\"1.0\"}").build();
    }

    // --- DTOs ---

    public static class TranslationRequest {
        private String text;
        private String sourceLang = "auto";
        private String targetLang = "Darija";
        private boolean transliterate = false;

        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
        public String getSourceLang() { return sourceLang; }
        public void setSourceLang(String sourceLang) { this.sourceLang = sourceLang; }
        public String getTargetLang() { return targetLang; }
        public void setTargetLang(String targetLang) { this.targetLang = targetLang; }
        public boolean isTransliterate() { return transliterate; }
        public void setTransliterate(boolean transliterate) { this.transliterate = transliterate; }
    }

    public static class BatchRequest {
        private List<String> texts;
        private String sourceLang = "auto";
        private String targetLang = "Darija";
        private boolean transliterate = false;

        public List<String> getTexts() { return texts; }
        public void setTexts(List<String> texts) { this.texts = texts; }
        public String getSourceLang() { return sourceLang; }
        public void setSourceLang(String s) { this.sourceLang = s; }
        public String getTargetLang() { return targetLang; }
        public void setTargetLang(String t) { this.targetLang = t; }
        public boolean isTransliterate() { return transliterate; }
        public void setTransliterate(boolean t) { this.transliterate = t; }
    }

    public static class TranslationResponse {
        private String translation;
        private String transliteration;
        private String detectedLang;
        private String error;

        public TranslationResponse() {}
        public TranslationResponse(String translation, String transliteration, String error) {
            this.translation = translation;
            this.transliteration = transliteration;
            this.error = error;
        }
        public TranslationResponse withDetectedLang(String d) { this.detectedLang = d; return this; }

        public String getTranslation() { return translation; }
        public void setTranslation(String t) { this.translation = t; }
        public String getTransliteration() { return transliteration; }
        public void setTransliteration(String t) { this.transliteration = t; }
        public String getDetectedLang() { return detectedLang; }
        public void setDetectedLang(String d) { this.detectedLang = d; }
        public String getError() { return error; }
        public void setError(String e) { this.error = e; }
    }

    public static class HistoryEntry {
        private String source;
        private String translation;
        private String transliteration;
        private String sourceLang;
        private String targetLang;
        private String timestamp;

        public HistoryEntry() {}
        public HistoryEntry(String source, String translation, String transliteration,
                            String sourceLang, String targetLang, String timestamp) {
            this.source = source;
            this.translation = translation;
            this.transliteration = transliteration;
            this.sourceLang = sourceLang;
            this.targetLang = targetLang;
            this.timestamp = timestamp;
        }

        public String getSource() { return source; }
        public void setSource(String s) { this.source = s; }
        public String getTranslation() { return translation; }
        public void setTranslation(String t) { this.translation = t; }
        public String getTransliteration() { return transliteration; }
        public void setTransliteration(String t) { this.transliteration = t; }
        public String getSourceLang() { return sourceLang; }
        public void setSourceLang(String s) { this.sourceLang = s; }
        public String getTargetLang() { return targetLang; }
        public void setTargetLang(String t) { this.targetLang = t; }
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String t) { this.timestamp = t; }
    }

    public static class LangOption {
        private String code;
        private String name;

        public LangOption() {}
        public LangOption(String code, String name) { this.code = code; this.name = name; }
        public String getCode() { return code; }
        public void setCode(String c) { this.code = c; }
        public String getName() { return name; }
        public void setName(String n) { this.name = n; }
    }
}
