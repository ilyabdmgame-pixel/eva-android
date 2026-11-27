package ru.eva.envtest;

import java.net.InetAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

public final class RuntimeDnsTest {
    public static void main(String[] args) throws Exception {
        Path root = Files.createTempDirectory("eva-dns-test-");
        try {
            Path config = Files.createDirectories(root.resolve("etc")).resolve("resolv.conf");
            InetAddress first = InetAddress.getByAddress(new byte[]{(byte)192,0,2,1});
            InetAddress second = InetAddress.getByAddress(new byte[]{(byte)192,0,2,2});
            Files.writeString(config, "previous\n");
            RuntimeDns.update(root.toFile(), List.of(first));
            if (!Files.readString(config).equals("previous\n")) throw new AssertionError("Existing personal runtime changed");
            Files.createFile(Files.createDirectories(root.resolve("usr/share/eva-userspace")).resolve("manifest.tsv"));
            RuntimeDns.update(root.toFile(), List.of(first,first,second));
            String expected = "nameserver 192.0.2.1\nnameserver 192.0.2.2\n";
            RuntimeDns.update(root.toFile(), List.of());
            if (!Files.readString(config).equals(expected)) throw new AssertionError("No usable cached DNS after disconnection");
            RuntimeDns.update(root.toFile(), List.of(second));
            if (!Files.readString(config).equals("nameserver 192.0.2.2\n")) throw new AssertionError("Old network was retained");
        } finally {
            try (Stream<Path> tree = Files.walk(root)) {
                for (Path p : tree.sorted(Comparator.reverseOrder()).toList()) Files.delete(p);
            }
        }
        System.out.println("DNS follows the active network in the public Linux image and survives disconnects.");
    }
}
