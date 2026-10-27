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
      document.querySelectorAll('[data-booking-verification]').forEach(el => { el.hidden = false; });
    }
  }));
  document.querySelectorAll('[data-cookie-settings]').forEach(button => button.addEventListener('click', () => {
    if (notice) { notice.hidden = false; notice.querySelector('button').focus(); }
  }));
  document.querySelectorAll('[data-booking-verification]').forEach(bookingForm => {
    let challenge;
    const status = bookingForm.querySelector('[data-verification-status]');
    const step = bookingForm.querySelector('[data-code-step]');
    const send = bookingForm.querySelector('[type=submit]');
    const reset = () => {
      challenge = null;
      step.hidden = true;
      send.hidden = false;
      bookingForm.elements.code.required = false;
      bookingForm.elements.code.value = '';
    };
    bookingForm.elements.email.addEventListener('input', reset);
    bookingForm.querySelector('[data-resend-code]').addEventListener('click', () => { reset(); bookingForm.requestSubmit(); });
    bookingForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!bookingForm.reportValidity()) return;
      const buttons = bookingForm.querySelectorAll('button');
      buttons.forEach(button => { button.disabled = true; });
      const verifying = Boolean(challenge);
      status.textContent = verifying ? 'Checking your code…' : 'Sending your code…';
      try {
        if (!/^https?:$/.test(location.protocol)) throw new Error('Email verification requires the deployed website. Please email info@abiryva.com for help booking.');
        const response = await fetch('/api/booking-verification', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: verifying ? 'verify' : 'send', email: bookingForm.elements.email.value, code: bookingForm.elements.code.value, challenge }),
          signal: AbortSignal.timeout(30000)
        });
        if (!(response.headers.get('content-type') || '').includes('application/json')) {
          throw new Error('The booking verification service is not available on this website yet. Please email info@abiryva.com for help booking.');
        }
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Verification unavailable. Please try again.');
        if (!verifying) {
          challenge = result.challenge;
          step.hidden = false;
          send.hidden = true;
          bookingForm.elements.code.required = true;
          status.textContent = 'Code sent. Check your inbox and spam folder. You can request another code after one minute.';
          bookingForm.elements.code.focus();
        } else {
          const container = bookingForm.closest('.site-booking').querySelector('[data-booking-container]');
          const frame = document.createElement('iframe');
          frame.title = 'Book a 30-minute discovery call with Abiryva on Calendly';
          frame.src = result.bookingUrl + '&embed_domain=' + encodeURIComponent(location.hostname) + '&embed_type=Inline';
          const link = document.createElement('a');
          link.href = result.bookingUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.className = 'site-secondary-button'; link.textContent = 'Open verified booking calendar ↗';
          container.replaceChildren(link, frame);
          bookingForm.hidden = true;
          if (notice) notice.hidden = true;
        }
      } catch (error) { status.textContent = error.name === 'TimeoutError' ? 'Request timed out. Please try again shortly.' : error instanceof TypeError ? 'Could not reach the verification service. Please check your connection or email info@abiryva.com for help booking.' : error.message; }
      finally { buttons.forEach(button => { button.disabled = false; }); }
    });
  });
  const openService = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const aliases = {'technology-advisory':'digital-transformation','ai-automation':'ai-governance','cloud-technology':'cloud-security','digital-government':'digital-transformation','business-resilience':'resilience','managed-advisory':'cybersecurity','security-operations':'resilience','network-security':'cloud-security'};
    id = aliases[id] || id;
    const target = document.getElementById(id);
    if (target?.matches('details.premium-service-card')) { target.open = true; target.scrollIntoView({block:'start'}); }
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
