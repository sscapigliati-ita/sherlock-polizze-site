package it.sherlock.polizze;

import android.app.Activity;
import android.content.Context;
import android.util.Log;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.Collections;
import java.util.List;

public class BillingManager implements PurchasesUpdatedListener {

    private static final String TAG = "BillingManager";

    public enum ResultKind { SUCCESS, USER_CANCELED, ERROR, PENDING }

    public static class PurchaseResult {
        public final ResultKind kind;
        public final String productId;
        public final String purchaseToken;
        public final String orderId;
        public final String reasonSlug;
        public final boolean fromRestore;

        public PurchaseResult(ResultKind kind, String productId, String purchaseToken,
                              String orderId, String reasonSlug, boolean fromRestore) {
            this.kind = kind;
            this.productId = productId;
            this.purchaseToken = purchaseToken;
            this.orderId = orderId;
            this.reasonSlug = reasonSlug;
            this.fromRestore = fromRestore;
        }
    }

    public interface ResultListener {
        void onResult(PurchaseResult r);
    }

    private final Context appContext;
    private final ResultListener listener;
    private final BillingClient billingClient;
    private boolean connected = false;

    public BillingManager(Context context, ResultListener listener) {
        this.appContext = context.getApplicationContext();
        this.listener = listener;
        this.billingClient = BillingClient.newBuilder(appContext)
                .setListener(this)
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
    }

    public void connect() {
        if (connected) return;
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult br) {
                connected = (br.getResponseCode() == BillingClient.BillingResponseCode.OK);
                Log.i(TAG, "Setup finished: " + br.getResponseCode() + " " + br.getDebugMessage());
            }
            @Override
            public void onBillingServiceDisconnected() {
                connected = false;
                Log.w(TAG, "Disconnected; will retry on next call");
            }
        });
    }

    public void disconnect() {
        if (billingClient != null && billingClient.isReady()) {
            billingClient.endConnection();
        }
        connected = false;
    }

    public boolean isReady() {
        return connected && billingClient != null && billingClient.isReady();
    }

    public void launchPurchase(final Activity host, final String productId) {
        if (!isReady()) {
            listener.onResult(new PurchaseResult(ResultKind.ERROR, productId, null, null, "not_ready", false));
            return;
        }
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(product))
                .build();
        billingClient.queryProductDetailsAsync(params, (result, queryResult) -> {
            // v9 breaking: il secondo arg è QueryProductDetailsResult, non più
            // List<ProductDetails> diretto. La lista si estrae da getProductDetailsList().
            List<ProductDetails> list = queryResult.getProductDetailsList();
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || list.isEmpty()) {
                listener.onResult(new PurchaseResult(ResultKind.ERROR, productId, null, null,
                        "product_not_found", false));
                return;
            }
            ProductDetails details = list.get(0);
            BillingFlowParams.ProductDetailsParams pdp = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details)
                    .build();
            BillingFlowParams flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(pdp))
                    .build();
            BillingResult launch = billingClient.launchBillingFlow(host, flow);
            if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                listener.onResult(new PurchaseResult(ResultKind.ERROR, productId, null, null,
                        "launch_failed_" + launch.getResponseCode(), false));
            }
        });
    }

    // Segnala a Play che un prodotto consumable è stato "usato" e può essere
    // riacquistato. Usato per acquisto_singolo dopo la verify/emissione codice
    // lato server; non toccare per founder_lifetime che è non-consumable.
    public void consume(String purchaseToken) {
        if (!isReady() || purchaseToken == null || purchaseToken.isEmpty()) return;
        ConsumeParams params = ConsumeParams.newBuilder()
                .setPurchaseToken(purchaseToken)
                .build();
        billingClient.consumeAsync(params, (br, token) -> {
            Log.i(TAG, "consume result=" + br.getResponseCode() + " msg=" + br.getDebugMessage());
        });
    }

    public void queryExistingPurchases() {
        if (!isReady()) return;
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        billingClient.queryPurchasesAsync(params, (br, purchases) -> {
            if (br.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    deliverPurchase(p, true);
                }
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult br, List<Purchase> purchases) {
        int code = br.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            listener.onResult(new PurchaseResult(ResultKind.USER_CANCELED, null, null, null, "user_canceled", false));
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null) {
            listener.onResult(new PurchaseResult(ResultKind.ERROR, null, null, null, "code_" + code, false));
            return;
        }
        for (Purchase p : purchases) {
            deliverPurchase(p, false);
        }
    }

    private void deliverPurchase(Purchase p, boolean fromRestore) {
        int state = p.getPurchaseState();
        String pid = p.getProducts().isEmpty() ? null : p.getProducts().get(0);
        if (state == Purchase.PurchaseState.PENDING) {
            listener.onResult(new PurchaseResult(ResultKind.PENDING, pid, p.getPurchaseToken(), p.getOrderId(), null, fromRestore));
            return;
        }
        if (state == Purchase.PurchaseState.PURCHASED) {
            listener.onResult(new PurchaseResult(ResultKind.SUCCESS, pid, p.getPurchaseToken(), p.getOrderId(), null, fromRestore));
        }
    }
}
