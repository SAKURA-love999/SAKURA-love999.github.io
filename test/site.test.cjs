'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const Hexo = require('hexo');
const { load } = require('cheerio');
const project = path.resolve(__dirname, '..');
const output = path.join(project, 'public');
let published;
let indexPerPage;
let diaryPerPage;

test.before(async () => {
  const site = new Hexo(project, { silent: true });
  try {
    await site.init();
    await site.load();
    const urlFor = site.extend.helper.get('url_for').bind(site);
    indexPerPage = site.config.index_generator.per_page;
    diaryPerPage = site.config.per_page;
    published = site.locals.get('posts').sort('-date').toArray().map(post => ({
      title: post.title,
      path: urlFor(post.path),
      cover: /^https?:\/\//i.test(post.cover || '') ? post.cover : urlFor(post.cover || '/imgs/default-cover.webp'),
      linked: post.preview_link !== false,
      date: post.date.format('YYYY-MM-DD'),
      month: post.date.format('YYYY/MM'),
      bodyText: load(post.content, null, false).text().trim()
    }));
  } finally {
    await site.exit();
  }
});

function page(file = 'index.html') {
  const route = decodeURI(file).replace(/^\/+/, '');
  const filename = route.endsWith('.html') ? route : path.posix.join(route, 'index.html');
  const html = fs.readFileSync(path.join(output, filename), 'utf8');
  assert.ok(html.includes('id="site-data"'), 'Valid rendered theme: ' + file);
  return load(html);
}

