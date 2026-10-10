<?php
/**
 * titanali-install.php — نصب‌کنندهٔ یک‌بارمصرف روی هاست سی‌پنل
 * ------------------------------------------------------------------
 * محتویات titanali-cpanel.zip را که در public_html گذاشتید، این فایل را در مرورگر باز کنید:
 *
 *      https://titanali1.ir/titanali-install.php
 *
 * کارها:  ۱) بررسی وضعیت (فایل‌های بسته، PHP، نوشتن، پوشهٔ داده، .htaccess، تازگی index.html)
 *         ۲) اختیاری: بردن پوشهٔ داده بیرون از public_html و ساخت titanali-config.php
 *         ۳) ساخت ادمین سرور از راه api.php (bcrypt سمت سرور) و اثبات با login
 *         ۴) بستن وب به پوشهٔ داده، و پاک‌کردن خودش
 *
 * ایمنی: فقط تا پیش از نصب کار می‌کند (وقتی ادمینی نیست، چیزی برای حفاظت هم نیست)؛
 *        nonce یک‌بارمصرف + بررسی Origin/Referer + حداکثر ۶ تلاش در ساعت؛
 *        رمز عبور در هیچ فایلی نوشته نمی‌شود و در صفحه چاپ نمی‌شود.
 *        بعد از نصب، خود را unlink می‌کند (اگر مجوز نبود chmod 0400 و دستور پاک‌کردن را نشان می‌دهد).
 *
 * راه خط‌فرمان (همان کار + بکاپ و گزارش بیشتر):
 *   curl -fsSL https://raw.githubusercontent.com/titanali1/titanali1/latest/deploy/install-on-server.sh | bash
 * CLI هم کار می‌کند:  TA_ADMIN_PASS='…' php titanali-install.php --install --user=admin --move
 *
 * PHP 7.0+ · بدون وابستگی · سازگار با هاست‌های محدود (exec لازم ندارد).
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');
@set_time_limit(120);
@ignore_user_abort(true);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header('X-Robots-Tag: noindex, nofollow');

define('SELF', __FILE__);
define('DIR', dirname(__FILE__));
define('LOCK', DIR . '/titanali-install.lock');
define('MAX_TRIES', 6);
define('NEED_FILES', 'index.html,api.php,.htaccess,sw.js,site.webmanifest,404.html,robots.txt,sitemap.xml,favicon.svg,og.png,icon-192.png,icon-512.png,apple-touch-icon.png,titanali-config.sample.php');
define('REPO_RAW', 'https://raw.githubusercontent.com/titanali1/titanali1/latest/');

/* ================================================================ ابزارها */
function h($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }

function base_url()
{
    if (!isset($_SERVER['HTTP_HOST'])) return '';
    $host = $_SERVER['HTTP_HOST'];
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443)
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    $dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
    if (substr($dir, -1) === '/') $dir = substr($dir, 0, -1);
    return ($https ? 'https' : 'http') . '://' . $host . $dir;
}

/** درخواست به api.php روی همین هاست. برمی‌گرداند code / text / json */
function api_call($action, $payload, $verify)
{
    $base = base_url();
    if ($base === '') return array('code' => 0, 'text' => 'HTTP_HOST تنظیم نیست', 'json' => null, 'insecure' => false);
    $url = $base . '/api.php?action=' . $action;
    $body = is_array($payload) ? json_encode($payload) : null;
    $code = 0; $text = '';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 40);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 12);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, $verify);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, $verify ? 2 : 0);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        if ($body !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, $body); }
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json', 'Expect:'));
        $out = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($out === false) { $text = 'curl: ' . curl_error($ch); } else { $text = (string) $out; }
        curl_close($ch);
    } else {
        $opt = array('http' => array('ignore_errors' => true, 'timeout' => 40,
            'header' => "Content-Type: application/json\r\nAccept: application/json\r\n"));
        if ($body !== null) { $opt['http']['method'] = 'POST'; $opt['http']['content'] = $body; }
        $opt['ssl'] = array('verify_peer' => $verify, 'verify_peer_name' => $verify, 'allow_self_signed' => !$verify);
        $out = @file_get_contents($url, false, stream_context_create($opt));
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $code = (int) $m[1];
        $text = $out === false ? '' : (string) $out;
    }
    $json = null;
    $t = trim($text);
    if ($t !== '' && ($t[0] === '{' || $t[0] === '[')) $json = json_decode($t, true);
    return array('code' => $code, 'text' => $t, 'json' => is_array($json) ? $json : null, 'insecure' => !$verify);
}

