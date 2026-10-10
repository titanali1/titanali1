# titanali — پوستهٔ WebView: فقط پل JS ⇄ اندروید نباید کج‌وش_lghat شود
-keepclassmembers class ir.titanali1.app.Bridge {
   @android.webkit.JavascriptInterface <methods>;
}
# WebViewAssetLoader / callbacks
-keep class ir.titanali1.app.** { *; }
-dontwarn android.webkit.**
# حفظ شمارهٔ خطوط برای گزارش crash در کنسول
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
