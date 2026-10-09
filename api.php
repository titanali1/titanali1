<?php
/**
 * titanali — بک‌اند اختیاری (یک‌فایلی، PHP 7.0+، بدون دیتابیس و بدون Composer)
 * -----------------------------------------------------------------------------
 * چه کاری می‌کند؟
 *   • محتوای سایت (طرح‌ها، پروفایل، اینستاگرام،…) را روی سرور نگه می‌دارد تا
 *     هر دستگاهی همان نسخه را ببیند و ادمین از موبایل هم بتواند ویرایش کند.
 *   • صندوق مشترک (inbox): پیام‌های بازدیدکننده‌ها در سرور می‌نشیند، ادمین
 *     پاسخ می‌دهد و پاسخ در گفتگوی همان بازدیدکننده ظاهر می‌شود.
 *   • شمارنده‌های لایک/دانلود/بازدید و کامنت‌ها بین همه مشترک است.
 *   • ورود ادمین سمت سرور (bcrypt + توکن) — دیگر رمز در سورس نیست.
 *
 * نصب: همین فایل را کنار index.html در public_html بگذارید. پوشهٔ
 *   titanali-data/ خودکار ساخته و با .htaccess بسته می‌شود.
 *   سپس از تب «همگام‌سازی» پنل، یک بار نام‌کاربری/رمز بسازید (action=install).
 *
 * فایل‌ها همه JSON تخت‌اند و با flock + نوشتن اتمی (tmp + rename) ذخیره می‌شوند.
 * اگر api.php را پاک کنید، سایت دقیقاً مثل قبل کار می‌کند (فقط محلی).
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

define('TA_VER', '1.0.0');
define('TA_TOKEN_TTL', 43200);          /* ۱۲ ساعت نشست ادمین */

/* =====================================================================
 *  تنظیمات و مسیرها
 * ===================================================================== */
function ta_cfg()
{
    static $c = null;
    if ($c !== null) return $c;
    $base = dirname(__FILE__);
    $c = array(
        'dataDir'  => $base . '/titanali-data',
        'maxJson'  => 6 * 1024 * 1024,   /* سقف بدنهٔ JSON */
        'maxFile'  => 6 * 1024 * 1024,   /* سقف هر پیوست */
        'origin'   => '',                /* برای CORS؛ خالی = فقط همان مبدأ */
        'proxyTrusted' => false,         /* اگر پشت CDN هستید true کنید */
    );
    if (is_file($base . '/titanali-config.php')) {
        $x = include $base . '/titanali-config.php';
        if (is_array($x)) $c = array_merge($c, $x);
    }
    if (!is_dir($c['dataDir'])) @mkdir($c['dataDir'], 0775, true);
    ta_harden($c['dataDir']);
    return $c;
}

/* بستن دسترسی وب به پوشهٔ داده‌ها و غیرفعال‌کردن PHP در پیوست‌ها */
function ta_harden($dir)
{
    if (!is_dir($dir)) return;
    $deny = "Require all denied\nDeny from all\nOptions -Indexes\n";
    if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', $deny);
    if (!is_file($dir . '/index.php')) @file_put_contents($dir . '/index.php', "<?php /* silence is golden */\n");
    $up = $dir . '/uploads';
    if (!is_dir($up)) @mkdir($up, 0775, true);
    if (!is_file($up . '/.htaccess')) {
        @file_put_contents($up . '/.htaccess', $deny . "<FilesMatch \"\\.(php|phtml|phar|pl|py|cgi)$\">\n  Require all denied\n</FilesMatch>\n");
    }
    if (!is_dir($dir . '/backups')) @mkdir($dir . '/backups', 0775, true);
}

function ta_file($name)
{
    $c = ta_cfg();
    return $c['dataDir'] . '/' . $name;
}

/* =====================================================================
 *  خواندن/نوشتن JSON (قفل‌شده و اتمی)
 * ===================================================================== */
function ta_read($name, $def)
{
    $p = ta_file($name);
    if (!is_file($p)) return $def;
    $fp = @fopen($p, 'rb');
    if (!$fp) return $def;
    @flock($fp, LOCK_SH);
    $s = '';
    while (!feof($fp)) { $chunk = fread($fp, 262144); if ($chunk === false) break; $s .= $chunk; }
    @flock($fp, LOCK_UN);
    fclose($fp);
    if ($s === '') return $def;
    $j = json_decode($s, true);
    return is_array($j) ? $j : $def;
}

function ta_put($name, $data)
{
    $p = ta_file($name);
    $tmp = $p . '.' . getmypid() . '.tmp';
    $s = json_encode($data, JSON_UNESCAPED_UNICODE + JSON_UNESCAPED_SLASHES);
    if ($s === false) return false;
    if (@file_put_contents($tmp, $s, LOCK_EX) === false) return false;
    @chmod($tmp, 0644);
    if (!@rename($tmp, $p)) { @unlink($tmp); return false; }
    clearstatcache(true, $p);
    return true;
}

function ta_lock()
{
    $c = ta_cfg();
    $fp = @fopen($c['dataDir'] . '/_lock', 'cb');
    if (!$fp) ta_out(500, array('ok' => false, 'error' => 'پوشهٔ داده‌ها نوشتنی نیست: ' . $c['dataDir']));
    @flock($fp, LOCK_EX);
    return $fp;
}
function ta_unlock($fp)
{
    if ($fp) { @flock($fp, LOCK_UN); fclose($fp); }
}

/* =====================================================================
 *  لایهٔ HTTP
 * ===================================================================== */
