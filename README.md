# KEROPPILOT

Windows 11 微信对话助手：把聊天记录和你的真实意图交给 DeepSeek，直接在控制台生成可发送的回复，不需要再复制 Prompt 到 ChatGPT。

技术栈：Tauri 2、React、TypeScript、Tailwind CSS，DeepSeek 官方 Chat Completions API。

## 使用

双击 `Start-ChatPilot.cmd` 或桌面的 KEROPPILOT 快捷方式。

1. 首次使用先点右上角的链接图标，打开「API 设置」小面板，粘贴在 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 创建的 API Key，点「保存到本机」。密钥用 Windows DPAPI 加密，只有当前 Windows 账户能解密；也可以只输入不保存，仅本次窗口使用。支持环境变量 `DEEPSEEK_API_KEY` 作为备选来源。
2. 在微信复制文字版聊天记录，粘贴到页面顶部的「粘贴聊天记录」输入框，可直接编辑与清空。可在「对方是我的」选择预设关系，或选「自定义」后填写具体身份。
3. 在策略实验台填写回复意图，微调直接程度、情感温度、主动程度，再选本次语气和长度；回复固定生成 4 个版本。「正式」按工作沟通、学习或任务交接、与长辈或上级对话的真实语域来写，不使用网络梗、Emoji 和口头禅。
4. 填好聊天和意图后，DeepSeek 会自动在「我想表达」卡片下方生成回复，不需要点按钮。之后拖动三个参数、切换语气或长度，停止调整约 2 秒后回复会自动更新。每个版本统一使用【版本一 · 策略名】【策略思路】【正文】【评价】四段格式；回复下方只有一个「复制回复」按钮，可直接粘贴到微信。
5. 「对话分析」页用同一份聊天记录自动生成三种角度的语境解读，会结合当代年轻人的梗、反话和情绪温度做更深入的分析，不再附带接话示例。
6. 仍然想手动使用 ChatGPT 时，可展开页面底部的「备用：复制 Prompt 到 ChatGPT」，复制完整提示词。

「我的风格」保存口头禅、Emoji 偏好和自定义表达规则，修改后立即用于后续生成与 Prompt。聊天记录、意图和拟发送正文只保留在当前窗口。

文字记录自动识别微信复制的「昵称 → 日期时间 → 正文」格式，保留多行正文、图片占位和链接。也支持 `我：`、`自己：`、`对方：`、`朋友：` 前缀。使用昵称格式时，可在回复意图中注明「我是某昵称」，明确代谁回复。可以仅使用文字记录，也可以在 ChatGPT 流程中上传截图补充上下文。

通过系统标题栏拖动窗口，拖动边缘调整大小。图钉控制置顶。个人偏好保存在本地 `chatpilot.style.v1`，所选模型保存在 `chatpilot.deepseek.v1`，API Key 由 Rust 侧加密保存到应用配置目录。

## 隐私

- API Key 通过 Windows DPAPI（`CryptProtectData`）加密后写入 `%APPDATA%\com.chatpilot.desktop\deepseek.key`，不写入日志、聊天存储或前端持久化。
- 只有在自动生成回复或解读时，聊天记录、意图、关系、风格设置和策略参数才会作为请求内容发送到 `https://api.deepseek.com`；页面的 CSP 仅允许连接该域名。
- 复制 Prompt 的备用流程不会发送任何内容到网络。
- 可随时在「API 设置」删除本机密钥。

## 本地运行

安装 Node.js 22 LTS、Rust stable MSVC、Visual Studio 2022 Build Tools 的 C++ 桌面开发工作负载及 Windows SDK。应用需要 WebView2 Runtime。

```powershell
cd D:\WECHATCOPILOT
npm ci
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npm run tauri -- dev
```

前端预览可运行 `npm run dev` 并访问终端显示的地址；浏览器预览没有 Tauri 命令，密钥只保存在当前标签页的 sessionStorage，刷新标签页后需重新输入。

## 构建与测试

```powershell
npm test
npm run build
npm run tauri -- build
```

EXE 位于 `src-tauri\target\release\chatpilot.exe`。安装包位于 `src-tauri\target\release\bundle\nsis\KEROPPILOT_0.1.0_x64-setup.exe`。重新构建前请关闭已有 ChatPilot 窗口。安装包尚未配置代码签名。

测试覆盖 DeepSeek SSE 流式解析、HTTP 错误映射、密钥格式与掩码、会话存储、模型偏好、参数变化自动生成与防抖、API 设置保存/测试/删除、Prompt 备用复制、风格应用与本地存储失败。

## 视觉与模块

三个内容页面（策略实验台、对话分析、我的风格）加右上角钥匙图标弹出的 API 设置小面板、共享聊天面板、导航、滑块、输入框、选择器、按钮、流式回复和反馈统一采用 Frogdo 风格：奶油白纸面、青柠绿、墨黑圆角卡片与青蛙图标。

全局样式 `src/styles.css` 定义奶油底 #F8F5E9、纸白 #FFFFFF、青柠绿 #A7E23B、墨绿 #4E8C12、墨黑 #1F1F1B，以及珊瑚 #EF6C57、粉 #F4A7A3、黄 #F6C445。公共变量管理 30px 面板圆角、16px 控件圆角、柔和阴影和 180ms 动效。所有前景蛙脸直接使用原图、无额外描边或阴影，卡片角落带低透明度漫画网点；策略卡片使用滚动吸附居中，六张大眼蛙表情在空回复时轮播。支持减少动画与强制对比度。系统标题栏固定浅色，原生下拉选项由 Windows/WebView 绘制。

- `src/App.tsx` 管理页面、共享聊天上下文、策略参数和 DeepSeek 配置。
- `src/components/FrogMark.tsx` 使用你提供的 6 张大眼蛙表情（`public/frogs/*.webp`），按语义用于品牌、卡片标题、滑块、水印、背景与错误提示。替换这些图片即可全站换图，不需要改代码。对应关系：品牌/聊天/滑块待机 `smile`，意图/背景/空状态/分析 `wink`，滑块拖动 `surprised`，风格 `love`，缺少 Key `sad`，错误提示 `annoyed`；卡片与输入框水印为 `smile` 的低透明度版本。
- `src/components/ChatContextPanel.tsx` 提供常驻聊天输入卡：左栏关系选择、右栏聊天记录，两栏并排以减少占用高度。
- `src/components/ReplyConsole.tsx` 嵌入卡片底部，参数变化后防抖自动重新生成，只保留一个复制按钮；错误信息仍会就地显示。
- `src/components/ApiSettingsPage.tsx` 管理 API Key、模型选择、连接测试与隐私说明。
- `src/components/SettingsDialog.tsx` 提供右上角钥匙图标的按需弹出面板（Esc / 点击遮罩关闭）。
- `src/components/PromptOutput.tsx` 与 `PromptFallback.tsx` 保留复制 Prompt 到 ChatGPT 的备用流程。
- `src/services/deepseek.ts` 封装请求、SSE 解析、错误映射与连接测试。
- `src/services/apiKey.ts` 与 `src-tauri/src/secret.rs` 负责密钥的加密保存、读取与删除。
- `src/services/prompts/` 独立封装回复、分析及组合模板。
- `src/hooks/useStyleProfile.ts` 与 `src/services/preferences.ts` 管理个人偏好。
- `src/services/desktop.ts` 提供剪贴板、置顶和外部链接。

截图与 OCR 模块仍未包含。模型处理现在由 DeepSeek API 在应用内完成，ChatGPT 复制流程仅作为备用。

