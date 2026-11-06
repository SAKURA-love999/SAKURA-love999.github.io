'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function deploy({ baseDir, publicDir, repo, branch }) {
  if (!repo || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(branch)) throw new Error('Invalid deployment configuration.');
  if (!fs.existsSync(path.join(publicDir, 'index.html'))) throw new Error('Run npm run check before deploying.');
  const author = { name: git(baseDir, ['config', 'user.name']), email: git(baseDir, ['config', 'user.email']) };
  const cache = path.resolve(baseDir, '.cache');
  fs.mkdirSync(cache, { recursive: true });
  const checkout = fs.mkdtempSync(path.join(cache, 'deploy-'));
  // Each deploy starts at the current remote commit; a concurrent update rejects the normal push.
  try {
    git(baseDir, ['clone', '--single-branch', '--branch', branch, '--', repo, checkout]);
    for (const entry of fs.readdirSync(checkout)) {
      if (entry === '.git') continue;
      const target = path.resolve(checkout, entry);
      if (!target.startsWith(checkout + path.sep)) throw new Error('Unsafe deployment path.');
      fs.rmSync(target, { recursive: true, force: true });
    }
    for (const entry of fs.readdirSync(publicDir)) {
      if (entry === '.git') throw new Error('A generated site must not contain .git.');
      fs.cpSync(path.join(publicDir, entry), path.join(checkout, entry), { recursive: true, verbatimSymlinks: true });
    }
    git(checkout, ['config', 'user.name', author.name]);
    git(checkout, ['config', 'user.email', author.email]);
    git(checkout, ['add', '--all']);
    if (git(checkout, ['diff', '--cached', '--name-only'])) {
      git(checkout, ['commit', '-m', 'Publish Hexo site']);
      git(checkout, ['push', 'origin', 'HEAD:' + branch]);
    }
    const commit = git(checkout, ['rev-parse', 'HEAD']);
    console.log('Published ' + branch + ': ' + commit);
    return commit;
  } finally {
    if (path.dirname(checkout) !== cache || !path.basename(checkout).startsWith('deploy-')) throw new Error('Unsafe cache cleanup.');
    fs.rmSync(checkout, { recursive: true, force: true });
  }
}

module.exports = { deploy };
