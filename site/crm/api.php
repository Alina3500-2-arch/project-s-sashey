<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/mail.php';
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
try {
  $db=db(); $action=$_GET['action']??''; $input=json_body();
  if ($action==='public-lead') {
    if (clean($input['website_url']??'',300)) out(['ok'=>true]);
    $name=clean($input['name']??'',300); $phone=clean($input['phone']??'',100);
    if (!$name && !$phone) out(['error'=>'Укажите имя или телефон.'],422);
    $q=$db->prepare('INSERT INTO leads(name,phone,niche,initial_message,landing_url,utm_source,utm_medium,utm_campaign,utm_content,utm_term,source) VALUES (?,?,?,?,?,?,?,?,?,?,"Сайт")');
    $q->execute([$name,$phone,clean($input['niche']??'',300),clean($input['initial_message']??''),clean($input['landing_url']??'',1000),clean($input['utm_source']??'',300),clean($input['utm_medium']??'',300),clean($input['utm_campaign']??'',300),clean($input['utm_content']??'',300),clean($input['utm_term']??'',300)]);
    activity($db,(int)$db->lastInsertId(),null,'created','Заявка с сайта создана'); out(['ok'=>true]);
  }
  if ($action==='login') {
    $phone=normalize_phone($input['phone']??''); $password=(string)($input['password']??'');
    $q=$db->prepare('SELECT id,phone,full_name,password_hash FROM users WHERE phone=? AND is_active=1 LIMIT 1');$q->execute([$phone]);$staff=$q->fetch();
    if (!$staff || !password_verify($password,$staff['password_hash'])) out(['error'=>'Проверьте номер телефона и пароль.'],401);
    start_session(); session_regenerate_id(true); $_SESSION['crm_user']=['id'=>(int)$staff['id'],'phone'=>$staff['phone'],'full_name'=>$staff['full_name']]; $_SESSION['csrf']=bin2hex(random_bytes(32)); out(['user'=>$_SESSION['crm_user'],'csrf'=>$_SESSION['csrf']]);
  }
  if ($action==='logout') { csrf(); $_SESSION=[]; session_destroy(); out(['ok'=>true]); }
  $user=must_user();
  if ($action==='me') { start_session(); out(['user'=>$user,'csrf'=>$_SESSION['csrf']]); }
  if ($action==='bootstrap') { $staff=$db->query('SELECT id,phone,full_name FROM users WHERE is_active=1 ORDER BY full_name')->fetchAll(); $rows=$db->query('SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC')->fetchAll(); out(['leads'=>$rows,'profiles'=>$staff]); }
  if ($action==='mail-status') {
    ensure_mail_schema($db);$configured=(bool)crm_mail_credentials($db);
    $messages=$db->query('SELECT e.id,e.lead_id,e.from_email,e.from_name,e.subject,e.body,e.sent_at,l.name AS lead_name,l.company AS lead_company FROM emails e LEFT JOIN leads l ON l.id=e.lead_id ORDER BY e.sent_at DESC,e.id DESC LIMIT 50')->fetchAll();
    out(['email'=>'hello@ashpartners.ru','configured'=>$configured,'last_sync'=>crm_setting($db,'mail_last_sync'),'messages'=>$messages]);
  }
  csrf();
  if ($action==='mail-configure') {
    ensure_mail_schema($db);$email=strtolower(clean($input['email']??'',190)??'');$password=(string)($input['password']??'');
    if($email!=='hello@ashpartners.ru')out(['error'=>'Можно подключить только hello@ashpartners.ru.'],422);if(strlen($password)<4)out(['error'=>'Введите пароль почтового ящика.'],422);
    $mailbox=crm_mail_open($email,$password);imap_close($mailbox);crm_setting_save($db,'mail_email',$email);crm_setting_save($db,'mail_password',crm_mail_encrypt($password));out(['ok'=>true]);
  }
  if ($action==='mail-sync') { $added=crm_mail_sync($db);out(['ok'=>true,'added'=>$added]); }
  $fields=['name'=>300,'company'=>300,'niche'=>300,'phone'=>100,'email'=>190,'messenger'=>500,'website'=>500,'city'=>200,'initial_message'=>5000,'stage'=>50,'deal_type'=>100,'source'=>100,'utm_source'=>300,'utm_medium'=>300,'utm_campaign'=>300,'utm_content'=>300,'utm_term'=>300,'landing_url'=>1000,'product'=>300,'next_action'=>1000,'documents_url'=>1000,'extra_links'=>5000];
  if ($action==='lead-save') {
    $id=(int)($input['id']??0); $data=[]; foreach($fields as $field=>$max) $data[$field]=clean($input[$field]??null,$max);
    if (!in_array($data['stage'] ?: 'Новая заявка',CRM_STAGES,true)) out(['error'=>'Неизвестная стадия.'],422); $data['stage']=$data['stage'] ?: 'Новая заявка';
    $data['responsible_id']=($input['responsible_id']??'')==='' ? null : (int)$input['responsible_id']; $data['amount']=($input['amount']??'')==='' ? null : (float)$input['amount']; $data['next_action_date']=clean($input['next_action_date']??'',20);
    if ($id) {
      $oldQ=$db->prepare('SELECT * FROM leads WHERE id=? AND deleted_at IS NULL');$oldQ->execute([$id]);$old=$oldQ->fetch();if(!$old)out(['error'=>'Заявка не найдена.'],404);
      $set=[];$values=[];foreach($data as $key=>$value){$set[]="$key=?";$values[]=$value;}$values[]=$id;$db->prepare('UPDATE leads SET '.implode(',',$set).' WHERE id=?')->execute($values);
      if($old['stage']!==$data['stage'])activity($db,$id,$user['id'],'stage','Стадия изменена: '.$old['stage'].' → '.$data['stage']);
      if((int)($old['responsible_id']??0)!==(int)($data['responsible_id']??0))activity($db,$id,$user['id'],'responsible','Изменён ответственный');
      if((string)($old['amount']??'')!==(string)($data['amount']??''))activity($db,$id,$user['id'],'amount','Сумма изменена');
      if((string)($old['next_action_date']??'')!==(string)($data['next_action_date']??''))activity($db,$id,$user['id'],'next_action','Дата следующего действия изменена');
    } else { $cols=array_keys($data);$db->prepare('INSERT INTO leads ('.implode(',',$cols).') VALUES ('.implode(',',array_fill(0,count($cols),'?')).')')->execute(array_values($data));$id=(int)$db->lastInsertId();activity($db,$id,$user['id'],'created','Заявка создана'); }
    $comment=clean($input['new_comment']??'');if($comment){$db->prepare('INSERT INTO comments(lead_id,user_id,text) VALUES(?,?,?)')->execute([$id,$user['id'],$comment]);activity($db,$id,$user['id'],'comment','Добавлен комментарий');}
    $q=$db->prepare('SELECT * FROM leads WHERE id=?');$q->execute([$id]);out(['lead'=>$q->fetch()]);
  }
  if ($action==='lead-archive') { $id=(int)($input['id']??0);$db->prepare('UPDATE leads SET deleted_at=NOW() WHERE id=?')->execute([$id]);activity($db,$id,$user['id'],'archived','Заявка перенесена в архив');out(['ok'=>true]); }
  if ($action==='lead-history') { $id=(int)($_GET['id']??0);$q=$db->prepare('SELECT a.description,a.created_at,COALESCE(u.full_name,"Сотрудник") AS author FROM activity a LEFT JOIN users u ON u.id=a.user_id WHERE a.lead_id=? ORDER BY a.created_at DESC');$q->execute([$id]);$c=$db->prepare('SELECT c.text,c.created_at,u.full_name AS author FROM comments c JOIN users u ON u.id=c.user_id WHERE c.lead_id=? ORDER BY c.created_at DESC');$c->execute([$id]);out(['activity'=>$q->fetchAll(),'comments'=>$c->fetchAll()]); }
  out(['error'=>'Неизвестный запрос.'],404);
} catch (Throwable $e) { error_log('CRM error: '.$e->getMessage()); out(['error'=>'Временная ошибка CRM. Попробуйте ещё раз.'],500); }
