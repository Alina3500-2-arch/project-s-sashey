(() => {
  const root=document.querySelector('#app');
  const stages=['Новая заявка','Связались','Бесплатный аудит','Аудит отправлен','Платный аудит','Счёт / договор','Оплачено','В работе','Завершено','Отказ'];
  const sources=['Сайт','Яндекс Директ','Авито','Яндекс Бизнес','2ГИС','Telegram','MAX','WhatsApp','Instagram','Рекомендация','Повторный клиент','Другое'];
  const dealTypes=['Первичное обращение','Повторный клиент','Бесплатный аудит','Стратегический аудит','Запуск системы заявок','Пересборка продаж','Ведение','Другое'];
  let csrf='',user=null,leads=[],profiles=[],selected=null,currentModule='deals',currentView='kanban',ownerFilter='all';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>v?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short'}).format(new Date(v)):'—';
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(v||0))+' ₽';
  const isOverdue=v=>v&&new Date(v+'T23:59:59')<new Date();
  async function api(action,data,method='POST'){
    const options={method,headers:{}};
    if(method==='POST'){options.headers['Content-Type']='application/json';options.headers['X-CSRF-Token']=csrf;options.body=JSON.stringify(data||{});}
    const query=method==='GET'&&data?'&'+new URLSearchParams(data):'';
    const response=await fetch(`api.php?action=${action}${query}`,options);
    const result=await response.json().catch(()=>({error:'Сервер вернул неверный ответ.'}));
    if(!response.ok)throw Error(result.error||'Ошибка сервера.');return result;
  }
  const notice=message=>{const node=document.createElement('div');node.className='toast';node.textContent=message;document.body.append(node);setTimeout(()=>node.remove(),3500)};
  function login(){
    root.innerHTML=`<section class="login"><form class="login-card" id="login"><img class="login-mark" src="../assets/favicon.svg" alt=""><p class="eyebrow">Апполонов и Шигапова</p><h1>Вход в CRM</h1><p class="login-sub">Сделки, клиенты и следующие действия — в одном месте.</p><label class="field"><span>Номер телефона</span><input name="phone" type="tel" placeholder="+7 900 000-00-00" required autocomplete="tel"></label><label class="field"><span>Пароль</span><input name="password" type="password" required autocomplete="current-password"></label><button class="primary" style="width:100%">Войти в CRM →</button><p class="error" hidden></p></form></section>`;
    document.querySelector('#login').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,error=form.querySelector('.error');try{const result=await api('login',Object.fromEntries(new FormData(form)));user=result.user;csrf=result.csrf;load()}catch(err){error.textContent=err.message;error.hidden=false}};
  }
  async function load(){try{const data=await api('bootstrap',null,'GET');leads=data.leads;profiles=data.profiles;renderCRM()}catch(err){root.innerHTML=`<section class="login"><div class="login-card"><h1>CRM недоступна</h1><p class="error">${esc(err.message)}</p></div></section>`}}
  const railIcon=(symbol,label,target)=>`<button class="b24-rail-btn" data-rail="${target}" title="${label}" aria-label="${label}"><span>${symbol}</span><small>${label}</small></button>`;
  function renderCRM(){
    root.innerHTML=`<div class="b24-shell"><aside class="b24-rail"><button class="b24-burger" aria-label="Свернуть меню">☰</button><img src="../assets/ash-mark.svg" alt="" class="b24-rail-logo">${railIcon('◆','Сделки','deals')}${railIcon('◌','Клиенты','clients')}${railIcon('✓','Дела','activities')}${railIcon('▦','Календарь','calendar')}${railIcon('↗','Аналитика','analytics')}${railIcon('▤','Документы','documents')}<span class="b24-rail-space"></span></aside><div class="b24-main"><header class="b24-top"><div class="b24-logo"><b>Апполонов</b><i>и</i><b>Шигапова</b></div><label class="b24-global-search"><input placeholder="найти клиента или сделку"><span>⌕</span></label><div class="b24-top-spacer"></div><span class="b24-work">● РАБОТАЮ</span><span class="b24-user">${esc(user.full_name)}⌄</span><img class="b24-top-mark" src="../assets/ash-mark.svg" alt="Логотип Апполонов и Шигапова"></header><nav class="b24-modules"><button data-module="leads">Лиды</button><button data-module="deals">Сделки</button><button data-module="clients">Клиенты</button><button data-module="sales">Продажи</button><button data-module="analytics">Аналитика</button><button data-module="documents">Документы</button></nav><main class="b24-content"><section class="b24-titlebar"><h1 id="section-title">Сделки <span>☆</span></h1><button class="b24-create" id="new">СОЗДАТЬ <b>⌄</b></button><button class="b24-pipeline">☰ &nbsp; ОБЩАЯ <span>${leads.length}</span>⌄</button><label class="b24-filter"><span>▽</span><input id="search" placeholder="Найти сделку или клиента"><b>⌕</b></label><button class="b24-gear">⚙</button></section><section class="b24-viewbar"><button data-view="kanban">Канбан</button><button data-view="list">Список</button><button data-view="activities">Дела</button><button data-view="calendar">Календарь</button><div class="b24-view-spacer"></div><span>Мои:</span><button data-owner="all">Все</button><button data-owner="mine">Мои сделки</button><button data-owner="planned">Запланированные</button></section><section class="b24-board" id="board"></section></main></div></div>`;
    document.querySelector('.b24-rail-space').insertAdjacentHTML('beforebegin',railIcon('✉','Почта','mail'));
    document.querySelector('.b24-modules').insertAdjacentHTML('beforeend','<button data-module="mail">Почта</button>');
    document.querySelector('#new').onclick=()=>openDeal({stage:stages[0],deal_type:'Первичное обращение'},true);
    document.querySelector('#search').oninput=renderWorkspace;
    document.querySelector('.b24-global-search input').oninput=event=>{document.querySelector('#search').value=event.target.value;renderWorkspace()};
    document.querySelector('.b24-user').onclick=async()=>{if(confirm('Выйти из CRM?')){await api('logout',{});csrf='';user=null;login()}};
    document.querySelectorAll('[data-module]').forEach(button=>button.onclick=()=>switchModule(button.dataset.module));
    document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{currentView=button.dataset.view;renderWorkspace()});
    document.querySelectorAll('[data-owner]').forEach(button=>button.onclick=()=>{ownerFilter=button.dataset.owner;renderWorkspace()});
    document.querySelector('.b24-pipeline').onclick=()=>notice('Воронка: общая');
    document.querySelector('.b24-gear').onclick=()=>notice('Настройки воронки добавим после согласования этапов');
    document.querySelectorAll('[data-rail]').forEach(button=>button.onclick=()=>switchRail(button.dataset.rail));
    document.querySelector('.b24-burger').onclick=()=>document.querySelector('.b24-shell').classList.toggle('rail-collapsed');
    renderWorkspace();
  }
  function dealCard(lead){
    const owner=profiles.find(p=>p.id==lead.responsible_id)?.full_name||'Не назначен';
    const overdue=isOverdue(lead.next_action_date);
    return `<article class="b24-card" draggable="true" tabindex="0" data-id="${lead.id}"><div class="b24-card-top"><h3>${esc(lead.name||lead.company||'Сделка #'+lead.id)}</h3><span class="b24-counter ${overdue?'hot':''}">${overdue?'!':'0'}</span></div><p class="b24-card-type">${esc(lead.deal_type||'первичное обращение')}</p><strong>${money(lead.amount)}</strong><a>${esc(lead.company||lead.name||lead.phone||'Клиент не указан')}</a><p>${date(lead.created_at)}</p><small>Ответственный</small><div class="b24-responsible"><span>${esc(owner.slice(0,1))}</span>${esc(owner)}</div>${lead.next_action?`<div class="b24-task ${overdue?'overdue':''}">${overdue?'ПРОСРОЧЕНО':'ДЕЛО'} · ${esc(lead.next_action)}</div>`:''}<footer><button data-open="activity">+ Дело</button><time>${lead.next_action_date?date(lead.next_action_date):'нет срока'}</time></footer></article>`;
  }
  const moduleTitles={leads:'Лиды',deals:'Сделки',clients:'Клиенты',sales:'Продажи',analytics:'Аналитика',documents:'Документы',mail:'Почта'};
  function switchModule(module){
    currentModule=module;
    if(module==='leads'){currentView='kanban'}
    renderWorkspace();
  }
  function switchRail(target){
    if(target==='activities'||target==='calendar'){currentModule='deals';currentView=target}
    else currentModule=target;
    renderWorkspace();
  }
  function filteredLeads(){
    const query=(document.querySelector('#search')?.value||'').toLowerCase();
    return leads.filter(lead=>{
      const matchesQuery=[lead.name,lead.company,lead.phone,lead.email,lead.niche,lead.deal_type].join(' ').toLowerCase().includes(query);
      const matchesOwner=ownerFilter==='all'||(ownerFilter==='mine'&&Number(lead.responsible_id)===Number(user.id))||(ownerFilter==='planned'&&lead.next_action_date);
      const matchesModule=currentModule!=='leads'||['Новая заявка','Связались'].includes(lead.stage);
      return matchesQuery&&matchesOwner&&matchesModule;
    });
  }
  function renderWorkspace(){
    const title=document.querySelector('#section-title');if(!title)return;
    title.innerHTML=`${moduleTitles[currentModule]||'Сделки'} <span>☆</span>`;
    document.querySelectorAll('[data-module]').forEach(button=>button.classList.toggle('active',button.dataset.module===currentModule));
    document.querySelectorAll('[data-rail]').forEach(button=>button.classList.toggle('active',button.dataset.rail===currentModule||(button.dataset.rail===currentView&&currentModule==='deals')));
    document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===currentView));
    document.querySelectorAll('[data-owner]').forEach(button=>button.classList.toggle('active',button.dataset.owner===ownerFilter));
    const viewbar=document.querySelector('.b24-viewbar');viewbar.hidden=!['deals','leads'].includes(currentModule);
    document.querySelector('.b24-pipeline').hidden=!['deals','leads'].includes(currentModule);
    document.querySelector('#new').hidden=!['deals','leads'].includes(currentModule);
    document.querySelector('.b24-gear').hidden=!['deals','leads'].includes(currentModule);
    document.querySelector('.b24-filter').hidden=!['deals','leads','clients'].includes(currentModule);
    if(currentModule==='clients')return renderClients();
    if(currentModule==='sales')return renderSales();
    if(currentModule==='analytics')return renderAnalytics();
    if(currentModule==='documents')return renderDocuments();
    if(currentModule==='mail')return renderMail();
    if(currentView==='list')return renderList();
    if(currentView==='activities')return renderActivities();
    if(currentView==='calendar')return renderCalendar();
    renderColumns();
  }
  function bindCards(){
    document.querySelectorAll('.b24-card,[data-row-id]').forEach(card=>{card.onclick=event=>{event.stopPropagation();const id=card.dataset.id||card.dataset.rowId;openDeal(leads.find(lead=>lead.id==id),false,event.target.dataset.open==='activity')};card.ondragstart=event=>event.dataTransfer.setData('text/plain',card.dataset.id)});
  }
  function renderList(){
    const items=filteredLeads();
    document.querySelector('#board').innerHTML=`<div class="b24-table-wrap"><table class="b24-table"><thead><tr><th>Сделка</th><th>Стадия</th><th>Клиент</th><th>Сумма</th><th>Ответственный</th><th>Следующее дело</th></tr></thead><tbody>${items.map(lead=>`<tr data-row-id="${lead.id}"><td><strong>${esc(lead.name||'Сделка #'+lead.id)}</strong><small>${esc(lead.deal_type||'')}</small></td><td><span class="b24-stage-pill">${esc(lead.stage)}</span></td><td>${esc(lead.company||lead.phone||'—')}</td><td>${money(lead.amount)}</td><td>${esc(profiles.find(p=>p.id==lead.responsible_id)?.full_name||'Не назначен')}</td><td>${esc(lead.next_action||'—')}</td></tr>`).join('')||'<tr><td colspan="6">Ничего не найдено</td></tr>'}</tbody></table></div>`;
    bindCards();
  }
  function renderActivities(){
    const items=filteredLeads().filter(lead=>lead.next_action||lead.next_action_date).sort((a,b)=>String(a.next_action_date||'9999').localeCompare(String(b.next_action_date||'9999')));
    document.querySelector('#board').innerHTML=`<div class="b24-simple-grid">${items.map(lead=>`<article class="b24-simple-card" data-row-id="${lead.id}"><span class="${isOverdue(lead.next_action_date)?'danger':''}">${date(lead.next_action_date)}</span><h3>${esc(lead.next_action||'Дело без описания')}</h3><p>${esc(lead.name||lead.company||'Сделка #'+lead.id)}</p></article>`).join('')||'<div class="b24-empty-state"><h2>Запланированных дел пока нет</h2><p>Откройте сделку и назначьте следующее действие.</p></div>'}</div>`;
    bindCards();
  }
  function renderCalendar(){
    const groups={};filteredLeads().filter(lead=>lead.next_action_date).forEach(lead=>(groups[lead.next_action_date]??=[]).push(lead));
    document.querySelector('#board').innerHTML=`<div class="b24-calendar">${Object.entries(groups).sort().map(([day,items])=>`<section><header>${date(day)}</header>${items.map(lead=>`<button data-row-id="${lead.id}"><b>${esc(lead.next_action||'Дело')}</b><span>${esc(lead.name||lead.company||'Сделка #'+lead.id)}</span></button>`).join('')}</section>`).join('')||'<div class="b24-empty-state"><h2>Календарь пока пуст</h2><p>Даты появятся после планирования дел.</p></div>'}</div>`;
    bindCards();
  }
  function renderClients(){
    const items=filteredLeads();
    document.querySelector('#board').innerHTML=`<div class="b24-simple-grid clients">${items.map(lead=>`<article class="b24-client-card" data-row-id="${lead.id}"><div>${esc((lead.name||lead.company||'?').slice(0,1))}</div><h3>${esc(lead.name||lead.company||'Без имени')}</h3><p>${esc(lead.company||lead.deal_type||'Клиент')}</p><a href="tel:${esc(lead.phone||'')}">${esc(lead.phone||'Телефон не указан')}</a><small>${esc(lead.stage)}</small></article>`).join('')||'<div class="b24-empty-state"><h2>Клиентов пока нет</h2></div>'}</div>`;
    bindCards();
  }
  function renderAnalytics(){
    const won=leads.filter(lead=>['Оплачено','В работе','Завершено'].includes(lead.stage));const conversion=leads.length?Math.round(won.length/leads.length*100):0;
    const sourceRows=sources.map(source=>({source,count:leads.filter(lead=>lead.source===source).length})).filter(item=>item.count).sort((a,b)=>b.count-a.count);
    document.querySelector('#board').innerHTML=`<div class="b24-analytics-head"><div><p>ОБЩАЯ КАРТИНА</p><h2>Аналитика продаж</h2><span>Показывает, откуда приходят сделки и сколько из них доходят до работы.</span></div><strong>${conversion}<small>%</small><em>конверсия</em></strong></div><div class="b24-analytics-grid"><section><header><h3>Источники обращений</h3><span>${leads.length} всего</span></header><div class="b24-source-chart">${sourceRows.map(item=>`<div><span>${esc(item.source)}</span><i><b style="width:${Math.max(7,item.count/Math.max(1,leads.length)*100)}%"></b></i><strong>${item.count}</strong></div>`).join('')||'<p>Укажите источник в карточках сделок — здесь появится сравнение каналов.</p>'}</div></section><section><header><h3>Прохождение воронки</h3><span>по этапам</span></header><div class="b24-funnel">${stages.map(stage=>{const count=leads.filter(lead=>lead.stage===stage).length;return `<div><span>${esc(stage)}</span><i><b style="width:${leads.length?Math.max(4,count/leads.length*100):0}%"></b></i><strong>${count}</strong></div>`}).join('')}</div></section></div>`;
  }
  function renderSales(){
    const active=leads.filter(lead=>!['Завершено','Отказ'].includes(lead.stage));const paid=leads.filter(lead=>['Оплачено','В работе','Завершено'].includes(lead.stage));const pipeline=active.reduce((sum,lead)=>sum+Number(lead.amount||0),0);const revenue=paid.reduce((sum,lead)=>sum+Number(lead.amount||0),0);
    document.querySelector('#board').innerHTML=`<div class="b24-sales-hero"><div><p>ФИНАНСЫ И ВОРОНКА</p><h2>${money(revenue)}</h2><span>сумма оплаченных и завершённых сделок</span></div><div class="b24-sales-ring" style="--progress:${leads.length?Math.round(paid.length/leads.length*100):0}"><strong>${paid.length}</strong><span>успешных</span></div></div><div class="b24-stats"><article><span>Активные сделки</span><strong>${active.length}</strong><small>в текущей работе</small></article><article><span>Сумма в работе</span><strong>${money(pipeline)}</strong><small>потенциальная выручка</small></article><article><span>Средний чек</span><strong>${money(paid.length?revenue/paid.length:0)}</strong><small>по успешным сделкам</small></article><article><span>Без следующего шага</span><strong>${active.filter(lead=>!lead.next_action).length}</strong><small>нужно запланировать дело</small></article></div>`;
  }
  function renderDocuments(){
    document.querySelector('#board').innerHTML='<div class="b24-dev-state"><img src="../assets/ash-mark.svg" alt=""><p>РАЗДЕЛ В РАЗРАБОТКЕ</p><h2>Документы появятся позже</h2><span>Здесь будут шаблоны аудитов, коммерческих предложений, счетов и договоров. Пока мы не показываем неработающие кнопки создания.</span></div>';
  }
  async function renderMail(){
    const board=document.querySelector('#board');board.innerHTML='<div class="b24-mail-loading">Подключаемся к почтовому разделу…</div>';
    try{
      const data=await api('mail-status',null,'GET');
      if(!data.configured){
        board.innerHTML=`<div class="b24-mail-connect"><img src="../assets/ash-mark.svg" alt=""><p>ПОЧТА НА ВАШЕМ СЕРВЕРЕ</p><h2>Подключить ${esc(data.email)}</h2><span>Пароль шифруется на сервере. После подключения CRM сможет получать входящие письма и связывать их с клиентами по email.</span><form id="mail-connect-form"><label class="field"><span>Почтовый ящик</span><input name="email" type="email" value="${esc(data.email)}" readonly></label><label class="field"><span>Пароль почты</span><input name="password" type="password" required autocomplete="current-password"></label><button class="b24-create">ПРОВЕРИТЬ И ПОДКЛЮЧИТЬ</button><small>Данные передаются по HTTPS и не показываются сотрудникам после сохранения.</small></form></div>`;
        document.querySelector('#mail-connect-form').onsubmit=async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;button.textContent='ПРОВЕРЯЕМ…';try{await api('mail-configure',Object.fromEntries(new FormData(event.currentTarget)));notice('Почта подключена');renderMail()}catch(error){notice(error.message);button.disabled=false;button.textContent='ПРОВЕРИТЬ И ПОДКЛЮЧИТЬ'}};return;
      }
      board.innerHTML=`<div class="b24-mail-head"><div><p>ПОДКЛЮЧЕНО</p><h2>${esc(data.email)}</h2><span>${data.last_sync?'Последняя синхронизация: '+date(data.last_sync):'Почта подключена. Запустите первую синхронизацию.'}</span></div><button class="b24-create" id="mail-sync">СИНХРОНИЗИРОВАТЬ</button></div><div class="b24-mail-list">${data.messages.map(message=>`<article data-row-id="${message.lead_id||''}" class="${message.lead_id?'linked':''}"><div class="b24-mail-avatar">${esc((message.from_name||message.from_email||'?').slice(0,1))}</div><div><header><strong>${esc(message.from_name||message.from_email||'Отправитель')}</strong><time>${date(message.sent_at)}</time></header><h3>${esc(message.subject||'Без темы')}</h3><p>${esc((message.body||'').slice(0,240))}</p><small>${message.lead_id?'Связано со сделкой: '+esc(message.lead_name||message.lead_company||'#'+message.lead_id):'Пока не связано со сделкой'}</small></div></article>`).join('')||'<div class="b24-empty-state"><h2>Писем пока нет</h2><p>Нажмите «Синхронизировать», чтобы получить последние входящие.</p></div>'}</div>`;
      document.querySelector('#mail-sync').onclick=async event=>{event.currentTarget.disabled=true;event.currentTarget.textContent='ПОЛУЧАЕМ ПИСЬМА…';try{const result=await api('mail-sync',{});notice(`Новых писем: ${result.added}`);renderMail()}catch(error){notice(error.message);event.currentTarget.disabled=false;event.currentTarget.textContent='СИНХРОНИЗИРОВАТЬ'}};
      document.querySelectorAll('.b24-mail-list [data-row-id]').forEach(item=>{if(item.dataset.rowId)item.onclick=()=>openDeal(leads.find(lead=>lead.id==item.dataset.rowId),false)});
    }catch(error){board.innerHTML=`<div class="b24-empty-state"><h2>Почта временно недоступна</h2><p>${esc(error.message)}</p></div>`}
  }
  function renderColumns(){
    const visible=filteredLeads();
    document.querySelector('#board').innerHTML=stages.map((stage,index)=>{
      const items=visible.filter(lead=>lead.stage===stage);
      const total=items.reduce((sum,lead)=>sum+Number(lead.amount||0),0);
      return `<section class="b24-column" data-stage="${esc(stage)}" style="--stage-index:${index}"><header><div class="b24-stage-name">${esc(stage)} <span>(${items.length})</span></div><div class="b24-stage-total">${money(total)}</div><button class="b24-quick" data-quick-stage="${esc(stage)}">+ <span>Быстрая сделка</span></button></header><div class="b24-cards">${items.map(dealCard).join('')||'<p class="b24-empty">Перетащите сделку сюда</p>'}</div></section>`;
    }).join('');
    document.querySelectorAll('[data-quick-stage]').forEach(button=>button.onclick=()=>openDeal({stage:button.dataset.quickStage,deal_type:'Первичное обращение'},true));
    bindCards();
    document.querySelectorAll('.b24-column').forEach(column=>{column.ondragover=event=>{event.preventDefault();column.classList.add('is-over')};column.ondragleave=()=>column.classList.remove('is-over');column.ondrop=async event=>{event.preventDefault();column.classList.remove('is-over');const lead=leads.find(l=>l.id==event.dataTransfer.getData('text/plain'));if(!lead||lead.stage===column.dataset.stage)return;try{const data=await api('lead-save',{...lead,stage:column.dataset.stage,responsible_id:lead.responsible_id||'',amount:lead.amount||'',next_action_date:lead.next_action_date||''});Object.assign(lead,data.lead);renderColumns()}catch(err){notice(err.message)}}});
  }
  const input=(name,label,type='text',wide=false,placeholder='')=>`<label class="field ${wide?'wide':''}"><span>${label}</span><input name="${name}" type="${type}" ${placeholder?`placeholder="${placeholder}"`:''}></label>`;
  const opts=(items,value)=>items.map(item=>`<option value="${esc(item)}" ${item===value?'selected':''}>${esc(item)}</option>`).join('');
  const select=(name,label,items,value,empty='Не указано')=>`<label class="field"><span>${label}</span><select name="${name}"><option value="">${empty}</option>${opts(items,value)}</select></label>`;
  function openDealLegacy(lead,isNew=false,focusActivity=false){
    selected=lead;
    const owners=profiles.map(p=>`<option value="${p.id}" ${p.id==lead.responsible_id?'selected':''}>${esc(p.full_name)}</option>`).join('');
    if(isNew){
      root.insertAdjacentHTML('beforeend',`<div class="modal b24-modal" id="modal"><form class="b24-quick-form" id="lead-form"><header><div><p>БЫСТРАЯ СДЕЛКА</p><h2>Новая сделка</h2></div><button type="button" id="close">×</button></header><div class="grid">${input('name','Название сделки / имя','text',true,'Например: Иван · аудит')}${input('phone','Телефон','tel',false,'+7 900 000-00-00')}${input('amount','Сумма','number',false,'0')}${select('deal_type','Вид сделки',dealTypes,lead.deal_type,'Первичное обращение')}${select('source','Источник',sources,lead.source)}<label class="field"><span>Ответственный</span><select name="responsible_id"><option value="">Не назначен</option>${owners}</select></label><label class="field wide"><span>Комментарий клиента</span><textarea name="initial_message" placeholder="Можно заполнить позже"></textarea></label></div><footer><button type="button" class="secondary" id="cancel">Отмена</button><button class="b24-save">СОЗДАТЬ</button></footer></form></div>`);
      bindDealForm(lead,true);return;
    }
    const stageTrack=stages.map((stage,index)=>`<button type="button" class="b24-deal-stage ${stage===lead.stage?'active':''}" data-stage-value="${esc(stage)}" style="--i:${index}">${esc(stage)}</button>`).join('');
    root.insertAdjacentHTML('beforeend',`<div class="b24-deal-layer" id="modal"><button type="button" class="b24-layer-close" id="close">×</button><form class="b24-deal" id="lead-form"><header class="b24-deal-head"><div><h2>${esc(lead.name||lead.company||'Сделка #'+lead.id)} <small>#${lead.id}</small></h2><p>${esc(lead.deal_type||'Первичное обращение')} · ${esc(lead.source||'Источник не указан')}</p></div><div class="b24-deal-actions"><a href="tel:${esc(lead.phone||'')}" class="${lead.phone?'':'disabled'}">☎</a><button type="button">Документ⌄</button><button type="button">Предложение⌄</button></div></header><div class="b24-stage-track">${stageTrack}</div><nav class="b24-deal-tabs"><button type="button" class="active">Общие</button><button type="button">Товары</button><button type="button">Предложения</button><button type="button">Счета</button><button type="button">Документы</button><button type="button">Связи</button><button type="button">Ещё⌄</button></nav><input type="hidden" name="stage" value="${esc(lead.stage)}"><div class="b24-deal-body"><section class="b24-fields"><article class="b24-field-card"><div class="b24-field-card-head"><h3>О сделке</h3><span>изменить</span></div><label class="b24-amount"><span>Сумма и валюта</span><input name="amount" type="number" value="${esc(lead.amount||'')}"><b>₽</b></label><div class="b24-two">${select('deal_type','Вид сделки',dealTypes,lead.deal_type)}${select('source','Источник',sources,lead.source)}</div>${input('product','Продукт / услуга')}${input('niche','Ниша / направление')}</article><article class="b24-field-card"><div class="b24-field-card-head"><h3>Клиент</h3><span>контакты</span></div>${input('name','Имя клиента')}${input('company','Компания')}${input('phone','Телефон','tel')}${input('email','Email','email')}${input('messenger','Мессенджер / ссылка')}${input('website','Сайт')}${input('city','Город')}<label class="field"><span>Ответственный</span><select name="responsible_id"><option value="">Не назначен</option>${owners}</select></label></article><article class="b24-field-card"><div class="b24-field-card-head"><h3>Маркетинг и документы</h3><span>автоматически</span></div>${input('documents_url','Документы','url')}${input('landing_url','Страница заявки','url')}${input('utm_source','UTM SOURCE')}${input('utm_medium','UTM MEDIUM')}${input('utm_campaign','UTM CAMPAIGN')}${input('utm_content','UTM CONTENT')}${input('utm_term','UTM TERM')}${input('extra_links','Дополнительная ссылка','url')}</article></section><section class="b24-timeline"><nav><button type="button" class="active">Дело</button><button type="button">Комментарий</button><button type="button">Задача</button><button type="button">WhatsApp</button><button type="button">СМС</button><button type="button">Ещё⌄</button></nav><article class="b24-activity-box" id="activity-box"><h3>Запланировать следующее действие</h3><label><textarea name="next_action" placeholder="Например: позвонить и обсудить аудит"></textarea></label><div><input name="next_action_date" type="date"><button class="b24-save">СОХРАНИТЬ</button></div></article><article class="b24-comment-box"><div class="b24-timeline-icon">＋</div><textarea name="new_comment" placeholder="Оставить внутренний комментарий"></textarea></article><div class="b24-timeline-title"><span>История сделки</span></div><div id="history" class="b24-history"><p>Загружаем историю…</p></div></section></div><footer class="b24-deal-footer"><button type="button" class="secondary" id="archive">В архив</button><button class="b24-save">СОХРАНИТЬ СДЕЛКУ</button></footer></form></div>`);
    const form=document.querySelector('#lead-form');Object.entries(lead).forEach(([key,value])=>{if(form.elements[key]&&value!=null)form.elements[key].value=value});
    document.querySelectorAll('[data-stage-value]').forEach(button=>button.onclick=()=>{form.elements.stage.value=button.dataset.stageValue;document.querySelectorAll('[data-stage-value]').forEach(x=>x.classList.toggle('active',x===button))});
    document.querySelectorAll('.b24-deal-tabs button,.b24-timeline>nav button').forEach(button=>button.onclick=()=>{const selector=button.parentElement.classList.contains('b24-deal-tabs')?'.b24-deal-tabs button':'.b24-timeline>nav button';document.querySelectorAll(selector).forEach(item=>item.classList.toggle('active',item===button));notice(`${button.textContent.trim()}: раздел готовится для следующего этапа CRM`)});
    document.querySelectorAll('.b24-deal-actions button').forEach(button=>button.onclick=()=>notice(`${button.textContent.trim()}: сначала добавьте ссылку в блоке «Маркетинг и документы»`));
    bindDealForm(lead,false);loadHistory(lead.id);if(focusActivity)setTimeout(()=>document.querySelector('#activity-box textarea')?.focus(),100);
  }
  function openDeal(lead,isNew=false,focusActivity=false){
    document.body.classList.add('crm-modal-open');
    document.onkeydown=event=>{if(event.key==='Escape')closeDeal()};
    if(isNew){openDealLegacy(lead,true,focusActivity);return}
    selected=lead;
    const owners=profiles.map(p=>`<option value="${p.id}" ${p.id==lead.responsible_id?'selected':''}>${esc(p.full_name)}</option>`).join('');
    const stageTrack=stages.map((stage,index)=>`<button type="button" class="b24-deal-stage ${stage===lead.stage?'active':''}" data-stage-value="${esc(stage)}" style="--i:${index}">${esc(stage)}</button>`).join('');
    root.insertAdjacentHTML('beforeend',`<div class="b24-deal-layer" id="modal"><button type="button" class="b24-layer-close" id="close">×</button><form class="b24-deal" id="lead-form"><header class="b24-deal-head"><div><h2>${esc(lead.name||lead.company||'Сделка #'+lead.id)} <small>#${lead.id}</small></h2><p>${esc(lead.deal_type||'Первичное обращение')} · ${esc(lead.source||'Источник не указан')}</p></div><div class="b24-deal-actions"><a href="tel:${esc(lead.phone||'')}" class="${lead.phone?'':'disabled'}" title="Позвонить">☎ Позвонить</a><a href="mailto:${esc(lead.email||'')}" class="${lead.email?'':'disabled'}" title="Написать письмо">✉ Написать</a></div></header><div class="b24-stage-track">${stageTrack}</div><nav class="b24-deal-tabs"><button type="button" class="active" data-deal-tab="general">Общие</button><button type="button" data-deal-tab="services">Услуги</button></nav><input type="hidden" name="stage" value="${esc(lead.stage)}"><div class="b24-deal-body"><section class="b24-fields"><article class="b24-field-card" data-deal-pane="general"><div class="b24-field-card-head"><h3>О сделке</h3><span>основное</span></div><label class="b24-amount"><span>Сумма и валюта</span><input name="amount" type="number" value="${esc(lead.amount||'')}"><b>₽</b></label><div class="b24-two">${select('source','Источник',sources,lead.source)}${input('niche','Ниша / направление')}</div></article><article class="b24-field-card" data-deal-pane="general"><div class="b24-field-card-head"><h3>Клиент</h3><span>контакты</span></div>${input('name','Имя клиента')}${input('company','Компания')}${input('phone','Телефон','tel')}${input('email','Email','email')}${input('messenger','Мессенджер / ссылка')}${input('website','Сайт')}${input('city','Город')}<label class="field"><span>Ответственный</span><select name="responsible_id"><option value="">Не назначен</option>${owners}</select></label></article><article class="b24-field-card" data-deal-pane="general"><div class="b24-field-card-head"><h3>Источник заявки</h3><span>заполняется автоматически</span></div>${input('landing_url','Страница заявки','url')}${input('utm_source','UTM SOURCE')}${input('utm_medium','UTM MEDIUM')}${input('utm_campaign','UTM CAMPAIGN')}${input('utm_content','UTM CONTENT')}${input('utm_term','UTM TERM')}${input('extra_links','Дополнительная ссылка','url')}</article><article class="b24-field-card" data-deal-pane="services" hidden><div class="b24-field-card-head"><h3>Услуги</h3><span>что продаём клиенту</span></div>${select('deal_type','Вид сделки',dealTypes,lead.deal_type,'Выберите вид сделки')}${input('product','Услуга / состав работ','text',false,'Например: аудит и пересборка продаж')}<p class="b24-service-note">Здесь фиксируем основную услугу. Подробный состав работ можно добавить в комментарии справа.</p></article></section><section class="b24-timeline"><nav><button type="button" class="active" data-timeline-target="activity-box">Дело</button><button type="button" data-timeline-target="comment-box">Комментарий</button></nav><article class="b24-activity-box" id="activity-box"><h3>Запланировать следующее действие</h3><label><textarea name="next_action" placeholder="Например: позвонить и обсудить аудит"></textarea></label><div><input name="next_action_date" type="date"><button class="b24-save">СОХРАНИТЬ</button></div></article><article class="b24-comment-box" id="comment-box"><div class="b24-timeline-icon">＋</div><textarea name="new_comment" placeholder="Оставить внутренний комментарий"></textarea></article><div class="b24-timeline-title"><span>История сделки</span></div><div id="history" class="b24-history"><p>Загружаем историю…</p></div></section></div><footer class="b24-deal-footer"><button type="button" class="secondary" id="archive">В архив</button><button class="b24-save">СОХРАНИТЬ СДЕЛКУ</button></footer></form></div>`);
    const form=document.querySelector('#lead-form');Object.entries(lead).forEach(([key,value])=>{if(form.elements[key]&&value!=null)form.elements[key].value=value});
    document.querySelectorAll('[data-stage-value]').forEach(button=>button.onclick=()=>{form.elements.stage.value=button.dataset.stageValue;document.querySelectorAll('[data-stage-value]').forEach(item=>item.classList.toggle('active',item===button))});
    document.querySelectorAll('[data-deal-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-deal-tab]').forEach(item=>item.classList.toggle('active',item===button));document.querySelectorAll('[data-deal-pane]').forEach(pane=>pane.hidden=pane.dataset.dealPane!==button.dataset.dealTab)});
    document.querySelectorAll('[data-timeline-target]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-timeline-target]').forEach(item=>item.classList.toggle('active',item===button));document.querySelector(`#${button.dataset.timelineTarget} textarea`)?.focus()});
    bindDealForm(lead,false);loadHistory(lead.id);if(focusActivity)setTimeout(()=>document.querySelector('#activity-box textarea')?.focus(),100);
  }
  function bindDealForm(lead,isNew){
    const form=document.querySelector('#lead-form');
    document.querySelector('#close').onclick=closeDeal;document.querySelector('#cancel')?.addEventListener('click',closeDeal);document.querySelector('#archive')?.addEventListener('click',archiveDeal);form.onsubmit=saveDeal;
    if(isNew){Object.entries(lead).forEach(([key,value])=>{if(form.elements[key]&&value!=null)form.elements[key].value=value})}
  }
  function closeDeal(){document.querySelector('#modal')?.remove();document.body.classList.remove('crm-modal-open');document.onkeydown=null;selected=null}
  async function saveDeal(event){
    event.preventDefault();const raw=Object.fromEntries(new FormData(event.currentTarget));
    try{const result=await api('lead-save',{...selected,...raw,id:selected.id||0});const index=leads.findIndex(l=>l.id==result.lead.id);if(index<0)leads.unshift(result.lead);else leads[index]=result.lead;closeDeal();renderCRM();notice('Сделка сохранена')}catch(err){notice(err.message)}
  }
  async function archiveDeal(){if(!confirm('Перенести сделку в архив?'))return;try{await api('lead-archive',{id:selected.id});leads=leads.filter(l=>l.id!==selected.id);closeDeal();renderCRM()}catch(err){notice(err.message)}}
  async function loadHistory(id){
    try{const data=await api('lead-history',{id},'GET');const events=[...data.comments.map(item=>({...item,kind:'Комментарий'})),...data.activity.map(item=>({...item,kind:'Событие'}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));document.querySelector('#history').innerHTML=events.map(item=>`<article class="b24-history-item"><div class="b24-timeline-icon">${item.kind==='Комментарий'?'✎':'i'}</div><div><small>${esc(item.author||'CRM')} · ${date(item.created_at)}</small><p>${esc(item.text||item.description)}</p></div></article>`).join('')||'<p class="b24-no-history">Сделка создана. История появится после первого действия.</p>'}catch(_){document.querySelector('#history').innerHTML='<p>Не удалось загрузить историю.</p>'}
  }
  (async()=>{try{const data=await api('me',null,'GET');user=data.user;csrf=data.csrf;load()}catch(_){login()}})();
})();