function ta_out($code, $arr)
{
    if (!headers_sent()) {
        @http_response_code($code);
        @header('Content-Type: application/json; charset=utf-8');
        @header('Cache-Control: no-store, max-age=0');
        @header('X-Content-Type-Options: nosniff');
        @header('Referrer-Policy: no-referrer');
        $c = ta_cfg();
        if ($c['origin'] !== '') {
            @header('Access-Control-Allow-Origin: ' . $c['origin']);
            @header('Vary: Origin');
        }
    }
    echo json_encode($arr, JSON_UNESCAPED_UNICODE + JSON_UNESCAPED_SLASHES);
    exit;
}

function ta_ip()
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0';
    $c = ta_cfg();
    if ($c['proxyTrusted'] && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $p = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $x = trim($p[0]);
        if ($x !== '') $ip = $x;
    }
    return substr($ip, 0, 45);
}

function ta_body()
{
    $c = ta_cfg();
    $len = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($len > $c['maxJson']) ta_out(413, array('ok' => false, 'error' => 'بدنهٔ درخواست بیش از حد مجاز است'));
    $s = file_get_contents('php://input');
    if ($s === false || $s === '') return array();
    if (strlen($s) > $c['maxJson']) ta_out(413, array('ok' => false, 'error' => 'بدنهٔ درخواست بیش از حد مجاز است'));
    $j = json_decode($s, true);
    if (!is_array($j)) ta_out(400, array('ok' => false, 'error' => 'JSON نامعتبر است'));
    return $j;
}

function ta_str($v, $max, $keep = false)
{
    if (!is_scalar($v)) return '';
    $s = (string) $v;
    if (!$keep) {
        $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $s);   /* کنترل‌کاراکترها */
        $s = strip_tags($s);
    }
    $s = trim($s);
    if (function_exists('mb_substr')) return mb_substr($s, 0, $max, 'UTF-8');
    return substr($s, 0, $max);
}

function ta_arr($v) { return is_array($v) ? $v : array(); }

/* محدودیت نرخ ساده، فایل‌محور */
function ta_throttle($key, $max, $win)
{
    $f = ta_read('rl.json', array());
    $now = time();
    $list = isset($f[$key]) && is_array($f[$key]) ? $f[$key] : array();
    $keep = array();
    foreach ($list as $t) { if ($t > $now - $win) $keep[] = $t; }
    if (count($keep) >= $max) {
        $f[$key] = $keep; ta_put('rl.json', $f);
        return false;
    }
    $keep[] = $now;
    $f[$key] = $keep;
    if (count($f) > 400) $f = array_slice($f, -300, null, true);   /* رشد بی‌حد نکند */
    ta_put('rl.json', $f);
    return true;
}

/* =====================================================================
 *  احراز هویت
 * ===================================================================== */
function ta_conf()  { return ta_read('config.json', array()); }

function ta_secret()
{
    $c = ta_conf();
    if (isset($c['secret']) && strlen($c['secret']) >= 32) return $c['secret'];
    $s = bin2hex(random_bytes(24));
    $c['secret'] = $s;
    ta_put('config.json', $c);
    return $s;
}

function ta_users()
{
    $c = ta_conf();
    return isset($c['users']) && is_array($c['users']) ? array_values($c['users']) : array();
}
function ta_installed() { return count(ta_users()) > 0; }

function ta_hash_pw($pw)
{
    if (defined('PASSWORD_DEFAULT')) return password_hash($pw, PASSWORD_DEFAULT);
    return 'sha256$' . hash('sha256', $pw . 'titanali-salt');   /* فقط برای PHP های خیلی قدیمی */
}
function ta_check_pw($pw, $hash)
{
    if (strpos((string) $hash, 'sha256$') === 0) {
        return hash_equals($hash, 'sha256$' . hash('sha256', $pw . 'titanali-salt'));
    }
    return password_verify($pw, (string) $hash);
}

function ta_issue($u)
{
    $t = bin2hex(random_bytes(20));
    $tk = ta_read('tokens.json', array());
    $tk[$u] = array('h' => hash('sha256', $t), 'exp' => time() + TA_TOKEN_TTL);
    ta_put('tokens.json', $tk);
    return $t;
}

function ta_whoami()
{
    $h = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) $h = $_SERVER['HTTP_AUTHORIZATION'];
    elseif (isset($_SERVER['HTTP_X_TA_TOKEN'])) $h = 'Bearer ' . $_SERVER['HTTP_X_TA_TOKEN'];
    elseif (!empty($_GET['t'])) $h = 'Bearer ' . $_GET['t'];
    $t = trim(preg_replace('/^Bearer\s+/i', '', $h));
    if ($t === '') return null;
    $tk = ta_read('tokens.json', array());
    $now = time();
    $dirty = false;
    $hit = null;
    foreach ($tk as $u => $r) {
        if (!is_array($r) || !isset($r['h'])) { unset($tk[$u]); $dirty = true; continue; }
        if ($r['exp'] < $now) { unset($tk[$u]); $dirty = true; continue; }
        if (hash_equals($r['h'], hash('sha256', $t))) { $hit = $u; break; }
    }
    if ($dirty) ta_put('tokens.json', $tk);
    if ($hit === null) return null;
    foreach (ta_users() as $a) { if (isset($a['u']) && $a['u'] === $hit) return array('u' => $hit, 'name' => isset($a['name']) ? $a['name'] : $hit); }
    return array('u' => $hit, 'name' => $hit);
}

