package com.translator;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.util.Base64;

@Provider
public class BasicAuthFilter implements ContainerRequestFilter {

    // ponytail: hardcoded creds, move to DB/env if this ever goes real
    private static final String USERNAME = System.getenv().getOrDefault("AUTH_USER", "admin");
    private static final String PASSWORD = System.getenv().getOrDefault("AUTH_PASS", "password123");

    @Override
    public void filter(ContainerRequestContext ctx) {
        if ("OPTIONS".equalsIgnoreCase(ctx.getMethod())) return;
        if (ctx.getUriInfo().getPath().equals("translate/languages")) return;

        String auth = ctx.getHeaderString("Authorization");
        if (auth == null || !auth.startsWith("Basic ")) {
            abort(ctx);
            return;
        }
        try {
            String decoded = new String(Base64.getDecoder().decode(auth.substring(6)));
            String[] parts = decoded.split(":", 2);
            if (parts.length != 2 || !USERNAME.equals(parts[0]) || !PASSWORD.equals(parts[1])) {
                abort(ctx);
            }
        } catch (Exception e) {
            abort(ctx);
        }
    }

    private void abort(ContainerRequestContext ctx) {
        ctx.abortWith(Response.status(Response.Status.UNAUTHORIZED)
                .header("WWW-Authenticate", "Basic realm=\"translator\"")
                .entity("{\"error\":\"Unauthorized\"}")
                .build());
    }
}
