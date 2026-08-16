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

    // Шаг пройден, если в нём отмечен хотя бы один вариант.
    // На последнем шаге просим имя и телефон.
    var stepFilled = function (step) {
      if (step.querySelector('.quiz-fields')) {
        var name = step.querySelector('input[name="Имя"]');
        var tel = step.querySelector('input[name="Телефон"]');
        if (!name.value.trim()) { return 'Напишите, как к вам обращаться.'; }
        if (tel.value.replace(/\D/g, '').length < 10) { return 'Оставьте телефон или WhatsApp, чтобы мы могли ответить.'; }
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
    quiz.addEventListener('submit', function (e) {
      var problem = stepFilled(steps[steps.length - 1]);
      if (problem) { e.preventDefault(); showError(problem); }
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
  if (guide && firstCard) {
    var cards = document.querySelectorAll('.level-card');

    // ВАЖНО: высоты здесь меряются offsetHeight/offsetTop, а НЕ
    // getBoundingClientRect(). Прямоугольник из getBoundingClientRect
    // отдаётся с учётом трансформаций, и в предпросмотре ПК-версии
    // (pc.html держит страницу в кадре с transform:scale) Safari на
    // iPhone возвращал искажённые числа. Скрипт раздувал строки, за ними
    // карточки — колонки прайса уходили вниз на несколько пустых экранов,
    // и дальше блока было не пролистать. offsetHeight — целочисленная
    // метрика раскладки, трансформации на неё не влияют ни в одном
    // браузере, поэтому результат одинаков и на мониторе, и в кадре.
    var boxH = function (el) { return el.offsetHeight; };
    var boxTop = function (el) {
      var y = 0;
      while (el) { y += el.offsetTop; el = el.offsetParent; }
      return y;
    };

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
          if (rows[i]) { tallest = Math.max(tallest, boxH(rows[i])); }
        });
        // Строка прайса — это одна-две строки текста. Если намерили больше,
        // измерение врёт (так было в кадре предпросмотра на iPhone) —
        // тогда лучше оставить высоты как есть, чем раздуть карточки.
        if (!tallest || tallest > 240) { continue; }
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
        natural = Math.max(natural, boxH(card));
      });
      // Карточка тарифа не может быть выше экрана монитора. Если намерили
      // больше — измерение врёт; ставить такую «лесенку» нельзя, иначе
      // прайс растянется на несколько пустых экранов.
      if (!natural || natural > 900) {
        cards.forEach(function (card) { card.style.minHeight = ''; });
        return;
      }
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
      items.forEach(function (li, i) {
        var h = boxH(rows[i]);
        li.style.height = (h && h <= 240) ? h + 'px' : '';
      });
      if (!levelsCopy) { return; }
      levelsCopy.style.marginTop = '0px';
      var shift = boxTop(rows[0]) - boxTop(items[0]);
      // Сдвиг левой колонки — десятки пикселей. Сотни означают, что мерить
      // сейчас нечем (страница ещё собирается): лучше ничего не двигать.
      levelsCopy.style.marginTop = Math.abs(shift) > 400 ? '' : shift + 'px';
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

})();