function ta_need_admin()
{
    if (!ta_installed()) ta_out(423, array('ok' => false, 'error' => 'ابتدا ادمین را در تب «همگام‌سازی» بسازید (نصب روی سرور)'));
    $w = ta_whoami();
    if (!$w) ta_out(401, array('ok' => false, 'error' => 'نشست تمام شده — دوباره وارد شوید'));
    return $w;
}

/* =====================================================================
 *  محتوا / شمارنده‌ها / کامنت‌ها
 * ===================================================================== */
function ta_meta() { return ta_read('meta.json', array()); }
function ta_rev()
{
    $m = ta_meta();
    return isset($m['rev']) ? (int) $m['rev'] : 0;
}
function ta_bump()
{
    $m = ta_meta();
    $m['rev'] = (int) (isset($m['rev']) ? $m['rev'] : 0) + 1;
    $m['updated'] = time();
    ta_put('meta.json', $m);
    return $m['rev'];
}

function ta_payload($withSocial)
{
    $content = ta_read('content.json', null);
    $m = ta_meta();
    $out = array('ok' => true, 'rev' => ta_rev(), 'installed' => ta_installed());
    $out['data'] = is_array($content) ? $content : null;
    $out['updated'] = isset($m['updated']) ? (int) $m['updated'] : 0;
    if ($withSocial) $out['social'] = ta_social_shape();
    return $out;
}

function ta_social() { return ta_read('social.json', array('likes' => array(), 'dl' => array(), 'views' => 0, 'comments' => array())); }

function ta_social_shape()
{
    $s = ta_social();
    return array(
        'likes'    => ta_arr($s['likes']),
        'dl'       => ta_arr($s['dl']),
        'views'    => isset($s['views']) ? (int) $s['views'] : 0,
        'comments' => ta_arr($s['comments']),
    );
}

/* =====================================================================
 *  پیام‌ها
 * ===================================================================== */
function ta_inbox_all() { return ta_arr(ta_read('inbox.json', array())); }

function ta_sane_sid($s)
{
    $s = preg_replace('/[^A-Za-z0-9_-]/', '', (string) $s);
    return substr($s, 0, 24);
}

/* =====================================================================
 *  پیوست‌ها
 * ===================================================================== */
function ta_types()
{
    return array(
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif',
        'image/avif' => 'avif', 'image/svg+xml' => 'svg', 'application/pdf' => 'pdf',
        'video/mp4' => 'mp4', 'video/webm' => 'webm', 'audio/mpeg' => 'mp3', 'text/plain' => 'txt',
        'application/zip' => 'zip', 'application/octet-stream' => 'bin',
    );
}

function ta_store_file($name, $type, $b64)
{
    $c = ta_cfg();
    $raw = base64_decode(preg_replace('/\s+/', '', (string) $b64), true);
    if ($raw === false || $raw === '') return array('ok' => false, 'error' => 'پیوست رمزگشایی نشد');
    if (strlen($raw) > $c['maxFile']) return array('ok' => false, 'error' => 'حجم پیوست بیشتر از ' . round($c['maxFile'] / 1048576, 1) . ' مگابایت است');
    $types = ta_types();
    $mime = isset($types[$type]) ? $type : 'application/octet-stream';
    $ext = $types[$mime];
    $id = substr(hash('sha256', $raw . microtime() . ta_secret()), 0, 24);
    $fn = $id . '.' . $ext;
    $dir = $c['dataDir'] . '/uploads';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    if (@file_put_contents($dir . '/' . $fn, $raw) === false) return array('ok' => false, 'error' => 'ذخیرهٔ فایل روی سرور نشد (مجوز پوشهٔ titanali-data)');
    $safe = preg_replace('/[^\w.\- ]+/u', '', (string) $name);
    if ($safe === '') $safe = 'file.' . $ext;
    return array('ok' => true, 'id' => $fn, 'url' => 'api.php?action=file&f=' . rawurlencode($fn),
                 'name' => substr($safe, 0, 80), 'type' => $mime, 'size' => strlen($raw));
}

/* =====================================================================
 *  مسیردهی
 * ===================================================================== */
$ACTION = isset($_GET['action']) ? preg_replace('/[^a-z_]/', '', strtolower((string) $_GET['action'])) : 'health';
$ME = ta_whoami();
$AUTH = is_array($ME);

/* ---------- عمومی ---------- */
if ($ACTION === 'health') {
    ta_out(200, array('ok' => true, 'app' => 'titanali', 'ver' => TA_VER, 'installed' => ta_installed(),
                      'needSetup' => !ta_installed(), 'rev' => ta_rev(),
                      'writable' => is_writable(ta_cfg()['dataDir']),
                      'php' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
                      'file' => ta_cfg()['dataDir'] . '/titanali-data'));
}

