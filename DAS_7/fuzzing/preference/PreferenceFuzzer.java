import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Random;

public final class PreferenceFuzzer {
    private static final String[] FREQUENCIES = {"Weekly", "Fortnightly", "Monthly"};
    private static final long DEFAULT_DURATION_MS = 12L * 60L * 60L * 1000L;
    private static final String BASELINE_EMAIL = "baseline@example.test";

    private final String baseUrl;
    private final long seed;
    private final Random random;
    private long cases;
    private String currentRequest = "";

    private PreferenceFuzzer(String baseUrl, long seed) {
        this.baseUrl = baseUrl;
        this.seed = seed;
        this.random = new Random(seed);
    }

    public static void main(String[] args) throws Exception {
        String baseUrl = env("FUZZ_BASE_URL", "http://127.0.0.1:4107");
        long seed = longEnv("FUZZ_SEED", System.currentTimeMillis());
        long durationMs = longEnv("FUZZ_DURATION_MS", DEFAULT_DURATION_MS);
        if (durationMs <= 0L) throw new IllegalArgumentException("FUZZ_DURATION_MS must be positive");

        PreferenceFuzzer fuzzer = new PreferenceFuzzer(baseUrl, seed);
        System.out.println("[fuzz] seed=" + seed);
        System.out.println("[fuzz] durationMs=" + durationMs);

        try {
            fuzzer.run(durationMs);
        } catch (Throwable failure) {
            File saved = fuzzer.saveFailure(failure);
            System.err.println("[fuzz] failed at case " + fuzzer.cases);
            System.err.println("[fuzz] reproduce with FUZZ_SEED=" + seed);
            System.err.println("[fuzz] request saved to " + saved.getAbsolutePath());
            throw failure;
        }
    }

    private void run(long durationMs) throws Exception {
        assertHealth();
        checkOversizedInput();
        long startedAt = System.currentTimeMillis();
        long deadline = startedAt + durationMs;

        while (System.currentTimeMillis() < deadline) {
            if (cases % 10L == 0L) runValidCase();
            else runInvalidCase();
            cases += 1L;

            if (cases % 1000L == 0L) {
                assertHealth();
                long elapsedMs = Math.max(1L, System.currentTimeMillis() - startedAt);
                long casesPerSecond = cases * 1000L / elapsedMs;
                System.out.println("[fuzz] cases=" + cases + " rate=" + casesPerSecond + "/s");
            }
        }

        long elapsedMs = System.currentTimeMillis() - startedAt;
        System.out.println("[fuzz] completed cases=" + cases + " elapsedMs=" + elapsedMs);
    }

    private void runValidCase() throws Exception {
        resetState();
        boolean enabled = random.nextBoolean();
        String frequency = FREQUENCIES[random.nextInt(FREQUENCIES.length)];
        String local = asciiToken(1 + random.nextInt(20));
        String domain = asciiToken(1 + random.nextInt(20));
        String rawEmail = "  " + randomCase(local + "@" + domain + ".TEST") + "  ";
        String expectedEmail = rawEmail.trim().toLowerCase();

        currentRequest = "{"
            + "\"parentId\":\"attacker-parent\","
            + "\"enabled\":" + enabled + ","
            + "\"frequency\":\"" + frequency + "\","
            + "\"recipientEmail\":\"" + jsonEscape(rawEmail) + "\""
            + "}";

        Response response = request("PUT", "/parents/fuzz-parent/preferences", currentRequest);
        require(response.status == 200, "valid input returned HTTP " + response.status);
        require(response.body.contains("\"parentId\":\"fuzz-parent\""), "URL parent ID was not used");
        require(response.body.contains("\"recipientEmail\":\"" + jsonEscape(expectedEmail) + "\""),
            "email was not normalized");

        String state = request("GET", "/__fuzz/state", null).body;
        require(state.contains("\"writes\":1"), "valid input did not perform exactly one write");
        require(state.contains("\"parentId\":\"fuzz-parent\""), "stored parent ID was replaced");
    }

    private void runInvalidCase() throws Exception {
        resetState();
        currentRequest = invalidRequest();

        Response response = request("PUT", "/parents/fuzz-parent/preferences", currentRequest);
        require(response.status == 400, "invalid input returned HTTP " + response.status);
        require(response.status != 500, "invalid input caused an internal error");

        String state = request("GET", "/__fuzz/state", null).body;
        require(state.contains("\"writes\":0"), "invalid input reached the repository");
        require(state.contains("\"recipientEmail\":\"" + BASELINE_EMAIL + "\""),
            "invalid input changed stored state");
    }