/** health؛ اگر گواهی SSL ناقپ بود، یک بار بی‌بررسی امتحان می‌کند */
function health()
{
    $r = api_call('health', null, true);
    if (is_array($r['json'])) return $r;
    $r2 = api_call('health', null, false);
    if (is_array($r2['json'])) { $r2['badSsl'] = true; return $r2; }
    return $r;
}

function lock_read()
{
    $d = @json_decode((string) @file_get_contents(LOCK), true);
    return is_array($d) ? $d : array();
}
function lock_write($d) { @file_put_contents(LOCK, json_encode($d), LOCK_EX); }
function rand_token()
{
    if (function_exists('random_bytes')) return bin2hex(random_bytes(16));
    return substr(sha1(uniqid((string) mt_rand(), true)) . sha1((string) microtime(true)), 0, 32);
}
function nonce_issue()
{
    $d = lock_read();
    $d['n'] = rand_token();
    lock_write($d);
    return $d['n'];
}
function nonce_bump()
{
    $d = lock_read();
    $span = time() - (int) (isset($d['when']) ? $d['when'] : 0);
    $d['tries'] = ($span > 3600 || !isset($d['tries'])) ? 1 : ((int) $d['tries'] + 1);
    $d['when'] = time();
    unset($d['n']);
    lock_write($d);
    return (int) $d['tries'];
}
function same_origin()
{
    if (!isset($_SERVER['HTTP_HOST'])) return false;
    $host = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST']);
    foreach (array('HTTP_ORIGIN', 'HTTP_REFERER') as $k) {
        if (!empty($_SERVER[$k])) {
            $u = parse_url($_SERVER[$k]);
            if (isset($u['host']) && strcasecmp($u['host'], $host) === 0) return true;
        }
    }
    return false;
}

/* ============================================================== گزارش‌ها */
function env_rows()
{
    $rows = array();
    $real = realpath(DIR);
    $rows[] = array('این فایل', $real ? $real : DIR, true);
    $rows[] = array('PHP', PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . '.' . PHP_RELEASE_VERSION
        . (function_exists('password_hash') ? ' · password_hash ✓' : ' · بدون password_hash!'), function_exists('password_hash'));
    $rows[] = array('curl', function_exists('curl_init') ? 'هست' : 'نیست (از stream استفاده می‌شود)', true);
    $writable = is_writable(DIR);
    $rows[] = array('نوشتن در این پوشه', $writable ? 'مجاز ✓' : 'مجاز نیست (nonce و پاک‌کردن خودکار ممکن نیست)', $writable);

    $miss = array();
    foreach (explode(',', NEED_FILES) as $f) { if (!file_exists(DIR . '/' . $f)) $miss[] = $f; }
    $rows[] = array('فایل‌های بسته', $miss ? 'کم است: ' . implode('، ', $miss) . ' ← بسته را دوباره Extract کنید' : 'همه هست ✓ (' . count(explode(',', NEED_FILES)) . ' فایل)', !$miss);

    $idx = (string) @file_get_contents(DIR . '/index.html', false, null, 0, 200000);
    $fresh = (strpos($idx, 'titanali1.ir') !== false) && (strpos($idx, 'data-apibtn') !== false);
    $rows[] = array('تازگی index.html', $fresh ? 'نسخهٔ تازه به نظر می‌رسد ✓' : 'کهنه است (دامنه یا تب همگام‌سازی پیدا نشد) ← بستهٔ تازه را Extract کنید', $fresh);
    $sw = (string) @file_get_contents(DIR . '/sw.js');
    if ($sw !== '' && preg_match('/V\s*=\s*[\'"]?([\w.]+)/', $sw, $m)) $rows[] = array('نسخهٔ سرویس‌ورکر', 'V = ' . $m[1] . ' (با هر تغییر فایل، یکی بالا ببرید)', true);

    $ht = (string) @file_get_contents(DIR . '/.htaccess');
    $rows[] = array('.htaccess', ($ht !== '' && strpos($ht, 'titanali-data') !== false) ? 'هست و داده را می‌بندد ✓' : 'نیست یا داده را نمی‌بندد ❌', $ht !== '' && strpos($ht, 'titanali-data') !== false);

    $hh = health();
    $j = isset($hh['json']) ? $hh['json'] : null;
    if (!is_array($j) || !isset($j['app']) || $j['app'] !== 'titanali') {
        $code = isset($hh['code']) ? $hh['code'] : 0;
        $note = 'api.php پاسخ JSON نداد (HTTP ' . $code . ')';
        if ($code === 0 || $code === 404) $note .= ' — فایل api.php نیست یا PHP خاموش است';
        elseif (strpos((string) $hh['text'], 'curl') === 0) $note .= ' — ' . h(substr((string) $hh['text'], 0, 120));
        else $note .= ' — احتمالاً خطای PHP: ' . h(substr((string) $hh['text'], 0, 160));
        $rows[] = array('بک‌اند', $note, false);
    } else {
        $rows[] = array('بک‌اند', 'نسخهٔ ' . (isset($j['ver']) ? $j['ver'] : '?') . ' · PHP ' . (isset($j['php']) ? $j['php'] : '?')
            . ' · rev ' . (int) (isset($j['rev']) ? $j['rev'] : 0), true);
        $ok = !empty($j['writable']);
        $rows[] = array('پوشهٔ داده', (isset($j['dataDir']) ? $j['dataDir'] : '—') . ' · ' . ($ok ? 'قابل نوشتن ✓' : 'قابل نوشتن نیست ❌ (مجوز/مالکیت)'), $ok);
        $rows[] = array('ادمین سرور', empty($j['installed']) ? 'ساخته نشده — با فرم پایین ساخته می‌شود' : 'از قبل ساخته شده ✓', !empty($j['installed']));
        if (!empty($hh['badSsl'])) $rows[] = array('گواهی SSL', 'api.php فقط با بی‌اعتنایی به گواهی پاسخ داد → در سی‌پنل AutoSSL را بزنید', false);
    }
    return array('rows' => $rows, 'health' => is_array($j) ? $j : null);
}