if ($ACTION === 'install') {
    if (ta_installed()) ta_out(409, array('ok' => false, 'error' => 'روی این سرور قبلاً نصب شده است'));
    $b = ta_body();
    $u = ta_str(isset($b['u']) ? $b['u'] : '', 32);
    $p = isset($b['p']) ? (string) $b['p'] : '';
    $nm = ta_str(isset($b['name']) ? $b['name'] : '', 40);
    if (strlen($u) < 3) ta_out(400, array('ok' => false, 'error' => 'نام کاربری حداقل ۳ حرف'));
    if (strlen($p) < 8) ta_out(400, array('ok' => false, 'error' => 'رمز حداقل ۸ کاراکتر (برای سرور سخت‌گیرانه‌تر از حالت محلی)'));
    if (!ta_throttle('install', 5, 600)) ta_out(429, array('ok' => false, 'error' => 'چند دقیقه صبر کنید'));
    $lk = ta_lock();
    $c = ta_conf();
    $c['users'] = array(array('u' => $u, 'p' => ta_hash_pw($p), 'name' => $nm !== '' ? $nm : 'ادمین سرور', 'role' => 'owner'));
    if (!isset($c['secret'])) $c['secret'] = bin2hex(random_bytes(24));
    ta_put('config.json', $c);
    if (isset($b['data']) && is_array($b['data'])) ta_put('content.json', $b['data']);
    ta_unlock($lk);
    ta_secret();
    ta_out(200, array('ok' => true, 'token' => ta_issue($u), 'user' => $u, 'name' => $nm !== '' ? $nm : 'ادمین سرور',
                      'rev' => ta_rev(), 'msg' => 'ادمین سرور ساخته شد. از این پس با همین رمز وارد شوید.'));
}

if ($ACTION === 'login') {
    if (!ta_installed()) ta_out(423, array('ok' => false, 'error' => 'نصب انجام نشده — از تب همگام‌سازی اقدام کنید'));
    $b = ta_body();
    $u = ta_str(isset($b['u']) ? $b['u'] : '', 32);
    $p = isset($b['p']) ? (string) $b['p'] : '';
    if (!ta_throttle('login:' . ta_ip() . ':' . $u, 10, 600)) {
        ta_out(429, array('ok' => false, 'error' => 'تلاش زیاد بود — ۱۰ دقیقه صبر کنید'));
    }
    $found = null;
    foreach (ta_users() as $a) {
        if (isset($a['u']) && $a['u'] === $u && ta_check_pw($p, isset($a['p']) ? $a['p'] : '')) { $found = $a; break; }
    }
    if (!$found) ta_out(401, array('ok' => false, 'error' => 'نام کاربری یا رمز درست نیست'));
    ta_out(200, array('ok' => true, 'token' => ta_issue($u), 'user' => $u,
                      'name' => isset($found['name']) ? $found['name'] : $u));
}

if ($ACTION === 'logout') {
    $b = ta_body();
    $tk = ta_read('tokens.json', array());
    foreach ($tk as $u => $r) {
        if (is_array($r) && isset($r['h']) && isset($b['t']) && $r['h'] === hash('sha256', (string) $b['t'])) unset($tk[$u]);
    }
    ta_put('tokens.json', $tk);
    ta_out(200, array('ok' => true));
}

if ($ACTION === 'content') {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') ta_out(200, ta_payload(true));
    $w = ta_need_admin();
    $b = ta_body();
    $data = isset($b['data']) ? $b['data'] : null;
    if (!is_array($data)) ta_out(400, array('ok' => false, 'error' => 'data لازم است'));
    if (count($data) < 1) ta_out(400, array('ok' => false, 'error' => 'data خالی است'));
    $lk = ta_lock();
    $cur = ta_rev();
    if (isset($b['baseRev']) && (int) $b['baseRev'] !== $cur) {
        ta_unlock($lk);
        ta_out(409, array('ok' => false, 'conflict' => true, 'rev' => $cur, 'data' => ta_read('content.json', null),
                          'error' => 'نسخهٔ سرور تازه‌تر است؛ اول «گرفتن از سرور» را بزنید یا با «جابه‌جایی» بازنویسی کنید'));
    }
    if (!ta_put('content.json', $data)) { ta_unlock($lk); ta_out(500, array('ok' => false, 'error' => 'نوشتن نشد')); }
    $newRev = ta_bump();
    $lg = ta_read('log.json', array());
    array_push($lg, array('ts' => time(), 'u' => $w['u'], 'what' => 'content'));
    ta_put('log.json', array_slice($lg, -200));
    ta_unlock($lk);
    ta_out(200, array('ok' => true, 'rev' => $newRev));
}

if ($ACTION === 'social') { ta_out(200, array('ok' => true, 'social' => ta_social_shape())); }

if ($ACTION === 'metric') {
    $b = ta_body();
    $i = isset($b['i']) ? preg_replace('/[^0-9]/', '', (string) $b['i']) : '';
    $k = isset($b['k']) ? (string) $b['k'] : '';
    $d = isset($b['d']) ? ((int) $b['d']) : 1;
    if ($d > 1) $d = 1; if ($d < -1) $d = -1;
    if ($i === '' || !in_array($k, array('like', 'dl'), true)) ta_out(400, array('ok' => false, 'error' => 'i و k لازم است'));
    if (!ta_throttle('metric:' . ta_ip(), 120, 60)) ta_out(429, array('ok' => false, 'error' => 'کمی صبر کنید'));
    $lk = ta_lock();
    $s = ta_social();
    $bucket = $k === 'like' ? 'likes' : 'dl';
    if (!isset($s[$bucket]) || !is_array($s[$bucket])) $s[$bucket] = array();
    $v = isset($s[$bucket][$i]) ? (int) $s[$bucket][$i] : 0;
    $v = max(0, $v + $d);
    if ($v === 0) unset($s[$bucket][$i]); else $s[$bucket][$i] = $v;
    $s['views'] = (int) (isset($s['views']) ? $s['views'] : 0) + 1;
    ta_put('social.json', $s);
    ta_unlock($lk);
    ta_out(200, array('ok' => true, 'social' => ta_social_shape()));
}

