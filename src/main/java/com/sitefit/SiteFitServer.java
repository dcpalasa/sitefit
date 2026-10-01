package com.sitefit;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

/**
 * Zero-dependency Java 21 HTTP server for SiteFit.
 *
 * Why no framework?
 * - It keeps the project easy to run and explain.
 * - The original project was Java, so this preserves that lineage.
 * - GitHub Pages can still serve the same /docs frontend as a static demo.
 */
public final class SiteFitServer {
    private static final int PORT = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
    private static final Path DOCS = Paths.get("docs").toAbsolutePath().normalize();
    private static final Path DEFAULT_PRIVATE_DATA = Paths.get("data", "private", "properties.json").toAbsolutePath().normalize();
    private static final Path DEMO_DATA = DOCS.resolve("data").resolve("demo-properties.json").normalize();

    private static String propertiesJson;
    private static String dataLabel;

    public static void main(String[] args) throws Exception {
        loadData();

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/api/health", SiteFitServer::healthHandler);
        server.createContext("/api/properties", SiteFitServer::propertiesHandler);
        server.createContext("/api/source", SiteFitServer::sourceHandler);
        server.createContext("/", SiteFitServer::staticHandler);

        server.setExecutor(null);
        server.start();

        System.out.println();
        System.out.println("SiteFit is running.");
        System.out.println("Open: http://localhost:" + PORT);
        System.out.println("Data: " + dataLabel);
        System.out.println("Press Ctrl+C to stop.");
        System.out.println();
    }

    private static void loadData() throws IOException {
        String envPath = System.getenv("SITEFIT_DATA");
        Path requested = envPath == null || envPath.isBlank()
                ? DEFAULT_PRIVATE_DATA
                : Paths.get(envPath).toAbsolutePath().normalize();

        Path source = Files.exists(requested) ? requested : DEMO_DATA;
        propertiesJson = Files.readString(source, StandardCharsets.UTF_8);
        dataLabel = source.equals(DEMO_DATA) ? "public demo dataset" : source.toString();
    }

    private static void healthHandler(HttpExchange exchange) throws IOException {
        if (!methodAllowed(exchange, "GET")) return;
        json(exchange, 200, "{\"status\":\"ok\",\"app\":\"SiteFit\"}");
    }

    private static void propertiesHandler(HttpExchange exchange) throws IOException {
        if (!methodAllowed(exchange, "GET")) return;
        json(exchange, 200, propertiesJson);
    }

    private static void sourceHandler(HttpExchange exchange) throws IOException {
        if (!methodAllowed(exchange, "GET")) return;
        String mode = dataLabel.equals("public demo dataset") ? "demo" : "private";
        json(exchange, 200, "{\"mode\":\"" + mode + "\",\"label\":\"" + escapeJson(dataLabel) + "\"}");
    }

    private static boolean methodAllowed(HttpExchange exchange, String method) throws IOException {
        if (exchange.getRequestMethod().equalsIgnoreCase(method)) return true;
        exchange.getResponseHeaders().set("Allow", method);
        send(exchange, 405, "text/plain; charset=utf-8", "Method not allowed");
        return false;
    }

    private static void staticHandler(HttpExchange exchange) throws IOException {
        if (!methodAllowed(exchange, "GET")) return;

        String rawPath = URLDecoder.decode(exchange.getRequestURI().getPath(), StandardCharsets.UTF_8);
        String relative = rawPath.equals("/") ? "index.html" : rawPath.substring(1);
        Path file = DOCS.resolve(relative).normalize();

        // Prevent path traversal.
        if (!file.startsWith(DOCS)) {
            send(exchange, 403, "text/plain; charset=utf-8", "Forbidden");
            return;
        }

        if (Files.isDirectory(file)) file = file.resolve("index.html");
        if (!Files.exists(file) || !Files.isRegularFile(file)) {
            send(exchange, 404, "text/plain; charset=utf-8", "Not found");
            return;
        }

        byte[] bytes = Files.readAllBytes(file);
        send(exchange, 200, contentType(file), bytes);
    }

    private static void json(HttpExchange exchange, int status, String body) throws IOException {
        Headers h = exchange.getResponseHeaders();
        h.set("Access-Control-Allow-Origin", "*");
        h.set("Cache-Control", "no-store");
        send(exchange, status, "application/json; charset=utf-8", body);
    }

    private static void send(HttpExchange exchange, int status, String contentType, String body) throws IOException {
        send(exchange, status, contentType, body.getBytes(StandardCharsets.UTF_8));
    }

    private static void send(HttpExchange exchange, int status, String contentType, byte[] body) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(status, body.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(body);
        }
    }

    private static String contentType(Path file) {
        String name = file.getFileName().toString().toLowerCase();
        if (name.endsWith(".html")) return "text/html; charset=utf-8";
        if (name.endsWith(".css")) return "text/css; charset=utf-8";
        if (name.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (name.endsWith(".json")) return "application/json; charset=utf-8";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
