'use strict';

const pagination = require('hexo-pagination');

hexo.extend.generator.register('sakura-pages', function (locals) {
  return [
    ...pagination('log', locals.posts.sort('-date'), {
      perPage: this.config.per_page,
      layout: 'index',
      data: { title: '日記', diary: true, __index: true }
    }),
    { path: 'categories/index.html', layout: 'taxonomy', data: { title: '分類', kind: 'categories' } },
    { path: 'tags/index.html', layout: 'taxonomy', data: { title: 'タグ', kind: 'tags' } },
    { path: '.nojekyll', data: '' }
  ];
});