if ($ACTION === 'comment') {
    $b = ta_body();
    if (isset($b['company']) && trim((string) $b['company']) !== '') ta_out(200, array('ok' => true, 'quiet' => true));  /* زنبور عسل */
    $i = isset($b['i']) ? preg_replace('/[^0-9]/', '', (string) $b['i']) : '';
    $txt = ta_str(isset($b['txt']) ? $b['txt'] : '', 400);
    $who = ta_str(isset($b['n']) ? $b['n'] : '', 24);
    if ($i === '' || $txt === '') ta_out(400, array('ok' => false, 'error' => 'متن خالی است'));
    if (!ta_throttle('cmt:' . ta_ip(), 6, 60)) ta_out(429, array('ok' => false, 'error' => 'زیاد شد — کمی صبر کنید'));
    $lk = ta_lock();
    $s = ta_social();
    if (!isset($s['comments']) || !is_array($s['comments'])) $s['comments'] = array();
    if (!isset($s['comments'][$i]) || !is_array($s['comments'][$i])) $s['comments'][$i] = array();
    $s['comments'][$i][] = array('id' => substr(bin2hex(random_bytes(5)), 0, 8),
                                 'n' => $who !== '' ? $who : 'مهمان', 'txt' => $txt, 'ts' => time() * 1000);
    foreach ($s['comments'] as $kk => $vv) { $s['comments'][$kk] = array_slice($vv, -60); }
    ta_put('social.json', $s);
    ta_unlock($lk);
    ta_out(200, array('ok' => true, 'comments' => $s['comments'][$i]));
}

if ($ACTION === 'comment_del') {
    $w = ta_need_admin();
    $b = ta_body();
    $i = preg_replace('/[^0-9]/', '', isset($b['i']) ? (string) $b['i'] : '');
    $cid = preg_replace('/[^a-f0-9]/', '', isset($b['id']) ? (string) $b['id'] : '');
    if ($i === '' || $cid === '') ta_out(400, array('ok' => false, 'error' => 'i و id لازم است'));
    $lk = ta_lock();
    $s = ta_social();
    if (isset($s['comments'][$i]) && is_array($s['comments'][$i])) {
        $keep = array();
        foreach ($s['comments'][$i] as $c) {
            if (is_array($c) && isset($c['id']) && $c['id'] === $cid) continue;
            $keep[] = $c;
        }
        $s['comments'][$i] = $keep;
        ta_put('social.json', $s);
    }
    ta_unlock($lk);
    ta_out(200, array('ok' => true, 'comments' => isset($s['comments'][$i]) ? $s['comments'][$i] : array()));
}

/* ---------- گفتگو و صندوق ---------- */
if ($ACTION === 'send') {
    $b = ta_body();
    if (isset($b['company']) && trim((string) $b['company']) !== '') ta_out(200, array('ok' => true, 'quiet' => true));
    $sid = ta_sane_sid(isset($b['sid']) ? $b['sid'] : '');
    if ($sid === '') $sid = substr(hash('sha256', ta_ip() . microtime() . ta_secret()), 0, 8);
    $txt = ta_str(isset($b['text']) ? $b['text'] : '', 4000);
    $file = (isset($b['file']) && is_array($b['file'])) ? $b['file'] : null;
    if ($txt === '' && !$file) ta_out(400, array('ok' => false, 'error' => 'پیام خالی است'));
    if (!ta_throttle('send:' . ta_ip(), 12, 60)) ta_out(429, array('ok' => false, 'error' => 'چند پیام پشت سر هم فرستادید — یک دقیقه صبر کنید'));
    $lk = ta_lock();
    $box = ta_inbox_all();
    $mid = substr(bin2hex(random_bytes(6)), 0, 10);
    $row = array('mid' => $mid, 'sid' => $sid, 'from' => 'guest', 'text' => $txt, 'ts' => time() * 1000,
                 'to' => ta_str(isset($b['to']) ? $b['to'] : '', 24), 'ip' => ta_ip(), 'ua' => substr(ta_str(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '', 120), 0, 120));
    if ($file) {
        $row['file'] = array('id' => ta_str(isset($file['id']) ? $file['id'] : '', 40),
                             'name' => ta_str(isset($file['name']) ? $file['name'] : '', 80),
                             'type' => ta_str(isset($file['type']) ? $file['type'] : '', 40),
                             'size' => isset($file['size']) ? (int) $file['size'] : 0);
    }
    $box[] = $row;
    if (count($box) > 3000) $box = array_slice($box, -2500);
    ta_put('inbox.json', $box);
    ta_unlock($lk);
    ta_out(200, array('ok' => true, 'mid' => $mid, 'sid' => $sid, 'ts' => $row['ts'],
                      'unread' => ta_unread_count($sid)));
}

/* seen.json = { sid: {a: وقت‌که ادمین خوانده, g: وقت‌که مهمان خوانده} } */
function ta_seen() { return ta_arr(ta_read('seen.json', array())); }
function ta_seen_set($sid, $who, $ts)
{
    if ($sid === '') return;
    $s = ta_seen();
    if (!isset($s[$sid]) || !is_array($s[$sid])) $s[$sid] = array();
    $s[$sid][$who] = max((int) (isset($s[$sid][$who]) ? $s[$sid][$who] : 0), (int) $ts);
    if (count($s) > 2000) $s = array_slice($s, -1500, null, true);
    ta_put('seen.json', $s);
}
function ta_unread_count($sid)
{
    $s = ta_seen();
    $seen = isset($s[$sid]) && is_array($s[$sid]) && isset($s[$sid]['g']) ? (int) $s[$sid]['g'] : 0;
    $n = 0;
    foreach (ta_inbox_all() as $r) {
        if (!is_array($r)) continue;
        if (isset($r['from']) && $r['from'] === 'admin' && isset($r['sid']) && $r['sid'] === $sid && (int) $r['ts'] > $seen) $n++;
    }
    return $n;
}
function ta_unread_for_admin($sid)
{
    $s = ta_seen();
    $seen = isset($s[$sid]) && is_array($s[$sid]) && isset($s[$sid]['a']) ? (int) $s[$sid]['a'] : 0;
    $n = 0;
    foreach (ta_inbox_all() as $r) {
        if (!is_array($r)) continue;
        if (isset($r['from']) && $r['from'] !== 'admin' && isset($r['sid']) && $r['sid'] === $sid && (int) $r['ts'] > $seen) $n++;
    }
    return $n;
}

