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

  // --- Счётчик цифр о салоне ---------------------------------------------
  (function () {
    var figs = document.querySelectorAll('[data-count]');
    if (!figs.length || !('IntersectionObserver' in window)) return;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function run(el) {
      var end = parseFloat(el.getAttribute('data-count')) || 0;
      var dec = parseInt(el.getAttribute('data-decimals'), 10) || 0;
      var suffix = el.getAttribute('data-suffix') || '';
      var flash = el.getAttribute('data-flash');
      var dur = 1600 + Math.min(end, 300) * 2;      // крупные числа считаются дольше
      var t0 = null;

      function fmt(v) {
        return v.toFixed(dec).replace('.', ',') + suffix;
      }
      if (reduce) { el.textContent = fmt(end); return; }

      el.textContent = fmt(0);
      function frame(t) {
        if (t0 === null) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);          // замедление к финалу
        el.textContent = fmt(end * eased);
        if (p < 1) return requestAnimationFrame(frame);
        el.textContent = fmt(end);
        if (flash) el.classList.add('is-flash');
      }
      requestAnimationFrame(frame);
    }

    var io3 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io3.unobserve(e.target);
      });
    }, { threshold: .6 });
    Array.prototype.forEach.call(figs, function (el) { io3.observe(el); });
  }());

  // --- Видео о салоне ------------------------------------------------------
  (function () {
    var box = document.querySelector('.shot--video');
    if (!box) return;
    var video = box.querySelector('video');
    var play = box.querySelector('.shot__play');

    function start() {
      video.controls = true;
      box.classList.add('is-playing');
      video.play();
    }
    play.addEventListener('click', start);
    video.addEventListener('click', function () {
      if (!box.classList.contains('is-playing')) start();
    });
    video.addEventListener('pause', function () {
      if (video.currentTime === 0 || video.ended) box.classList.remove('is-playing');
    });
    video.addEventListener('ended', function () {
      video.currentTime = 0;
      video.controls = false;
      box.classList.remove('is-playing');
    });
    // Длительность подставляем из самого файла — не расходится с видео.
    video.addEventListener('loadedmetadata', function () {
      var cap = box.querySelector('.shot__time');
      if (!cap || !isFinite(video.duration)) return;
      var m = Math.floor(video.duration / 60), sec = Math.round(video.duration % 60);
      cap.textContent = m + ':' + (sec < 10 ? '0' : '') + sec;
    });
  }());

  // --- Акции и новости из карточки на Яндекс Картах ------------------------
  // В слайде — только фото, дата, заголовок и две кнопки: страница не должна
  // распухать от длинных текстов. Полный текст открывается в окне поверх сайта.
  (function () {
    var hosts = document.querySelectorAll('[data-posts]');
    if (!hosts.length) return;
    var FALLBACK = 'https://yandex.ru/maps/org/perfect_ton/64270712446/posts/';
    var BOOKING = 'https://n99533.yclients.com/company/112132/personal/select-master?o=';

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;   // текст внешний — только textContent
      return n;
    }

    // ---- окно с полной акцией ------------------------------------------
    var box = null;

    function ensureBox() {
      if (box) return box;
      box = el('div', 'pmodal');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.hidden = true;
      box.innerHTML =
        '<div class="pmodal__back" data-close></div>' +
        '<div class="pmodal__win">' +
          '<button class="pmodal__close" type="button" data-close aria-label="Закрыть">Закрыть</button>' +
          '<div class="pmodal__media"><img alt="" /></div>' +
          '<div class="pmodal__body">' +
            '<p class="pmodal__date"></p>' +
            '<h3 class="pmodal__title"></h3>' +
            '<div class="pmodal__text"></div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-close')) close();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !box.hidden) close();
      });
      return box;
    }

    function open(item) {
      var b = ensureBox();
      var media = b.querySelector('.pmodal__media');
      var img = media.querySelector('img');
      if (item.photos && item.photos[0]) {
        img.src = item.photos[0];
        media.hidden = false;
      } else {
        img.removeAttribute('src');
        media.hidden = true;
      }
      b.querySelector('.pmodal__date').textContent = item.date || '';
      b.querySelector('.pmodal__title').textContent = item.title || 'Новость салона';

      var text = b.querySelector('.pmodal__text');
      text.textContent = '';
      String(item.text || '').split(/\n{2,}/).forEach(function (part) {
        var p = el('p', null, part.trim());
        if (p.textContent) text.appendChild(p);
      });

      b.hidden = false;
      document.body.classList.add('nav-open');    // блокируем прокрутку под окном
      fitText(b);
      b.querySelector('.pmodal__close').focus();
    }

    // Длинные акции не режем и не прячем под прокрутку: сначала пробуем
    // ужать шрифт, и только если и это не помогло — включаем прокрутку.
    function fitText(b) {
      var body = b.querySelector('.pmodal__body');
      var win = b.querySelector('.pmodal__win');
      body.classList.remove('is-scroll');

      var fits = function () { return body.scrollHeight <= body.clientHeight + 4; };
      var setFont = function (px, lh, gap) {
        body.style.setProperty('--pfs', px.toFixed(1) + 'px');
        body.style.setProperty('--plh', String(lh));
        body.style.setProperty('--pgap', gap + 'px');
      };

      // 1) обычный размер, картинка крупная
      win.style.setProperty('--pmh', 'min(46vh,420px)');
      setFont(15, 1.6, 10);
      if (fits()) return;

      // 2) уступаем высоту картинки тексту — но не прячем её совсем
      var heights = ['min(38vh,340px)', 'min(30vh,270px)', 'min(24vh,210px)'];
      for (var h = 0; h < heights.length && !fits(); h++) {
        win.style.setProperty('--pmh', heights[h]);
      }
      if (fits()) return;

      // 3) и только потом ужимаем шрифт
      var size = 15;
      while (size > 9.8 && !fits()) {
        size -= 0.5;
        setFont(size, size > 13 ? 1.6 : 1.5, size > 13 ? 10 : 8);
      }
      if (!fits()) body.classList.add('is-scroll');
      capMedia(b);
    }

    // Страховка: картинка не должна вылезать за свой блок ни в одном браузере.
    function capMedia(b) {
      var media = b.querySelector('.pmodal__media');
      var img = media.querySelector('img');
      if (!img || media.hidden) return;
      img.style.maxHeight = media.clientHeight + 'px';
    }

    function close() {
      if (!box) return;
      box.hidden = true;
      document.body.classList.remove('nav-open');
    }

    // ---- лента ----------------------------------------------------------
    fetch('data/posts.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        Array.prototype.forEach.call(hosts, function (host) { renderPosts(host, data); });
      })
      .catch(function () {
        Array.prototype.forEach.call(hosts, function (host) {
          host.textContent = '';
          host.appendChild(el('p', 'posts-empty', 'Свежие акции салона скоро появятся здесь.'));
        });
      });

    function renderPosts(host, data) {
      var items = (data && data.items) || [];
      var limit = parseInt(host.getAttribute('data-limit'), 10) || 6;
      items = items.slice(0, limit);
      if (!items.length) return;

      host.textContent = '';
      var slider = el('div', 'slider');
      var track = el('div', 'slider__track');

      items.forEach(function (it) {
        var photo = it.photos && it.photos[0];
        var card = el('article', 'post' + (photo ? '' : ' post--text'));

        if (photo) {
          var img = document.createElement('img');
          img.className = 'post__img';
          img.src = photo;
          img.alt = '';
          img.loading = 'lazy';
          img.addEventListener('error', function () {
            img.remove();
            card.classList.add('post--text');
          });
          card.appendChild(img);
        }

        var body = el('div', 'post__body');
        if (it.date) body.appendChild(el('p', 'post__date', it.date));

        var title = el('button', 'post__title', it.title || 'Новость салона');
        title.type = 'button';
        body.appendChild(title);

        var row = el('div', 'post__row');
        var more = el('button', 'btn btn--ghost post__more-btn', 'Подробнее');
        more.type = 'button';
        var cta = el('a', 'btn btn--ghost post__cta', 'Записаться');
        cta.href = BOOKING; cta.target = '_blank'; cta.rel = 'noopener';
        row.appendChild(more);
        row.appendChild(cta);
        body.appendChild(row);

        card.appendChild(body);

        // Открываем окно по заголовку, кнопке и клику по самому слайду —
        // кроме кнопки записи, у неё своя задача.
        [title, more].forEach(function (n) {
          n.addEventListener('click', function (e) { e.stopPropagation(); open(it); });
        });
        card.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;
          open(it);
        });

        track.appendChild(card);
      });

      slider.appendChild(track);

      if (items.length > 1) {
        var prev = navButton('prev', 'M15 5l-7 7 7 7');
        var next = navButton('next', 'M9 5l7 7-7 7');
        slider.appendChild(prev);
        slider.appendChild(next);

        var dots = el('div', 'slider__dots');
        items.forEach(function (_, i) {
          var dot = el('button', 'slider__dot' + (i ? '' : ' is-active'));
          dot.type = 'button';
          dot.setAttribute('aria-label', 'Слайд ' + (i + 1));
          dot.addEventListener('click', function () { go(i); });
          dots.appendChild(dot);
        });
        slider.appendChild(dots);

        var go = function (i) {
          var card = track.children[i];
          if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' });
        };
        var current = function () {
          var w = track.clientWidth || 1;
          return Math.round(track.scrollLeft / w);
        };
        prev.addEventListener('click', function () { go(current() - 1); });
        next.addEventListener('click', function () { go(current() + 1); });

        var sync = function () {
          var i = current();
          Array.prototype.forEach.call(dots.children, function (d, k) {
            d.classList.toggle('is-active', k === i);
          });
          prev.disabled = i <= 0;
          next.disabled = i >= items.length - 1;
        };
        track.addEventListener('scroll', function () {
          clearTimeout(track._t);
          track._t = setTimeout(sync, 90);
        }, { passive: true });
        sync();
      }

      host.appendChild(slider);
    }

    function navButton(kind, path) {
      var b = el('button', 'slider__nav slider__nav--' + kind);
      b.type = 'button';
      b.setAttribute('aria-label', kind === 'prev' ? 'Предыдущая акция' : 'Следующая акция');
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path +
        '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      return b;
    }
  }());

  // --- Просмотр фотографий в полном размере -------------------------------
  // Любая картинка внутри [data-zoom] открывается поверх страницы;
  // соседние снимки листаются стрелками и клавишами.
  (function () {
    var groups = document.querySelectorAll('[data-zoom]');
    if (!groups.length) return;

    var box = null, list = [], index = 0;

    function build() {
      if (box) return box;
      box = document.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.hidden = true;
      box.innerHTML =
        '<div class="lightbox__back" data-close></div>' +
        '<button class="lightbox__close" type="button" data-close aria-label="Закрыть">Закрыть</button>' +
        '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Предыдущее фото">' +
          '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Следующее фото">' +
          '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<figure class="lightbox__fig"><img class="lightbox__img" alt="" /><figcaption class="lightbox__cap"></figcaption></figure>';
      document.body.appendChild(box);

      box.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-close')) close();
      });
      // Фото листаются пальцем: горизонтальный смах — соседний снимок,
      // вертикальный вниз — закрыть. Порог небольшой, чтобы жест ловился
      // и на узком экране, но случайное касание кадр не сдвигало.
      (function () {
        var x0 = 0, y0 = 0, t0 = 0, tracking = false;
        box.addEventListener('touchstart', function (e) {
          if (e.touches.length !== 1) { tracking = false; return; }
          x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
          t0 = e.timeStamp; tracking = true;
        }, { passive: true });
        box.addEventListener('touchend', function (e) {
          if (!tracking) return;
          tracking = false;
          var t = e.changedTouches[0];
          var dx = t.clientX - x0, dy = t.clientY - y0;
          if (e.timeStamp - t0 > 700) return;                 // это не смах, а удержание
          if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) { show(index + (dx < 0 ? 1 : -1)); return; }
          if (dy > 70 && Math.abs(dy) > Math.abs(dx)) close();
        }, { passive: true });
      }());

      box.querySelector('.lightbox__nav--prev').addEventListener('click', function () { show(index - 1); });
      box.querySelector('.lightbox__nav--next').addEventListener('click', function () { show(index + 1); });
      document.addEventListener('keydown', function (e) {
        if (box.hidden) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') show(index - 1);
        if (e.key === 'ArrowRight') show(index + 1);
      });
      return box;
    }

    function show(i) {
      if (!list.length) return;
      index = (i + list.length) % list.length;
      var src = list[index];
      box.querySelector('.lightbox__img').src = src.getAttribute('data-full') || src.getAttribute('src');
      box.querySelector('.lightbox__cap').textContent = src.getAttribute('alt') || '';
      var many = list.length > 1;
      box.querySelector('.lightbox__nav--prev').hidden = !many;
      box.querySelector('.lightbox__nav--next').hidden = !many;
    }

    function close() {
      if (!box) return;
      box.hidden = true;
      document.body.classList.remove('nav-open');
    }

    Array.prototype.forEach.call(groups, function (group) {
      group.addEventListener('click', function (e) {
        var img = e.target.closest('img');
        if (!img || !group.contains(img)) return;
        if (e.target.closest('a, button')) return;     // ссылки работают как раньше
        build();
        list = Array.prototype.slice.call(group.querySelectorAll('img'));
        show(list.indexOf(img));
        box.hidden = false;
        document.body.classList.add('nav-open');
        box.querySelector('.lightbox__close').focus();
      });
    });
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
      updateYmark(data);
    })
    .catch(function () {
      hosts.forEach(function (host) { renderEmpty(host, null); });
    });

  // Плашка рейтинга на первом экране — цифры из того же файла отзывов.
  function updateYmark(data) {
    var box = document.querySelector('[data-ymark]');
    if (!box || !data) return;
    var r = box.querySelector('[data-ymark-rating]');
    var c = box.querySelector('[data-ymark-count]');
    if (r && data.rating) r.textContent = Number(data.rating).toFixed(1).replace('.', ',');
    if (c && data.count) c.textContent = data.count + ' ' + plural(data.count, 'отзыв', 'отзыва', 'отзывов');
    if (data.org_url) box.href = data.org_url;
  }

  function plural(n, one, few, many) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

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