function data_target()
{
    $home = dirname(DIR);
    $base = basename(DIR);
    if ($base === 'public_html' || $base === 'public_ftp' || $base === 'htdocs' || $base === 'www') return $home . '/titanali-data';
    return $home . '/titanali-data';
}

function move_data_out(&$log)
{
    $target = data_target();
    if (!is_dir($target)) {
        if (!@mkdir($target, 0700, true)) {
            $log[] = array('✗', 'ساخت ' . h($target) . ' ممکن نشد (open_basedir یا مجوز) — بدون جابه‌جایی ادامه می‌دهیم.');
            return false;
        }
        @chmod($target, 0700);
    }
    $log[] = array('✓', 'پوشهٔ داده بیرون از وب آماده است: ' . h($target));
    $src = DIR . '/titanali-data';
    if (is_dir($src)) {
        $n = 0;
        foreach ((array) glob($src . '/*.json') as $f) { if (@copy($f, $target . '/' . basename($f))) $n++; }
        if (is_dir($src . '/uploads')) {
            if (!is_dir($target . '/uploads')) @mkdir($target . '/uploads', 0700, true);
            foreach ((array) glob($src . '/uploads/*') as $f) @copy($f, $target . '/uploads/' . basename($f));
        }
        $log[] = array('·', $n . ' فایل json موجود منتقل شد (نسخهٔ کهنه در public_html/titanali-data دست‌نخورده ماند).');
    }
    @file_put_contents($target . '/.htaccess', "Require all denied\nDeny from all\n<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\n");
    $cfg = DIR . '/titanali-config.php';
    $php = "<?php\n/** ساخته‌شده توسط titanali-install.php در " . date('Y-m-d H:i') . " */\nreturn array(\n    'dataDir' => '" . str_replace("'", '', $target) . "',\n);\n";
    $ok = @file_put_contents($cfg, $php) !== false;
    if ($ok) @chmod($cfg, 0600);
    $log[] = array($ok ? '✓' : '✗', $ok ? 'titanali-config.php نوشته شد: ' . h($cfg) : 'نوشتن titanali-config.php نشد — مسیر داده همان قبلی می‌ماند.');
    return $ok;
}

