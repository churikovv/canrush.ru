package ru.canrush.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String SITE_HOST = "canrush.ru";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TelegramLinksPlugin.class);
        registerPlugin(CanrushPushPlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().getWebView().setWebChromeClient(new MediaChooserChromeClient(getBridge()));
        openSiteLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openSiteLink(intent);
    }

    // Оболочка грузит server.url; ссылку canrush.ru из App Links открываем в том же WebView,
    // чтобы вход из письма и общие ссылки вели на нужную страницу, а не на главную.
    private void openSiteLink(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || !"https".equals(uri.getScheme()) || !SITE_HOST.equals(uri.getHost())) return;
        if (getBridge() == null) return;
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(uri.toString()));
    }
}
