// Мобильное меню, подсветка текущей вкладки и окно онлайн-записи.
document.addEventListener('DOMContentLoaded', function () {
  var burger = document.querySelector('.burger');
  var nav = document.querySelector('.nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a, .ftr__nav a').forEach(function (a) {
    if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
  });

  // --- Онлайн-запись во всплывающем окне ---------------------------------
  // Любая ссылка на YCLIENTS открывается поверх сайта, без ухода со страницы.
  // Если YCLIENTS запретит встраивание, внизу окна остаётся прямая ссылка.
  var BOOKING_URL = 'https://n99533.yclients.com/company/112132/personal/select-master?o=';

  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Онлайн-запись');
  modal.innerHTML =
    '<div class="modal__box">' +
      '<div class="modal__bar">' +
        '<span class="modal__title">Онлайн-запись</span>' +
        '<button class="modal__close" type="button">Закрыть</button>' +
      '</div>' +
      '<div class="modal__body">' +
        '<iframe title="Онлайн-запись Perfect Ton" allow="payment"></iframe>' +
        '<p class="modal__fallback">Окно не загрузилось? ' +
          '<a href="' + BOOKING_URL + '" target="_blank" rel="noopener">Открыть запись в новой вкладке</a></p>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  var frame = modal.querySelector('iframe');
  var closeBtn = modal.querySelector('.modal__close');
  var lastFocus = null;

  function openModal(url) {
    lastFocus = document.activeElement;
    if (frame.getAttribute('src') !== url) frame.setAttribute('src', url);
    modal.classList.add('is-open');
    document.body.classList.add('is-locked');
    closeBtn.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href*="yclients.com"]');
    if (!link) return;
    e.preventDefault();
    openModal(link.getAttribute('href') || BOOKING_URL);
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });
});

// ---------------------------------------------------------------------------
// Отзывы: берём из data/reviews.json и рисуем в дизайне сайта.
// Файл обновляется отдельно (планировщик в GitHub Actions или вручную),
// поэтому сайт не зависит от доступности Яндекса у посетителя.
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  var hosts = document.querySelectorAll('[data-reviews]');
  if (!hosts.length) return;

  var FALLBACK_URL = 'https://yandex.ru/maps/org/perfect_ton/64270712446/reviews/';

  fetch('data/reviews.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (data) {
      hosts.forEach(function (host) { render(host, data); });
    })
    .catch(function () {
      hosts.forEach(function (host) { renderEmpty(host, null); });
    });

  function stars(rating) {
    var n = Math.round(Number(rating) || 0);
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;      // textContent — данные внешние
    return n;
  }

  function renderEmpty(host, data) {
    host.textContent = '';
    var box = el('div', 'rev-empty');
    box.appendChild(el('p', null,
      'Лента отзывов ещё не наполнена. Все отзывы о салоне доступны в карточке ' +
      'на Яндекс Картах — здесь они появятся в оформлении сайта.'));
    var btns = el('div', 'btns');
    var a = el('a', 'btn', 'Отзывы на Яндекс Картах');
    a.href = (data && data.org_url) || FALLBACK_URL;
    a.target = '_blank'; a.rel = 'noopener';
    btns.appendChild(a);
    box.appendChild(btns);
    host.appendChild(box);
  }

  function render(host, data) {
    var items = (data && data.items) || [];
    var limit = parseInt(host.getAttribute('data-limit'), 10);
    if (!items.length) return renderEmpty(host, data);
    if (limit > 0) items = items.slice(0, limit);

    host.textContent = '';

    // Сводка: оценка и количество — показываем, только если данные есть.
    if (host.getAttribute('data-summary') !== 'off' && data.rating) {
      var sum = el('div', 'rev-summary');
      var left = el('div');
      left.appendChild(el('div', 'rev-summary__score', Number(data.rating).toFixed(1).replace('.', ',')));
      left.appendChild(el('div', 'rev-summary__stars', stars(data.rating)));
      sum.appendChild(left);
      var meta = el('div', 'rev-summary__meta');
      meta.appendChild(el('b', null, 'Рейтинг на Яндекс Картах'));
      if (data.count) meta.appendChild(document.createTextNode(data.count + ' отзывов'));
      sum.appendChild(meta);
      host.appendChild(sum);
    }

    var grid = el('div', 'rev-grid');
    items.forEach(function (it) {
      var card = el('article', 'rev');
      if (it.rating) card.appendChild(el('div', 'rev__stars', stars(it.rating)));

      var full = String(it.text || '').trim();
      var short = full.length > 320 ? full.slice(0, 300).replace(/\s+\S*$/, '') + '…' : full;
      var p = el('p', 'rev__text', short);
      card.appendChild(p);

      if (short !== full) {
        var more = el('button', 'rev__more', 'Читать полностью');
        more.type = 'button';
        more.addEventListener('click', function () {
          var opened = p.textContent === full;
          p.textContent = opened ? short : full;
          more.textContent = opened ? 'Читать полностью' : 'Свернуть';
        });
        card.appendChild(more);
      }

      var foot = el('div', 'rev__foot');
      foot.appendChild(el('span', 'rev__name', it.author || 'Гость'));
      if (it.date) foot.appendChild(el('span', 'rev__date', it.date));
      card.appendChild(foot);
      grid.appendChild(card);
    });
    host.appendChild(grid);

    if (host.getAttribute('data-summary') !== 'off') {
      var note = el('p', 'rev-note',
        'Источник — Яндекс Карты' + (data.updated ? '. Обновлено: ' + data.updated : '') + '.');
      host.appendChild(note);
    }
  }
});
