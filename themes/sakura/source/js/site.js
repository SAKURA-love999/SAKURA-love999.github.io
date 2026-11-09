(() => {
  'use strict';
  const posts = JSON.parse(document.querySelector('#site-data').textContent);
  const input = document.querySelector('#search-input');
  const results = document.querySelector('#search-results');
  const list = document.querySelector('#search-list');
  const header = document.querySelector('.site-header');
  let language = 'ja';

  function renderSearch() {
    const keyword = input.value.trim().toLocaleLowerCase();
    list.replaceChildren();
    if (!keyword) { results.classList.remove('is-open'); return; }
    const matches = posts.filter(post => post.title.toLocaleLowerCase().includes(keyword));
    for (const post of matches) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'search-result';
      link.href = post.path;
      const image = document.createElement('img');
      image.src = post.cover;
      image.alt = '';
      const title = document.createElement('span');
      title.textContent = post.title;
      link.append(image, title);
      item.append(link);
      list.append(item);
    }
    if (!matches.length) {
      const item = document.createElement('li');
      item.textContent = language === 'ja' ? '記事が見つかりません' : '没有搜索到内容';
      list.append(item);
    }
    results.classList.add('is-open');
  }

  function setLanguage(value) {
    language = value === 'zh' ? 'zh' : 'ja';
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'ja';
    document.querySelectorAll('[data-ja][data-zh]').forEach(node => { node.textContent = node.dataset[language]; });
    document.querySelectorAll('[data-lang-btn]').forEach(button => {
      const active = button.dataset.langBtn === language;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    input.placeholder = input.dataset[language === 'ja' ? 'placeholderJa' : 'placeholderZh'];
    document.querySelectorAll('[data-start-date]').forEach(node => {
      const days = Math.max(1, Math.floor((Date.now() - Date.parse(node.dataset.startDate + 'T00:00:00+09:00')) / 86400000) + 1);
      node.textContent = days + (language === 'ja' ? ' 日' : ' 天');
    });
    try { localStorage.setItem('sakura-language', language); } catch {}
    if (results.classList.contains('is-open')) renderSearch();
    document.dispatchEvent(new CustomEvent('sakura:languagechange'));
  }

  let saved;
  try { saved = localStorage.getItem('sakura-language'); } catch {}
  setLanguage(saved);
  document.querySelectorAll('[data-lang-btn]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.langBtn)));
  document.querySelector('#search-form').addEventListener('submit', event => { event.preventDefault(); renderSearch(); });
  input.addEventListener('input', renderSearch);
  document.querySelector('#close-search').addEventListener('click', () => { results.classList.remove('is-open'); input.focus(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') results.classList.remove('is-open'); });
  document.addEventListener('click', event => { if (!event.target.closest('.search')) results.classList.remove('is-open'); });
  document.querySelector('#backtop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  new ResizeObserver(() => document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px')).observe(header);
  let lastY = window.scrollY;
  let direction = 0;
  let distance = 0;
  window.addEventListener('scroll', () => {
    const y = Math.max(0, window.scrollY);
    const delta = y - lastY;
    const nextDirection = Math.sign(delta);
    if (nextDirection && nextDirection !== direction) distance = 0;
    direction = nextDirection || direction;
    distance += Math.abs(delta);
    header.classList.toggle('is-scrolled', y > 8);
    if (y < 24 || (direction < 0 && distance > 18)) header.classList.remove('is-hidden');
    else if (direction > 0 && distance > 8 && !header.querySelector(':focus-visible')) header.classList.add('is-hidden');
    lastY = y;
  }, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
})();
