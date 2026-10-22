package ru.canrush.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Screenshots made on the site (tier lists, drink calendar): the WebView cannot download a blob link or copy
 * an image, so the site sends the PNG as base64. `save` puts it in Pictures/CanRush (MediaStore, Android 10+,
 * no permission); `share` opens the system share sheet with the file.
 */
@CapacitorPlugin(name = "CanrushImage")
public class CanrushImagePlugin extends Plugin {

    private static final String ALBUM = "CanRush";

    @PluginMethod
    public void save(PluginCall call) {
        byte[] png = decode(call);
        if (png == null) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Сохранение доступно на Android 10 и новее", "UNSUPPORTED");
            return;
        }
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName(call));
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + ALBUM);
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            call.reject("Не удалось создать файл");
            return;
        }
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new IOException("No output stream");
            out.write(png);
        } catch (IOException e) {
            resolver.delete(uri, null, null);
            call.reject("Не удалось сохранить изображение");
            return;
        }
        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        resolver.update(uri, values, null, null);
        call.resolve();
    }

    @PluginMethod
    public void share(PluginCall call) {
        byte[] png = decode(call);
        if (png == null) return;
        File dir = new File(getContext().getCacheDir(), "shared");
        if (!dir.exists() && !dir.mkdirs()) {
            call.reject("Не удалось подготовить файл");
            return;
        }
        File file = new File(dir, fileName(call));
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(png);
        } catch (IOException e) {
            call.reject("Не удалось подготовить файл");
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
        Intent send = new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        String title = call.getString("title");
        if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, title);
        Intent chooser = Intent.createChooser(send, null).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(chooser);
        call.resolve();
    }

    private byte[] decode(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Нет изображения");
            return null;
        }
        try {
            return Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Повреждённое изображение");
            return null;
        }
    }

    /** Only letters, digits, dashes and dots from the site's name, always ending in .png. */
    private String fileName(PluginCall call) {
        String name = call.getString("fileName", "canrush.png").replaceAll("[^A-Za-z0-9._-]", "");
        if (name.isEmpty()) name = "canrush.png";
        return name.endsWith(".png") ? name : name + ".png";
    }
}
