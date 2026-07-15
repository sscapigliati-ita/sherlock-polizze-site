package it.sherlock.polizze;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.URL;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import org.json.JSONException;
import org.json.JSONObject;

import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.analytics.FirebaseAnalytics.ConsentType;
import com.google.firebase.analytics.FirebaseAnalytics.ConsentStatus;
import android.content.SharedPreferences;
import java.util.HashMap;

import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.InstallState;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends Activity {

    private WebView webView;
    private FirebaseAnalytics mFirebaseAnalytics;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST = 1;
    private static final int UPDATE_REQUEST_CODE = 500;
    private static final Map<String, String> pendingResults = new HashMap<String, String>();

    private static final String BACKEND_URL = "https://www.sherlockpolizze.it";
    private long lastBackPressedAt = 0L;

    private BillingManager billing;
    private String pendingPurchaseEmail = null;

    private AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installStateListener;

    // Consenso Analytics: allineato al manifest (default DENIED, opt-in esplicito).
    // Persistito in SharedPreferences con nome versionato per gestire migrazioni future.
    private static final String PREFS_NAME = "sherlock_consent";
    private static final String KEY_CONSENT_STATE = "analytics_consent_v1";
    private static final String CONSENT_GRANTED = "granted";
    private static final String CONSENT_DENIED = "denied";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mFirebaseAnalytics = FirebaseAnalytics.getInstance(this);
        // Applica lo stato di consenso persistito (se esiste). Se l'utente non
        // ha ancora scelto, il default del manifest è "collection disabled" e
        // resta cosi finché il JS non chiama Android.setAnalyticsConsent.
        applyPersistedConsent();
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        final int BG = Color.parseColor("#070b18");
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().getDecorView().setBackgroundColor(BG);

        webView = new WebView(this);
        webView.setBackgroundColor(BG);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        root.setFitsSystemWindows(true);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int l, t, r, b;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    Insets bars = insets.getInsets(
                            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    l = bars.left; t = bars.top; r = bars.right; b = bars.bottom;
                } else {
                    l = insets.getSystemWindowInsetLeft();
                    t = insets.getSystemWindowInsetTop();
                    r = insets.getSystemWindowInsetRight();
                    b = insets.getSystemWindowInsetBottom();
                }
                v.setPadding(l, t, r, b);
                return insets;
            }
        });
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        // La PWA è già dark: impediamo al WebView di applicare l'algoritmo
        // di darkening automatico che invertiva gli sfondi lasciando il testo
        // bianco (titoli invisibili su fondo bianco su Android in dark mode).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            settings.setAlgorithmicDarkeningAllowed(false);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }

        webView.addJavascriptInterface(new SherlockBridge(), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = cb;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                String[] mimes = {"application/pdf", "image/jpeg", "image/png", "image/jpg"};
                intent.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
                try {
                    startActivityForResult(Intent.createChooser(intent, "Seleziona documento"), FILE_CHOOSER_REQUEST);
                } catch (ActivityNotFoundException error) {
                    filePathCallback.onReceiveValue(null);
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Nessun selettore file disponibile", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });

        webView.loadUrl("file:///android_asset/www/index.html");

        billing = new BillingManager(this, this::onPurchaseResult);
        billing.connect();

        setupInAppUpdate();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (billing != null) billing.queryExistingPurchases();
        checkPendingUpdateInstall();
    }

    @Override
    protected void onDestroy() {
        if (billing != null) billing.disconnect();
        if (appUpdateManager != null && installStateListener != null) {
            appUpdateManager.unregisterListener(installStateListener);
        }
        super.onDestroy();
    }

    /* ------------------------------------------------------------------ */
    /*  Firebase Analytics consent (R4)                                    */
    /* ------------------------------------------------------------------ */

    private void applyPersistedConsent() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String state = prefs.getString(KEY_CONSENT_STATE, null);
            if (CONSENT_GRANTED.equals(state)) {
                applyConsent(true);
            } else {
                // null (mai scelto) o CONSENT_DENIED → mantieni default disabilitato.
                // Non chiamiamo setAnalyticsCollectionEnabled(false) perche' il
                // manifest lo dichiara gia' e la ridichiarazione non serve.
                applyConsent(false);
            }
        } catch (Exception ignore) { /* noop */ }
    }

    private void applyConsent(boolean granted) {
        try {
            if (mFirebaseAnalytics == null) return;
            mFirebaseAnalytics.setAnalyticsCollectionEnabled(granted);
            HashMap<ConsentType, ConsentStatus> consent = new HashMap<ConsentType, ConsentStatus>();
            ConsentStatus s = granted ? ConsentStatus.GRANTED : ConsentStatus.DENIED;
            consent.put(ConsentType.ANALYTICS_STORAGE, s);
            consent.put(ConsentType.AD_STORAGE, s);
            consent.put(ConsentType.AD_USER_DATA, s);
            consent.put(ConsentType.AD_PERSONALIZATION, s);
            mFirebaseAnalytics.setConsent(consent);
        } catch (Exception ignore) { /* noop */ }
    }

    /* ------------------------------------------------------------------ */
    /*  Google Play In-App Update (flexible flow)                          */
    /* ------------------------------------------------------------------ */
    private void setupInAppUpdate() {
        try {
            appUpdateManager = AppUpdateManagerFactory.create(this);
            installStateListener = new InstallStateUpdatedListener() {
                @Override
                public void onStateUpdate(InstallState state) {
                    if (state.installStatus() == InstallStatus.DOWNLOADED) {
                        promptCompleteUpdate();
                    }
                }
            };
            appUpdateManager.registerListener(installStateListener);
            checkForUpdate();
        } catch (Exception ignore) { /* noop, non bloccare l'app */ }
    }

    private void checkForUpdate() {
        if (appUpdateManager == null) return;
        try {
            appUpdateManager.getAppUpdateInfo().addOnSuccessListener(new OnSuccessListener<AppUpdateInfo>() {
                @Override
                public void onSuccess(AppUpdateInfo info) {
                    if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                            && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                        try {
                            appUpdateManager.startUpdateFlowForResult(
                                    info, AppUpdateType.FLEXIBLE, MainActivity.this, UPDATE_REQUEST_CODE);
                            logAnalytics("update_prompt_shown", null);
                        } catch (android.content.IntentSender.SendIntentException e) { /* noop */ }
                    } else if (info.installStatus() == InstallStatus.DOWNLOADED) {
                        promptCompleteUpdate();
                    }
                }
            });
        } catch (Exception ignore) { /* noop */ }
    }

    private void checkPendingUpdateInstall() {
        if (appUpdateManager == null) return;
        try {
            appUpdateManager.getAppUpdateInfo().addOnSuccessListener(new OnSuccessListener<AppUpdateInfo>() {
                @Override
                public void onSuccess(AppUpdateInfo info) {
                    if (info.installStatus() == InstallStatus.DOWNLOADED) {
                        promptCompleteUpdate();
                    }
                }
            });
        } catch (Exception ignore) { /* noop */ }
    }

    private void promptCompleteUpdate() {
        runOnUiThread(new Runnable() {
            public void run() {
                Toast.makeText(MainActivity.this,
                        "Aggiornamento pronto. Applicalo per usare l'ultima versione.",
                        Toast.LENGTH_LONG).show();
                logAnalytics("update_downloaded", null);
                if (appUpdateManager != null) {
                    appUpdateManager.completeUpdate();
                }
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] results = null;
            try {
                if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
                filePathCallback.onReceiveValue(results);
            } finally {
                filePathCallback = null;
            }
        } else if (requestCode == UPDATE_REQUEST_CODE) {
            if (resultCode == RESULT_OK) {
                logAnalytics("update_accepted", null);
            } else if (resultCode == RESULT_CANCELED) {
                logAnalytics("update_declined", null);
            }
        }
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript(
                "Boolean(window.SherlockNavigation&&window.SherlockNavigation.canGoBack())",
                value -> {
                    if ("true".equals(value)) {
                        webView.evaluateJavascript("window.SherlockNavigation.goBack()", null);
                    } else if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        handleExitConfirmation();
                    }
                });
    }

    private void handleExitConfirmation() {
        long now = System.currentTimeMillis();
        if (now - lastBackPressedAt <= 2000L) {
            super.onBackPressed();
            return;
        }
        lastBackPressedAt = now;
        Toast.makeText(this, "Premi di nuovo Indietro per uscire", Toast.LENGTH_SHORT).show();
    }

    private boolean handleUrl(String url) {
        NavigationPolicy.Destination destination = NavigationPolicy.classify(url);
        if (destination == NavigationPolicy.Destination.INTERNAL) {
            webView.loadUrl(url);
            return true;
        }
        if (destination == NavigationPolicy.Destination.EXTERNAL
                || destination == NavigationPolicy.Destination.EMAIL) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (ActivityNotFoundException error) {
                Toast.makeText(this, "Nessuna app disponibile per aprire questo link", Toast.LENGTH_SHORT).show();
            }
            return true;
        }
        Toast.makeText(this, "Link non supportato", Toast.LENGTH_SHORT).show();
        return true;
    }

    /* ------------------------------------------------------------------ */
    /*  JavaScript Bridge                                                    */
    /* ------------------------------------------------------------------ */
    class SherlockBridge {

        @JavascriptInterface
        public void callAPI(final String url, final String method,
                            final String headersJson, final String body,
                            final String callbackId) {
            new APITask(url, method, headersJson, body, callbackId).execute();
        }

        @JavascriptInterface
        public String getResult(String cbId) {
            String r = pendingResults.remove(cbId);
            return r != null ? r : "";
        }

        @JavascriptInterface
        public void openURL(final String url) {
            runOnUiThread(new Runnable() {
                public void run() {
                    handleUrl(url);
                }
            });
        }

        @JavascriptInterface
        public void showToast(final String msg) {
            runOnUiThread(new Runnable() {
                public void run() {
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public String getDeviceId() {
            return android.provider.Settings.Secure.getString(
                    getContentResolver(),
                    android.provider.Settings.Secure.ANDROID_ID);
        }

        @JavascriptInterface
        public void shareText(final String text, final String subject) {
            runOnUiThread(new Runnable() {
                public void run() {
                    Intent intent = new Intent(Intent.ACTION_SEND);
                    intent.setType("text/plain");
                    intent.putExtra(Intent.EXTRA_TEXT, text);
                    intent.putExtra(Intent.EXTRA_SUBJECT, subject);
                    startActivity(Intent.createChooser(intent, "Condividi"));
                }
            });
        }

        @JavascriptInterface
        public void vibrate() {
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(android.content.Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate(50);
        }

        @JavascriptInterface
        public void track(String eventName, String paramsJson) {
            if (mFirebaseAnalytics == null || eventName == null || eventName.isEmpty()) return;
            Bundle bundle = new Bundle();
            if (paramsJson != null && !paramsJson.isEmpty()) {
                try {
                    JSONObject json = new JSONObject(paramsJson);
                    Iterator<String> keys = json.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        Object v = json.opt(k);
                        if (v == null || v == JSONObject.NULL) continue;
                        if (v instanceof String) bundle.putString(k, (String) v);
                        else if (v instanceof Integer) bundle.putLong(k, ((Integer) v).longValue());
                        else if (v instanceof Long) bundle.putLong(k, (Long) v);
                        else if (v instanceof Double) bundle.putDouble(k, (Double) v);
                        else if (v instanceof Float) bundle.putDouble(k, ((Float) v).doubleValue());
                        else if (v instanceof Boolean) bundle.putLong(k, ((Boolean) v) ? 1L : 0L);
                        else bundle.putString(k, String.valueOf(v));
                    }
                } catch (Exception e) { /* noop */ }
            }
            mFirebaseAnalytics.logEvent(eventName, bundle);
        }

        @JavascriptInterface
        public boolean isPlayBillingAvailable() {
            return billing != null && billing.isReady();
        }

        @JavascriptInterface
        public void startPurchase(final String productId) {
            startPurchase(productId, null);
        }

        @JavascriptInterface
        public void startPurchase(final String productId, final String email) {
            pendingPurchaseEmail = email;
            runOnUiThread(new Runnable() {
                public void run() {
                    if (billing != null) billing.launchPurchase(MainActivity.this, productId);
                }
            });
        }

        @JavascriptInterface
        public String getBackendUrl() {
            return BACKEND_URL;
        }

        @JavascriptInterface
        public String getAppVersion() {
            try {
                android.content.pm.PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                return pi.versionName + " (" + pi.versionCode + ")";
            } catch (Exception e) {
                return "";
            }
        }

        // Ritorna lo stato di consenso persistito: "granted", "denied" oppure
        // stringa vuota se l'utente non ha ancora scelto (JS mostrera' il
        // banner alla prima apertura).
        @JavascriptInterface
        public String getAnalyticsConsent() {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                String state = prefs.getString(KEY_CONSENT_STATE, null);
                return state == null ? "" : state;
            } catch (Exception e) {
                return "";
            }
        }

        // Setta lo stato di consenso (chiamato dal JS bridge dopo la scelta
        // dell'utente nel banner). Values: "granted" | "denied".
        @JavascriptInterface
        public void setAnalyticsConsent(final String value) {
            final boolean granted = CONSENT_GRANTED.equals(value);
            final String persisted = granted ? CONSENT_GRANTED : CONSENT_DENIED;
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                prefs.edit().putString(KEY_CONSENT_STATE, persisted).apply();
            } catch (Exception ignore) { /* noop */ }
            runOnUiThread(new Runnable() {
                public void run() {
                    applyConsent(granted);
                }
            });
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Play Billing callback + server verify                             */
    /* ------------------------------------------------------------------ */
    private void onPurchaseResult(final BillingManager.PurchaseResult r) {
        runOnUiThread(new Runnable() {
            public void run() {
                switch (r.kind) {
                    case USER_CANCELED:
                        evalJs("window.onPurchaseCancelled && window.onPurchaseCancelled();");
                        logAnalytics("play_billing_cancelled", null);
                        break;
                    case PENDING:
                        evalJs("window.onPurchasePending && window.onPurchasePending();");
                        logAnalytics("play_billing_pending", null);
                        break;
                    case ERROR:
                        evalJs("window.onPurchaseError && window.onPurchaseError('" + esc(r.reasonSlug) + "');");
                        logAnalytics("play_billing_error", "{\"reason\":\"" + esc(r.reasonSlug) + "\"}");
                        break;
                    case SUCCESS:
                        logAnalytics("play_billing_purchased", "{\"restore\":" + (r.fromRestore ? "1" : "0") + "}");
                        verifyPurchaseOnServer(r);
                        break;
                }
            }
        });
    }

    private void verifyPurchaseOnServer(final BillingManager.PurchaseResult r) {
        new Thread(new Runnable() {
            public void run() {
                String body;
                try {
                    JSONObject j = new JSONObject();
                    j.put("purchaseToken", r.purchaseToken);
                    j.put("productId", r.productId);
                    if (pendingPurchaseEmail != null && !pendingPurchaseEmail.isEmpty()) {
                        j.put("email", pendingPurchaseEmail);
                    }
                    body = j.toString();
                } catch (JSONException e) {
                    postPurchaseError("body_json_error");
                    return;
                }
                try {
                    HttpURLConnection conn = (HttpURLConnection) new URL(BACKEND_URL + "/api/play-billing/verify").openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setDoOutput(true);
                    byte[] bytes = body.getBytes("UTF-8");
                    conn.setRequestProperty("Content-Length", String.valueOf(bytes.length));
                    OutputStream os = conn.getOutputStream();
                    os.write(bytes);
                    os.close();
                    int code = conn.getResponseCode();
                    InputStream is = code < 400 ? conn.getInputStream() : conn.getErrorStream();
                    BufferedReader br = new BufferedReader(new InputStreamReader(is, "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    br.close();
                    JSONObject resp = new JSONObject(sb.toString());
                    if (code == 200 && resp.has("codice")) {
                        final String codice = resp.getString("codice");
                        final String piano = resp.optString("piano", "founder");
                        // I prodotti consumable (acquisto_singolo) vanno segnalati a Play
                        // altrimenti l'utente non può riacquistare la stessa consulenza.
                        // Il piano 'founder' resta non-consumable (lifetime).
                        if ("singolo".equals(piano) && billing != null && r.purchaseToken != null) {
                            billing.consume(r.purchaseToken);
                        }
                        runOnUiThread(new Runnable() {
                            public void run() {
                                evalJs("window.onProActivated && window.onProActivated('" + esc(codice) + "', '" + esc(piano) + "');");
                                logAnalytics("play_billing_verified", "{\"piano\":\"" + esc(piano) + "\"}");
                            }
                        });
                    } else {
                        postPurchaseError(resp.optString("error", "verify_failed_" + code));
                    }
                } catch (Exception e) {
                    postPurchaseError("network_" + (e.getMessage() == null ? "unknown" : e.getMessage()));
                }
            }
        }).start();
    }

    private void postPurchaseError(final String reasonSlug) {
        runOnUiThread(new Runnable() {
            public void run() {
                evalJs("window.onPurchaseError && window.onPurchaseError('" + esc(reasonSlug) + "');");
                logAnalytics("play_billing_verify_error", "{\"reason\":\"" + esc(reasonSlug) + "\"}");
            }
        });
    }

    private void evalJs(String js) {
        if (webView != null) webView.evaluateJavascript(js, null);
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n");
    }

    private void logAnalytics(String event, String paramsJson) {
        if (mFirebaseAnalytics == null) return;
        Bundle b = new Bundle();
        if (paramsJson != null) {
            try {
                JSONObject j = new JSONObject(paramsJson);
                Iterator<String> keys = j.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    Object v = j.opt(k);
                    if (v instanceof String) b.putString(k, (String) v);
                    else if (v != null) b.putString(k, String.valueOf(v));
                }
            } catch (Exception ignore) {}
        }
        mFirebaseAnalytics.logEvent(event, b);
    }

    /* ------------------------------------------------------------------ */
    /*  Async HTTP Task                                                      */
    /* ------------------------------------------------------------------ */
    class APITask extends AsyncTask<Void, Void, Void> {
        private final String url, method, headersJson, body, callbackId;

        APITask(String url, String method, String headersJson, String body, String callbackId) {
            this.url = url;
            this.method = method;
            this.headersJson = headersJson;
            this.body = body;
            this.callbackId = callbackId;
        }

        @Override
        protected Void doInBackground(Void... params) {
            String result = null;
            String errorCode = null;
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(120000);

                JSONObject hdrs = new JSONObject(headersJson);
                Iterator<String> keys = hdrs.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    conn.setRequestProperty(k, hdrs.getString(k));
                }

                if (body != null && !body.isEmpty()) {
                    conn.setDoOutput(true);
                    byte[] bytes = body.getBytes("UTF-8");
                    conn.setRequestProperty("Content-Length", String.valueOf(bytes.length));
                    OutputStream os = conn.getOutputStream();
                    os.write(bytes);
                    os.close();
                }

                int code = conn.getResponseCode();
                InputStream is = code < 400 ? conn.getInputStream() : conn.getErrorStream();
                BufferedReader br = new BufferedReader(new InputStreamReader(is, "UTF-8"));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();
                result = sb.toString();

            } catch (SocketTimeoutException e) {
                errorCode = "network_timeout";
            } catch (UnknownHostException e) {
                errorCode = "network_unavailable";
            } catch (Exception e) {
                errorCode = "server_error";
            }

            String cbKey = "cb_" + callbackId;
            try {
                if (result != null) {
                    String payload = Base64.encodeToString(
                            result.getBytes(Charset.forName("UTF-8")), Base64.NO_WRAP);
                    pendingResults.put(cbKey, BridgeResult.success(payload).toJson());
                } else {
                    pendingResults.put(cbKey, BridgeResult.error(
                            errorCode != null ? errorCode : "server_error").toJson());
                }
            } catch (JSONException error) {
                pendingResults.put(cbKey, "{\"ok\":false,\"error\":\"invalid_response\"}");
            }
            final String key = cbKey;
            runOnUiThread(new Runnable() {
                public void run() {
                    webView.evaluateJavascript("window._apiReady('" + key + "')", null);
                }
            });
            return null;
        }
    }
}