function hexo(...args) {
  const result = execFileSync(process.execPath, [path.join(project, 'node_modules/hexo-cli/bin/hexo'), ...args], { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.doesNotMatch(result, /ERROR|FATAL/, result);
}

function listingPages(first) {
  const pages = [];
  const visited = new Set();
  let route = first;
  while (route) {
    assert.ok(!visited.has(route), 'Pagination must not loop: ' + route);
    visited.add(route);
    const $ = page(route);
    pages.push($);
    route = $('.pagination a[rel="next"]').attr('href');
  }
  return pages;
}

function checkDiaryListing(first, posts, perPage, diary = false) {
  const pages = listingPages(first);
  const size = perPage > 0 ? perPage : Math.max(1, posts.length);
  assert.equal(pages.length, Math.max(1, Math.ceil(posts.length / size)));
  pages.forEach(($, pageIndex) => {
    const expected = posts.slice(pageIndex * size, (pageIndex + 1) * size);
    const cards = $('.article-card');
    assert.equal(cards.length, expected.length);
    assert.equal($('.hero').length, !diary && pageIndex === 0 ? 1 : 0);
    assert.equal($('.article-card p').length, 0, 'Previews never include body paragraphs');
    cards.each((index, card) => {
      const post = expected[index];
      const cover = $(card).find('.article-cover');
      assert.equal($(card).find('.article-title').text(), post.title);
      assert.equal(cover.find('img').attr('src'), post.cover);
      assert.equal(cover.is('a'), post.linked);
      assert.equal(cover.attr('href'), post.linked ? post.path : undefined);
    });
    assert.equal($('.mini-game').length, pageIndex === pages.length - 1 ? 1 : 0,
      'Game appears only after the last diary page');
  });
  return pages;
}

function archivePaths(first) {
  return listingPages(first).flatMap($ => $('.archive-entry').map((_, entry) => $(entry).attr('href')).get());
}

test('core routes render with the shared design and working assets', () => {
  const routes = new Set(['index.html', 'log/index.html', 'archives/index.html',
    'categories/index.html', 'tags/index.html', 'about/index.html', 'link/index.html', 'tools/index.html', '404.html']);
  for (const post of published) {
    routes.add(post.path);
    routes.add('archives/' + post.month.slice(0, 4) + '/');
    routes.add('archives/' + post.month + '/');
  }
  const searchPosts = published.map(({ title, path, cover }) => ({ title, path, cover }));
  for (const route of routes) {
    const $ = page(route);
    assert.equal($('.site-header').length, 1);
    assert.equal($('.profile-name').attr('data-ja'), 'さくら');
    assert.equal($('.profile-name').attr('data-zh'), '樱');
    assert.equal($('[data-lang-btn="zh"]').text(), '简体中文');
    assert.equal($('.nav-links a').first().attr('href'), '/');
    $('img[src], script[src], link[href], source[src]').each((_, element) => {
      const url = $(element).attr('src') || $(element).attr('href');
      if (/^https?:/.test(url)) return;
      assert.ok(url.startsWith('/'), 'Nested-page-safe URL: ' + url);
      assert.ok(fs.existsSync(path.join(output, decodeURI(url))), 'Asset exists: ' + url);
    });
    assert.deepEqual(JSON.parse($('#site-data').text()), searchPosts);
  }
  const css = fs.readFileSync(path.join(output, 'css/site.css'), 'utf8');
  for (const match of css.matchAll(/url\("([^"]+)"\)/g)) {
    assert.ok(fs.existsSync(path.resolve(output, 'css', match[1])), match[1]);
  }
  assert.ok(fs.existsSync(path.join(output, '.nojekyll')));
});

test('home and diary preserve linked cover-only cards and the localized game', () => {
  const homePages = checkDiaryListing('index.html', published, indexPerPage);
  checkDiaryListing('log/index.html', published, diaryPerPage, true);
  const $ = homePages.at(-1);
  assert.equal($('.mini-game__title').attr('data-ja'), '遊んでみてね');
  assert.equal($('.mini-game__title').attr('data-zh'), '一起来玩吧！');
  assert.equal($('#fleepy-game').attr('tabindex'), '0');
  assert.equal($('#game-history-title').attr('data-ja'), '履歴');
  assert.equal($('#game-history-title').attr('data-zh'), '游玩记录');
  assert.equal($('#game-history-list').children().length, 0, 'Private records are never baked into the website');
  assert.equal($('#game-history-more').is('[hidden]'), true);
  assert.ok($('script[src="/js/game-history.js"]').index() < $('script[src="/js/game.js"]').index());
});

test('archives and article pages match the current Markdown instead of fixed sample content', () => {
  assert.deepEqual(archivePaths('archives/index.html').sort(), published.map(post => post.path).sort());
  for (const post of published) {
    const $ = page(post.path);
    assert.equal($('.post-heading').text(), post.title);
    assert.equal($('.post-date time').attr('datetime'), post.date);
    assert.equal($('.post-cover').attr('src'), post.cover);
    assert.equal($('.post-content').text().trim(), post.bodyText);
    assert.equal($('.mini-game').length, 0);
  }
});

test('new Markdown diaries populate lists, detail, taxonomy, archives and search; drafts stay private', () => {
  const owned = [];
  const title = '测试日记 </script><script>notExecutable()</script> "quotes"';
  const fixture = 'sakura-test-' + process.pid;
  const fixtureCount = Math.max(10, indexPerPage + 1, diaryPerPage + 1);
  const category = fixture + '-category';
  const tag = fixture + '-tag';
  const expectedPaths = Array.from({ length: fixtureCount }, (_, i) => '/' + fixture + '/diary-' + i + '/');
  try {
    for (let i = 0; i < fixtureCount; i++) {
      const file = path.join(project, 'source/_posts/' + fixture + '-' + i + '.md');
      assert.ok(!fs.existsSync(file), 'Never replace an existing post');
      assert.ok(!published.some(post => post.path === expectedPaths[i]), 'Never reuse an existing article URL');
      fs.writeFileSync(file, '---\n' +
        'title: ' + JSON.stringify(i === 0 ? title : 'Test diary ' + i) + '\n' +
        'date: 2000-01-01 12:00:00\nupdated: 2000-01-01 12:00:00\n' +
        'permalink: ' + fixture + '/diary-' + i + '/\n' +
        'lang: zh-CN\ncover: /imgs/default-cover.webp\n' +
        'categories: [' + category + ']\ntags: [' + tag + ']\n---\n' +
        '## TEST_MARKDOWN_HEADING\n\nnot-preview-in-card\n\n' +
        '<span style="color:#b24564;font-size:20px;">Styled text</span>\n\n' +
        '<p style="font-size:18px;line-height:1.9;">Styled paragraph</p>\n\n' +
        '![image](/imgs/avatar.jpg)\n', { flag: 'wx' });
      owned.push(file);
    }
    const draft = path.join(project, 'source/_drafts/' + fixture + '-draft.md');
    fs.mkdirSync(path.dirname(draft), { recursive: true });
    assert.ok(!fs.existsSync(draft));
    fs.writeFileSync(draft, '---\ntitle: ' + fixture + '-PRIVATE_DRAFT\n---\nPrivate content.\n', { flag: 'wx' });
    owned.push(draft);
    hexo('generate');

    const $ = page();
    const search = JSON.parse($('#site-data').text());
    assert.equal(search.length, published.length + fixtureCount);
    assert.ok(search.some(post => post.title === title));
    assert.ok(search.every(post => post.title !== fixture + '-PRIVATE_DRAFT'));
    for (const route of expectedPaths) assert.ok(search.some(post => post.path === route), route);
    const posts = search.map(post => ({ ...post, linked: published.find(original => original.path === post.path)?.linked ?? true }));
    for (const first of ['index.html', 'log/index.html']) {
      const pages = checkDiaryListing(first, posts, first === 'index.html' ? indexPerPage : diaryPerPage, first.startsWith('log/'));
      for (const listing of pages) assert.doesNotMatch(listing('.article-card').text(), /not-preview-in-card/);
    }
    assert.equal($('script:not([src]):not(#site-data)').length, 0, 'Titles cannot inject scripts');
    const detail = page(expectedPaths[0]);
    assert.equal(detail('.post-heading').text(), title);
    assert.equal(detail('.post-content h2').text(), 'TEST_MARKDOWN_HEADING');
    assert.equal(detail('.post-content').attr('lang'), 'zh-CN');
    assert.equal(detail('.post-content img').attr('src'), '/imgs/avatar.jpg');
    assert.equal(detail('.post-content span[style]').attr('style'), 'color:#b24564;font-size:20px;');
    assert.equal(detail('.post-content p[style]').attr('style'), 'font-size:18px;line-height:1.9;');
    assert.equal(detail('script:not([src]):not(#site-data)').length, 0);
    assert.deepEqual(archivePaths('categories/' + category + '/').sort(), [...expectedPaths].sort());
    assert.deepEqual(archivePaths('tags/' + tag + '/').sort(), [...expectedPaths].sort());
    const monthPaths = published.filter(post => post.month === '2000/01').map(post => post.path);
    assert.deepEqual(archivePaths('archives/2000/01/').sort(), monthPaths.concat(expectedPaths).sort());
    assert.equal(Number($('.stats .stat strong').last().text()), search.length);
    const monthPill = $('.archive-pill').filter((_, pill) => $(pill).attr('href') === '/archives/2000/01/');
    assert.equal(Number(monthPill.find('span').last().text()), monthPaths.length + fixtureCount);
  } finally {
    for (const file of owned) fs.unlinkSync(file);
    hexo('clean');
    hexo('generate');
  }
  assert.deepEqual(JSON.parse(page()('#site-data').text()),
    published.map(({ title, path, cover }) => ({ title, path, cover })), 'Final site contains no fixtures');
});
