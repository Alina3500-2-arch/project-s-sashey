(function () {
  /* На мобильном макете анимация — часть согласованной композиции, поэтому
     системный Reduce Motion не переводит страницу в статичное состояние. */
  var reduce = window.innerWidth > 1000 && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasObserver = 'IntersectionObserver' in window;
  var afterPaint = function (fn, delay) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { window.setTimeout(fn, delay || 0); });
    });
  };
  // Некоторые мобильные webview не дают IntersectionObserver. В таком случае
  // запускаем дорожки при реальном входе блока в экран, а не при загрузке.
  var watchFallback = function (el, enter, leave) {
    if (hasObserver) return false;
    var visible = false;
    var check = function () {
      var rect = el.getBoundingClientRect();
      var inside = rect.top < window.innerHeight * .88 && rect.bottom > window.innerHeight * .12;
      if (inside && !visible) { visible = true; afterPaint(enter, 80); }
      if (!inside && visible && leave) { visible = false; leave(); }
    };
    window.addEventListener('scroll', check, { passive:true });
    window.addEventListener('resize', check);
    window.setTimeout(check, 120);
    return true;
  };

  // Без requestAnimationFrame: в Safari кадры не идут, пока страница не
  // видна на экране (свёрнутая вкладка, iframe за пределами прокрутки —
  // например, в pc.html), и сайт так и оставался пустым, потому что
  // is-loading прячет всё содержимое. Снимаем класс напрямую.
  var revealFirstScreen = function () {
    document.documentElement.classList.remove('is-loading');
    document.body.classList.add('ready');
  };
  // Жёсткая страховка: что бы ни случилось с промисами ниже, через 2,5 с
  // страница обязана быть видимой.
  setTimeout(revealFirstScreen, 2500);
  var waitForLoad = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise(function (resolve) { window.addEventListener('load', resolve, { once:true }); });
  var waitForFonts = document.fonts ? document.fonts.ready : Promise.resolve();
  // Пока висит is-loading, CSS прячет всё содержимое (visibility:hidden).
  // Раньше класс снимался строго после window.load, то есть после ВСЕХ
  // ресурсов — и если один запрос тормозил или падал (например, шрифты
  // с fonts.googleapis.com, недоступного в России), сайт оставался
  // пустым экраном сколько угодно долго. Теперь ждём не дольше 1,5 с:
  // что не успело — доедет и появится само, но страница уже видна.
  var failsafe = new Promise(function (resolve) { setTimeout(resolve, 1500); });
  Promise.race([Promise.all([waitForLoad, waitForFonts]), failsafe])
    .then(revealFirstScreen);

  var blocks = [].slice.call(document.querySelectorAll('.reveal'));
  if (reduce) {
    blocks.forEach(function (el) { el.classList.add('seen'); });
  } else if (watchFallback(document.documentElement, function () {
    blocks.forEach(function (el) { el.classList.add('seen'); });
  })) {
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    blocks.forEach(function (el) { io.observe(el); });
  }

  // Видео в шапке кейса: без стандартных контролов, чтобы кнопка оставалась
  // частью визуального языка страницы. Повторный клик по ролику ставит паузу.
  [].forEach.call(document.querySelectorAll('.case-video-card'), function (card) {
    var video = card.querySelector('.case-video');
    var play = card.querySelector('.case-video-play');
    if (!video || !play) return;
    play.addEventListener('click', function () { video.play(); });
    video.addEventListener('click', function () { if (!video.paused) video.pause(); });
    video.addEventListener('play', function () { card.classList.add('is-playing'); });
    video.addEventListener('pause', function () { card.classList.remove('is-playing'); });
    video.addEventListener('ended', function () { card.classList.remove('is-playing'); });
  });

  // «Управляемость» запускается только когда панель уже заметно в кадре:
  // сперва три круга, затем две связи, затем финальная стрелка и акцент заголовка.
  var control = document.querySelector('.control');
  if (control) {
    if (reduce) {
      control.classList.add('run');
    } else if (watchFallback(control, function () { control.classList.add('run'); })) {
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
    if (reduce) {
      stairs.classList.add('run');
    } else if (watchFallback(stairs, function () { stairs.classList.add('run'); }, function () { stairs.classList.remove('run'); })) {
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
    if (reduce) { el.classList.add('run'); return; }
    if (watchFallback(el, function () { el.classList.add('run'); }, function () { el.classList.remove('run'); })) return;
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

    // Кадры кейса лежат в скрытых панелях, а lazy-картинка в display:none
    // никогда не «подъезжает» к экрану — поэтому загрузка стартовала только
    // в момент переключения вкладки, и слайд открывался пустым. Снимаем
    // lazy заранее: у соседних кадров сразу, у остальных — когда кейс
    // показался на экране.
    var warmUp = function (frame) {
      if (!frame || frame.dataset.warm) { return; }
      frame.dataset.warm = '1';
      [].forEach.call(frame.querySelectorAll('img[loading="lazy"]'), function (img) {
        img.setAttribute('loading', 'eager');
      });
    };
    var warmAround = function (i) {
      warmUp(cbFrames[i]);
      warmUp(cbFrames[i + 1]);
      warmUp(cbFrames[i - 1]);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) { return; }
          obs.disconnect();
          [].forEach.call(cbFrames, warmUp);
        });
      }, { rootMargin: '300px' }).observe(cbShell);
    } else {
      [].forEach.call(cbFrames, warmUp);
    }
    warmAround(0);

    var goToTab = function (i) {
      i = Math.max(0, Math.min(cbCount - 1, i));
      cbCurrent = i;
      warmAround(i);
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
    if (reduce) {
      split.classList.add('torn');
    } else if (watchFallback(split, function () {
      window.setTimeout(function () { split.classList.add('torn'); }, 1350);
    }, function () { split.classList.remove('torn'); })) {
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

  // Отзывы: превью справа переключают скриншот в телефоне слева.
  var rvList = document.querySelector('.rv-list');
  if (rvList) {
    var rvShots = [].slice.call(document.querySelectorAll('.rv-shot'));
    var rvCards = [].slice.call(document.querySelectorAll('.rv-card'));
    var rvSets = [].slice.call(document.querySelectorAll('.trust-stat-set'));
    rvList.addEventListener('click', function (e) {
      var card = e.target.closest('.rv-card');
      if (!card) { return; }
      var id = card.dataset.review;
      rvShots.forEach(function (img) { img.classList.toggle('is-on', img.dataset.review === id); });
      rvSets.forEach(function (set) { set.classList.toggle('is-on', set.dataset.review === id); });
      rvCards.forEach(function (b) {
        var on = b === card;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    });
  }

  // Тариф подробно: «Подробнее» открывает описание из <template>
  // рядом с карточкой, вместе с ценой и кнопкой заказа.
  var lvModal = document.getElementById('lv-modal');
  if (lvModal) {
    var lvBody = lvModal.querySelector('.lv-modal-body');
    var lvTitle = lvModal.querySelector('#lv-modal-title');
    var lvPrice = lvModal.querySelector('.lv-modal-price');
    var lvLabel = lvModal.querySelector('.lv-modal-label');
    var lvOpener = null;
    var lvClose = function () {
      lvModal.hidden = true;
      document.body.style.overflow = '';
      if (lvOpener) { lvOpener.focus(); }
    };
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.level-more');
      if (btn) {
        var card = btn.closest('.level-card');
        var tpl = card.querySelector('.level-full');
        if (!tpl) { return; }
        lvOpener = btn;
        lvLabel.textContent = card.querySelector('.level-label').textContent;
        lvTitle.innerHTML = card.querySelector('h3').innerHTML;
        lvPrice.textContent = card.querySelector('.level-price').textContent;
        lvBody.innerHTML = '';
        lvBody.appendChild(tpl.content.cloneNode(true));
        lvModal.hidden = false;
        document.body.style.overflow = 'hidden';
        lvModal.querySelector('.lv-modal-x').focus();
        return;
      }
      if (e.target.closest('[data-close]')) { lvClose(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lvModal.hidden) { lvClose(); }
    });
  }

  // Квиз в подвале: четыре шага вместо длинной формы. Разметка целиком
  // в HTML, здесь только переключение шагов, прогресс и проверка ответа.
  var quiz = document.getElementById('quiz');
  if (quiz) {
    var steps = [].slice.call(quiz.querySelectorAll('.quiz-step'));
    var bar = quiz.querySelector('.quiz-bar i');
    var counter = quiz.querySelector('.quiz-count b');
    var backBtn = quiz.querySelector('.quiz-back');
    var nextBtn = quiz.querySelector('.quiz-next');
    var sendBtn = quiz.querySelector('.quiz-send');
    var errBox = quiz.querySelector('.quiz-error');
    var at = 0;

    var showError = function (text) {
      errBox.textContent = text;
      errBox.hidden = !text;
    };

    // ── Маска телефона: только российский формат ────────────────────
    // Буквы не вводятся вовсе, номер всегда собирается как
    // +7 (900) 000-00-00. Ведущие 8 и 7 считаются кодом страны, чтобы
    // человек мог вставить номер в любом привычном виде.
    var telField = quiz.querySelector('input[name="Телефон"]');
    var maskTel = function (raw) {
      var d = String(raw).replace(/\D/g, '');
      if (d[0] === '8' || d[0] === '7') { d = d.slice(1); }
      d = d.slice(0, 10);
      if (!d) { return ''; }
      var out = '+7 (' + d.slice(0, 3);
      if (d.length >= 4) { out += ') ' + d.slice(3, 6); }
      if (d.length >= 7) { out += '-' + d.slice(6, 8); }
      if (d.length >= 9) { out += '-' + d.slice(8, 10); }
      return out;
    };
    if (telField) {
      var applyMask = function () {
        var atEnd = telField.selectionStart === telField.value.length;
        telField.value = maskTel(telField.value);
        // курсор в конец, только если он там и был: иначе правка середины
        // номера превращалась в прыжок каретки
        if (atEnd) { telField.selectionStart = telField.selectionEnd = telField.value.length; }
      };
      telField.addEventListener('input', applyMask);
      telField.addEventListener('paste', function () { setTimeout(applyMask, 0); });
      telField.addEventListener('focus', function () {
        if (!telField.value) { telField.value = '+7 ('; }
      });
      telField.addEventListener('blur', function () {
        // «+7 (» без цифр — это не номер, а остаток подсказки
        if (telField.value.replace(/\D/g, '').length <= 1) { telField.value = ''; }
      });
    }

    // Шаг пройден, если в нём отмечен хотя бы один вариант.
    // На последнем шаге просим имя и телефон.
    var stepFilled = function (step) {
      if (step.querySelector('.quiz-fields')) {
        var name = step.querySelector('input[name="Имя"]');
        var tel = step.querySelector('input[name="Телефон"]');
        if (!name.value.trim()) { return 'Напишите, как к вам обращаться.'; }
        // 10 цифр после +7 — полный российский номер
        if (tel.value.replace(/\D/g, '').replace(/^7/, '').length < 10) {
          return 'Оставьте телефон полностью — 10 цифр после +7.';
        }
        if (!step.querySelector('input[name="Связь"]:checked')) {
          return 'Выберите, как с вами связаться.';
        }
        return '';
      }
      var checked = step.querySelector('input:checked');
      if (!checked) { return 'Выберите вариант, чтобы перейти дальше.'; }
      // «Другое» засчитываем только вместе с вписанным текстом
      var own = step.querySelector('.quiz-own-field');
      if (own && checked.dataset.own && !own.value.trim()) {
        return 'Напишите, чем занимается бизнес.';
      }
      return '';
    };

    // Любая кнопка сайта (href="#quiz") открывает квиз ОКНОМ поверх
    // страницы, а не уводит прокруткой в подвал. Форма на сайте одна:
    // на время показа она переезжает в окно, при закрытии возвращается
    // на своё место в подвале. Метка держит это место в разметке.
    var quizModal = document.getElementById('quiz-modal');
    var quizSlot = quizModal && quizModal.querySelector('.quiz-modal-slot');
    var quizHome = document.createComment('место формы в подвале');
    var quizDone = document.getElementById('quiz-done');

    var openQuiz = function () {
      if (!quizModal || !quizSlot || quiz.parentNode === quizSlot) { return; }
      quiz.parentNode.insertBefore(quizHome, quiz);
      quizSlot.appendChild(quiz);
      quizModal.hidden = false;
      document.body.style.overflow = 'hidden';
      quizModal.querySelector('.lv-modal-x').focus();
    };
    var closeQuiz = function () {
      if (!quizModal || quizModal.hidden) { return; }
      quizModal.hidden = true;
      document.body.style.overflow = '';
      if (quizHome.parentNode) { quizHome.parentNode.insertBefore(quiz, quizHome); }
    };
    if (quizModal) {
      quizModal.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) { closeQuiz(); }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeQuiz(); }
      });
    }

    // При каждом заходе квиз начинается с первого шага — иначе человек,
    // открывший окно второй раз, попадал бы на середину прежнего прохода.
    // Заодно запоминаем, какая кнопка привела: это уходит в заявку.
    var fromField = quiz.querySelector('input[name="Откуда"]');
    var markSource = function (btn) {
      if (!fromField || !btn) { return; }
      var card = btn.closest('.level-card');
      // innerText, а не textContent: внутри кнопок есть <br>, и без учёта
      // переносов слова слипались — «Запуститьсистему».
      var label = (btn.innerText || btn.textContent || '').replace(/\s+/g, ' ').trim();
      if (card) {
        var lv = card.querySelector('.level-kicker,h3');
        label = (lv ? (lv.innerText || lv.textContent).replace(/\s+/g, ' ').trim() + ' · ' : '') + label;
      }
      // хвостовые стрелки с кнопок («Получить разбор ↗») в заявке не нужны
      fromField.value = label.replace(/[\s→↗↘➔»]+$/, '') || 'Кнопка на сайте';
    };
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('a[href="#quiz"]');
      if (!btn) { return; }
      e.preventDefault();
      // кнопка «Заказать» живёт в окне тарифа — его закрываем
      var lv = document.getElementById('lv-modal');
      if (lv && !lv.hidden) { lv.hidden = true; }
      markSource(btn);
      at = 0;
      render();
      openQuiz();
    });

    var render = function () {
      steps.forEach(function (s, i) { s.classList.toggle('is-on', i === at); });
      counter.textContent = at + 1;
      bar.style.width = ((at + 1) / steps.length * 100) + '%';
      backBtn.hidden = at === 0;
      nextBtn.hidden = at === steps.length - 1;
      sendBtn.hidden = at !== steps.length - 1;
      showError('');
    };

    nextBtn.addEventListener('click', function () {
      var problem = stepFilled(steps[at]);
      if (problem) { showError(problem); return; }
      at = Math.min(at + 1, steps.length - 1);
      render();
    });
    backBtn.addEventListener('click', function () {
      at = Math.max(at - 1, 0);
      render();
    });
    // Выбор одиночного варианта сам ведёт на следующий шаг — короткая
    // пауза, чтобы человек увидел, что именно отметил. На мультивыборе
    // и на контактах шаг не переключаем: там ответов может быть несколько.
    quiz.addEventListener('change', function (e) {
      showError('');
      var input = e.target;
      if (input.type !== 'radio' || at === steps.length - 1) { return; }
      // «Другое» раскрывает поле для своего варианта — здесь автопереход
      // помешал бы: человек не успел бы ничего вписать
      var ownField = steps[at].querySelector('.quiz-own-field');
      if (ownField) {
        var isOwn = !!input.dataset.own;
        ownField.hidden = !isOwn;
        if (isOwn) { ownField.focus(); return; }
        ownField.value = '';
      }
      setTimeout(function () {
        if (!input.checked || at === steps.length - 1) { return; }
        at += 1;
        render();
      }, 260);
    });
    // ── Отправка заявки в CRM ──────────────────────────────────────────
    // POST на api.php?action=public-lead. Адрес абсолютный: страницу
    // смотрят и с ashpartners.ru, и с превью на GitHub Pages.
    var CRM_URL = 'https://ashpartners.ru/crm/api.php?action=public-lead';
    var sending = false;

    // Все ответы квиза — одним понятным текстом, как приходят в CRM.
    var buildMessage = function (data) {
      var lines = [];
      var add = function (label, value) {
        if (value && String(value).trim()) { lines.push(label + ': ' + value); }
      };
      add('Форма', data.get('Откуда') || 'Квиз на сайте');
      add('Сфера', data.get('Своя сфера') || data.get('Сфера'));
      add('Уже есть', data.getAll('Есть').join(', '));
      add('Задача', data.get('Задача'));
      add('Связаться', data.get('Связь'));
      return lines.join('\n');
    };

    // Как назвать выбранный способ связи в благодарности:
    // «свяжутся с вами по телефону», «... в Telegram».
    var wayText = {
      'Позвонить': 'по телефону',
      'MAX': 'в MAX',
      'Telegram': 'в Telegram',
      'WhatsApp': 'в WhatsApp'
    };

    var utm = function (name) {
      return new URLSearchParams(location.search).get(name) || '';
    };

    quiz.addEventListener('submit', function (e) {
      var problem = stepFilled(steps[steps.length - 1]);
      if (problem) { e.preventDefault(); showError(problem); return; }
      e.preventDefault();
      if (sending) { return; }           // заявка уходит ровно один раз
      sending = true;
      sendBtn.disabled = true;
      var wasLabel = sendBtn.textContent;
      sendBtn.textContent = 'Отправляем…';
      showError('');

      var data = new FormData(quiz);
      var payload = {
        name: (data.get('Имя') || '').trim(),
        phone: (data.get('Телефон') || '').trim(),
        niche: (data.get('Своя сфера') || data.get('Сфера') || '').trim(),
        initial_message: buildMessage(data),
        landing_url: location.href,
        utm_source: utm('utm_source'),
        utm_medium: utm('utm_medium'),
        utm_campaign: utm('utm_campaign'),
        utm_content: utm('utm_content'),
        utm_term: utm('utm_term'),
        website_url: data.get('website_url') || ''   // ловушка для ботов
      };

      var restore = function () {
        sending = false;
        sendBtn.disabled = false;
        sendBtn.textContent = wasLabel;
      };

      // Ограничение по времени: если CRM не отвечает, запрос нельзя
      // оставлять висеть — иначе кнопка навсегда застревает на
      // «Отправляем…». Через 15 секунд обрываем и показываем ошибку.
      var stop = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (stop) { stop.abort(); } }, 15000);

      fetch(CRM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: stop ? stop.signal : undefined
      }).then(function (r) {
        clearTimeout(timer);
        return r.ok ? r.json() : Promise.reject(new Error('CRM не приняла заявку'));
      }).then(function () {
        // Успех: форма прячется, на её месте — сообщение. Если квиз открыт
        // окном, сообщение показываем в окне.
        quiz.hidden = true;
        if (quizDone) {
          var wayBox = quizDone.querySelector('.quiz-done-way');
          if (wayBox) {
            wayBox.textContent = wayText[data.get('Связь')] || 'в течение рабочего дня';
          }
          if (quiz.parentNode) { quiz.parentNode.appendChild(quizDone); }
          quizDone.hidden = false;
        }
      }).catch(function () {
        clearTimeout(timer);
        restore();
        // CRM недоступна — форму не ломаем: показываем причину и оставляем
        // прежний путь, письмо на почту.
        showError('Не получилось отправить заявку — попробуйте ещё раз или ' +
                  'позвоните: +7 (920) 146-11-40.');
      });
    });

    render();
  }

  // Подписи слева от прайса («Срок», «Наблюдение», «Результат», «Оплата»)
  // должны стоять ровно напротив своих строк в карточках. Считать это в CSS
  // не выходит: строки разной высоты, а жёсткие высоты переполняют низкие
  // карточки и выдавливают кнопку заказа. Поэтому меряем готовую таблицу
  // первой карточки и подгоняем список под неё.
  var guide = document.querySelector('.levels-guide');
  var firstCard = document.querySelector('.level-card--0');
  // Сдвигаем не сам список, а всю левую колонку: иначе «Путь от бесплатного
  // разбора…» оставался наверху, а список уезжал вниз — между ними зияла
  // пустота во весь блок.
  var levelsCopy = document.querySelector('.levels-copy');

  // В предпросмотре ПК-версии с телефона (pc.html держит страницу во
  // вложенном кадре с ?w= и показывает её уменьшенной через transform)
  // это выравнивание НЕ работает: браузер отдаёт скрипту размеры с учётом
  // масштаба кадра, тот раздувает строки, за ними карточки — и прайс
  // уходил вниз бесконечной пустотой, дальше него было не пролистать.
  // Мерить в кадре нечем, поэтому там прайс рисуется одним CSS: лесенка
  // задана в min-height карточек, она статична и растянуться не может.
  // Подписи слева в кадре могут стоять чуть не вровень со строками —
  // это цена за рабочий предпросмотр. На мониторе (страница открыта сама
  // по себе, не в кадре) всё считается как раньше, до пикселя.
  var inPreviewFrame = window.top !== window.self && /[?&]w=\d{3,4}/.test(location.search);
  if (guide && firstCard && !inPreviewFrame) {
    var cards = document.querySelectorAll('.level-card');

    // Одинаковые строки разных карточек должны лежать на одном уровне:
    // «5 рабочих дней» напротив «До 30 рабочих дней» и так далее. Текст в
    // них разной длины, поэтому равняем по самой высокой строке в ряду.
    var levelRows = function (reset) {
      var byCard = [];
      cards.forEach(function (card) {
        var rows = [].slice.call(card.querySelectorAll('.level-details li'));
        rows.forEach(function (li) { li.style.height = ''; });
        byCard.push(rows);
      });
      if (reset || !byCard.length) { return; }
      var count = byCard[0].length;
      for (var i = 0; i < count; i++) {
        var tallest = 0;
        byCard.forEach(function (rows) {
          if (rows[i]) { tallest = Math.max(tallest, rows[i].getBoundingClientRect().height); }
        });
        byCard.forEach(function (rows) {
          if (rows[i]) { rows[i].style.height = tallest + 'px'; }
        });
      }
    };

    // Лесенка карточек: ступенька между соседними уровнями должна быть
    // одинаковой. Высоты в CSS этого не дают — содержимое карточек разной
    // длины, и самая низкая карточка перерастает свою заданную высоту,
    // из-за чего первая ступенька выходила вдвое меньше остальных. Поэтому
    // считаем от самой высокой карточки в её естественном виде.
    var levelLadder = function (reset) {
      cards.forEach(function (card) { card.style.minHeight = reset ? '' : '0px'; });
      if (reset) { return; }
      var natural = 0;
      cards.forEach(function (card) {
        natural = Math.max(natural, card.getBoundingClientRect().height);
      });
      // шаг пропорционален карточке, чтобы лесенка не ломалась на узком ПК
      var step = Math.round(natural * 0.064);
      cards.forEach(function (card, i) {
        card.style.minHeight = (natural + step * i) + 'px';
      });
    };

    var alignGuide = function () {
      var items = guide.querySelectorAll('li');
      var rows = firstCard.querySelectorAll('.level-details li');
      // на телефоне карточки листаются лентой — выравнивать нечего
      if (window.innerWidth <= 900 || rows.length !== items.length) {
        levelRows(true);
        levelLadder(true);
        if (levelsCopy) { levelsCopy.style.marginTop = ''; }
        items.forEach(function (li) { li.style.height = ''; });
        return;
      }
      levelRows(false);
      // ступеньку считаем после выравнивания строк: они меняют высоту карточек
      levelLadder(false);
      items.forEach(function (li, i) { li.style.height = rows[i].getBoundingClientRect().height + 'px'; });
      if (!levelsCopy) { return; }
      levelsCopy.style.marginTop = '0px';
      var shift = rows[0].getBoundingClientRect().top - items[0].getBoundingClientRect().top;
      levelsCopy.style.marginTop = shift + 'px';
    };
    // Выравнивание считается по фактическим размерам, а они меняются уже
    // после первого прохода: догружаются шрифты и картинки, страница может
    // открыться в узком окне (или в предпросмотре ПК-версии внутри рамки) и
    // получить настоящую ширину позже. Раньше пересчёт был только по resize,
    // и в таких случаях прайс так и оставался разъехавшимся: строки карточек
    // на разной высоте, левый столбик подписей — сам по себе.
    var alignPending = false;
    var scheduleAlign = function () {
      if (alignPending) { return; }
      alignPending = true;
      requestAnimationFrame(function () { alignPending = false; alignGuide(); });
    };
    alignGuide();
    window.addEventListener('resize', scheduleAlign);
    window.addEventListener('load', scheduleAlign);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(scheduleAlign); }
    // размер блока меняется и без resize окна — следим за самим блоком
    if (window.ResizeObserver) {
      var levelsRO = new ResizeObserver(scheduleAlign);
      levelsRO.observe(guide);
      var cardsBox = document.querySelector('.level-cards');
      if (cardsBox) { levelsRO.observe(cardsBox); }
    }
  }

  // Подсказка «Листайте дальше» у тарифов — гаснет после первого свайпа.
  var levelCards = document.querySelector('.level-cards');
  if (levelCards) {
    var hint = levelCards.previousElementSibling;
    levelCards.addEventListener('scroll', function () {
      if (hint) hint.classList.add('is-hidden');
    }, { passive: true, once: true });
  }

  // Раньше слайды кейса равнялись на телефоне по самому длинному, чтобы блок
  // не прыгал при переключении вкладок. Но короткие слайды при этом росли в
  // полтора-два раза: между фотографией и текстом зияла пустота, а сами кейсы
  // занимали по полтора экрана. Теперь неактивные кадры убраны из потока
  // (display:none в CSS), каждый слайд идёт ровно по своему содержимому —
  // здесь остаётся только снять высоты, выставленные прежней версией.
  var evenCaseSlides = function () {
    document.querySelectorAll('.cb-shell .case-slide').forEach(function (slide) {
      slide.style.minHeight = '';
    });
  };
  evenCaseSlides();
  window.addEventListener('resize', evenCaseSlides);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(evenCaseSlides); }
  // картинки внутри слайдов догружаются и меняют высоту
  window.addEventListener('load', evenCaseSlides);

  // Подсказка «Прокрутите вниз» у вопросов: гаснет после первой прокрутки
  // списка и не показывается вовсе, если прокручивать нечего.
  var faqList = document.querySelector('.faq-list');
  var faqHint = document.querySelector('.faq-hint');
  if (faqList && faqHint) {
    var syncFaqHint = function () {
      var scrollable = faqList.scrollHeight - faqList.clientHeight > 8;
      faqHint.classList.toggle('is-hidden', !scrollable);
    };
    syncFaqHint();
    window.addEventListener('resize', syncFaqHint);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(syncFaqHint); }
    faqList.addEventListener('scroll', function () {
      faqHint.classList.add('is-hidden');
    }, { passive: true, once: true });
    // раскрытый вопрос меняет высоту списка — подсказка может стать лишней
    faqList.addEventListener('toggle', syncFaqHint, true);
  }

  // Видеовиджет. Правила, из-за которых он устроен именно так:
  // 1) файл начинает грузиться только после window.load — чтобы не
  //    тормозить саму страницу;
  // 2) виджет всплывает не сразу, а когда видео уже готово играть
  //    без остановок, иначе в углу мигает чёрный прямоугольник;
  // 3) автозапуск браузеры разрешают только без звука — звук
  //    включается кнопкой;
  // 4) размер один и увеличить его нельзя: исходник сжат, крупнее
  //    выглядит плохо. Поэтому нет ни полного экрана, ни «картинки
  //    в картинке», ни меню с «сохранить видео».
  var vw = document.getElementById('video-widget');
  if (vw) {
    var vwSrc = 'assets/ash-video-widget-lite.mp4';
    var vwVideo = vw.querySelector('.vw-preview');
    var vwFrame = vw.querySelector('.vw-frame');
    var vwToggle = vw.querySelector('.vw-toggle');
    var vwSound = vw.querySelector('.vw-sound');
    var vwDismissed = false;

    var vwPlay = function () {
      vwVideo.playbackRate = 1.2;   // после паузы браузер сбрасывает скорость
      var p = vwVideo.play();
      if (p && p.catch) { p.catch(function () {}); }
    };
    var vwShow = function () {
      if (vwDismissed || !vw.hidden) { return; }
      // ни одного кадра ещё нет (или файл не открылся) — не всплываем,
      // иначе в углу появится чёрный прямоугольник
      if (vwVideo.readyState < 2) { return; }
      vw.hidden = false;
      requestAnimationFrame(function () { vw.classList.add('is-ready'); });
      vwPlay();
    };
    vwVideo.addEventListener('canplaythrough', vwShow);
    var vwStart = function () {
      vwVideo.src = vwSrc;
      vwVideo.playbackRate = 1.2;   // «плюс 0,2» к обычной скорости
      vwVideo.load();
      // подстраховка: canplaythrough приходит не во всех браузерах
      setTimeout(vwShow, 2500);
      setTimeout(vwShow, 6000);
    };
    if (document.readyState === 'complete') { vwStart(); }
    else { window.addEventListener('load', vwStart); }

    // на телефоне «наведения» нет: первый тап показывает кнопки,
    // через 3 секунды без действий они снова уходят
    var vwTouchTimer = null;
    var vwTouched = function () {
      vw.classList.add('is-touched');
      clearTimeout(vwTouchTimer);
      vwTouchTimer = setTimeout(function () { vw.classList.remove('is-touched'); }, 3000);
    };
    vwFrame.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') { vwTouched(); }
    });

    // клик по кадру = пауза/продолжить, то же делает кнопка
    var vwUserPaused = false;
    var vwSwitch = function () {
      if (vwVideo.paused) { vwPlay(); } else { vwVideo.pause(); }
      vwUserPaused = !vwVideo.paused ? false : true;
      vwTouched();
    };
    // слушаем всю рамку: поверх кадра лежит слой с кнопками, и клик
    // «по видео» на самом деле приходит в него
    vwFrame.addEventListener('click', function (e) {
      if (e.target.closest('.vw-sound')) { return; }
      vwSwitch();
    });
    var vwSyncBtn = function () {
      vwToggle.setAttribute('aria-pressed', vwVideo.paused ? 'true' : 'false');
      vwToggle.setAttribute('aria-label', vwVideo.paused ? 'Продолжить' : 'Пауза');
    };
    vwVideo.addEventListener('play', vwSyncBtn);
    vwVideo.addEventListener('pause', vwSyncBtn);

    vwSound.addEventListener('click', function () {
      vwVideo.muted = !vwVideo.muted;
      vwSound.setAttribute('aria-pressed', vwVideo.muted ? 'false' : 'true');
      vwSound.setAttribute('aria-label', vwVideo.muted ? 'Включить звук' : 'Выключить звук');
      if (vwVideo.paused) { vwPlay(); }
      vwTouched();
    });

    vw.querySelector('.vw-hide').addEventListener('click', function () {
      vwDismissed = true;
      vwVideo.pause();
      vw.hidden = true;
    });

    // меню правой кнопки на видео — это и есть «сохранить видео»
    vwFrame.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    vwVideo.addEventListener('dragstart', function (e) { e.preventDefault(); });
    // двойной клик в некоторых браузерах разворачивает видео на весь экран
    vwVideo.addEventListener('dblclick', function (e) { e.preventDefault(); });

    // за экраном видео не крутим — не тратим батарею и трафик
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { vwVideo.pause(); }
      else if (!vw.hidden && !vwUserPaused) { vwPlay(); }
    });
  }

})();
