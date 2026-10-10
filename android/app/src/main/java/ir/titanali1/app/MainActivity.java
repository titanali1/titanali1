package ir.titanali1.app;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Locale;

/**
 * پوستهٔ تیتانلی: سایت (index.html) داخل WebView.
 *
 * دو حالت با gradle.properties:
 *  • remoteFirst=false (پیش‌فرض) — نسخهٔ بسته‌بندی‌شده از assets/web روی مبدأ
 *    ساختگی https://app.titanali1.ir/ بالا می‌آید؛ آفلاین هم کار می‌کند و
 *    درخواست‌ها به api.phpِ هاست با CORS مجاز است.
 *  • remoteFirst=true — همان سایتِ زنده باز می‌شود (تازه‌ترین محتوا، نیاز به اینترنت).
 */
public class MainActivity extends AppCompatActivity {

    private static final long BACK_EXIT_WINDOW_MS = 2200L;

    private WebView web;
    private SwipeRefreshLayout refresh;
    private LinearLayout offlineBar;
    private ProgressBar progress;
    private final SiteAssetHandler assets = new SiteAssetHandler(this);

    private ValueCallback<Uri[]> fileCallback;
    private Uri pendingCamera;
    private long lastBackAt = 0L;

    private final ActivityResultLauncher<Intent> picker =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),
                    this::onPickerResult);

    // ───────────────────────── lifecycle ─────────────────────────
    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        setContentView(R.layout.activity_main);

        View root = findViewById(R.id.root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        web = findViewById(R.id.web);
        refresh = findViewById(R.id.refresh);
        offlineBar = findViewById(R.id.offlineBar);
        progress = findViewById(R.id.progress);
        ((TextView) findViewById(R.id.offlineText)).setText(R.string.offline_note);
        Button retry = findViewById(R.id.offlineRetry);
        retry.setText(R.string.retry);
        retry.setOnClickListener(v -> {
            vibrate(18);
            web.reload();
        });

        configureWebView();
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(startUrl());

        refresh.setOnRefreshListener(() -> {
            if (isOnline()) web.reload();
            else {
                refresh.setRefreshing(false);
                toast(R.string.offline_note);
            }
        });
        updateOfflineBar();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String frag = fragmentOf(intent);
        if (!frag.isEmpty()) web.loadUrl(startUrl());          // میان‌بُر طرح‌ها/گفتگو
        else web.reload();
    }

    @Override protected void onStart() {
        super.onStart();
        try {
            IntentFilter f = new IntentFilter(ConnectivityManager.CONNECTIVITY_ACTION);
            ContextCompat.registerReceiver(this, netReceiver, f, ContextCompat.RECEIVER_NOT_EXPORTED);
        } catch (Exception ignored) { }
        web.onResume();
        web.resumeTimers();
    }

    @Override protected void onStop() {
        try { unregisterReceiver(netReceiver); } catch (Exception ignored) { }
        web.pauseTimers();
        super.onStop();
    }

    @Override protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override protected void onSaveInstanceState(android.os.Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override protected void onDestroy() {
        try {
            ViewGroup p = (ViewGroup) web.getParent();
            if (p != null) p.removeView(web);
            web.destroy();
        } catch (Exception ignored) { }
        super.onDestroy();
    }

    // ───────────────────────── webview ─────────────────────────
    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings st = web.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);              // localStorage سایت همین‌جا زندگی می‌کند
        st.setDatabaseEnabled(false);
        st.setAllowFileAccess(false);               // همه‌چیز از asset loader، نه file://
        st.setAllowContentAccess(false);
        st.setAllowUniversalAccessFromFileURLs(false);
        st.setAllowFileAccessFromFileURLs(false);
        st.setJavaScriptCanOpenWindowsAutomatically(false);
        st.setMediaPlaybackRequiresUserGesture(false);
        st.setLoadsImagesAutomatically(true);
        st.setSupportZoom(false);
        st.setBuiltInZoomControls(false);
        st.setTextZoom(100);
        st.setUseWideViewPort(true);
        st.setLoadWithOverviewMode(true);
        st.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 26) st.setSafeBrowsingEnabled(true);
        // «wv» عمداً حذف می‌شود: با آن، گوگل‌پلی برنامه را «وب‌سایت بسته‌بندی‌شده» می‌داند.
        String ua = st.getUserAgentString().replace("; wv", "");
        st.setUserAgentString(ua + " TitanaliApp/" + BuildConfig.VERSION_NAME);

        web.setBackgroundColor(ContextCompat.getColor(this, R.color.brand_bg));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        web.addJavascriptInterface(new Bridge(this), "TitanaliApp");
        web.setWebViewClient(client);
        web.setWebChromeClient(chrome);
        web.setDownloadListener(this::onDownload);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web.canGoBack()) { web.goBack(); return; }
                long now = System.currentTimeMillis();
                if (now - lastBackAt < BACK_EXIT_WINDOW_MS) { finish(); return; }
                lastBackAt = now;
                toast(R.string.back_again);
            }
        });
    }

    private String startUrl() {
        String base = BuildConfig.REMOTE_FIRST
                ? BuildConfig.SITE_URL
                : "https://" + BuildConfig.APP_HOST + "/index.html";
        String frag = fragmentOf(getIntent());
        if (!frag.isEmpty()) {
            if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
            base = base + "#" + frag;
        }
        return base;
    }

    /** میان‌بُرها و لینک‌های سایت: https://titanali1.ir/#chat → «chat» */
    private static String fragmentOf(Intent it) {
        if (it == null) return "";
        Uri u = it.getData();
        if (u == null) return "";
        String f = u.getFragment();
        if (f == null || f.isEmpty()) return "";
        f = f.replaceAll("[^a-zA-Z0-9_-]", "");
        return f.length() > 24 ? "" : f;
    }

    private final androidx.webkit.WebViewClientCompat client = new androidx.webkit.WebViewClientCompat() {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (BuildConfig.APP_HOST.equalsIgnoreCase(u.getHost())) {
                String path = u.getPath() == null ? "/" : u.getPath();
                WebResourceResponse r = assets.handle(path);
                if (r != null) return r;
            }
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);

            if (BuildConfig.APP_HOST.equals(host)) return false;              // فایل‌های خودِ پوسته
            if (isOurSite(host)) return false;                                  // لینک داخلی سایت
            if ("tel".equals(scheme) || "sms".equals(scheme) || "mailto".equals(scheme)) {
                open(u);
                return true;
            }
            if ("http".equals(scheme) || "https".equals(scheme)) {             // تلگرام/واتساپ/اینستا…
                open(u);
                return true;
            }
            return true;                                                       // هر چیز دیگر: رد
        }

        @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            progress.setVisibility(View.VISIBLE);
            if (BuildConfig.REMOTE_FIRST) injectConfig(view);
        }

        @Override public void onPageFinished(WebView view, String url) {
            progress.setVisibility(View.GONE);
            refresh.setRefreshing(false);
            updateOfflineBar();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) loadOfflinePage();
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                        WebResourceResponse errorResponse) {
            if (request.isForMainFrame() && errorResponse != null && errorResponse.getStatusCode() >= 500) {
                loadOfflinePage();
            }
        }
    };

    /** صفحهٔ آفلاینِ خودِ پوسته (assets/web/offline.html) — فقط وقتی چارچهٔ اصلی شکست خورد. */
    private void loadOfflinePage() {
        updateOfflineBar();
        if (web.getUrl() == null) web.loadUrl("https://" + BuildConfig.APP_HOST + "/offline.html");
    }

    private final WebChromeClient chrome = new WebChromeClient() {
        @Override public void onProgressChanged(WebView view, int newProgress) {
            if (progress != null) {
                progress.setProgress(newProgress);
                if (newProgress >= 100) progress.setVisibility(View.GONE);
            }
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try {
                Intent get = params.createIntent();
                if (acceptsImage(params)) {
                    Intent capture = cameraIntent();
                    if (capture != null) {
                        get.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{capture});
                    }
                }
                picker.launch(get);
                return true;
            } catch (Exception e) {
                fileCallback = null;
                toast(R.string.no_app_for_link);
                return false;
            }
        }

        @Override public void onPermissionRequest(android.webkit.PermissionRequest request) {
            request.deny();          // دوربین/میکروفون وب‌درخواستی لازم است؛ ما از intent بومی استفاده می‌کنیم
        }
    };

    // ───────────────────────── پیوست و دوربین ─────────────────────────
    private static boolean acceptsImage(WebChromeClient.FileChooserParams p) {
        if (p == null) return false;
        String[] types = p.getAcceptTypes();
        if (types == null || types.length == 0) return true;
        for (String t : types) {
            if (t == null) continue;
            String s = t.toLowerCase(Locale.ROOT).trim();
            if (s.isEmpty() || s.startsWith("image/") || s.equals("*/*")) return true;
        }
        return false;
    }

    private Intent cameraIntent() {
        try {
            File dir = new File(getCacheDir(), "shots");
            if (!dir.exists() && !dir.mkdirs()) return null;
            File tmp = new File(dir, "shot-" + System.currentTimeMillis() + ".jpg");
            pendingCamera = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", tmp);
            Intent cam = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
            cam.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, pendingCamera);
            cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return cam;
        } catch (Exception e) {
            pendingCamera = null;
            return null;
        }
    }

    private void onPickerResult(ActivityResult res) {
        ValueCallback<Uri[]> cb = fileCallback;
        fileCallback = null;
        if (cb == null) return;
        Uri[] picked = null;
        try {
            picked = WebChromeClient.FileChooserParams.parseResult(
                    res.getResultCode() == RESULT_OK ? RESULT_OK : RESULT_CANCELED, res.getData());
        } catch (Exception ignored) { }
        if ((picked == null || picked.length == 0) && pendingCamera != null) {
            picked = new Uri[]{pendingCamera};
        }
        pendingCamera = null;
        if (picked != null) {
            java.util.ArrayList<Uri> keep = new java.util.ArrayList<>();
            for (Uri u : picked) if (u != null) keep.add(u);
            picked = keep.isEmpty() ? null : keep.toArray(new Uri[0]);
        }
        cb.onReceiveValue(picked);
    }

    // ───────────────────────── دریافت فایل ─────────────────────────
    private void onDownload(String url, String userAgent, String contentDisposition, String mimetype, long total) {
        if (url == null || url.isEmpty()) return;
        String name = android.webkit.MimeTypeMap.getSingleton()
                .getExtensionFromMimeType(mimetype == null ? "" : mimetype);
        String fileName = android.net.Uri.parse(url).getLastPathSegment();
        if (fileName == null || fileName.isEmpty() || fileName.length() > 80 || fileName.contains("?")) {
            fileName = "titanali-" + System.currentTimeMillis() + (name == null ? ".bin" : "." + name);
        }

        if (url.startsWith("data:")) {                      // پیوست‌های محلی سایت (dataURL)
            saveDataUrl(url, fileName);
            return;
        }
        try {
            DownloadManager.Request rq = new DownloadManager.Request(Uri.parse(url));
            rq.addRequestHeader("User-Agent", userAgent == null ? "" : userAgent);
            rq.setTitle(fileName);
            rq.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (mimetype != null && mimetype.contains("/")) rq.setMimeType(mimetype);
            try {
                rq.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADORS, fileName);
            } catch (Exception ignored) { }
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm == null) throw new IllegalStateException();
            dm.enqueue(rq);
            toast(R.string.download_started);
        } catch (Exception e) {
            open(Uri.parse(url));
        }
    }

    private void saveDataUrl(String dataUrl, String fileName) {
        int comma = dataUrl.indexOf(',');
        if (comma < 0 || !dataUrl.toLowerCase(Locale.ROOT).contains("base64")) { open(Uri.parse(dataUrl)); return; }
        try {
            byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) dir = getFilesDir();
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, fileName.replaceAll("[^a-zA-Z0-9._-]", "_"));
            try (FileOutputStream fo = new FileOutputStream(out)) { fo.write(bytes); }
            toast(getString(R.string.download_started) + " · " + out.getName());
        } catch (Exception e) {
            toast(R.string.no_app_for_link);
        }
    }

    // ───────────────────────── شبکه ─────────────────────────
    private final BroadcastReceiver netReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { updateOfflineBar(); }
    };

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            Network n = cm.getActiveNetwork();
            if (n == null) return false;
            NetworkCapabilities cap = cm.getNetworkCapabilities(n);
            return cap != null && cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Exception e) {
            return true;
        }
    }

    private void updateOfflineBar() {
        boolean offline = !isOnline();
        if (offlineBar == null) return;
        offlineBar.setVisibility(offline ? View.VISIBLE : View.GONE);
    }

    // ───────────────────────── کمک‌ها ─────────────────────────
    /** در حالت سایت‌زنده، تنظیمات پوسته با evaluateJavascript اضافه می‌شود (best effort). */
    private void injectConfig(WebView view) {
        String js = "window.TITANALI_SITE=" + quote(BuildConfig.SITE_URL)
                + ";window.TITANALI_API=" + quote(BuildConfig.API_URL)
                + ";window.TITANALI_APP={platform:'android',version:" + quote(BuildConfig.VERSION_NAME)
                + ",package:" + quote(BuildConfig.APPLICATION_ID) + "};";
        try { view.evaluateJavascript(js, null); } catch (Exception ignored) { }
    }

    private static String quote(String v) {
        if (v == null) return "''";
        return "'" + v.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    private boolean isOurSite(String host) {
        String ours = Uri.parse(BuildConfig.SITE_URL).getHost();
        if (ours == null || host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        ours = ours.toLowerCase(Locale.ROOT);
        return host.equals(ours) || host.endsWith("." + ours);
    }

    private void open(Uri u) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            toast(R.string.no_app_for_link);
        }
    }

    private void vibrate(int ms) {
        try {
            Bridge b = new Bridge(this);
            b.vibrate(ms);
        } catch (Exception ignored) { }
    }

    private void toast(String s) {
        if (s == null || s.isEmpty()) return;
        Toast.makeText(getApplicationContext(), s, Toast.LENGTH_SHORT).show();
    }

    private void toast(int resId) {
        toast(getString(resId));
    }

}
