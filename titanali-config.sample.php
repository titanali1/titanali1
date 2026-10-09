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
    'allowOrigin'  => '',

    // پشت Cloudflare/CDN: true کنید تا IP بازدیدکننده از X-Forwarded-For خوانده شود (برای محدودیت نرخ).
    'proxyTrusted' => false,

    // سقف‌ها:
    'maxJson'      => 6 * 1024 * 1024,
    'maxFile'      => 6 * 1024 * 1024,
);
