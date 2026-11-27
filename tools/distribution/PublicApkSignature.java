import com.android.apksig.DefaultApkSignerEngine;
import com.android.apksig.apk.ApkUtils;
import com.android.apksig.util.DataSources;
import java.io.DataOutputStream;
import java.io.File;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;

// Use the Android SDK signer's ZIP-sections API: APK entries already aligned by Gradle stay byte-identical.
class PublicApkSignature {
    private static char[] password(String file) throws Exception {
        try (var reader = Files.newBufferedReader(Path.of(file))) {
            String first = reader.readLine();
            if (first == null || first.isEmpty()) throw new IllegalArgumentException("Empty password file");
            return first.toCharArray();
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 7) throw new IllegalArgumentException("apk output keystore storePassFile keyPassFile alias-or-empty certificate-sha256");
        try (var apk = new RandomAccessFile(args[0], "r")) {
            var data = DataSources.asDataSource(apk);
            var zip = ApkUtils.findZipSections(data);
            var manifest = ApkUtils.getAndroidManifest(data);
            if (!"org.evaassistant.app".equals(ApkUtils.getPackageNameFromBinaryAndroidManifest(manifest.duplicate()))
                    || ApkUtils.getMinSdkVersionFromBinaryAndroidManifest(manifest.duplicate()) != 26
                    || ApkUtils.getDebuggableFromBinaryAndroidManifest(manifest.duplicate())) {
                throw new IllegalArgumentException("Expected the non-debuggable public Eva APK for API 26");
            }
            char[] storePass = password(args[3]), keyPass = password(args[4]);
            DefaultApkSignerEngine.SignerConfig config;
            try {
                var store = KeyStore.getInstance(new File(args[2]), storePass);
                String alias = args[5];
                if (alias.isEmpty()) {
                    var names = store.aliases();
                    while (names.hasMoreElements()) {
                        var name = names.nextElement();
                        if (store.isKeyEntry(name)) {
                            if (!alias.isEmpty()) throw new IllegalArgumentException("Specify --alias for this keystore");
                            alias = name;
                        }
                    }
                }
                var chain = store.getCertificateChain(alias);
                if (chain == null || chain.length == 0) throw new IllegalArgumentException("No certificate for this key alias");
                String fingerprint = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(chain[0].getEncoded()));
                if (!fingerprint.equals(args[6])) throw new IllegalArgumentException("Certificate differs from the pinned public release signer");
                var certificates = Arrays.stream(chain).map(X509Certificate.class::cast).toList();
                var key = (PrivateKey) store.getKey(alias, keyPass);
                config = new DefaultApkSignerEngine.SignerConfig.Builder("Eva", key, certificates).build();
            } finally {
                Arrays.fill(storePass, '\0');
                Arrays.fill(keyPass, '\0');
            }
            long central = zip.getZipCentralDirectoryOffset(), end = zip.getZipEndOfCentralDirectoryOffset();
            var engine = new DefaultApkSignerEngine.Builder(List.of(config), 26)
                    .setV1SigningEnabled(false).setV2SigningEnabled(true).setV3SigningEnabled(true)
                    .setVerityEnabled(false).build();
            try {
                var request = engine.outputZipSections2(data.slice(0, central),
                        data.slice(central, end - central), data.slice(end, data.size() - end));
                try (var out = new DataOutputStream(Files.newOutputStream(Path.of(args[1])))) {
                    out.writeInt(request.getPaddingSizeBeforeApkSigningBlock());
                    out.write(request.getApkSigningBlock());
                }
                request.done();
                engine.outputDone();
            } finally {
                engine.close();
            }
        }
    }
}
