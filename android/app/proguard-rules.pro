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
# BillingManager e' del progetto: R8 non ha consumer rules per il nostro codice.
# Il method reference this::onPurchaseResult e i callback interni giustificano il keep.
-keep class it.sherlock.polizze.BillingManager { *; }
-keep class it.sherlock.polizze.BillingManager$* { *; }

# Librerie Google (Firebase, GMS, Play Core, Play Billing): reintrodotte le
# keep wildcard in v4.6.16/vc74 dopo che la vc73 (senza wildcard) e' stata
# rigettata da Google Play review con "Broken Functionality — Crashes: Your app
# crashes after opening". Il crash NON e' apparso nel report pre-lancio Firebase
# Test Lab ne' in Android vitals: e' probabile che una specifica classe di
# Firebase/BillingClient caricata via reflection sul device del reviewer fosse
# stata offuscata da R8 senza copertura da consumer proguard rules dell'AAR.
# La v4.6.13/vc71 aveva queste stesse wildcard e non aveva crash: ripristiniamo
# la strategia "prudenza" a costo di ~11% di dimensione. In futuro (v4.6.17+)
# si possono restringere a keep mirati SE si dispone di uno stack trace.
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.play.core.** { *; }
-keep class com.android.billingclient.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
-dontwarn com.google.android.play.core.**
-dontwarn com.android.billingclient.**

# --- JS callbacks invoked via evaluateJavascript from Java ---
# window.onProActivated, onPurchaseCancelled, onPurchaseError, onPurchasePending,
# _apiReady — questi vivono nel JS, non nel Java, quindi non serve keep. Ok.

# --- Standard Android/Kotlin rules already included via proguard-android-optimize.txt ---