/* ================================================================= اقدام */
$isCli = (php_sapi_name() === 'cli');
$in = $_POST;
$op = 'form';
if ($isCli) {
    $argvv = isset($_SERVER['argv']) ? $_SERVER['argv'] : array();
    $op = in_array('--install', $argvv, true) ? 'install' : 'check';
    $in = array();
    foreach ($argvv as $a) {
        if (strpos($a, '--user=') === 0) $in['u'] = substr($a, 7);
        if (strpos($a, '--name=') === 0) $in['name'] = substr($a, 7);
        if ($a === '--move') $in['move'] = '1';
    }
    if (isset($_ENV['TA_ADMIN_PASS'])) $in['p'] = $_ENV['TA_ADMIN_PASS'];
    if (isset($_SERVER['TA_ADMIN_PASS'])) $in['p'] = $_SERVER['TA_ADMIN_PASS'];
    if (isset($_ENV['TA_ADMIN_USER'])) $in['u'] = $_ENV['TA_ADMIN_USER'];
} elseif (isset($_POST['op'])) {
    $op = (string) $_POST['op'];
} elseif (isset($_GET['op'])) {
    $op = (string) $_GET['op'];
}

$env = env_rows();
$j = $env['health'];
$installed = is_array($j) && !empty($j['installed']);
$msgs = array();
$done = false;
$nonce = '';

/* فقط تا پیش از نصب، و فقط تا سقف تلاش‌ها */
$lock = lock_read();
$recent = (time() - (int) (isset($lock['when']) ? $lock['when'] : 0)) < 3600;
$tries = (int) (isset($lock['tries']) ? $lock['tries'] : 0);
if ($recent && $tries >= MAX_TRIES) {
    $msgs[] = array('✗', 'بیش از ' . MAX_TRIES . ' تلاش در این یک ساعت — یک ساعت صبر کنید یا فایل <code>titanali-install.lock</code> را پاک کنید.');
    $op = 'blocked';
}
if ($op === 'install') {
    if ($installed) {
        $msgs[] = array('·', 'ادمین سرور از قبل ساخته شده؛ نیازی به نصب نیست.');
        $op = 'blocked';
    } elseif (!$isCli) {
        $nonce = isset($in['n']) ? (string) $in['n'] : '';
        $okNonce = ($nonce !== '' && isset($lock['n']) && hash_equals((string) $lock['n'], $nonce));
        if (!$okNonce && !same_origin()) {
            $msgs[] = array('✗', 'توکن این صفحه معتبر نبود (احتمالاً برگه را از کش باز کرده‌اید). یک بار Fresh باز کنید — <code>Ctrl+Shift+R</code> — و دوباره بفرستید.');
            $op = 'blocked';
        }
    }
}
if ($op === 'install') {
    if (!$isCli) nonce_bump();
    $u = trim(isset($in['u']) ? (string) $in['u'] : '');
    $p = isset($in['p']) ? (string) $in['p'] : '';
    $p2 = isset($in['p2']) ? (string) $in['p2'] : '';
    $nm = trim(isset($in['name']) ? (string) $in['name'] : '');
    $bad = array();
    if (!preg_match('/^[A-Za-z0-9_.\-]{3,32}$/', $u)) $bad[] = 'نام کاربری باید ۳ تا ۳۲ نویسهٔ لاتین باشد (بدون فاصله).';
    if (strlen($p) < 12) $bad[] = 'رمز حداقل ۱۲ نویسه (سرور ۸ می‌خواهد؛ این‌جا سخت‌گیرانه‌تریم).';
    if (!$isCli && $p !== $p2) $bad[] = 'دو بارِ رمز یکی نبود.';
    if ($bad) {
        foreach ($bad as $b) $msgs[] = array('✗', h($b));
        $op = 'form';
    } else {
        if (!empty($in['move'])) move_data_out($msgs);
        $r = api_call('install', array('u' => $u, 'p' => $p, 'name' => $nm !== '' ? $nm : 'ادمین اصلی'), true);
        if (is_array($r['json']) && !empty($r['json']['ok'])) {
            $tk = isset($r['json']['token']) ? (string) $r['json']['token'] : '';
            $msgs[] = array('✓', 'ادمین سرور ساخته شد · ' . h($u) . ' · rev ' . (int) (isset($r['json']['rev']) ? $r['json']['rev'] : 0)
                . ' · توکن ' . strlen($tk) . ' نویسه‌ای صادر شد (چاپ نمی‌شود).');
            $l = api_call('login', array('u' => $u, 'p' => $p), true);
            $msgs[] = (is_array($l['json']) && !empty($l['json']['ok']))
                ? array('✓', 'ورود با همین رمز روی سرور تست شد (نشست ۱۲ ساعته).')
                : array('·', 'تست login کد ' . (int) $l['code'] . ' داد — اگر ۴۲۹ است فقط محدودیت تلاش است و نصب درست بوده.');
            $msgs[] = array('·', 'پنل: ' . h(base_url()) . '/ → کلیک روی عنوان «تیتانلی» → <b>' . h($u) . '</b> و همین رمز.');
            $msgs[] = array('·', 'انتشار طرح‌های داخل مرورگر خودتان: پنل → تب «همگام‌سازی سرور» → «⬆ فرستادن محتوا به سرور».');
            $msgs[] = array('·', 'تغییر رمز: پنل → تب «ادمین‌ها» → رمز تازه → «ذخیره» → تب «همگام‌سازی سرور» → «🔑 رمز ادمین‌ها روی سرور».');
            $done = true;
        } else {
            $e = (is_array($r['json']) && isset($r['json']['error'])) ? $r['json']['error'] : substr((string) $r['text'], 0, 240);
            $msgs[] = array('✗', 'سرور نصب را نپذیرفت (HTTP ' . (int) $r['code'] . '): ' . h($e));
            $op = 'form';
        }
    }
}
if ($installed && !$msgs) $msgs[] = array('✓', 'بک‌اند فعال است؛ این فایل دیگر چیزی نمی‌سازد.');