    private String invalidRequest() {
        int kind = random.nextInt(12);
        String frequency = FREQUENCIES[random.nextInt(FREQUENCIES.length)];
        switch (kind) {
            case 0: return "{}";
            case 1: return "null";
            case 2: return "[]";
            case 3: return "{\"enabled\":\"" + randomCase("true") + "\",\"frequency\":\"Weekly\",\"recipientEmail\":\"a@b.test\"}";
            case 4: return "{\"enabled\":{},\"frequency\":\"Weekly\",\"recipientEmail\":\"a@b.test\"}";
            case 5: return "{\"enabled\":true,\"frequency\":\"" + jsonEscape(unicodeText()) + "\",\"recipientEmail\":\"a@b.test\"}";
            case 6: return "{\"enabled\":true,\"frequency\":[],\"recipientEmail\":\"a@b.test\"}";
            case 7: return "{\"enabled\":true,\"frequency\":\"" + frequency + "\",\"recipientEmail\":\"" + jsonEscape(unicodeText()) + "\"}";
            case 8: return "{\"enabled\":true,\"frequency\":\"" + frequency + "\",\"recipientEmail\":null}";
            case 9: return "{\"enabled\":true,\"frequency\":\"Daily\",\"recipientEmail\":\"a@b.test\",\"extra\":" + randomJson(2) + "}";
            case 10: return "{\"enabled\":false,\"frequency\":\"\",\"recipientEmail\":\"a@b.test\"}";
            default: return "{\"enabled\":" + randomJson(3) + ",\"frequency\":\"Weekly\",\"recipientEmail\":\"a@b.test\"}";
        }
    }

    private String randomJson(int depth) {
        if (depth <= 0) {
            switch (random.nextInt(4)) {
                case 0: return "null";
                case 1: return String.valueOf(random.nextBoolean());
                case 2: return String.valueOf(random.nextInt());
                default: return "\"" + jsonEscape(unicodeText()) + "\"";
            }
        }
        if (random.nextBoolean()) {
            return "[" + randomJson(depth - 1) + "," + randomJson(depth - 1) + "]";
        }
        return "{\"" + asciiToken(4) + "\":" + randomJson(depth - 1) + "}";
    }

    private void checkOversizedInput() throws Exception {
        resetState();
        StringBuilder email = new StringBuilder(110000);
        for (int i = 0; i < 110000; i++) email.append('a');
        currentRequest = "{\"enabled\":true,\"frequency\":\"Weekly\",\"recipientEmail\":\""
            + email + "@example.test\"}";
        Response response = request("PUT", "/parents/fuzz-parent/preferences", currentRequest);
        require(response.status == 413, "oversized JSON returned HTTP " + response.status + " instead of 413");
        String state = request("GET", "/__fuzz/state", null).body;
        require(state.contains("\"writes\":0"), "oversized input reached the repository");
    }

    private void assertHealth() throws Exception {
        Response response = request("GET", "/__fuzz/health", null);
        require(response.status == 200, "harness health returned HTTP " + response.status);
    }

    private void resetState() throws Exception {
        Response response = request("POST", "/__fuzz/reset", "{}");
        require(response.status == 200, "state reset returned HTTP " + response.status);
    }

    private Response request(String method, String path, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl + path).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        connection.setRequestProperty("Accept", "application/json");
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            connection.getOutputStream().write(bytes);
        }

        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String responseBody = readAll(stream);
        connection.disconnect();
        return new Response(status, responseBody);
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) result.append(line);
        reader.close();
        return result.toString();
    }

    private File saveFailure(Throwable failure) throws Exception {
        File directory = new File("fuzzing/preference/failures");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IllegalStateException("Could not create " + directory);
        }
        File file = new File(directory, "failure-seed-" + seed + "-case-" + cases + ".txt");
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
            new FileOutputStream(file), StandardCharsets.UTF_8));
        writer.write("seed=" + seed + "\n");
        writer.write("case=" + cases + "\n");
        writer.write("error=" + failure + "\n");
        writer.write("request=" + currentRequest + "\n");
        writer.close();
        return file;
    }

    private String asciiToken(int length) {
        String alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder result = new StringBuilder(length);
        for (int i = 0; i < length; i++) result.append(alphabet.charAt(random.nextInt(alphabet.length())));
        return result.toString();
    }

    private String randomCase(String value) {
        StringBuilder result = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            result.append(random.nextBoolean() ? Character.toUpperCase(character) : Character.toLowerCase(character));
        }
        return result.toString();
    }

    private String unicodeText() {
        String[] values = {"", "not-an-email", "用户例子测试", "a b", "\u0000", "💥", "@", "."};
        return values[random.nextInt(values.length)];
    }

    private static String jsonEscape(String value) {
        StringBuilder escaped = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            switch (character) {
                case '"': escaped.append("\\\""); break;
                case '\\': escaped.append("\\\\"); break;
                case '\b': escaped.append("\\b"); break;
                case '\f': escaped.append("\\f"); break;
                case '\n': escaped.append("\\n"); break;
                case '\r': escaped.append("\\r"); break;
                case '\t': escaped.append("\\t"); break;
                default:
                    if (character < 0x20) escaped.append(String.format("\\u%04x", (int) character));
                    else escaped.append(character);
            }
        }
        return escaped.toString();
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private static long longEnv(String name, long fallback) {
        String value = System.getenv(name);
        if (value == null || value.trim().isEmpty()) return fallback;
        return Long.parseLong(value.trim());
    }

    private static final class Response {
        final int status;
        final String body;
        Response(int status, String body) {
            this.status = status;
            this.body = body;
        }
    }
}
