// Мобильное меню, подсветка текущей вкладки и окно онлайн-записи.
document.addEventListener('DOMContentLoaded', function () {
  var burger = document.querySelector('.burger');
  var nav = document.querySelector('.nav');
  if (burger && nav) {
    // Меню на телефоне открывается поверх страницы (лайтбокс), а не выпадает.
    var setMenu = function (open) {
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    burger.addEventListener('click', function () {
      setMenu(!nav.classList.contains('is-open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target === nav || e.target.closest('a, .nav__close')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) setMenu(false);
    });
  }

  // --- Появление блоков при прокрутке -----------------------------------
  // Классы навешиваем скриптом: без JS страница остаётся видимой целиком.
  (function () {
    if (!('IntersectionObserver' in window)) return;
    var groups = [
      ['.sec__head .eyebrow', 'anim', 0],
      ['.sec__head .h-serif', 'anim', .12],
      ['.sec__head .rule, .sec__head .rule--gold', 'anim anim--rule', .24],
      ['.shot', 'anim anim--left', 0],
      ['.sec__text > *', 'anim anim--right', .08],
      ['.svc__card', 'anim anim--zoom', .09],
      ['.team li', 'anim', .1],
      ['.sec--reviews [data-reviews]', 'anim', 0],
      ['.cta__text > *', 'anim', .12],
      ['.ftr__grid > *', 'anim', .1],
      ['.btns', 'anim', .1]
    ];
    var items = [];
    groups.forEach(function (g) {
      var list = document.querySelectorAll(g[0]);
      Array.prototype.forEach.call(list, function (el, i) {
        if (el.closest('.hero')) return;              // первый экран анимирован в CSS
        el.className += (el.className ? ' ' : '') + g[1];
        el.style.setProperty('--d', (g[2] * i).toFixed(2) + 's');
        items.push(el);
      });
    });
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io2.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .08 });
    items.forEach(function (el) { io2.observe(el); });

    // Отзывы подгружаются позже — подхватываем их карточки, когда появятся.
    var host = document.querySelector('.sec--reviews [data-reviews]');
    if (host && 'MutationObserver' in window) {
      new MutationObserver(function () {
        Array.prototype.forEach.call(host.querySelectorAll('.rev'), function (el, i) {
          if (el.classList.contains('anim')) return;
          el.classList.add('anim');
          el.style.setProperty('--d', (i * .12).toFixed(2) + 's');
          io2.observe(el);
        });
      }).observe(host, { childList: true, subtree: true });
    }
  }());

  // --- Лёгкий параллакс фона первого экрана -------------------------------
  (function () {
    var bg = document.querySelector('.hero__bg');
    if (!bg || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var ticking = false;
    addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = Math.min(scrollY, innerHeight);
        bg.style.transform = 'translate3d(0,' + (y * .18).toFixed(1) + 'px,0) scale(1.06)';
        ticking = false;
      });
    }, { passive: true });
  }());

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
        '<a class="modal__new" href="' + BOOKING_URL + '" target="_blank" rel="noopener">В новой вкладке</a>' +
        '<button class="modal__close" type="button">Закрыть</button>' +
      '</div>' +
      '<div class="modal__body">' +
        '<div class="modal__loading" role="status">' +
          '<span class="modal__spin" aria-hidden="true"></span>' +
          '<p class="modal__loading-text">Загружаем расписание…</p>' +
        '</div>' +
        '<iframe title="Онлайн-запись Perfect Ton" allow="payment"></iframe>' +
      '</div>' +
      '<p class="modal__hint">Не открылось? ' +
        '<a href="' + BOOKING_URL + '" target="_blank" rel="noopener">Открыть запись в новой вкладке</a></p>' +
    '</div>';
  document.body.appendChild(modal);

  var frame = modal.querySelector('iframe');
  var closeBtn = modal.querySelector('.modal__close');
  var loading = modal.querySelector('.modal__loading');
  var loadingText = modal.querySelector('.modal__loading-text');
  var lastFocus = null;
  var warmed = false;
  var timer = null;

  // Прогрев: YCLIENTS — тяжёлое приложение, на холодную стартует несколько
  // секунд. Начинаем грузить его заранее — при наведении на кнопку записи,
  // а если наведения не было, в простое после загрузки страницы. К моменту
  // клика окно обычно уже готово и открывается сразу.
  // Отличить «виджет загрузился» от «встраивание запрещено» изнутри страницы
  // нельзя: в обоих случаях iframe сообщает «load», а contentDocument равен
  // null. Поэтому не гадаем, а через несколько секунд после открытия всегда
  // показываем неперекрывающую подсказку с выходом в новую вкладку.
  function hintAfterDelay() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      modal.classList.add('show-hint');
    }, 6000);
  }

  function warmUp() {
    if (warmed) return;
    warmed = true;
    frame.addEventListener('load', function () {
      loading.classList.add('is-done');
    });
    frame.setAttribute('src', BOOKING_URL);
  }

  ['pointerenter', 'touchstart', 'focusin'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
      if (e.target.closest && e.target.closest('a[href*="yclients.com"]')) warmUp();
    }, { passive: true, capture: true });
  });

  if (window.requestIdleCallback) {
    requestIdleCallback(warmUp, { timeout: 2500 });
  } else {
    setTimeout(warmUp, 1200);
  }

  function openModal(url) {
    lastFocus = document.activeElement;
    warmUp();
    if (url && url !== BOOKING_URL && frame.getAttribute('src') !== url) {
      loading.classList.remove('is-done');
      frame.setAttribute('src', url);
    }
    modal.classList.add('is-open');
    document.body.classList.add('is-locked');
    closeBtn.focus();

    hintAfterDelay();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.classList.remove('show-hint');
    document.body.classList.remove('is-locked');
    if (timer) { clearTimeout(timer); timer = null; }
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
      var look = el('a', 'btn rev-summary__link', 'Смотреть на Яндекс Картах');
      look.href = data.org_url || FALLBACK_URL;
      look.target = '_blank'; look.rel = 'noopener';
      sum.appendChild(look);
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

      var who = el('div', 'rev__who');
      var name = String(it.author || 'Гость');
      var ava = el('span', 'rev__ava');
      if (it.avatar) {
        var img = document.createElement('img');
        img.src = it.avatar;
        img.alt = '';
        img.loading = 'lazy';
        // Если картинка не загрузилась — остаются инициалы под ней.
        img.addEventListener('error', function () { img.remove(); });
        ava.appendChild(img);
      }
      ava.setAttribute('data-initials', name.trim().charAt(0).toUpperCase() || '?');
      who.appendChild(ava);

      // Имя ведёт на блок отзывов салона на Картах — первоисточник,
      // а не на профиль автора: клиенту нужно увидеть именно отзывы.
      var link = el('a', 'rev__name', name);
      link.href = data.org_url || FALLBACK_URL;
      link.target = '_blank';
      link.rel = 'noopener';
      link.title = 'Открыть отзыв на Яндекс Картах';
      who.appendChild(link);
      foot.appendChild(who);

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
