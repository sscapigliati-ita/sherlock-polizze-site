# === Sherlock Polizze — ProGuard/R8 rules ===

# Keep line numbers for readable stack traces in Play Console
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- WebView JavaScript Bridge (critical) ---
# L'HTML in assets/www/index.html chiama Android.callAPI, Android.startPurchase,
# Android.track, Android.openURL, Android.showToast, Android.shareText,
# Android.vibrate, Android.isPlayBillingAvailable, Android.getResult,
# Android.getDeviceId, Android.getBackendUrl. Se R8 li rinomina l'app si rompe.
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
# SherlockBridge e' registrata via addJavascriptInterface e i suoi metodi sono
# chiamati dal JS tramite reflection sul nome originale. Manteniamo la classe
# integra (nome + tutti i membri). MainActivity NON serve -keep esplicito: e'
# dichiarata nel manifest e le consumer-rules Android preservano i lifecycle
# callback. Meno keep = piu' ottimizzazione R8 (target Android vitals).
-keep class it.sherlock.polizze.MainActivity$SherlockBridge { *; }

# --- Play Billing (BillingManager referenced via method reference this::onPurchaseResult) ---
-keep class it.sherlock.polizze.BillingManager { *; }
-keep class it.sherlock.polizze.BillingManager$* { *; }
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# --- Firebase Analytics (has consumer rules but be explicit) ---
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# --- Google Play In-App Update ---
-keep class com.google.android.play.core.** { *; }
-keep interface com.google.android.play.core.** { *; }
-dontwarn com.google.android.play.core.**

# --- JS callbacks invoked via evaluateJavascript from Java ---
# window.onProActivated, onPurchaseCancelled, onPurchaseError, onPurchasePending,
# _apiReady — questi vivono nel JS, non nel Java, quindi non serve keep. Ok.

# --- Standard Android/Kotlin rules already included via proguard-android-optimize.txt ---
