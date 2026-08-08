(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var revealFirstScreen = function () {
    requestAnimationFrame(function () {
      document.documentElement.classList.remove('is-loading');
      document.body.classList.add('ready');
    });
  };
  var waitForLoad = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise(function (resolve) { window.addEventListener('load', resolve, { once:true }); });
  var waitForFonts = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.all([waitForLoad, waitForFonts]).then(revealFirstScreen);

  var blocks = [].slice.call(document.querySelectorAll('.reveal'));
  if (reduce || !('IntersectionObserver' in window)) {
    blocks.forEach(function (el) { el.classList.add('seen'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    blocks.forEach(function (el) { io.observe(el); });
  }

  // «Управляемость» запускается только когда панель уже заметно в кадре:
  // сперва три круга, затем две связи, затем финальная стрелка и акцент заголовка.
  var control = document.querySelector('.control');
  if (control) {
    if (reduce || !('IntersectionObserver' in window)) {
      control.classList.add('run');
    } else {
      var controlObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            window.setTimeout(function () { control.classList.add('run'); }, 220);
            controlObserver.unobserve(control);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.45 });
      controlObserver.observe(control);
    }
  }

  // Ступени появляются по очереди на каждом заходе в экран.
  var stairs = document.querySelector('.stairs');
  if (stairs) {
    if (reduce || !('IntersectionObserver' in window)) {
      stairs.classList.add('run');
    } else {
      var ro = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          stairs.classList.toggle('run', e.isIntersecting);
        });
      }, { threshold: 0.18 });
      ro.observe(stairs);
    }
  }

  // Блоки со своей дорожкой появления: класс .run ставится на входе
  // в экран и снимается на выходе, поэтому анимация играет заново.
  [].forEach.call(document.querySelectorAll('.princ,.closer,.duo'), function (el) {
    if (reduce || !('IntersectionObserver' in window)) { el.classList.add('run'); return; }
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { el.classList.toggle('run', e.isIntersecting); });
    }, { threshold: 0.16 });
    io2.observe(el);
  });

  // Кейсы (Eco-Store, Алмазное бурение, ...): переключение вкладок,
  // стрелки, свайп — одна и та же логика на каждый .cb-shell на странице.
  [].forEach.call(document.querySelectorAll('.cb-shell'), function (cbShell) {
    var cbTabs = cbShell.querySelectorAll('.cb-tab');
    var cbFrames = cbShell.querySelectorAll('.cb-frame');
    var cbPrev = cbShell.querySelector('.cb-arrow-prev');
    var cbNext = cbShell.querySelector('.cb-arrow-next');
    var cbCount = cbTabs.length;
    var cbCurrent = 0;

    var goToTab = function (i) {
      i = Math.max(0, Math.min(cbCount - 1, i));
      cbCurrent = i;
      [].forEach.call(cbTabs, function (b) { b.classList.toggle('is-on', +b.dataset.tab === i); });
      [].forEach.call(cbFrames, function (f) { f.classList.toggle('is-on', +f.dataset.panel === i); });
      cbShell.classList.toggle('is-cover', i === 0);
      if (cbPrev) cbPrev.disabled = i === 0;
      if (cbNext) cbNext.disabled = i === cbCount - 1;
      // новая вкладка всегда открывается с начала слайда, а не с той
      // точки прокрутки, где остался предыдущий слайд
      var activeSlide = cbShell.querySelector('.cb-frame.is-on .case-slide');
      if (activeSlide) activeSlide.scrollTop = 0;
      // Раньше здесь был scrollIntoView на телефоне — сейчас высоты
      // слайдов почти совпадают, страница и так не прыгает, а сам
      // scrollIntoView дёргал экран при каждом клике. Убрано.
    };

    cbShell.querySelector('.cb-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.cb-tab');
      if (!btn) return;
      goToTab(+btn.dataset.tab);
    });
    if (cbPrev) cbPrev.addEventListener('click', function () { goToTab(cbCurrent - 1); });
    if (cbNext) cbNext.addEventListener('click', function () { goToTab(cbCurrent + 1); });

    // Ссылки внутри слайда вида «Что сделали →» переключают вкладку;
    // ссылка последнего слайда на #audit — обычный якорь, не трогаем.
    [].forEach.call(cbShell.querySelectorAll('.case-next[data-goto]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        goToTab(+a.dataset.goto);
      });
    });

    // Протяжка мышью на ПК — Pointer Events, только для мыши.
    var dragX = 0, dragY = 0, dragging = false;
    cbShell.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      dragX = e.clientX; dragY = e.clientY; dragging = true;
    }, { passive: true });
    cbShell.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'mouse' || !dragging) return;
      dragging = false;
      var dx = e.clientX - dragX;
      var dy = e.clientY - dragY;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        goToTab(cbCurrent + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });

    // Свайп пальцем — отдельные touch-обработчики, не Pointer Events:
    // на iOS горизонтальный жест внутри страницы, которая сама скроллится
    // вертикально, браузер может забрать себе и прислать touchcancel вместо
    // touchend — pointerup в этом случае просто не срабатывает. Здесь сами
    // решаем по первому заметному сдвигу, что это горизонтальный жест, и
    // явно отменяем нативную прокрутку (preventDefault), чтобы жест
    // долистал до конца.
    var touchX = 0, touchY = 0, touchAxis = null;
    cbShell.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; touchAxis = null;
    }, { passive: true });
    cbShell.addEventListener('touchmove', function (e) {
      var dx = e.touches[0].clientX - touchX;
      var dy = e.touches[0].clientY - touchY;
      if (touchAxis === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        touchAxis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      }
      if (touchAxis === 'x') e.preventDefault();
    }, { passive: false });
    cbShell.addEventListener('touchend', function (e) {
      if (touchAxis !== 'x') return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 48) goToTab(cbCurrent + (dx < 0 ? 1 : -1));
    }, { passive: true });
  });

  // Лист приезжает целым и рвётся; при уходе с экрана собирается обратно,
  // поэтому разрыв показывается заново на каждой прокрутке.
  var split = document.getElementById('split');
  if (split) {
    if (reduce || !('IntersectionObserver' in window)) {
      split.classList.add('torn');
    } else {
      var tearTimer = null;
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          clearTimeout(tearTimer);
          if (e.isIntersecting) {
            tearTimer = setTimeout(function () { split.classList.add('torn'); }, 1350);
          } else {
            split.classList.remove('torn');
          }
        });
      }, { threshold: 0.3 });
      so.observe(split);
    }
  }

})();
