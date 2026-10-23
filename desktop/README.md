# 砺 · 工作台（桌面客户端）

连接云端团队 AI 平台的本地工作台：文件留在本机，任务与经验回流云端。

## 功能

- **我的项目**：每个项目 = 一个本地文件夹，AI 只在登记的目录里干活（白名单保护）
- **一键干活**：客户核查 / 台账整理 / 标书初稿，选项目、填参数即可
- **任务与时间线**：从云端拉任务，本地执行，结果与产物回传
- **技能库**：云端下发的 SOP 自动同步到本地，助理照着做
- **终端**：项目目录内执行命令（默认关闭，可在设置里开白名单）
- **托盘常驻**：关窗不退出，后台等活；托盘菜单可快速打开/退出
- **连接管理**：服务器地址 + 员工 Key，保存后一键测试

## 运行（开发）

```bash
cd desktop
npm install
npm start
```

> 注意：macOS 上 Electron 首次安装会把二进制缓存到 `~/Library/Caches/electron`，如遇 EPERM 请在**非受限终端**里执行 `npm install`。

## 打包

```bash
npm run dist:mac    # 产出 dist/LiShi-Workbench-<version>-<arch>.dmg
npm run dist:win    # 产出 dist/LiShi-Workbench-<version>-<arch>.exe（需在 Windows 上）
```

Windows 安装包建议用 GitHub Actions 构建（`.github/workflows/build-desktop.yml`），不用在本机装 Windows 工具链。

## 目录结构

```
desktop/
  src/main/main.js       主进程：窗口、托盘、文件/命令、云端通信
  src/main/preload.js    contextBridge 暴露的安全 API
  src/renderer/          界面（HTML/CSS/JS，无构建步骤）
  assets/                图标
```

## 安全边界

- 文件操作限制在「项目根目录 + 已登记项目目录」内（路径校验，防目录穿越）
- 命令执行默认关闭；开启后仅允许白名单命令，超时 60s
- 与云端通信只用车终端 Key（`X-API-Key`），不含任何云端模型密钥
