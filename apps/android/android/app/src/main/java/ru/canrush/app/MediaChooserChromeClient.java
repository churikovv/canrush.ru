package ru.canrush.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Поля выбора фото на сайте (accept="image/…") без атрибута capture: Capacitor открывает только
 * галерею, а Chrome на телефоне предлагает ещё и камеру. Здесь — системный выбор, где рядом с
 * галереей есть «Снять фото» (и «Снять видео», если поле принимает видео). Остальное — как в Capacitor.
 * CAMERA в манифесте не объявлен намеренно: тогда приложению камеры разрешение не нужно.
 */
public class MediaChooserChromeClient extends BridgeWebChromeClient {

    private final Bridge bridge;
    private final ActivityResultLauncher<Intent> chooserLauncher;
    private ValueCallback<Uri[]> pendingCallback;
    private File pendingPhoto;

    public MediaChooserChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
        chooserLauncher = bridge.registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), this::onChooserResult);
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
        String[] types = params.getAcceptTypes();
        if (params.isCaptureEnabled() || !accepts(types, "image/")) {
            return super.onShowFileChooser(webView, callback, params);
        }

        Intent pick = params.createIntent();
        if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        String[] mimeTypes = mimeTypes(types);
        if (mimeTypes.length > 1) pick.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);

        List<Intent> capture = new ArrayList<>();
        File photo = null;
        try {
            photo = createPhotoFile();
            Uri photoUri = FileProvider.getUriForFile(bridge.getContext(), bridge.getContext().getPackageName() + ".fileprovider", photo);
            Intent takePhoto = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            takePhoto.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
            takePhoto.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (takePhoto.resolveActivity(bridge.getActivity().getPackageManager()) != null) capture.add(takePhoto);
        } catch (IOException | IllegalArgumentException ignored) {
            // Без временного файла камера недоступна, остаётся галерея.
        }
        if (accepts(types, "video/")) {
            Intent takeVideo = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
            if (takeVideo.resolveActivity(bridge.getActivity().getPackageManager()) != null) capture.add(takeVideo);
        }

        Intent chooser = Intent.createChooser(pick, bridge.getContext().getString(R.string.media_chooser_title));
        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, capture.toArray(new Intent[0]));

        cancelPending();
        pendingCallback = callback;
        pendingPhoto = photo;
        try {
            chooserLauncher.launch(chooser);
        } catch (ActivityNotFoundException e) {
            cancelPending();
            return super.onShowFileChooser(webView, callback, params);
        }
        return true;
    }

    private void onChooserResult(ActivityResult result) {
        ValueCallback<Uri[]> callback = pendingCallback;
        File photo = pendingPhoto;
        pendingCallback = null;
        pendingPhoto = null;
        if (callback == null) return;

        Uri[] uris = null;
        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                uris = new Uri[count];
                for (int i = 0; i < count; i++) uris[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                uris = new Uri[] { data.getData() };
            } else if (photo != null && photo.length() > 0) {
                uris = new Uri[] {
                    FileProvider.getUriForFile(bridge.getContext(), bridge.getContext().getPackageName() + ".fileprovider", photo)
                };
                photo = null;
            }
        }
        if (photo != null) photo.delete();
        callback.onReceiveValue(uris);
    }

    private void cancelPending() {
        if (pendingCallback != null) pendingCallback.onReceiveValue(null);
        if (pendingPhoto != null) pendingPhoto.delete();
        pendingCallback = null;
        pendingPhoto = null;
    }

    private File createPhotoFile() throws IOException {
        File dir = new File(bridge.getContext().getCacheDir(), "camera");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Нет папки для снимков");
        return File.createTempFile("photo_", ".jpg", dir);
    }

    private static boolean accepts(String[] types, String prefix) {
        for (String type : types) {
            if (type.startsWith(prefix)) return true;
        }
        return false;
    }

    private static String[] mimeTypes(String[] types) {
        List<String> result = new ArrayList<>();
        for (String type : types) {
            if (type.contains("/") && !result.contains(type)) result.add(type);
        }
        return result.toArray(new String[0]);
    }
}
