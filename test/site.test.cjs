'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { load } = require('cheerio');
const project = path.resolve(__dirname, '..');
const output = path.join(project, 'public');

function page(file = 'index.html') {
  const html = fs.readFileSync(path.join(output, file), 'utf8');
  assert.ok(html.includes('id="site-data"'), 'Valid rendered theme: ' + file);
  return load(html);
}

function hexo(...args) {
  const result = execFileSync(process.execPath, [path.join(project, 'node_modules/hexo-cli/bin/hexo'), ...args], { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.doesNotMatch(result, /ERROR|FATAL/, result);
}

test('core routes render with the shared design and working assets', () => {
  for (const route of ['index.html', 'log/index.html', '2025/11/04/hello-world/index.html', 'archives/index.html', 'archives/2025/index.html', 'archives/2025/11/index.html', 'categories/index.html', 'tags/index.html', 'about/index.html', 'link/index.html', 'tools/index.html', '404.html']) {
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
    assert.equal(JSON.parse($('#site-data').text()).length, 1);
  }
  const css = fs.readFileSync(path.join(output, 'css/site.css'), 'utf8');
  for (const match of css.matchAll(/url\("([^"]+)"\)/g)) {
    assert.ok(fs.existsSync(path.resolve(output, 'css', match[1])), match[1]);
  }
  assert.ok(fs.existsSync(path.join(output, '.nojekyll')));
});

test('home preserves cover-only cards, linked Hello World, and localized game', () => {
  const $ = page();
  assert.equal($('.hero').length, 1);
  assert.equal($('.article-title').text(), 'Hello World');
  assert.equal($('.article-card .article-cover').is('a'), true);
  assert.equal($('.article-card .article-cover').attr('href'), '/2025/11/04/hello-world/');
  assert.equal($('.article-card p').length, 0);
  assert.equal($('.mini-game__title').attr('data-ja'), '遊んでみてね');
  assert.equal($('.mini-game__title').attr('data-zh'), '一起来玩吧！');
  assert.equal($('#fleepy-game').attr('tabindex'), '0');
  assert.equal($('#game-history-title').attr('data-ja'), '履歴');
  assert.equal($('#game-history-title').attr('data-zh'), '游玩记录');
  assert.equal($('#game-history-list').children().length, 0, 'Private records are never baked into the website');
  assert.equal($('#game-history-more').is('[hidden]'), true);
  assert.ok($('script[src="/js/game-history.js"]').index() < $('script[src="/js/game.js"]').index());
  assert.equal(page('log/index.html')('.hero').length, 0);
  const post = page('2025/11/04/hello-world/index.html');
  assert.equal(post('.post-heading').text(), 'Hello World');
  assert.equal(post('.post-content h2').text(), 'Quick Start');
  assert.equal(post('.post-content > p').first().text(), 'テスト');
  assert.equal(post('.post-date time').attr('datetime'), '2025-11-04');
  assert.equal(post('.mini-game').length, 0);
});

test('home, diary and archive entries all open the article', () => {
  const diary = page('log/index.html');
  const articlePath = '/2025/11/04/hello-world/';
  assert.equal(page()('.article-cover').attr('href'), articlePath);
  assert.equal(diary('.article-card .article-cover').is('a'), true);
  assert.equal(diary('.article-card .article-cover').attr('href'), articlePath);
  assert.equal(diary('.article-card p').length, 0);
  const archive = page('archives/index.html');
  assert.equal(archive('.archive-entry').attr('href'), articlePath);
  assert.equal(page(articlePath + 'index.html')('.post-content > p').first().text(), 'テスト');
});

test('new Markdown diaries populate lists, detail, taxonomy, archives and search; drafts stay private', () => {
  const owned = [];
  const title = '测试日记 </script><script>notExecutable()</script> "quotes"';
  try {
    for (let i = 0; i < 10; i++) {
      const file = path.join(project, 'source/_posts/2025-12-09-sakura-test-' + i + '.md');
      assert.ok(!fs.existsSync(file), 'Never replace an existing post');
      owned.push(file);
      fs.writeFileSync(file, '---\n' +
        'title: ' + JSON.stringify(i === 0 ? title : 'Test diary ' + i) + '\n' +
        'date: 2025-12-09 12:00:00\nupdated: 2025-12-09 12:00:00\n' +
        'lang: zh-CN\ncover: /imgs/default-cover.webp\n' +
        'categories: [test-category]\ntags: [test-tag]\n---\n' +
        '## TEST_MARKDOWN_HEADING\n\nnot-preview-in-card\n\n![image](/imgs/avatar.jpg)\n');
    }
    const draft = path.join(project, 'source/_drafts/sakura-test-fixture-draft.md');
    fs.mkdirSync(path.dirname(draft), { recursive: true });
    assert.ok(!fs.existsSync(draft));
    owned.push(draft);
    fs.writeFileSync(draft, '---\ntitle: PRIVATE_DRAFT\n---\nPrivate content.\n');
    hexo('generate');

    const $ = page();
    assert.equal($('.article-card').length, 10);
    assert.equal($('.article-card .article-cover').filter('a').length, 10);
    assert.doesNotMatch($('.article-card').text(), /not-preview-in-card/);
    assert.equal($('.mini-game').length, 0, 'Game appears only after the last diary');
    assert.equal(page('page/2/index.html')('.mini-game').length, 1);
    assert.equal(page('log/page/2/index.html')('.mini-game').length, 1);
    assert.equal(page('log/page/2/index.html')('.article-cover').attr('href'), '/2025/11/04/hello-world/');
    const search = JSON.parse($('#site-data').text());
    assert.equal(search.length, 11);
    assert.ok(search.some(post => post.title === title));
    assert.ok(search.every(post => post.title !== 'PRIVATE_DRAFT'));
    assert.equal($('script:not([src]):not(#site-data)').length, 0, 'Titles cannot inject scripts');
    const detail = page('2025/12/09/sakura-test-0/index.html');
    assert.equal(detail('.post-heading').text(), title);
    assert.equal(detail('.post-content h2').text(), 'TEST_MARKDOWN_HEADING');
    assert.equal(detail('.post-content').attr('lang'), 'zh-CN');
    assert.equal(detail('.post-content img').attr('src'), '/imgs/avatar.jpg');
    assert.equal(page('categories/test-category/index.html')('.archive-entry').length, 10);
    assert.equal(page('tags/test-tag/index.html')('.archive-entry').length, 10);
    assert.equal(page('archives/2025/12/index.html')('.archive-entry').length, 10);
    assert.equal($('.stats .stat strong').last().text(), '11');
    assert.equal($('.archive-pill').first().find('span').last().text(), '10');
  } finally {
    for (const file of owned) fs.unlinkSync(file);
    hexo('clean');
    hexo('generate');
  }
  assert.equal(JSON.parse(page()('#site-data').text()).length, 1, 'Final site contains no fixtures');
});
