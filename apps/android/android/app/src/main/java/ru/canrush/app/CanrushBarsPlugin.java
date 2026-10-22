package ru.canrush.app;

import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Colours behind the status and navigation bars. With WebView 140+ the page itself draws under the bars
 * (viewport-fit=cover); older WebViews are padded by Capacitor and the window background shows there instead,
 * so the site passes its header backing (`top`) and tab bar (`bottom`) colours. The middle is always covered
 * by the WebView, so a gradient that switches colour mid-screen is invisible.
 */
@CapacitorPlugin(name = "CanrushBars")
public class CanrushBarsPlugin extends Plugin {

    private Integer top;
    private Integer bottom;

    @PluginMethod
    public void setColors(PluginCall call) {
        try {
            top = Color.parseColor(call.getString("top", ""));
            bottom = Color.parseColor(call.getString("bottom", ""));
        } catch (IllegalArgumentException e) {
            call.reject("Colours must be #RRGGBB");
            return;
        }
        getActivity().runOnUiThread(() -> {
            apply();
            call.resolve();
        });
    }

    /** A theme switch makes SystemBars reset the window background: put ours back right after it. */
    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        getActivity().getWindow().getDecorView().post(this::apply);
    }

    private void apply() {
        if (top == null || bottom == null) return;
        GradientDrawable background = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] { top, top, top, bottom, bottom, bottom }
        );
        getActivity().getWindow().getDecorView().setBackground(background);
    }
}