if ($ACTION === 'thread') {
    $sid = ta_sane_sid(isset($_GET['sid']) ? $_GET['sid'] : '');
    if ($sid === '') ta_out(400, array('ok' => false, 'error' => 'sid لازم است'));
    $out = array();
    foreach (ta_inbox_all() as $r) {
        if (!is_array($r) || !isset($r['sid']) || $r['sid'] !== $sid) continue;
        if (isset($r['from']) && $r['from'] !== 'admin') continue;   /* فقط پاسخ‌های ادمین */
        $row = array('mid' => $r['mid'], 'text' => $r['text'], 'ts' => $r['ts'], 'from' => 'them',
                     'name' => isset($r['name']) ? $r['name'] : 'تیتانلی');
        if (!empty($r['file']) && is_array($r['file'])) {
            $row['file'] = array('name' => $r['file']['name'], 'type' => $r['file']['type'],
                                 'size' => $r['file']['size'], 'url' => 'api.php?action=file&f=' . rawurlencode($r['file']['id']));
        }
        $out[] = $row;
    }
    $max = 0;
    foreach ($out as $o) { if ((int) $o['ts'] > $max) $max = (int) $o['ts']; }
    if ($max) ta_seen_set($sid, 'g', $max);
    ta_out(200, array('ok' => true, 'messages' => $out, 'unread' => 0));
}

if ($ACTION === 'inbox') {
    $w = ta_need_admin();
    $threads = array();
    $seenAll = ta_seen();
    foreach (ta_inbox_all() as $r) {
        if (!is_array($r) || !isset($r['sid'])) continue;
        $sid = $r['sid'];
        if (!isset($threads[$sid])) $threads[$sid] = array('sid' => $sid, 'n' => 0, 'last' => 0, 'items' => array(), 'unread' => 0);
        $threads[$sid]['n']++;
        $threads[$sid]['last'] = max($threads[$sid]['last'], (int) $r['ts']);
        if (count($threads[$sid]['items']) < 40) $threads[$sid]['items'][] = $r;
        if (isset($r['from']) && $r['from'] !== 'admin') {
            $seen = isset($seenAll[$sid]) && is_array($seenAll[$sid]) && isset($seenAll[$sid]['a']) ? (int) $seenAll[$sid]['a'] : 0;
            if ((int) $r['ts'] > $seen) $threads[$sid]['unread']++;
        }
    }
    foreach ($threads as $k => $v) {
        $t = $v['items'];
        usort($t, 'ta_cmp_ts');
        $threads[$k]['items'] = $t;
        $threads[$k]['unreadForAdmin'] = ta_unread_for_admin($v['sid']);
    }
    usort($threads, 'ta_cmp_last');
    $nu = 0;
    foreach ($threads as $v) { $nu += $v['unreadForAdmin']; }
    ta_out(200, array('ok' => true, 'threads' => array_values($threads), 'total' => count(ta_inbox_all()), 'unread' => $nu));
}

function ta_cmp_ts($a, $b) { return (int) $a['ts'] === (int) $b['ts'] ? 0 : ((int) $a['ts'] < (int) $b['ts'] ? -1 : 1); }
function ta_cmp_last($a, $b) { return (int) $b['last'] === (int) $a['last'] ? 0 : ((int) $b['last'] < (int) $a['last'] ? -1 : 1); }

if ($ACTION === 'reply') {
    $w = ta_need_admin();
    $b = ta_body();
    $sid = ta_sane_sid(isset($b['sid']) ? $b['sid'] : '');
    $txt = ta_str(isset($b['text']) ? $b['text'] : '', 4000);
    if ($sid === '' || $txt === '') ta_out(400, array('ok' => false, 'error' => 'sid و text لازم است'));
    $lk = ta_lock();
    $box = ta_inbox_all();
    $mid = substr(bin2hex(random_bytes(6)), 0, 10);
    $row = array('mid' => $mid, 'sid' => $sid, 'from' => 'admin', 'name' => $w['name'], 'text' => $txt, 'ts' => time() * 1000 + 1);
    if (!empty($b['file']) && is_array($b['file'])) $row['file'] = $b['file'];
    $box[] = $row;
    ta_put('inbox.json', $box);
    ta_unlock($lk);
    ta_seen_set($sid, 'a', $row['ts']);      /* ادمین که جواب داد، یعنی خوانده */
    ta_out(200, array('ok' => true, 'mid' => $mid, 'ts' => $row['ts']));
}

if ($ACTION === 'read') {
    $w = ta_need_admin();
    $b = ta_body();
    $sid = ta_sane_sid(isset($b['sid']) ? $b['sid'] : '');
    $t = 0;
    foreach (ta_inbox_all() as $r) { if (is_array($r) && isset($r['sid']) && $r['sid'] === $sid) $t = max($t, (int) $r['ts']); }
    ta_seen_set($sid, 'a', $t + 1);
    ta_out(200, array('ok' => true, 'unread' => ta_unread_for_admin($sid)));
}

