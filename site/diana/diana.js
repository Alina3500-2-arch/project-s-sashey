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
