package ru.eva.envtest;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public final class EvaPresence {
    private static JSONObject profile;

    private EvaPresence() {}

    private static synchronized JSONObject profile(Context context) {
        if (profile == null) {
            try (InputStream in = context.getAssets().open("eva-presence.json");
                 ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[1024];
                for (int n; (n = in.read(buffer)) != -1;) bytes.write(buffer, 0, n);
                profile = new JSONObject(bytes.toString("UTF-8"));
            } catch (Exception unavailable) {
                profile = new JSONObject();
            }
        }
        return profile;
    }

    public static String webProfile(Context context) {
        return profile(context).toString();
    }

    static Curve curve(Context context, String name) {
        JSONArray values = profile(context).optJSONArray(name);
        if (values == null) return new Curve(0, 0, 0);
        return new Curve(values.optInt(0), (float) values.optDouble(1, 0), (float) values.optDouble(2, 0));
    }

    static final class Curve {
        final int duration;
        final float displacement;
        final float angle;

        Curve(int duration, float displacement, float angle) {
            this.duration = duration;
            this.displacement = displacement;
            this.angle = angle;
        }

        float amount(long elapsed) {
            if (elapsed <= 0 || elapsed >= duration) return 0;
            double value = Math.sin(Math.PI * elapsed / duration);
            return (float) (value * value);
        }
    }
}
