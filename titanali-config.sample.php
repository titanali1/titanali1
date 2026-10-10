<?php
/**
 * نمونهٔ پیکربندی بک‌اند titanali
 * این فایل را به titanali-config.php تغییر نام دهید (کنار api.php) تا خوانده شود.
 * همه‌چیز اختیاری است؛ بدون آن، api.php از titanali-data/ کنار خودش استفاده می‌کند.
 */
return array(
    // جای دیتا. بهترین حالت: بیرون از public_html، تا وب اصلاً به آن دسترسی نداشته باشد.
    'dataDir'      => dirname(__DIR__) . '/titanali-data',

    // اگر کلید را اینجا بگذارید، از بازنویسی خودکار در titanali-data/config.json جلوگیری می‌شود.
    // با این تولید کنید:  echo $(php -r 'echo bin2hex(random_bytes(24));')
    // 'secret'       => '........................................',

    // فقط اگر می‌خواهید سایت دیگری (یا دامنهٔ دیگر) به api.php درخواست بزند. خالی = همان مبدأ.
    // (کلید allowOrigin هم پذیرفته می‌شود.)
    'origin'       => '',

    // پشت Cloudflare/CDN: true کنید تا IP بازدیدکننده از X-Forwarded-For خوانده شود (برای محدودیت نرخ).
    'proxyTrusted' => false,

    // سقف‌ها:
    'maxJson'      => 6 * 1024 * 1024,
    'maxFile'      => 6 * 1024 * 1024,

    /* ---------- انتشار روی هاست ----------
       هر بار که در پنل ادمین چیزی ذخیره می‌شود، یک فایل ایستا کنار api.php نوشته
       می‌شود تا سایت حتی بدون PHP هم تازه بماند و سریع‌تر باز شود.
       '' = خاموش. مسیر مطلق هم می‌پذیرد. */
    'publishFile'  => 'titanali-content.json',
    'publishMax'   => 2000000,        // سقف اندازهٔ فایل منتشرشده (بایت)

    /* ---------- فید واقعی اینستاگرام (اختیاری) ----------
       برای اینکه فید سایت با «پیج متصل» هم‌گام بماند، به Meta Graph API نیاز است:
       ۱) یک Business/Creator اکانت را به یک صفحهٔ فیسبوک وصل کنید.
       ۲) در developers.facebook.com یک اپ بسازید و permission های
          instagram_basic, instagram_manage_insights (و اگر ویدیو دارید publish_video) را بگیرید.
       ۳) با Graph API Explorer یک توکن Long-Lived برای همان صفحه بگیرید.
       ۴) شناسهٔ عددی پیج:  GET graph.facebook.com/v19.0/me/accounts
       توکن را هرگز در index.html نگذارید؛ فقط همین‌جا (فایل ۶۰۰ و بیرون از دسترس وب). */
    'igToken'      => '',
    'igGraphId'    => '',
    'igLimit'      => 12,              // چند پست آخر
    'igTtl'        => 900,             // دقیقه؛ اعتبار کش فید
);
