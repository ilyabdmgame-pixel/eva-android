package ru.eva.envtest;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.stream.Stream;

public final class RuntimePortraitsTest {
    public static void main(String[] args) throws Exception {
        Path root = Files.createTempDirectory("eva-portrait-upgrade-");
        try {
            Path avatar = Files.createDirectories(root.resolve("root/codex-mobile/avatar"));
            String[] names = {"idle", "edited", "unreplaced", "redirect"};
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest("old".getBytes(StandardCharsets.UTF_8)));
            StringBuilder manifest = new StringBuilder();
            for (String name : names) {
                Files.writeString(avatar.resolve(name + ".png"), name.equals("edited") ? "custom" : "old");
                if (!name.equals("unreplaced")) Files.writeString(avatar.resolve(name + ".webp"), "new");
                manifest.append(hash).append("\troot/codex-mobile/avatar/").append(name).append(".png\n");
            }
            Path privateImage = Files.writeString(root.resolve("private.png"), "old");
            Files.delete(avatar.resolve("redirect.png"));
            Files.createSymbolicLink(avatar.resolve("redirect.png"), privateImage);
            manifest.append(hash).append("\tprivate.png\n");
            for (int i = 0; i < 2; i++) {
                RuntimePortraits.removeReplaced(root.toFile(), new ByteArrayInputStream(manifest.toString().getBytes(StandardCharsets.US_ASCII)));
                if (Files.exists(avatar.resolve("idle.png")) || !Files.exists(avatar.resolve("idle.webp")))
                    throw new AssertionError("The stock replacement must survive");
                for (String name : new String[]{"edited", "unreplaced", "redirect"})
                    if (!Files.exists(avatar.resolve(name + ".png"))) throw new AssertionError(name);
                if (!Files.readString(privateImage).equals("old")) throw new AssertionError("Personal image changed");
            }
        } finally {
            try (Stream<Path> tree = Files.walk(root)) {
                for (Path path : tree.sorted(Comparator.reverseOrder()).toList()) Files.delete(path);
            }
        }
        System.out.println("Portrait upgrade reclaims only the matching stock PNG and is idempotent.");
    }
}
