(() => {
  'use strict';
  const key = 'abiryvaPrivacyChoiceV1';
  const notice = document.getElementById('site-cookie-notice');
  let choice;
  try { choice = localStorage.getItem(key); } catch (_) { /* Choices still work for this page. */ }
  if (notice && !choice) notice.hidden = false;
  const saveChoice = value => {
    choice = value;
    try { localStorage.setItem(key, value); } catch (_) { /* Private browsing can disable storage. */ }
    if (notice) notice.hidden = true;
  };
  document.querySelectorAll('[data-consent]').forEach(button => button.addEventListener('click', () => {
    saveChoice(button.dataset.consent);
    if (choice === 'essential') {
      document.querySelectorAll('[data-booking-container]').forEach(el => el.replaceChildren());
      document.querySelectorAll('[data-load-booking]').forEach(el => { el.hidden = false; });
    }
  }));
  document.querySelectorAll('[data-cookie-settings]').forEach(button => button.addEventListener('click', () => {
    if (notice) { notice.hidden = false; notice.querySelector('button').focus(); }
  }));
  document.querySelectorAll('[data-load-booking]').forEach(button => button.addEventListener('click', () => {
    const container = button.closest('.site-booking').querySelector('[data-booking-container]');
    const iframe = document.createElement('iframe');
    iframe.title = 'Book a 30-minute consultation with Abiryva on Calendly';
    iframe.src = 'https://calendly.com/alahamhedge/30min?embed_domain=' + encodeURIComponent(location.hostname) + '&embed_type=Inline';
    iframe.loading = 'lazy';
    container.replaceChildren(iframe);
    button.hidden = true;
    // Explicitly loading the calendar is consent for this visit; no preference is silently persisted.
    if (notice) notice.hidden = true;
  }));
  const openService = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(id);
    if (target?.matches('details.premium-service-card')) target.open = true;
  };
  openService();
  window.addEventListener('hashchange', openService);

  const form = document.getElementById('enquiry-form');
  if (!form) return;
  const availability = document.querySelector('[data-enquiry-availability]');
  const status = document.getElementById('enquiry-status');
  let token;
  const selected = new URLSearchParams(location.search).get('service');
  if ([...form.elements.service.options].some(option => option.value === selected)) form.elements.service.value = selected;
  fetch('/api/enquiry', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Unavailable')))
    .then(data => {
      if (!data.available || !data.token) throw new Error('Unavailable');
      token = data.token;
      form.hidden = false;
      availability.hidden = true;
    })
    .catch(() => { availability.textContent = 'Please book a consultation above or email info@abiryva.com to discuss your requirements.'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    status.textContent = 'Sending your enquiry…';
    try {
      const data = Object.fromEntries(new FormData(form));
      data.consent = form.elements.consent.checked;
      data.token = token;
      const response = await fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Your enquiry could not be sent. Please try again or email info@abiryva.com.');
      status.textContent = 'Thank you. Your enquiry has been sent to our team.';
      form.reset();
      // Each completed enquiry needs a fresh token; a retry retains the old idempotency key.
      const refreshed = await fetch('/api/enquiry', { signal: AbortSignal.timeout(10000) }).then(r => r.json()).catch(() => null);
      if (refreshed?.token) token = refreshed.token;
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'We could not confirm delivery. Please retry; repeated attempts use the same reference to avoid duplicate emails.' : error.message;
    } finally { button.disabled = false; }
  });
})();
