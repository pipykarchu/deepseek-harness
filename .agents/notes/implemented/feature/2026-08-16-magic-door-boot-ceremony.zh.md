# Agent Note: 魔法之门启动仪式——加载页变成点击水晶开启的传送门

Status: implemented

[English](2026-08-16-magic-door-boot-ceremony.md) | 中文

## 问题

外壳启动门禁（`packages/client/web/src` 的 `AppRoot`）在插件树加载时渲染一个中性 spinner 卡片配 "HARNESS" 字标，启动一旦 settle（`loader.await()` + 全 ACTIVE 扫描）就一次性切换到真 UI。settle 可能在用户视线落到页面前就完成，于是加载瞬间一闪而过，进入应用毫无仪式感——功能上没问题，但产品想要一个有主题、品牌优先的入口（"皮玺玉紫色魔法少女"调性），同时仍要尊重既有的门禁契约：仅 status 永不开门，单项失败要保留醒目报告而非部分 UI。

挑战在于加一个点击驱动的仪式，却不削弱该契约、不破坏外壳自给自足：加载页仍必须零插件依赖渲染（它要报告它所依赖系统的失败），所以仪式不能引入资源拉取、动画库或任何插件包。

## 决策

`AppRoot` 变成由内核自有状态加定时过渡驱动的四阶段状态机——无新 props、无新依赖，所有视觉纯 CSS：

1. **charging（充能）**——悬浮水晶配双层魔法阵环旋转，最少停留 `LOADING_MS`（2.2 s），让"中间先加载"瞬间即便启动瞬时也能读到。
2. **closed（闭合）**——充能收束成闭合的大门（上扇、下扇），身后有缓慢旋转的魔法阵；中间水晶是唯一可交互元素。
3. **opening（开门）**——点击水晶触发四散爆发（扇翅蝴蝶、发光光点、下落花瓣、上升仙气——全是 CSS，由种子伪随机确定性生成，重渲染不抖动），魔法阵加速旋转并消散，门板带扫光以 3D 翻开（上扇向上、下扇向下），身后的传送门淡入。
4. **revealed（显露）**——传送门显示漩涡、光晕与欢迎语（"欢迎回来，魔法师"）；尚未 settle 的启动显示"正在唤醒世界…"直至 settle 到达。

真 UI 只在门已开**且**启动已 settle 后进入。已 settle 但用户尚未开门的启动会在显露的传送门前等这一手势；门先于 settle 打开时则在传送门前等 settle。任一顺序都一次性切换到真 UI，门禁契约因此成立——仅 status 仍永不开门，`renderApp` 恰好调用一次。

### 自给自足保留

所有视觉纯 CSS：渐变、`clip-path`、`conic-gradient` 环、`mask`、`box-shadow`、keyframes，以及 CSS 自定义属性（`--p-angle`、`--p-distance`、`--p-size`、`--p-delay`）驱动种子爆发。外壳不对任何插件包值导入、不拉取任何资源，于是加载页在（尤其是）插件失败时仍能渲染。fail-loud 分支不变：单项失败或启动拒绝都保留加载页与逐项醒目报告，完全绕过仪式。

### 计算背景仍是单色

启动页绘制固定的紫色夜空，独立于持久化的主题 token：`background-color` 是 e2e 断言的计算单色面（`#140a2e`），紫色渐变住 `background-image`。`data-ds-dark-theme` 属性与 `colorScheme` 仍跟随持久化偏好，所以深色主题契约 intact；只有加载页自身调色板换成了主题色。

### 桌面启动器

仓库根附带 PowerShell 启动器（`magic-door-launcher.ps1`）与生成的紫色水晶图标（`magic-door.ico`）；桌面快捷方式（`魔法之门 DeepSeek Harness.lnk`）指向该启动器，端口空闲时启动 `dsh web --port 3080 --host 127.0.0.1` 再打开浏览器。这些是便利入口，不是运行时代码。

## 后果

- 加载页现在拥有独立于主题 token 的固定紫色调性；想让启动页重新跟随 `--dsw-alias-bg-base` 的部署需回退 `AppRoot.module.css`。`data-ds-dark-theme` 属性与 `colorScheme` 仍跟随持久化偏好，深色主题契约因此 intact。
- 真 UI 不再在启动 settle 瞬间进入，而是等水晶点击。无头或脚本化启动若从不点击会停在显露的传送门——作为主题入口可接受，但日后任何想不经交互直接进真 UI 的自动化必须点击水晶（或日后经 `seam` 注入的跳过），不能只靠 settle。
- 仪式在真实启动之上叠加 `LOADING_MS + OPENING_MS + REVEAL_MS` 的感知延迟；各阶段与启动 settle 并行，所以慢启动时仪式是免费的，但快启动时用户会看到完整仪式。

## 测试

外壳自有门禁语义由 `packages/client/web/tests/app-root.client.spec.tsx` 用 fake timers 驱动阶段时长钉住：充能页从不调用 `renderApp`；仅 status 永不开门；失败项与启动失败报告保持醒目；仅 settle 不进入（门等水晶点击）；已 settle 时点击水晶一次性切换到真 UI；门先于 settle 打开时在传送门前等 settle 到达。完整浏览器链（真实模块系统 + vendored Loader + bundles）仍归 e2e。`apps/web/tests/settings-chrome.e2e.ts` 断言加载页计算背景色（`rgb(20, 10, 46)`）及持久化深色偏好仍设 `data-ds-dark-theme` 与 `colorScheme: dark`。

## 权衡过的替代方案

- **settle 即自动进入，仪式作为可跳过的覆盖层。** 否决：产品要的是水晶点击即入口，而非用户可能错过的前奏。让 settle 等手势保证每次启动都有仪式。
- **动画库（GSAP/anime.js）。** 基于外壳自给自足否决：加载页不能依赖插件包，且 keyframe CSS 覆盖所需全部动作（四散、旋转、3D 翻开、扫光），无需运行时依赖或资源拉取。
- **为门、传送门、水晶生成图片素材。** 暂缓：纯 CSS 让页面自包含且即时，并贴合启动页的 token fallback 策略。图片驱动的变体可日后叠加，无需改阶段契约。

## 风险

- 点击进入的契约偏离 web-client 架构笔记原有的"settle → 一次切换"措辞；该笔记已在同一改动中更新为魔法之门门禁描述，决策与架构记录因此一致。
- CSS 爆发用 `transform: rotate(var(--p-angle)) translate(...)` 配 `rotate(calc(var(--p-angle) * -1))` 把每个粒子回正以保持图形正立；不支持 `calc()` 嵌入 `rotate()` 的浏览器（所有常青引擎都支持）会按发射角散出未回正的图形。对启动页的常青引擎受众可接受。
- 桌面启动器仅在 3080 端口空闲时才拉起 web 服务器；已有别的服务占用 3080 的部署会跳过拉起并打开既有 URL，这正是便利行为的本意。
