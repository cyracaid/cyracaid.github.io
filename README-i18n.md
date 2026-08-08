# 网站结构说明

## 文件

```
index.html        页面骨架（175 行，不含内容）
styles.css        样式（从原来的 <style> 里原样搬出来的，没改设计）
app.js            渲染逻辑 + 语言切换 + 路由
i18n/langs.json   有哪几种语言
i18n/en.json      英文全部内容
i18n/cn.json      中文全部内容
i18n/ko.json      韩文全部内容
assets/           图片、CV（保持原样，不用动）
```

**原则：改文字只动 `i18n/*.json`，不用碰 HTML。**

## 语言怎么记住

- 网址里带 `?lang=cn` / `?lang=ko` / `?lang=en`
- 点语言按钮会自动写进网址，同时存进浏览器 localStorage
- 因为语言在 query string 里、路由在 `#` 里，进项目详情页 (`#/project/xxx`) 语言不会丢
- 第一次访问且没带 `?lang=`：按浏览器语言自动选中文／韩文，否则英文
- 可以直接分享带语言的链接，例如
  `https://cyracaid.github.io/?lang=ko#/project/ai-attitude-underestimation`

## 加一条 News

打开 `i18n/en.json`，找到 `news.recent`，在最前面加一项：

```json
{
  "date": "Aug 2026",
  "tagCls": "news-tag pub",
  "tagText": "Publication",
  "body": "<strong>标题</strong> — 正文，可以写 <em>斜体</em> 和 <a href=\"...\">链接</a>。"
}
```

`tagCls` 可选：`news-tag pub` / `role` / `poster` / `award` / `leave`（颜色不同）。
然后在 `cn.json`、`ko.json` 里加同一条的翻译。

## 加一种语言（比如日语）

1. 复制 `i18n/en.json` → `i18n/ja.json`，把值翻译掉
2. 在 `i18n/langs.json` 里加一行 `{"code": "ja", "label": "日本語"}`

**不用改 `app.js`。** 而且 `ja.json` 里没写或留空的字段会自动回退到英文，
所以可以先翻一半就上线，剩下的慢慢补。

## 预渲染（SEO）

`index.html` 里已经烤进了一份**英文版内容**，给不执行 JS 的爬虫看。
浏览器打开时 `app.js` 会覆盖掉它，所以真实访客看到的永远是 JSON 里的最新内容。

改完 `i18n/en.json` 后想同步这份静态副本：

```
npm install jsdom     # 只需一次
node prerender.js
```

**不跑也没关系** —— 访客看到的一定是最新的，只有爬虫会看到旧一点的版本。

中文／韩文版本没有烤进 HTML。Googlebot 会执行 JS，所以那两个语言最终也能被索引，
只是慢一些。如果以后想让中韩版独立被索引得更好，正确做法是生成 `/zh/`、`/ko/`
两个真实目录——那是另一个构建步骤，需要时再加。

## 本地预览

不能直接双击 `index.html` 打开（浏览器会拒绝读取 `i18n/*.json`）。
在文件夹里开个终端跑：

```
python3 -m http.server
```

然后访问 http://localhost:8000

## 这次改动记录

**修掉的 bug**

- `index.html` 里中文块的 `<div class="` 属性被注释截断、韩文块开标签整个丢失
  → 三种语言同时显示、页面上出现裸露的 `lang-content" data-lang="ko">` 字符
- `#research` `#news` `#publications` 等 id 重复三次（HTML 非法，锚点跳转不确定）
- `<main>` 和 `.page-wrap` 没有闭合标签
- 项目详情页读 `p.links` 但 `PROJECTS` 里根本没有这个字段 → 点进去 JS 崩溃、白屏
- 研究方向的标签 `.research-areas` 容器丢了，标签没排版
- 页尾有一段孤立的 `/div>` + "콘텐츠 준비 중" 残留，已删除
- 项目页原本隐藏顶栏，导致子页面上没法切语言 → 改成保留顶栏

**补齐的翻译**（原来中韩版仍是英文，需要你 review）

- 全部 7 段 Experience 的 14 条 bullet
- 4 条 News（ABCT 海报、JASP、BJSP、CUHK 海报）
- 中韩版研究简介开头残留的 "My research sits at the intersection of…"
- 教育经历：`交换 Student in Arts & Sciences`、`2025 年 1 月 – Jun 2025`、
  `May 2025 – Aug 2025` 等中英混排
- 机构名：Stanford / Penn（中韩）、上海 AI Lab / WashU / 浙科大 / 港中大（韩）
- 页尾标题 `Let's Connect` → 联系我 / 연락하기
- 导航、侧栏标签、项目页小标题（概览／研究动机／…）

**统一的数据（请确认）**

- 项目页作者原本写 `Cai Dong, Sijing Chen`，与 Publications 列表里的
  `Rongmian Huo, Shasha Yang, Cai Dong, Sijing Chen` 不一致 → 统一成后者
- `inequality-proenvironment` 的年份原本项目页写 2025、列表写 2024 → 统一成 2024
- 论文标题、期刊名、作者名三种语言保持英文（学术惯例）

**SEO**

- `<title>` / description / og:locale 跟随语言切换
- hreflang 改为指向 `?lang=en` / `?lang=cn` / `?lang=ko`
- 页面上同一时刻只有一种语言的文本，爬虫不会再读到三语混排
