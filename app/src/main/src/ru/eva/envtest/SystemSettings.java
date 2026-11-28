package ru.eva.envtest;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.widget.Toast;

/** Optional system screens differ across Android builds and restricted profiles. */
public final class SystemSettings {
    private SystemSettings() {}

    public static boolean open(Activity activity, Intent... choices) {
        for (Intent intent : choices) {
            try {
                activity.startActivity(intent);
                return true;
            } catch (ActivityNotFoundException | SecurityException unavailable) {
                // Some system activities accept the unscoped action only.
            }
        }
        Toast.makeText(activity,"Эти настройки Android недоступны в текущем профиле",Toast.LENGTH_LONG).show();
        return false;
    }

    public static boolean accessibility(Activity activity) {
        return open(activity, new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS), new Intent(Settings.ACTION_SETTINGS));
    }

    public static boolean overlay(Activity activity) {
        String action=Settings.ACTION_MANAGE_OVERLAY_PERMISSION;
        return open(activity, new Intent(action, Uri.parse("package:"+activity.getPackageName())), new Intent(action));
    }
}
