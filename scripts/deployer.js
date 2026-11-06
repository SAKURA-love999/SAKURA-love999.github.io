'use strict';

const { deploy } = require('../lib/deploy.cjs');

hexo.extend.deployer.register('sakura-git', function (options) {
  return deploy({
    baseDir: this.base_dir,
    publicDir: this.public_dir,
    repo: options.repo,
    branch: options.branch || 'master'
  });
});