/* پاک‌کردن خودش */
$selfGone = false;
if ($done || $installed) {
    @unlink(LOCK);
    if (is_writable(DIR)) @unlink(SELF);
    $selfGone = !file_exists(SELF);
    if (!$selfGone) @chmod(SELF, 0400);
    $env = env_rows();   /* گزارش تازه، بعد از تغییرات */
}

/* ================================================================ خروجی */
if ($isCli) {
    foreach ($env['rows'] as $r) echo ($r[2] ? '✓ ' : '· ') . $r[0] . ': ' . $r[1] . "\n";
    foreach ($msgs as $m) echo $m[0] . ' ' . strip_tags(str_replace('<code>', '`', str_replace('</code>', '`', $m[1]))) . "\n";
    if (!$done && !$installed) echo "· برای نصب: TA_ADMIN_PASS='رمز۱۲+' php titanali-install.php --install --user=admin --move\n";
    exit(($done || $installed) ? 0 : 1);
}

if ($op !== 'install') $nonce = nonce_issue();
?><!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>نصب titanali روی هاست</title>
<style>
:root{--bg:#050409;--card:#100d18;--line:rgba(255,255,255,.12);--tx:#f4f1ea;--dim:#a79fb5;--rose:#f43f5e;--blue:#60a5fa;--ok:#34d399;--no:#fb7185}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1100px 520px at 85% -12%,#1b1327 0,transparent 62%),var(--bg);color:var(--tx);
font:15px/1.95 Vazirmatn,"Segoe UI",Tahoma,sans-serif;padding:24px 14px 70px}
main{max-width:780px;margin:0 auto}
h1{font-size:15px;margin:0 0 10px;font-weight:700}
.t{font-size:23px;margin:0 0 4px;font-weight:800}
.sub{color:var(--dim);margin:0 0 18px;font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:17px;padding:15px 17px;margin:0 0 14px}
.row{display:flex;gap:11px;border-bottom:1px dashed rgba(255,255,255,.07);padding:7px 0;font-size:13.5px;align-items:baseline}
.row:last-child{border:0}
.row b{font-weight:600;min-width:130px;color:var(--dim);flex:none}
.row span{word-break:break-word}
.yes{color:var(--ok)}.no{color:var(--no)}
label{display:block;font-size:12.5px;color:var(--dim);margin:11px 0 4px}
input[type=text],input[type=password]{width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--line);background:#0b0912;color:var(--tx);font:inherit}
input:focus{outline:0;border-color:var(--blue)}
button{font:inherit;border:0;border-radius:12px;padding:11px 17px;cursor:pointer}
.go{background:var(--rose);color:#fff;font-weight:700}
.ghost{background:transparent;color:var(--blue);border:1px solid var(--line)}
.chk{display:flex;gap:9px;align-items:flex-start;font-size:13px;color:var(--tx);margin:11px 0}
.chk input{margin-top:6px;flex:none}
.warn{background:rgba(244,63,94,.09);border:1px solid rgba(244,63,94,.34);border-radius:13px;padding:11px 13px;font-size:13px;margin-top:12px}
.done{background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.42);border-radius:13px;padding:12px 14px;font-size:13.5px;margin-top:12px}
code{background:#0b0912;border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-size:12.3px}
a{color:var(--blue)}
.acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
</style></head><body><main>

<h1 class="t">نصب titanali روی <span dir="ltr"><?php echo h(isset($_SERVER['HTTP_HOST']) ? preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST']) : 'این دامنه'); ?></span></h1>
<p class="sub">پیش‌نیاز: محتویات <code>titanali-cpanel.zip</code> داخل <code>public_html</code> باشد. <?php echo $installed ? '' : 'اگر جابه‌جایی پوشهٔ داده را تیک بزنید، داده بیرون از وب می‌رود (توصیه‌شده).'; ?></p>

<div class="card"><h1>۱) بررسی پیش‌از‌اقدام</h1>
<?php foreach ($env['rows'] as $r): ?>
<div class="row"><b><?php echo h($r[0]); ?></b><span class="<?php echo $r[2] ? 'yes' : 'no'; ?>"><?php echo $r[1]; ?></span></div>
<?php endforeach; ?>
</div>

<?php if ($msgs): ?>
<div class="card"><h1>۲) نتیجه</h1>
<?php foreach ($msgs as $m): ?>
<div class="row"><span class="<?php echo $m[0] === '✓' ? 'yes' : ($m[0] === '✗' ? 'no' : ''); ?>" style="min-width:16px;flex:none"><?php echo $m[0]; ?></span><span><?php echo $m[1]; ?></span></div>
<?php endforeach; ?>
<?php if ($done): ?>
<div class="done"><?php echo $selfGone ? 'این فایل خودش را پاک کرد ✓ — با رفرش، این صفحه نباید باز شود.' : 'حالا این فایل را پاک کنید: <code>rm ' . h(SELF) . '</code> (یا از File Manager). تا پاک نشده، اگر کسی صفحه را باز کند فقط می‌بیند نصب شده است.'; ?>
&nbsp; <a href="./">رفتن به سایت</a></div>
<?php endif; ?>
</div>
<?php endif; ?>

