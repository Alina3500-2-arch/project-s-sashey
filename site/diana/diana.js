// Мобильное меню + подсветка текущей вкладки.
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

  // Формы в прототипе ничего не отправляют.
  document.querySelectorAll('form[data-proto]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = f.querySelector('.form__note');
      if (note) note.textContent = 'Прототип: форма не отправляется. Здесь будет запись в CRM / Telegram.';
    });
  });
});
