package ru.eva.life;

import android.app.ActivityManager;
import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.Process;
import android.os.StatFs;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class DeviceMonitor {
    private static final long RECENT_MS = 60 * 60 * 1000L;
    private final Context context;
    private long lastWall = -1;
    private long lastCpu;

    DeviceMonitor(Context context) {
        this.context = context.getApplicationContext();
    }

    JSONObject read(String tab) throws JSONException {
        ActivityManager manager = context.getSystemService(ActivityManager.class);
        JSONObject out = new JSONObject();
        if ("apps".equals(tab)) return apps(manager, out);
        if ("services".equals(tab)) return services(manager, out);
        ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
        manager.getMemoryInfo(memory);
        StatFs disk = new StatFs(context.getFilesDir().getPath());
        out.put("memoryTotal", memory.totalMem).put("memoryFree", memory.availMem)
            .put("diskTotal", disk.getTotalBytes()).put("diskFree", disk.getAvailableBytes())
            .put("uptime", SystemClock.elapsedRealtime());
        if (Build.VERSION.SDK_INT >= 29) {
            PowerManager power = context.getSystemService(PowerManager.class);
            out.put("thermal", power.getCurrentThermalStatus());
        }
        Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (battery != null) {
            int temp = battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
            if (temp >= -500 && temp <= 1000) out.put("batteryTemp", temp / 10.0);
            int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, 0);
            if (level >= 0 && scale > 0) out.put("battery", Math.round(level * 100f / scale));
        }
        long wall = SystemClock.elapsedRealtime();
        long cpu = Process.getElapsedCpuTime();
        if (lastWall >= 0 && wall > lastWall && wall - lastWall <= 15000) {
            out.put("cpuPercent", Math.round(100.0 * Math.max(0, cpu - lastCpu) / (wall - lastWall)));
        }
        lastWall = wall;
        lastCpu = cpu;
        return out;
    }

    private JSONObject apps(ActivityManager manager, JSONObject out) throws JSONException {
        JSONArray running = new JSONArray();
        List<ActivityManager.RunningAppProcessInfo> processes = manager.getRunningAppProcesses();
        if (processes != null) {
            for (ActivityManager.RunningAppProcessInfo process : processes) {
                JSONArray packages = new JSONArray();
                if (process.pkgList != null) for (String pkg : process.pkgList) packages.put(pkg);
                running.put(new JSONObject().put("name", process.processName)
                    .put("pid", process.pid).put("importance", process.importance).put("packages", packages));
                if (running.length() == 60) break;
            }
        }
        out.put("running", running);
        AppOpsManager ops = context.getSystemService(AppOpsManager.class);
        int access = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
        out.put("usageAccess", access == AppOpsManager.MODE_ALLOWED);
        JSONArray recent = new JSONArray();
        if (access == AppOpsManager.MODE_ALLOWED) {
            UsageStatsManager usage = context.getSystemService(UsageStatsManager.class);
            long end = System.currentTimeMillis();
            Map<String, Long> lastUsed = new HashMap<>();
            try {
                for (UsageStats item : usage.queryUsageStats(UsageStatsManager.INTERVAL_BEST, end - RECENT_MS, end)) {
                    long last = item.getLastTimeUsed();
                    if (last >= end - RECENT_MS && last <= end) lastUsed.merge(item.getPackageName(), last, Math::max);
                }
            } catch (SecurityException revoked) {
                out.put("usageAccess", false);
            }
            List<Map.Entry<String, Long>> ordered = new ArrayList<>(lastUsed.entrySet());
            ordered.sort(Map.Entry.comparingByValue(Comparator.reverseOrder()));
            for (Map.Entry<String, Long> item : ordered) {
                recent.put(new JSONObject().put("package", item.getKey()).put("lastUsed", item.getValue()));
                if (recent.length() == 30) break;
            }
        }
        return out.put("recent", recent);
    }

    private JSONObject services(ActivityManager manager, JSONObject out) throws JSONException {
        JSONArray rows = new JSONArray();
        for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(64)) {
            if (!context.getPackageName().equals(service.service.getPackageName())) continue;
            rows.put(new JSONObject().put("name", service.service.getShortClassName())
                .put("foreground", service.foreground).put("pid", service.pid));
        }
        return out.put("services", rows);
    }
}
