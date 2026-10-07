(() => {
  'use strict';
  const slider = document.querySelector('.hero-client-slider .swiper');
  if (slider && typeof Swiper !== 'undefined') {
    new Swiper(slider, { slidesPerView: 3, speed: 1000, spaceBetween: 30, loop: true,
      autoplay: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { delay: 5000 },
      breakpoints: { 768: { slidesPerView: 4 } } });
  }
  const items = [...document.querySelectorAll('.our-service-list .service-item')];
  items.forEach(item => item.addEventListener('mouseenter', () => {
    items.forEach(other => other.classList.toggle('active', other === item));
  }));
})();
