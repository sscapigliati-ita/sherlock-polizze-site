package it.sherlock.polizze;

import static it.sherlock.polizze.NavigationPolicy.Destination.EMAIL;
import static it.sherlock.polizze.NavigationPolicy.Destination.EXTERNAL;
import static it.sherlock.polizze.NavigationPolicy.Destination.INTERNAL;
import static it.sherlock.polizze.NavigationPolicy.Destination.REJECTED;
import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class NavigationPolicyTest {

    @Test
    public void classifiesCanonicalUrlsAsInternal() {
        assertEquals(INTERNAL, NavigationPolicy.classify("https://www.sherlockpolizze.it/privacy"));
        assertEquals(INTERNAL, NavigationPolicy.classify("https://sherlockpolizze.it/guide"));
    }

    @Test
    public void rejectsDangerousOrUnsupportedSchemes() {
        assertEquals(REJECTED, NavigationPolicy.classify("javascript:alert(1)"));
        assertEquals(REJECTED, NavigationPolicy.classify("http://www.sherlockpolizze.it"));
        assertEquals(REJECTED, NavigationPolicy.classify(null));
    }

    @Test
    public void classifiesMailAndExternalHttps() {
        assertEquals(EMAIL, NavigationPolicy.classify("mailto:info@sherlockpolizze.it"));
        assertEquals(EXTERNAL, NavigationPolicy.classify("https://www.ivass.it"));
    }
}
