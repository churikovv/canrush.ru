package ru.canrush.app;

import androidx.annotation.NonNull;
import java.util.List;
import ru.rustore.sdk.pushclient.messaging.exception.RuStorePushClientException;
import ru.rustore.sdk.pushclient.messaging.model.RemoteMessage;
import ru.rustore.sdk.pushclient.messaging.service.RuStoreMessagingService;

/**
 * RuStore Push delivery. The server sends `notification` with a deep link, so the SDK shows the notification
 * itself and a tap opens https://canrush.ru/… in MainActivity. The token is read by CanrushPushPlugin on each
 * app start and re-sent by the site, so a rotated token needs nothing here.
 */
public class CanrushRuStoreMessagingService extends RuStoreMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {}

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {}

    @Override
    public void onDeletedMessages() {}

    @Override
    public void onError(@NonNull List<? extends RuStorePushClientException> errors) {}
}
