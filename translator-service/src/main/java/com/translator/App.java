package com.translator;

import org.glassfish.grizzly.http.server.HttpServer;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.server.ResourceConfig;

import java.net.URI;

public class App {

    public static final String BASE_URI = "http://localhost:8080/api/";

    public static HttpServer startServer() {
        ResourceConfig config = new ResourceConfig()
                .packages("com.translator")
                .register(CorsFilter.class)
                .register(BasicAuthFilter.class);
        return GrizzlyHttpServerFactory.createHttpServer(URI.create(BASE_URI), config);
    }

    public static void main(String[] args) {
        HttpServer server = startServer();
        System.out.println("Darija Translator REST service running at " + BASE_URI);
        Runtime.getRuntime().addShutdownHook(new Thread(server::shutdownNow));
        try { Thread.currentThread().join(); } catch (InterruptedException e) { server.shutdownNow(); }
    }
}
