# Our Space · 双人专属空间

Apple 深色高级风的双人私人网站。包含双人档案、照片墙/回忆、留言互动和邮箱密码登录。

## 文件说明

- `index.html`：页面结构与各功能模块
- `style.css`：深色玻璃拟态、自适应布局与动效
- `app.js`：Firebase 登录、档案、回忆与留言逻辑
- `firestore.rules`：仅允许两位指定 UID 访问的数据库规则

## 部署前配置

### 1. 创建 Firebase 项目

1. 打开 https://console.firebase.google.com/ 创建项目。
2. 在项目设置中添加 Web 应用，复制 Firebase 配置。
3. 进入 **Authentication → Sign-in method**，启用 **Email/Password**。
4. 在 **Authentication → Users** 中手动添加两位成员的邮箱和密码。不要开放任意访客注册。
5. 进入 **Firestore Database** 创建数据库。

### 2. 填写 Web 配置

打开 `app.js`，找到 `firebaseConfig`，将 `YOUR_...` 替换为 Firebase 控制台提供的真实值。此配置不是服务账号密钥，但仍不要把服务账号私钥放进前端。

### 3. 限定只有两位成员能访问

1. Firebase Console → Authentication → Users，复制两位用户的 **UID**。
2. 打开 `firestore.rules`，将 `REPLACE_WITH_FIRST_MEMBER_UID` 和 `REPLACE_WITH_SECOND_MEMBER_UID` 替换为真实 UID。
3. 将规则部署到 Firestore。可在 Firebase Console 的 Firestore → Rules 粘贴并发布，也可使用 Firebase CLI 部署。

规则采用 UID 白名单，而不是只在网页里隐藏内容。**如果没有替换 UID 并发布规则，不要把网站当作已完成的私密部署。**

### 4. 部署网站

这是原生 HTML/CSS/JavaScript 项目，可部署到支持静态网站的托管平台，例如 Firebase Hosting、Vercel 或 Netlify。

Firebase Hosting CLI 示例：

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# 选择当前项目；public directory 设为当前目录（或将四个前端文件放入 public）
firebase deploy
```

若 `firebase init hosting` 创建了 `public` 文件夹，请将 `index.html`、`style.css`、`app.js` 放入 `public`，并将 `firebase.json` 的 hosting.public 指向 `public`。

## 数据结构

```text
spaces/
  couple-space/
    settings/
      profile
    memories/
      {memoryId}
    messages/
      {messageId}
```

## 安全提醒

- 不要配置 `allow read, write: if true`。
- 不要把 Firebase Admin SDK 服务账号密钥放进浏览器端。
- 当前版本用图片 URL 保存回忆图片；如果需要直接上传手机照片，可再接入 Firebase Storage 并配置对应 Storage Rules。
- 图片链接由成员输入，请只使用可信来源的链接。
- 两人共用同一个空间，任何被列入 UID 白名单的成员都能读写该空间内容。
- 上线前用未授权的第三个账号测试，确认 Firestore 读取和写入均被拒绝。
