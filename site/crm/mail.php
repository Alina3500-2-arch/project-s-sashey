<?php
declare(strict_types=1);

const CRM_MAILBOX = '{pop3.majordomo.ru:993/imap/ssl}INBOX';

function ensure_mail_schema(PDO $db): void {
  $db->exec("CREATE TABLE IF NOT EXISTS crm_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value LONGTEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $db->exec("CREATE TABLE IF NOT EXISTS emails (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lead_id INT UNSIGNED NULL,
    account_email VARCHAR(190) NOT NULL,
    message_uid VARCHAR(190) NOT NULL,
    direction VARCHAR(20) NOT NULL DEFAULT 'incoming',
    from_email VARCHAR(190) NULL,
    from_name VARCHAR(300) NULL,
    to_email VARCHAR(190) NULL,
    subject VARCHAR(500) NULL,
    body MEDIUMTEXT NULL,
    sent_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY emails_account_uid (account_email,message_uid),
    INDEX emails_lead_idx (lead_id,sent_at),
    CONSTRAINT emails_lead_fk FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function crm_setting(PDO $db, string $key): ?string {
  $q=$db->prepare('SELECT setting_value FROM crm_settings WHERE setting_key=?');$q->execute([$key]);
  $value=$q->fetchColumn();return $value===false?null:(string)$value;
}
function crm_setting_save(PDO $db, string $key, string $value): void {
  $db->prepare('INSERT INTO crm_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)')->execute([$key,$value]);
}
function crm_mail_key(): string {
  $config=crm_config();
  return sodium_crypto_generichash($config['install_token'].'|'.$config['db_password'],'',SODIUM_CRYPTO_SECRETBOX_KEYBYTES);
}
function crm_mail_encrypt(string $plain): string {
  $nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
  return base64_encode($nonce.sodium_crypto_secretbox($plain,$nonce,crm_mail_key()));
}
function crm_mail_decrypt(?string $sealed): ?string {
  if(!$sealed)return null;$raw=base64_decode($sealed,true);
  if($raw===false||strlen($raw)<=SODIUM_CRYPTO_SECRETBOX_NONCEBYTES)return null;
  $nonce=substr($raw,0,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);$cipher=substr($raw,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
  $plain=sodium_crypto_secretbox_open($cipher,$nonce,crm_mail_key());return $plain===false?null:$plain;
}
function crm_mail_credentials(PDO $db): ?array {
  ensure_mail_schema($db);$email=crm_setting($db,'mail_email');$password=crm_mail_decrypt(crm_setting($db,'mail_password'));
  return $email&&$password?['email'=>$email,'password'=>$password]:null;
}
function crm_mail_open(string $email,string $password) {
  if(!function_exists('imap_open'))throw new RuntimeException('На сервере недоступен модуль IMAP.');
  $mailbox=@imap_open(CRM_MAILBOX,$email,$password,0,1);
  if(!$mailbox){imap_errors();throw new RuntimeException('Majordomo не принял логин или пароль почты.');}
  return $mailbox;
}
function crm_mime_decode(?string $value): string {
  $result='';foreach(imap_mime_header_decode((string)$value) as $part){$charset=strtoupper($part->charset??'DEFAULT');$text=(string)$part->text;if(!in_array($charset,['DEFAULT','UTF-8','US-ASCII'],true))$text=@mb_convert_encoding($text,'UTF-8',$charset);$result.=$text;}return trim($result);
}
function crm_mail_part($mailbox,int $number): string {
  $structure=imap_fetchstructure($mailbox,$number);$body='';
  if(!empty($structure->parts)){
    foreach($structure->parts as $index=>$part){if((int)$part->type===0&&strtolower($part->subtype??'')==='plain'){$body=imap_fetchbody($mailbox,$number,(string)($index+1));$encoding=(int)($part->encoding??0);if($encoding===3)$body=base64_decode($body)?:'';elseif($encoding===4)$body=quoted_printable_decode($body);break;}}
  } else {$body=imap_body($mailbox,$number);$encoding=(int)($structure->encoding??0);if($encoding===3)$body=base64_decode($body)?:'';elseif($encoding===4)$body=quoted_printable_decode($body);}
  return mb_substr(trim(strip_tags($body)),0,20000);
}
function crm_mail_sync(PDO $db): int {
  $credentials=crm_mail_credentials($db);if(!$credentials)throw new RuntimeException('Сначала подключите почту.');
  $mailbox=crm_mail_open($credentials['email'],$credentials['password']);$numbers=imap_search($mailbox,'ALL')?:[];$numbers=array_slice($numbers,-40);$added=0;
  foreach(array_reverse($numbers) as $number){
    $uid=(string)imap_uid($mailbox,$number);$exists=$db->prepare('SELECT id FROM emails WHERE account_email=? AND message_uid=?');$exists->execute([$credentials['email'],$uid]);if($exists->fetchColumn())continue;
    $overview=imap_fetch_overview($mailbox,(string)$number,0)[0]??null;if(!$overview)continue;
    $header=imap_headerinfo($mailbox,$number);$fromEmail=strtolower(($header->from[0]->mailbox??'').'@'.($header->from[0]->host??''));$fromName=crm_mime_decode($overview->from??'');$subject=crm_mime_decode($overview->subject??'(без темы)');$sentAt=date('Y-m-d H:i:s',(int)($overview->udate??time()));
    $leadId=null;if($fromEmail){$lead=$db->prepare('SELECT id FROM leads WHERE deleted_at IS NULL AND LOWER(email)=? ORDER BY created_at DESC LIMIT 1');$lead->execute([$fromEmail]);$leadId=$lead->fetchColumn()?:null;}
    $db->prepare('INSERT IGNORE INTO emails(lead_id,account_email,message_uid,from_email,from_name,to_email,subject,body,sent_at) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$leadId,$credentials['email'],$uid,$fromEmail,$fromName,$credentials['email'],$subject,crm_mail_part($mailbox,$number),$sentAt]);$added+=(int)($db->lastInsertId()>0);
    if($leadId)activity($db,(int)$leadId,null,'email','Получено письмо: '.$subject);
  }
  imap_close($mailbox);crm_setting_save($db,'mail_last_sync',date('c'));return $added;
}

