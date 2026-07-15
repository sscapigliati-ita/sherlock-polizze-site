package it.sherlock.polizze;

import java.net.URI;

public final class NavigationPolicy {

    public enum Destination { INTERNAL, EXTERNAL, EMAIL, REJECTED }

    public static Destination classify(String raw) {
        if (raw == null || raw.trim().isEmpty()) return Destination.REJECTED;
        try {
            URI uri = URI.create(raw.trim());
            String scheme = uri.getScheme();
            if ("mailto".equalsIgnoreCase(scheme)) return Destination.EMAIL;
            if (!"https".equalsIgnoreCase(scheme)) return Destination.REJECTED;
            String host = uri.getHost();
            if ("www.sherlockpolizze.it".equalsIgnoreCase(host)
                    || "sherlockpolizze.it".equalsIgnoreCase(host)) {
                return Destination.INTERNAL;
            }
            return host == null ? Destination.REJECTED : Destination.EXTERNAL;
        } catch (IllegalArgumentException error) {
            return Destination.REJECTED;
        }
    }

    private NavigationPolicy() {}
}
