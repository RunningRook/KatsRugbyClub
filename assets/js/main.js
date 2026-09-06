// Kats Rugby Club — shared site behaviour
// Mobile nav toggle + lightweight contact/registration form handling.
// No backend required: forms post to Formspree (see the HTML comments
// next to each <form> for where to drop in the club's own endpoint).

document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close the mobile menu after a nav link is tapped.
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Progressive enhancement for any form with [data-ajax-form]:
  // submit via fetch so we can show an inline "Thanks!" message instead
  // of a full page reload/redirect. Falls back to a normal POST (and
  // Formspree's own thank-you page) if JS is unavailable.
  document.querySelectorAll('form[data-ajax-form]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      // Skip AJAX handling entirely for the placeholder endpoint so the
      // repo doesn't appear "broken" before the club swaps in a real one.
      if (form.action.indexOf('YOUR_FORM_ID') !== -1) {
        return;
      }

      event.preventDefault();
      var status = form.querySelector('.form-success');
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      })
        .then(function (response) {
          if (response.ok) {
            form.reset();
            if (status) status.style.display = 'block';
          } else {
            alert('Sorry, something went wrong sending your message. Please try again or email us directly.');
          }
        })
        .catch(function () {
          alert('Sorry, something went wrong sending your message. Please try again or email us directly.');
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  });
});
