const form = document.querySelector('#quiz');
if (form) {
  const honeypot = document.createElement('input');
  honeypot.name = 'website_url'; honeypot.tabIndex = -1; honeypot.autocomplete = 'off';
  honeypot.setAttribute('aria-hidden', 'true');
  honeypot.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px';
  form.append(honeypot);
  form.addEventListener('submit', async (event) => {
    // Основной квиз уже проверил обязательные ответы и мог отменить отправку.
    if (event.defaultPrevented) return;
    if (!form.checkValidity()) return;
    event.preventDefault();
    const data = new FormData(form);
    const features = data.getAll('Есть').join(', ');
    const message = ['Задача: ' + (data.get('Задача') || '—'), features && 'Уже есть: ' + features].filter(Boolean).join('\n');
    const params = new URLSearchParams(location.search);
    let result;
    try { result = await fetch('crm/api.php?action=public-lead', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.get('Имя'),phone:data.get('Телефон'),niche:data.get('Сфера'),initial_message:message,landing_url:location.href,utm_source:params.get('utm_source'),utm_medium:params.get('utm_medium'),utm_campaign:params.get('utm_campaign'),utm_content:params.get('utm_content'),utm_term:params.get('utm_term'),website_url:honeypot.value})}); } catch (_) { result=null; }
    const notice = form.querySelector('.quiz-error');
    // Пока CRM на хостинге настраивается или сервер временно недоступен,
    // не ломаем старый сценарий: браузер откроет письмо на hello@ashpartners.ru.
    if (!result || !result.ok) { form.submit(); return; }
    form.innerHTML = '<p class="quiz-q">Спасибо! Заявка уже у команды. Ответим в течение рабочего дня.</p>';
  });
}
