package org.evaassistant.smoke;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityNodeInfo;
import android.accessibilityservice.AccessibilityService;
import android.webkit.WebView;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import org.json.JSONArray;
import org.json.JSONObject;

/** Exercises the signed release with real pointer input, including the system HOME round trip. */
public final class HomeSmoke extends Instrumentation {
    private volatile Activity home;
    private static final String TAG = "EvaHomeSmoke";

    @Override public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        start();
    }

    @Override public void callActivityOnResume(Activity activity) {
        super.callActivityOnResume(activity);
        if ("ru.eva.life.Home".equals(activity.getClass().getName())) home = activity;
    }

    private static void await(String description, BooleanSupplier condition) {
        long deadline = SystemClock.elapsedRealtime() + 90_000;
        while (SystemClock.elapsedRealtime() < deadline) {
            if (condition.getAsBoolean()) {
                Log.i(TAG, description);
                return;
            }
            SystemClock.sleep(200);
        }
        throw new AssertionError("Timed out waiting for " + description);
    }

    private static WebView webView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView nested = webView(group.getChildAt(i));
                if (nested != null) return nested;
            }
        }
        return null;
    }

    private String dom(String expression) {
        ArrayBlockingQueue<String> reply = new ArrayBlockingQueue<>(1);
        home.runOnUiThread(() -> {
            WebView web = webView(home.getWindow().getDecorView());
            if (web == null) reply.offer("null");
            else web.evaluateJavascript(expression, value -> reply.offer(value == null ? "null" : value));
        });
        try {
            String value = reply.poll(5, TimeUnit.SECONDS);
            return value == null ? "null" : value;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError(e);
        }
    }

    private void visible(String selector) {
        await(selector, () -> "true".equals(dom("!!document.querySelector(" + JSONObject.quote(selector)
                + ")?.getClientRects().length")));
    }

    private void tap(String selector) throws Exception {
        visible(selector);
        String rect = dom("(()=>{const r=document.querySelector(" + JSONObject.quote(selector)
            + ").getBoundingClientRect();return [(r.left+r.width/2)/innerWidth,(r.top+r.height/2)/innerHeight]})()");
        JSONArray point = new JSONArray(rect);
        float nx = (float) point.getDouble(0), ny = (float) point.getDouble(1);
        if (nx < 0 || nx > 1 || ny < 0 || ny > 1) throw new AssertionError("Outside screen: " + selector);
        float[] pixels = new float[2];
        runOnMainSync(() -> {
            WebView web = webView(home.getWindow().getDecorView());
            int[] location = new int[2];
            web.getLocationOnScreen(location);
            pixels[0] = location[0] + nx * web.getWidth();
            pixels[1] = location[1] + ny * web.getHeight();
        });
        long start = SystemClock.uptimeMillis();
        for (int action : new int[]{MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP}) {
            MotionEvent event = MotionEvent.obtain(start, SystemClock.uptimeMillis(), action, pixels[0], pixels[1], 0);
            event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
            try { sendPointerSync(event); } finally { event.recycle(); }
            if (action == MotionEvent.ACTION_DOWN) SystemClock.sleep(60);
        }
    }

    private boolean activePackage(String expected) {
        AccessibilityNodeInfo root = getUiAutomation().getRootInActiveWindow();
        return root != null && expected.contentEquals(root.getPackageName() == null ? "" : root.getPackageName());
    }

    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            Intent entry = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ComponentName target = entry.resolveActivity(getTargetContext().getPackageManager());
            String pkg = getTargetContext().getPackageName();
            if (!new ComponentName(pkg, "ru.eva.life.Home").equals(target)) throw new AssertionError("Default HOME: " + target);
            if (!getUiAutomation().performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)) throw new AssertionError("System rejected HOME");
            await("launcher window", () -> home != null && activePackage(pkg));
            await("launcher ready", () -> "true".equals(dom("typeof window.openDeviceMonitor==='function' && typeof window.setHomeActive==='function'")));
            tap("#device-monitor");
            visible("#sheet[data-page='device-monitor'] .device-metrics");
            tap("button[data-tab='services']");
            visible("button[data-tab='services'][aria-pressed='true']");
            visible(".device-results .sub");
            tap(".device-refresh");
            tap("#close");
            home.startActivity(new Intent(Settings.ACTION_SETTINGS));
            await("system Settings", () -> activePackage("com.android.settings"));
            if (!getUiAutomation().performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)) throw new AssertionError("System rejected HOME");
            await("return to launcher", () -> activePackage(pkg));
            tap("#all");
            visible("#sheet[data-page='apps'] #app-search");
            tap("#close");
            await("drawer closed", () -> "true".equals(dom("document.getElementById('sheet').hidden")));
            result.putString("eva", "PASSED");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            result.putString("eva", Log.getStackTraceString(error));
            finish(Activity.RESULT_CANCELED, result);
        }
    }
}
