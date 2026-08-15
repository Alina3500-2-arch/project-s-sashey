<?php
declare(strict_types=1);

const CRM_STAGES = ['Новая заявка','Связались','Бесплатный аудит','Аудит отправлен','Платный аудит','Счёт / договор','Оплачено','В работе','Завершено','Отказ'];

function crm_config(): array {
  $file = __DIR__ . '/config.local.php';
  if (!is_file($file)) { throw new RuntimeException('CRM ещё не настроена: отсутствует config.local.php.'); }
  $config = require $file;
  foreach (['db_host','db_name','db_user','db_password','install_token'] as $key) if (empty($config[$key])) throw new RuntimeException('В config.local.php не заполнено поле ' . $key . '.');
  return $config;
}
function db(): PDO {
  static $pdo;
  if ($pdo) return $pdo;
  $c = crm_config();
  $pdo = new PDO("mysql:host={$c['db_host']};dbname={$c['db_name']};charset=utf8mb4", $c['db_user'], $c['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
  return $pdo;
}
function start_session(): void { if (session_status() !== PHP_SESSION_ACTIVE) session_start(['cookie_httponly'=>true,'cookie_samesite'=>'Strict','cookie_secure'=>(!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')]); }
function current_user(): ?array { start_session(); return $_SESSION['crm_user'] ?? null; }
function must_user(): array { $u=current_user(); if (!$u) { http_response_code(401); echo json_encode(['error'=>'Нужен вход в CRM.']); exit; } return $u; }
function csrf(): void { start_session(); if (!hash_equals($_SESSION['csrf'] ?? '', $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) { http_response_code(403); echo json_encode(['error'=>'Сессия устарела. Обновите страницу.']); exit; } }
function json_body(): array { $body=json_decode(file_get_contents('php://input'), true); return is_array($body) ? $body : $_POST; }
function out(array $data, int $code=200): void { http_response_code($code); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function clean(?string $value, int $max=5000): ?string { $value=trim((string)$value); return $value === '' ? null : mb_substr($value, 0, $max); }
function normalize_phone(?string $value): ?string {
  $digits=preg_replace('/\D+/', '', (string)$value);
  if (strlen($digits)===10) $digits='7'.$digits;
  if (strlen($digits)===11 && $digits[0]==='8') $digits='7'.substr($digits,1);
  return strlen($digits)===11 ? '+'.$digits : null;
}
function activity(PDO $db, int $leadId, ?int $userId, string $type, string $description): void { $db->prepare('INSERT INTO activity (lead_id,user_id,type,description) VALUES (?,?,?,?)')->execute([$leadId,$userId,$type,$description]); }
