package ru.canrush.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import ru.rustore.sdk.core.feature.model.FeatureAvailabilityResult;
import ru.rustore.sdk.pushclient.RuStorePushClient;

/**
 * Push setup the site cannot do itself. `status()` tells whether this build carries Firebase config
 * (google-services.json → the generated google_app_id string): without it FCM registration fails,
 * so the site does not ask for the permission at all. The «canrush» channel is what the server sends to.
 */
@CapacitorPlugin(name = "CanrushPush")
public class CanrushPushPlugin extends Plugin {

    static final String CHANNEL_ID = "canrush";

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getContext().getString(R.string.push_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription(getContext().getString(R.string.push_channel_description));
        manager.createNotificationChannel(channel);
    }

    /**
     * RuStore Push token, for phones where FCM is unavailable. Needs the RuStore app on the phone and this
     * build signed with the key registered in RuStore Console; otherwise the call is rejected.
     */
    @PluginMethod
    public void rustoreToken(PluginCall call) {
        RuStorePushClient.INSTANCE.checkPushAvailability()
            .addOnSuccessListener(result -> {
                if (!(result instanceof FeatureAvailabilityResult.Available)) {
                    call.reject("RuStore Push is unavailable");
                    return;
                }
                RuStorePushClient.INSTANCE.getToken()
                    .addOnSuccessListener(token -> {
                        JSObject value = new JSObject();
                        value.put("token", token);
                        call.resolve(value);
                    })
                    .addOnFailureListener(error -> call.reject(String.valueOf(error.getMessage())));
            })
            .addOnFailureListener(error -> call.reject(String.valueOf(error.getMessage())));
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context context = getContext();
        boolean fcm = context.getResources().getIdentifier("google_app_id", "string", context.getPackageName()) != 0;
        JSObject result = new JSObject();
        result.put("fcm", fcm);
        call.resolve(result);
    }
}
