# Sakura · Hexo 源工程

这里保存日记 Markdown、Hexo 配置、素材和当前页面设计的 `sakura` 主题。

- `hexo-source` 分支：可编辑的完整源码，换电脑时克隆这个分支。
- `master` 分支：Hexo 生成的网页，交给 GitHub Pages 发布，不在这里写日记。
- 没有找回旧电脑的源文件。本工程按 GitHub 上现存网页重建，恢复了唯一可查的 `Hello World` 文章；没有凭空补写其他日记。

## 换电脑后

安装 Node.js 24 LTS 和 Git，然后在 Git Bash 或 PowerShell 运行：

```sh
git clone --branch hexo-source https://github.com/SAKURA-love999/SAKURA-love999.github.io.git sakura-blog
cd sakura-blog
npm ci
npm run server
```

浏览器打开 <http://127.0.0.1:4173/>。预览期间保持终端运行，按 Ctrl+C 停止。

已克隆源码的电脑，在开始写作前先运行 `git pull --ff-only origin hexo-source`。不要同时在两台电脑上修改后直接覆盖。

## 写一篇日记

```sh
npm run new -- "my-diary"
```

命令会显示新文件的位置，通常为 `source/_posts/2026-11-06-my-diary.md`。日期以创建当天为准。文件名建议用英文短横线，标题可以写中文或日文。

```markdown
---
title: 今天的日记
date: 2026-11-06 20:00:00
updated: 2026-11-06 20:00:00
lang: zh-CN
cover: /imgs/diary/my-photo.jpg
categories:
  - 日常
tags:
  - 散步
---

今天的正文从这里开始。

## 一个小标题

可以使用 **粗体**、列表和图片。

![照片](/imgs/diary/my-photo.jpg)
```

- 图片放在 `source/imgs/diary/` 中，Markdown 中写 `/imgs/diary/文件名`。没有自己的封面时保留 `/imgs/default-cover.webp`。
- 日文正文把 `lang` 改为 `ja`。语言按钮只切换页面界面，不会自动翻译日记正文。
- `categories: []`、`tags: []` 表示暂不分类/打标签。
- 首页和日记列表只展示封面、标题和日期，不展示正文摘要。
- 新日记默认可点开。`Hello World` 的 `preview_link: false` 保留了首页不跳转的设置；其他日记不用加这项。
- 日期晚于当前时间的日记不会发布。

## 草稿

```sh
npm run new -- draft "unfinished-diary"
```

草稿在 `source/_drafts/`，不会被发布。写完后运行：

```sh
npx hexo publish unfinished-diary
```

## 保存源码并发布

先确认自己位于 `hexo-source` 分支：

```sh
git branch --show-current
git add .
git commit -m "Add diary"
git push origin hexo-source
npm run deploy
```

`npm run deploy` 会先生成并检查网页，再正常推送到 `master`，不会强制覆盖 Git 历史。认证使用本机的 Git/GitHub 登录，不需要把密码或令牌写进工程。发布需要网络和该仓库的推送权限。

**源码推送和网站发布是两步，两步都要做。** 只运行 deploy 不会自动保存新日记的 Markdown 到 GitHub。

部署后网站为 <https://SAKURA-love999.github.io/>。GitHub Pages 更新通常需要等待一会儿。

## 文件位置

| 内容 | 路径 |
| --- | --- |
| 日记 Markdown | `source/_posts/` |
| 草稿 | `source/_drafts/` |
| 图片/字体/音乐 | `source/imgs/`、`source/fonts/`、`source/music/` |
| 个人介绍/朋友/道具 | `source/about/`、`source/link/`、`source/tools/` |
| Hexo 配置 | `_config.yml` |
| 首页、文章、列表模板 | `themes/sakura/layout/` |
| 页面样式 | `themes/sakura/source/css/` |
| 语言、搜索、小游戏 | `themes/sakura/source/js/` |
| 新日记默认格式 | `scaffolds/post.md` |
| 生成的网页，不要直接编辑 | `public/` |

`npm run check` 检查生成结果和写作流程；`npm test` 也会测试不覆盖历史的部署流程。`public/`、`node_modules/`、数据库和部署缓存不会提交到源码分支。

字体沿用本机保存的 Kaisei Opti（日文）和思源宋体（中文），许可证保留在 `source/fonts/`；现有图片、音乐的使用权仍由站主自行确认。
