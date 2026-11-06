'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deploy } = require('../lib/deploy.cjs');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

test('deployment fast-forwards history, publishes only output, and is idempotent', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-deploy-test-'));
  try {
    const remote = path.join(temporary, 'remote.git');
    const baseDir = path.join(temporary, 'source');
    const publicDir = path.join(baseDir, 'public');
    fs.mkdirSync(publicDir, { recursive: true });
    git(temporary, 'init', '--bare', '--initial-branch=master', remote);
    git(baseDir, 'init', '--initial-branch=master');
    git(baseDir, 'config', 'user.name', 'Deploy Test');
    git(baseDir, 'config', 'user.email', 'test@example.invalid');
    fs.writeFileSync(path.join(baseDir, 'old.html'), 'old output');
    git(baseDir, 'add', 'old.html');
    git(baseDir, 'commit', '-m', 'Historical publication');
    git(baseDir, 'remote', 'add', 'origin', remote);
    git(baseDir, 'push', 'origin', 'master');
    const original = git(baseDir, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(publicDir, 'index.html'), 'new website');
    fs.writeFileSync(path.join(baseDir, 'private-source.md'), 'not published');
    const commit = deploy({ baseDir, publicDir, repo: remote, branch: 'master' });
    assert.equal(git(remote, 'rev-parse', 'master^'), original);
    assert.equal(git(remote, 'show', 'master:index.html'), 'new website');
    assert.equal(git(remote, 'ls-tree', '--name-only', 'master'), 'index.html');
    assert.equal(deploy({ baseDir, publicDir, repo: remote, branch: 'master' }), commit);
  } finally {
    if (path.dirname(temporary) !== os.tmpdir() || !path.basename(temporary).startsWith('sakura-deploy-test-')) throw new Error('Unsafe test cleanup');
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
