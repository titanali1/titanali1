package ir.titanali1.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.util.Locale;

/**
 * پل کوچک JS ⇄ اندروید. سایت با بررسی وجود window.TitanaliApp می‌فهمد داخل اپ است
 * (مثلاً دکمهٔ «اشتراک گوشی» را نشان می‌دهد).
 *
 * اصول ایمنی: فقط متن کوتاه پذیرفته می‌شود، لینک‌ها فقط http/https، و همهٔ کارهای
 * رابط‌کاربری روی thread اصلی انجام می‌شود.
 */
public final class Bridge {

    private static final int MAX_TEXT = 4000;

    private final Activity act;

    Bridge(Activity act) {
        this.act = act;
    }

    private void post(Runnable r) {
        act.runOnUiThread(r);
    }

    @JavascriptInterface
    public void share(final String text) {
        final String t = clamp(text);
        post(new Runnable() {
            @Override public void run() {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, t);
                try {
                    act.startActivity(Intent.createChooser(i, act.getString(R.string.share_title)));
                } catch (Exception ignored) {
                    toast(act.getString(R.string.no_app_for_link));
                }
            }
        });
    }

    @JavascriptInterface
    public void copy(final String text) {
        final String t = clamp(text);
        post(new Runnable() {
            @Override public void run() {
                try {
                    ClipboardManager cm = (ClipboardManager) act.getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm != null) {
                        cm.setPrimaryClip(ClipData.newPlainText(act.getString(R.string.app_name), t));
                        toast(act.getString(R.string.copied));
                    }
                } catch (Exception ignored) { }
            }
        });
    }

    @JavascriptInterface
    public void openExternal(final String url) {
        final String u = clamp(url);
        post(new Runnable() {
            @Override public void run() {
                String low = u.toLowerCase(Locale.ROOT);
                if (!low.startsWith("http://") && !low.startsWith("https://")
                        && !low.startsWith("mailto:") && !low.startsWith("tel:") && !low.startsWith("sms:")) return;
                try {
                    act.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u)));
                } catch (Exception ignored) {
                    toast(act.getString(R.string.no_app_for_link));
                }
            }
        });
    }

    /** بازخورد لمسی کوتاه — برای «پیام فرستاده شد». */
    @JavascriptInterface
    public void vibrate(final int ms) {
        final int d = Math.max(1, Math.min(400, ms));
        post(new Runnable() {
            @Override public void run() {
                try {
                    Vibrator vib;
                    if (Build.VERSION.SDK_INT >= 31) {
                        VibratorManager vm = (VibratorManager) act.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                        vib = vm == null ? null : vm.getDefaultVibrator();
                    } else {
                        //noinspection deprecation
                        vib = (Vibrator) act.getSystemService(Context.VIBRATOR_SERVICE);
                    }
                    if (vib == null || !vib.hasVibrator()) return;
                    if (Build.VERSION.SDK_INT >= 26) {
                        vib.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        //noinspection deprecation
                        vib.vibrate(d);
                    }
                } catch (Exception ignored) { }
            }
        });
    }

    @JavascriptInterface
    public void toast(final String msg) {
        final String m = clamp(msg);
        post(new Runnable() {
            @Override public void run() {
                if (m.isEmpty()) return;
                Toast.makeText(act.getApplicationContext(), m, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @JavascriptInterface
    public String info() {
        return "{\"platform\":\"android\",\"version\":\"" + esc(BuildConfig.VERSION_NAME)
                + "\",\"code\":" + BuildConfig.VERSION_CODE
                + ",\"release\":" + (BuildConfig.DEBUG ? "false" : "true")
                + ",\"sdk\":" + Build.VERSION.SDK_INT
                + ",\"site\":\"" + esc(BuildConfig.SITE_URL) + "\""
                + ",\"api\":\"" + esc(BuildConfig.API_URL) + "\""
                + ",\"package\":\"" + esc(BuildConfig.APPLICATION_ID) + "\"}";
    }

    private static String clamp(String s) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() > MAX_TEXT ? t.substring(0, MAX_TEXT) : t;
    }

    private static String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