if ($ACTION === 'thread_del') {
    $w = ta_need_admin();
    $b = ta_body();
    $sid = ta_sane_sid(isset($b['sid']) ? $b['sid'] : '');
    $lk = ta_lock();
    $keep = array();
    foreach (ta_inbox_all() as $r) { if (is_array($r) && isset($r['sid']) && $r['sid'] !== $sid) $keep[] = $r; }
    ta_put('inbox.json', $keep);
    ta_unlock($lk);
    ta_out(200, array('ok' => true, 'total' => count($keep)));
}

/* ---------- فایل‌ها ---------- */
if ($ACTION === 'upload') {
    $b = ta_body();
    $mime = isset($b['type']) ? (string) $b['type'] : '';
    if (!$AUTH && !in_array($mime, array('image/jpeg', 'image/png', 'image/webp'), true)) {
        ta_out(415, array('ok' => false, 'error' => 'مهمان فقط می‌تواند jpeg/png/webp بفرستد'));
    }
    if (!$AUTH && !ta_throttle('upl:' . ta_ip(), 12, 600)) {
        ta_out(429, array('ok' => false, 'error' => 'محدودیت بارگذاری — کمی بعداً تلاش کنید'));
    }
    $r = ta_store_file(isset($b['name']) ? $b['name'] : '', $mime, isset($b['data']) ? $b['data'] : '');
    if (empty($r['ok'])) ta_out(400, $r);
    ta_out(200, $r);
}

if ($ACTION === 'file') {
    $f = basename(isset($_GET['f']) ? (string) $_GET['f'] : '');
    if (!preg_match('/^[A-Za-z0-9._-]{8,64}$/', $f)) ta_out(400, array('ok' => false, 'error' => 'نام فایل نامعتبر است'));
    $path = ta_cfg()['dataDir'] . '/uploads/' . $f;
    if (!is_file($path)) ta_out(404, array('ok' => false, 'error' => 'فایل پیدا نشد'));
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mime = 'application/octet-stream';
    foreach (ta_types() as $m => $e) { if ($e === $ext) { $mime = $m; break; } }
    $dl = !empty($_GET['dl']);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: public, max-age=31536000, immutable');
    header('X-Content-Type-Options: nosniff');
    header('Content-Disposition: ' . ($dl ? 'attachment' : 'inline') . '; filename="' . $f . '"');
    header('Content-Security-Policy: default-src \'none\'');
    readfile($path);
    exit;
}

/* ---------- ادمین‌ها، ورودی/خروجی ---------- */
if ($ACTION === 'admins') {
    $w = ta_need_admin();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $out = array();
        foreach (ta_users() as $a) { $out[] = array('u' => $a['u'], 'name' => isset($a['name']) ? $a['name'] : $a['u'], 'role' => isset($a['role']) ? $a['role'] : 'admin'); }
        ta_out(200, array('ok' => true, 'admins' => $out));
    }
    $b = ta_body();
    $op = isset($b['op']) ? (string) $b['op'] : '';
    $lk = ta_lock();
    $users = ta_users();
    $byU = array();
    foreach ($users as $k => $a) { $byU[$a['u']] = $k; }
    if ($op === 'add') {
        $u = ta_str(isset($b['u']) ? $b['u'] : '', 32);
        $p = isset($b['p']) ? (string) $b['p'] : '';
        if (strlen($u) < 3 || strlen($p) < 8) { ta_unlock($lk); ta_out(400, array('ok' => false, 'error' => 'نام کاربری ۳+ و رمز ۸+ کاراکتر')); }
        if (isset($byU[$u])) { ta_unlock($lk); ta_out(409, array('ok' => false, 'error' => 'این نام کاربری هست')); }
        $users[] = array('u' => $u, 'p' => ta_hash_pw($p), 'name' => ta_str(isset($b['name']) ? $b['name'] : '', 40, false) ?: $u, 'role' => 'admin');
    } elseif ($op === 'remove') {
        $u = ta_str(isset($b['u']) ? $b['u'] : '', 32);
        if (count($users) <= 1) { ta_unlock($lk); ta_out(400, array('ok' => false, 'error' => 'آخرین ادمین حذف نمی‌شود')); }
        if ($u === $w['u']) { ta_unlock($lk); ta_out(400, array('ok' => false, 'error' => 'از خودتان نمی‌توانید خارج شوید')); }
        if (!isset($byU[$u])) { ta_unlock($lk); ta_out(404, array('ok' => false, 'error' => 'پیدا نشد')); }
        unset($users[$byU[$u]]);
        $users = array_values($users);
        $tk = ta_read('tokens.json', array()); unset($tk[$u]); ta_put('tokens.json', $tk);
    } elseif ($op === 'pw') {
        $u = ta_str(isset($b['u']) ? $b['u'] : $w['u'], 32);
        $p = isset($b['p']) ? (string) $b['p'] : '';
        if (strlen($p) < 8) { ta_unlock($lk); ta_out(400, array('ok' => false, 'error' => 'رمز جدید حداقل ۸ کاراکتر')); }
        if (!isset($byU[$u])) { ta_unlock($lk); ta_out(404, array('ok' => false, 'error' => 'پیدا نشد')); }
        $users[$byU[$u]]['p'] = ta_hash_pw($p);
    } elseif ($op === 'name') {
        $u = ta_str(isset($b['u']) ? $b['u'] : $w['u'], 32);
        if (!isset($byU[$u])) { ta_unlock($lk); ta_out(404, array('ok' => false, 'error' => 'پیدا نشد')); }
        $users[$byU[$u]]['name'] = ta_str(isset($b['name']) ? $b['name'] : '', 40) ?: $u;
    } else { ta_unlock($lk); ta_out(400, array('ok' => false, 'error' => 'op نامعتبر است')); }
    if (!ta_put('config.json', array_merge(ta_conf(), array('users' => array_values($users))))) {
        ta_unlock($lk); ta_out(500, array('ok' => false, 'error' => 'نوشتن نشد'));
    }
    ta_unlock($lk);
    $out = array();
    foreach (array_values($users) as $a) { $out[] = array('u' => $a['u'], 'name' => isset($a['name']) ? $a['name'] : $a['u'], 'role' => isset($a['role']) ? $a['role'] : 'admin'); }
    ta_out(200, array('ok' => true, 'admins' => $out));
}

