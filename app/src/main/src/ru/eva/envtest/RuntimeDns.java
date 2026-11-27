package ru.eva.envtest;

import java.io.File;
import java.io.IOException;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Collection;
import java.util.LinkedHashSet;

/** Populate a freshly built public userspace with the active Android network's resolvers. */
final class RuntimeDns {
    static synchronized void update(File root, Collection<InetAddress> servers) throws IOException {
        if (servers.isEmpty() || !new File(root, "usr/share/eva-userspace/manifest.tsv").isFile()) return;
        File target = new File(root.getCanonicalFile(), "etc/resolv.conf");
        if (!target.equals(target.getCanonicalFile())) return;
        LinkedHashSet<String> lines = new LinkedHashSet<>();
        for (InetAddress server : servers) lines.add("nameserver " + server.getHostAddress());
        byte[] data = (String.join("\n", lines) + "\n").getBytes(StandardCharsets.US_ASCII);
        Path path = target.toPath();
        if (Files.isRegularFile(path) && Files.size(path) == data.length &&
            java.util.Arrays.equals(Files.readAllBytes(path), data)) return;
        Path temp = Files.createTempFile(path.getParent(), ".eva-dns-", null);
        try {
            Files.write(temp, data);
            Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(temp);
        }
    }
}
