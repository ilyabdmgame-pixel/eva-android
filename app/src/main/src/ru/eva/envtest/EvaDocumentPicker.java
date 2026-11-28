package ru.eva.envtest;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import java.util.LinkedHashSet;
import java.util.Locale;

final class EvaDocumentPicker {
    private EvaDocumentPicker() {}

    static Intent intent(String[] accept, boolean multiple) {
        Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
        LinkedHashSet<String> types = new LinkedHashSet<>();
        boolean model = false;
        if (accept != null) for (String entry : accept) {
            if (entry == null) continue;
            for (String raw : entry.split(",")) {
                String type = raw.trim().toLowerCase(Locale.ROOT);
                if (type.equals(".glb") || type.equals("model/gltf-binary")) model = true;
                if (type.matches("[a-z0-9*.+-]+/[a-z0-9*.+-]+")) types.add(type);
            }
        }
        // File providers often label GLB as application/octet-stream or do not
        // report a MIME type. The importer validates the actual GLB signature.
        if (model || types.isEmpty() || types.contains("*/*")) pick.setType("*/*");
        else if (types.size() == 1) pick.setType(types.iterator().next());
        else {
            boolean images = true;
            for (String type : types) if (!type.startsWith("image/")) images = false;
            pick.setType(images ? "image/*" : "*/*");
            pick.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0]));
        }
        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
        return pick;
    }

    static Uri[] result(Intent data, boolean multiple) {
        if (data == null) return null;
        LinkedHashSet<Uri> result = new LinkedHashSet<>();
        ClipData clip = data.getClipData();
        if (clip != null) for (int i = 0; i < clip.getItemCount(); i++) {
            add(result, clip.getItemAt(i).getUri());
            if (!multiple && !result.isEmpty()) break;
        }
        if (result.isEmpty()) add(result, data.getData());
        return result.isEmpty() ? null : result.toArray(new Uri[0]);
    }

    private static void add(LinkedHashSet<Uri> result, Uri uri) {
        if (uri != null && "content".equals(uri.getScheme()) && uri.getAuthority() != null) result.add(uri);
    }
}
