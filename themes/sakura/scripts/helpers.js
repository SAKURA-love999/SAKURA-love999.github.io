'use strict';

hexo.extend.helper.register('sakura_posts', function () {
  return this.site.posts.sort('-date').toArray();
});

hexo.extend.helper.register('sakura_card_link', function (post) {
  return post.preview_link === false ? null : this.url_for(post.path);
});

hexo.extend.helper.register('sakura_cover', function (post) {
  const cover = post.cover || '/imgs/default-cover.webp';
  return /^https?:\/\//i.test(cover) ? cover : this.url_for(cover);
});

hexo.extend.helper.register('sakura_json', function (value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
});

hexo.extend.helper.register('sakura_latest_month', function () {
  const latest = this.site.posts.sort('-updated').first();
  return latest ? this.date(latest.updated, 'YYYY.MM') : '—';
});

hexo.extend.helper.register('sakura_open_days', function () {
  return Math.max(1, Math.floor((Date.now() - Date.parse('2025-11-04T00:00:00+09:00')) / 86400000) + 1);
});

hexo.extend.helper.register('sakura_months', function () {
  const months = new Map();
  this.site.posts.sort('-date').each(post => {
    const key = this.date(post.date, 'YYYY/MM');
    if (!months.has(key)) months.set(key, { path: 'archives/' + key + '/', label: this.date(post.date, 'YYYY年MM月'), count: 0 });
    months.get(key).count++;
  });
  return [...months.values()];
});
