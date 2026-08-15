<?php
require __DIR__ . '/bootstrap.php';
$message = '';
try {
  $db=db();
  // При первом открытии сами создаём таблицы: phpMyAdmin не нужен.
  $tableExists=$db->query("SHOW TABLES LIKE 'users'")->fetchColumn();
  if (!$tableExists) {
    $schema=file_get_contents(__DIR__ . '/schema.sql');
    foreach (array_filter(array_map('trim', explode(';', $schema))) as $statement) $db->exec($statement);
  }
  // Миграция ранней версии, где вход планировался по email.
  $phoneColumn=$db->query("SHOW COLUMNS FROM users LIKE 'phone'")->fetchColumn();
  if (!$phoneColumn) $db->exec('ALTER TABLE users CHANGE email phone VARCHAR(30) NOT NULL');
  $dealTypeColumn=$db->query("SHOW COLUMNS FROM leads LIKE 'deal_type'")->fetchColumn();
  if (!$dealTypeColumn) $db->exec('ALTER TABLE leads ADD deal_type VARCHAR(100) NULL AFTER stage');
  $count=(int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn();
  if ($_SERVER['REQUEST_METHOD']==='POST') {
    $c=crm_config();
    if ($count>0) throw new RuntimeException('Настройка уже завершена. Входите через CRM.');
    if (!hash_equals($c['install_token'], (string)($_POST['token']??''))) throw new RuntimeException('Неверный код настройки.');
    foreach (['alina_phone','alina_password','alex_phone','alex_password'] as $key) if (empty($_POST[$key])) throw new RuntimeException('Заполните все поля.');
    if (strlen($_POST['alina_password'])<10 || strlen($_POST['alex_password'])<10) throw new RuntimeException('Пароли должны быть не короче 10 символов.');
    $alinaPhone=normalize_phone($_POST['alina_phone']); $alexPhone=normalize_phone($_POST['alex_phone']);
    if (!$alinaPhone || !$alexPhone) throw new RuntimeException('Проверьте номера телефонов. Нужен российский номер из 10–11 цифр.');
    $db->beginTransaction(); $q=$db->prepare('INSERT INTO users(phone,password_hash,full_name) VALUES (?,?,?)');
    $q->execute([$alinaPhone,password_hash($_POST['alina_password'],PASSWORD_DEFAULT),'Алина']);
    $q->execute([$alexPhone,password_hash($_POST['alex_password'],PASSWORD_DEFAULT),'Александр']); $db->commit();
    $message='Готово. Теперь откройте index.html и войдите в CRM.';
  }
} catch (Throwable $e) { $message=$e->getMessage(); }
?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Настройка CRM · Аполлонов и Шигапова</title><link rel="icon" type="image/svg+xml" href="../assets/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" media="print" onload="this.media='all';this.onload=null" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Manrope:wght@400;500;600&display=swap"><link rel="stylesheet" href="crm.css?v=20260815-2"></head><body class="setup-body"><main class="setup-page"><section class="setup-intro"><img src="../assets/favicon.svg" alt=""><p class="eyebrow">Аполлонов и Шигапова</p><h1>Настроим вход<br>в вашу CRM</h1><p>Два личных входа. Заявки и история работы будут общими.</p></section><form method="post" class="setup-card"><p class="setup-step">Первичная настройка · 1 раз</p><?php if ($message): ?><p class="setup-message"><?=htmlspecialchars($message)?></p><?php endif; ?><label class="field setup-token"><span>Код настройки</span><input name="token" required autocomplete="off"></label><div class="setup-person"><div class="person-badge">А</div><div><h2>Алина</h2><p>Личный номер и пароль</p></div></div><label class="field"><span>Номер телефона</span><input name="alina_phone" type="tel" placeholder="+7 900 000-00-00" required autocomplete="tel"></label><label class="field"><span>Пароль</span><input name="alina_password" type="password" placeholder="Не меньше 10 символов" required autocomplete="new-password"></label><div class="setup-person"><div class="person-badge person-badge--dark">А</div><div><h2>Александр</h2><p>Отдельный личный вход</p></div></div><label class="field"><span>Номер телефона</span><input name="alex_phone" type="tel" placeholder="+7 900 000-00-00" required autocomplete="tel"></label><label class="field"><span>Пароль</span><input name="alex_password" type="password" placeholder="Не меньше 10 символов" required autocomplete="new-password"></label><button class="primary setup-submit">Создать два входа <span>→</span></button><p class="setup-note">После создания этот экран автоматически закроется для новых регистраций.</p></form></main></body></html>
