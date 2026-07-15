package it.sherlock.polizze;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

public class BridgeResultTest {

    @Test
    public void errorResultContainsOnlyStableCode() throws Exception {
        JSONObject json = new JSONObject(BridgeResult.error("network_timeout").toJson());
        assertFalse(json.getBoolean("ok"));
        assertEquals("network_timeout", json.getString("error"));
        assertFalse(json.has("exception"));
        assertFalse(json.has("payload"));
    }

    @Test
    public void successResultContainsPayload() throws Exception {
        JSONObject json = new JSONObject(BridgeResult.success("e30=").toJson());
        assertTrue(json.getBoolean("ok"));
        assertEquals("e30=", json.getString("payload"));
        assertFalse(json.has("error"));
    }
}
