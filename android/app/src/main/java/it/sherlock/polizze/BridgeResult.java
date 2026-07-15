package it.sherlock.polizze;

import org.json.JSONException;
import org.json.JSONObject;

public final class BridgeResult {
    private final boolean ok;
    private final String payload;
    private final String error;

    private BridgeResult(boolean ok, String payload, String error) {
        this.ok = ok;
        this.payload = payload;
        this.error = error;
    }

    public static BridgeResult success(String payload) {
        return new BridgeResult(true, payload, null);
    }

    public static BridgeResult error(String code) {
        return new BridgeResult(false, null, code);
    }

    public String toJson() throws JSONException {
        JSONObject out = new JSONObject().put("ok", ok);
        if (payload != null) out.put("payload", payload);
        if (error != null) out.put("error", error);
        return out.toString();
    }
}
