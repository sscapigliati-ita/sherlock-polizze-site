# === Sherlock Polizze — ProGuard/R8 rules ===

# Keep line numbers for readable stack traces in Play Console
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- WebView JavaScript Bridge (critical) ---
# The HTML in assets/www/index.html calls Android.callAPI, Android.startPurchase,
# Android.track, Android.openURL, Android.showToast, Android.shareText,
# Android.vibrate, Android.isPlayBillingAvailable, Android.getResult,
# Android.getDeviceId, Android.getBackendUrl. If R8 renames them the app breaks.
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class it.sherlock.polizze.MainActivity { *; }
-keep class it.sherlock.polizze.MainActivity$* { *; }

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
