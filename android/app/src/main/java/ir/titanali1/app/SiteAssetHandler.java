package ir.titanali1.app;

import android.content.Context;
import android.webkit.WebResourceResponse;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * فایل‌های آفلاینٔ سایت را از assets/web/ سرو می‌کند و پیش از تحویل HTML،
 * اسکریپت تنظیمات را به <head> اضافه می‌کند:
 * window.TITANALI_SITE / TITANALI_API / TITANALI_APP
 * (به همین ترتیب است که پوسته در حالت آفلاین هم با api.php واقعیِ هاست حرف می‌زند.)
 */
public final class SiteAssetHandler implements WebViewAssetLoader.PathHandler {

    static final String ASSET_DIR = "web/";
    private static final Charset UTF8 = Charset.forName("UTF-8");

    private final Context appCtx;

    SiteAssetHandler(Context ctx) {
        this.appCtx = ctx.getApplicationContext();
    }

    @Nullable
    @Override
    public WebResourceResponse handle(@NonNull String path) {
        String rel = (path == null ? "" : path).trim();
        if (rel.startsWith("/")) rel = rel.substring(1);
        int q = rel.indexOf('?');
        if (q >= 0) rel = rel.substring(0, q);
        if (rel.isEmpty()) rel = "index.html";
        // هیچ فرصتی برای بیرون رفتن از پوشهٔ assets
        if (rel.contains("..") || rel.startsWith("/") || rel.contains("\\")) return null;
        if (!rel.endsWith(".html") && !rel.endsWith(".css") && !rel.endsWith(".js")
                && !rel.endsWith(".svg") && !rel.endsWith(".png") && !rel.endsWith(".jpg")
                && !rel.endsWith(".webp") && !rel.endsWith(".json") && !rel.endsWith(".txt")
                && !rel.endsWith(".ico")) return null;

        byte[] raw;
        try {
            raw = readAll(appCtx.getAssets().open(ASSET_DIR + rel));
        } catch (IOException e) {
            return null;
        }

        String mime = mimeOf(rel);
        if (rel.endsWith(".html")) {
            String html = injectConfig(new String(raw, UTF8));
            raw = html.getBytes(UTF8);
            WebResourceResponse r = new WebResourceResponse("text/html", "utf-8",
                    new java.io.ByteArrayInputStream(raw));
            r.setStatusCodeAndReasonPhrase(200, "OK");
            r.setResponseHeaders(headers("no-store"));
            return r;
        }

        WebResourceResponse r = new WebResourceResponse(mime,
                mime.startsWith("image/") ? null : "utf-8",
                new java.io.ByteArrayInputStream(raw));
        r.setStatusCodeAndReasonPhrase(200, "OK");
        r.setResponseHeaders(headers("public, max-age=300"));
        return r;
    }

    /** تزریق تنظیمات + برچسب نسخه به اولِ بدنهٔ HTML (قبل از اسکریپت خودِ سایت). */
    private String injectConfig(String html) {
        StringBuilder js = new StringBuilder(256);
        js.append("<script>(function(){var c=")
          .append("{site:").append(q(BuildConfig.SITE_URL))
          .append(",api:").append(q(BuildConfig.API_URL))
          .append(",version:").append(q(BuildConfig.VERSION_NAME))
          .append(",code:").append(BuildConfig.VERSION_CODE)
          .append(",platform:'android',package:").append(q(BuildConfig.APPLICATION_ID))
          .append("};window.TITANALI_SITE=c.site;window.TITANALI_API=c.api;window.TITANALI_APP=c;})();")
          .append("</script>");
        String tag = js.toString();
        int head = html.toLowerCase(Locale.ROOT).indexOf("</head>");
        if (head >= 0) return html.substring(0, head) + tag + html.substring(head);
        int body = html.toLowerCase(Locale.ROOT).indexOf("<body");
        if (body >= 0) return html.substring(0, body) + tag + html.substring(body);
        return tag + html;
    }

    private static Map<String, String> headers(String cache) {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", cache);
        h.put("X-Content-Type-Options", "nosniff");
        return h;
    }

    private static String q(String s) {
        if (s == null) return "''";
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    private static String mimeOf(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".js")) return "application/javascript";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(1024, in.available()));
        byte[] buf = new byte[16384];
        int n;
        try {
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        } finally {
            try { in.close(); } catch (IOException ignored) { }
        }
        return out.toByteArray();
    }
}
