package ru.canrush.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Ссылки t.me на бота или канал открываются сразу в Telegram (tg://resolve), а не через браузер:
 * Telegram, установленный не из Google Play (RuStore, telegram.org), не закреплён за t.me, и Chrome
 * уводил на страницу «Скачать Telegram». Если Telegram не установлен — обычная обработка Capacitor.
 */
@CapacitorPlugin(name = "TelegramLinks")
public class TelegramLinksPlugin extends Plugin {

    private static final Pattern USERNAME = Pattern.compile("[A-Za-z0-9_]{4,32}");

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (!"https".equals(url.getScheme()) && !"http".equals(url.getScheme())) return null;
        String host = url.getHost();
        if (!"t.me".equals(host) && !"telegram.me".equals(host)) return null;
        List<String> segments = url.getPathSegments();
        if (segments.size() != 1 || !USERNAME.matcher(segments.get(0)).matches()) return null;

        Uri.Builder tg = new Uri.Builder().scheme("tg").authority("resolve").appendQueryParameter("domain", segments.get(0));
        for (String name : url.getQueryParameterNames()) {
            String value = url.getQueryParameter(name);
            if (value != null) tg.appendQueryParameter(name, value);
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, tg.build());
        if (intent.resolveActivity(getContext().getPackageManager()) == null) return null;
        try {
            getActivity().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            return null;
        }
    }
}
