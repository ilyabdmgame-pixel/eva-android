package ru.eva.envtest;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reclaim stock PNGs left by an earlier application-layer extraction. */
final class RuntimePortraits {
    private static final Pattern ENTRY = Pattern.compile(
        "([0-9a-f]{64})\t(root/(?:codex-mobile/avatar|\\.codex/generated_images/eva-builtin-20261116/(?:emotions|speech))/[a-z0-9-]+\\.png)"
    );

    static void removeReplaced(File root, InputStream manifest) throws IOException {
        File base = root.getCanonicalFile();
        byte[] buffer = new byte[32768];
        try (BufferedReader lines = new BufferedReader(new InputStreamReader(manifest, StandardCharsets.US_ASCII))) {
            String line;
            while ((line = lines.readLine()) != null) {
                Matcher entry = ENTRY.matcher(line);
                if (!entry.matches()) continue;
                String path = entry.group(2);
                File old = new File(base, path);
                if (!old.isFile() || !old.equals(old.getCanonicalFile())) continue;
                File replacement = new File(base, path.substring(0, path.length()-4) + ".webp");
                if (!replacement.isFile() || !replacement.equals(replacement.getCanonicalFile())) continue;
                MessageDigest hash;
                try { hash = MessageDigest.getInstance("SHA-256"); }
                catch (NoSuchAlgorithmException e) { throw new AssertionError(e); }
                try (InputStream input = Files.newInputStream(old.toPath())) {
                    int read;
                    while ((read = input.read(buffer)) != -1) hash.update(buffer, 0, read);
                }
                if (matches(hash.digest(), entry.group(1))) Files.deleteIfExists(old.toPath());
            }
        }
    }

    private static boolean matches(byte[] hash, String expected) {
        for (int i = 0; i < hash.length; i++) {
            int high = Character.digit(expected.charAt(2*i), 16);
            int low = Character.digit(expected.charAt(2*i+1), 16);
            if ((hash[i] & 255) != (high << 4 | low)) return false;
        }
        return true;
    }
}