<?php if (!$installed): ?>
<form class="card" method="post" action="">
<h1>۲) ساخت ادمین سرور و فعال‌سازی همگام‌سازی</h1>
<p class="sub">رمز با bcrypt سمت سرور هَش می‌شود؛ در این صفحه، در لاگ هاست یا در هیچ فایلی ذخیره نمی‌شود. درخواست به <code><?php echo h(base_url()); ?>/api.php</code> می‌رود.</p>
<input type="hidden" name="op" value="install">
<input type="hidden" name="n" value="<?php echo h($nonce); ?>">
<label>نام کاربری (لاتین، ۳ تا ۳۲ نویسه)</label>
<input type="text" name="u" value="admin" autocomplete="username" required>
<label>رمز عبور — حداقل ۱۲ نویسه</label>
<input type="password" name="p" autocomplete="new-password" required minlength="12">
<label>تکرار رمز</label>
<input type="password" name="p2" autocomplete="new-password" required minlength="12">
<label>نام نمایشی در پنل (اختیاری)</label>
<input type="text" name="name" value="ادمین اصلی">
<div class="chk"><input type="checkbox" id="mv" name="move" value="1" checked><label for="mv" style="margin:0;color:var(--tx)">پوشهٔ داده را بیرون از <code>public_html</code> ببر: <code><?php echo h(data_target()); ?></code> و <code>titanali-config.php</code> را بساز.</label></div>
<div class="acts">
<button class="go" type="submit">نصب و ساخت ادمین سرور</button>
<button class="ghost" type="submit" name="op" value="check">فقط بررسی دوباره</button>
</div>
<div class="warn">بعد از نصب موفق، این فایل تلاش می‌کند خودش را پاک کند. اگر پاک نشد، حتماً دستی پاکش کنید — تنها راهِ ساختِ ادمین تا وقتی ادمینی نیست همین فایل است.</div>
</form>
<?php else: ?>
<div class="card"><h1>۲) لازم نیست کاری کنید</h1>
<p class="sub">بک‌اند فعال است. <?php echo $selfGone ? 'این فایل هم خودش را پاک کرد ✓' : 'فایل را پاک کنید: <code>rm ' . h(SELF) . '</code>'; ?> — ورود پنل: <a href="./">همان صفحهٔ سایت</a>، کلیک روی عنوان «تیتانلی».</p></div>
<?php endif; ?>

<p class="sub">راه جایگزین (خط فرمان سی‌پنل): <code>curl -fsSL <?php echo REPO_RAW; ?>deploy/install-on-server.sh | bash</code> — بکاپ می‌گیرد، فایل‌ها را می‌ریزد و همان نصب را می‌کند.</p>
</main></body></html>
