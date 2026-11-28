package ru.eva.envtest;

import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Voices actually provided by the selected Android engine. One catalogue per TTS client. */
public final class AndroidVoices {
    private static final Locale RUSSIAN = Locale.forLanguageTag("ru-RU");
    private final Map<String, Voice> voices = new HashMap<>();
    private String engine = "";
    private String applied;
    private volatile String json = "[]";

    public String json() { return json; }
    public boolean engineChanged(TextToSpeech tts) {
        String now = tts.getDefaultEngine();
        return now != null && !now.equals(engine);
    }
    private static String id(String engine, String name) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] key = digest.digest((engine + '\0' + name).getBytes(StandardCharsets.UTF_8));
            return "android-tts:" + Base64.encodeToString(key, Base64.NO_WRAP | Base64.NO_PADDING | Base64.URL_SAFE);
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    public void refresh(TextToSpeech tts) {
        voices.clear(); applied = null;
        String active = tts.getDefaultEngine();
        engine = active == null ? "" : active;
        Set<Voice> available = tts.getVoices();
        JSONArray result = new JSONArray();
        if (available != null) {
            ArrayList<Voice> sorted = new ArrayList<>();
            for (Voice v : available) {
                if (v == null || v.getName() == null || v.getLocale() == null) continue;
                Set<String> features = v.getFeatures();
                if (features != null && features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                sorted.add(v);
            }
            sorted.sort((a, b) -> {
                boolean ar = "ru".equals(a.getLocale().getLanguage()), br = "ru".equals(b.getLocale().getLanguage());
                if (ar != br) return ar ? -1 : 1;
                int language = a.getLocale().toLanguageTag().compareToIgnoreCase(b.getLocale().toLanguageTag());
                return language != 0 ? language : a.getName().compareToIgnoreCase(b.getName());
            });
            for (Voice voice : sorted) {
                String key = id(engine, voice.getName());
                voices.put(key, voice);
                try { result.put(new JSONObject().put("voiceURI", key).put("name", voice.getName())
                    .put("lang", voice.getLocale().toLanguageTag()).put("localService", !voice.isNetworkConnectionRequired())); }
                catch (JSONException impossible) { throw new IllegalStateException(impossible); }
            }
        }
        json = result.toString();
    }
    public boolean apply(TextToSpeech tts, String selected) {
        String key = selected == null ? "" : selected;
        Voice candidate = voices.get(key);
        if (candidate == null) key = "";
        if (key.equals(applied)) return true;
        if (candidate != null && tts.setVoice(candidate) == TextToSpeech.SUCCESS) { applied = key; return true; }
        if (tts.setLanguage(RUSSIAN) < TextToSpeech.LANG_AVAILABLE) {
            Voice fallback = tts.getDefaultVoice();
            if (fallback == null || tts.setVoice(fallback) != TextToSpeech.SUCCESS) { applied = null; return false; }
        }
        applied = ""; return true;
    }
}