if ($ACTION === 'export') {
    $w = ta_need_admin();
    ta_out(200, array('ok' => true, 'app' => 'titanali', 'ver' => TA_VER, 'at' => time(),
                      'rev' => ta_rev(),
                      'data' => ta_read('content.json', null),
                      'social' => ta_social_shape(),
                      'inbox' => ta_inbox_all(),
                      'log' => ta_read('log.json', array())));
}

if ($ACTION === 'import') {
    $w = ta_need_admin();
    $b = ta_body();
    $lk = ta_lock();
    $stamp = date('Ymd-His');
    $bak = array('content' => ta_read('content.json', null), 'social' => ta_social(), 'inbox' => ta_inbox_all());
    ta_put('backups/backup-' . $stamp . '.json', $bak);
    $bl = ta_read('backups/list.json', array());
    $bl[] = $stamp;
    ta_put('backups/list.json', array_slice($bl, -10));
    foreach (glob(ta_cfg()['dataDir'] . '/backups/backup-*.json') as $old) {
        $all = glob(ta_cfg()['dataDir'] . '/backups/backup-*.json');
        if (count($all) > 10) { @unlink($old); }
    }
    if (isset($b['data']) && is_array($b['data'])) ta_put('content.json', $b['data']);
    if (isset($b['social']) && is_array($b['social'])) ta_put('social.json', $b['social']);
    if (isset($b['inbox']) && is_array($b['inbox'])) ta_put('inbox.json', $b['inbox']);
    ta_unlock($lk);
    ta_out(200, array('ok' => true, 'backup' => $stamp, 'rev' => ta_rev()));
}

if ($ACTION === 'stats') {
    $s = ta_social();
    $like = 0; $dl = 0;
    foreach (ta_arr($s['likes']) as $v) { $like += (int) $v; }
    foreach (ta_arr($s['dl']) as $v) { $dl += (int) $v; }
    ta_out(200, array('ok' => true, 'stats' => array('likes' => $like, 'dl' => $dl,
        'views' => isset($s['views']) ? (int) $s['views'] : 0,
        'comments' => isset($s['comments']) ? count($s['comments']) : 0,
        'messages' => count(ta_inbox_all()), 'rev' => ta_rev())));
}

/* تلاش برای خواندن اینستاگرام (best-effort؛ معمولاً اینستاگرام از سرور مسدود می‌کند) */
if ($ACTION === 'ig') {
    $w = ta_need_admin();
    $b = ta_body();
    $user = preg_replace('/[^A-Za-z0-9._]/', '', isset($b['user']) ? (string) $b['user'] : '');
    if ($user === '') ta_out(400, array('ok' => false, 'error' => 'نام کاربری لازم است'));
    $cache = ta_read('ig.json', array());
    if (isset($cache[$user]) && $cache[$user]['at'] > time() - 1800) ta_out(200, $cache[$user]['res']);
    $res = array('ok' => false, 'error' => 'اینستاگرام از سمت سرور پاسخ نداد (معمولی است). از «چسباندن JSON» استفاده کنید.');
    if (function_exists('curl_init')) {
        $ch = curl_init('https://www.instagram.com/' . rawurlencode($user) . '/?__a=1');
        curl_setopt_array($ch, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5, CURLOPT_FOLLOWLOCATION => true,
                                     CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; titanali-bot/1.0)', CURLOPT_SSL_VERIFYPEER => true));
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code === 200 && $raw) {
            $j = json_decode($raw, true);
            if (is_array($j)) $res = array('ok' => true, 'data' => $j, 'note' => 'از سمت سرور گرفته شد');
        }
    } elseif (ini_get('allow_url_fopen')) {
        $ctx = stream_context_create(array('http' => array('timeout' => 5, 'header' => "User-Agent: Mozilla/5.0 (compatible; titanali-bot/1.0)\r\n")));
        $raw = @file_get_contents('https://www.instagram.com/' . rawurlencode($user) . '/?__a=1', false, $ctx);
        if ($raw) { $j = json_decode($raw, true); if (is_array($j)) $res = array('ok' => true, 'data' => $j, 'note' => 'از سمت سرور گرفته شد'); }
    }
    $cache[$user] = array('at' => time(), 'res' => $res);
    ta_put('ig.json', array_slice($cache, -5, null, true));
    ta_out(200, $res);
}

ta_out(404, array('ok' => false, 'error' => 'endpoint ناشناخته', 'action' => $ACTION, 'ver' => TA_VER));
