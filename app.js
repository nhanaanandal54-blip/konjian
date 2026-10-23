import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, query, orderBy, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/*
  1) 在 Firebase Console 创建项目并启用 Email/Password 登录。
  2) 把 Firebase Web 配置填入下方 firebaseConfig。
  3) 在 firestore.rules 中把两位成员的 Firebase Auth UID 加入 allowlist。
  4) 部署 Firestore Rules。不要把数据库设为公开读写。
*/
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};

const configured = !Object.values(firebaseConfig).some(v => String(v).startsWith("YOUR_"));
const $ = (id) => document.getElementById(id);
const authView = $("authView"), appView = $("appView");
let auth, db, currentUser, profileData = null, toastTimer;

function showToast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
function setMessage(id, message, error = false) {
  const el = $(id); if (!el) return; el.textContent = message;
  el.style.color = error ? "#ffaaa9" : "#a9c4ff";
}
function safeDate(value) {
  if (!value) return "日期未设置";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未设置";
  return new Intl.DateTimeFormat("zh-CN", {year:"numeric",month:"short",day:"numeric"}).format(date);
}
function escapeHtml(value="") {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function switchView(loggedIn) {
  authView.classList.toggle("hidden", loggedIn); appView.classList.toggle("hidden", !loggedIn);
  $("logoutBtn").classList.toggle("hidden", !loggedIn);
}
function defaultProfile() {
  return {nameOne:"启宁", nameTwo:"另一位主人公", bioOne:"把日子过成喜欢的样子。", bioTwo:"在这里留下你的故事。"};
}
async function loadProfile() {
  const ref = doc(db, "spaces", "couple-space", "settings", "profile");
  const snap = await getDoc(ref);
  profileData = snap.exists() ? {...defaultProfile(), ...snap.data()} : defaultProfile();
  renderProfile();
}
function renderProfile() {
  const p = profileData || defaultProfile();
  $("nameOne").textContent = p.nameOne; $("nameTwo").textContent = p.nameTwo;
  $("bioOne").textContent = p.bioOne || ""; $("bioTwo").textContent = p.bioTwo || "";
  $("avatarOne").textContent = (p.nameOne || "启").slice(0,1);
  $("avatarTwo").textContent = (p.nameTwo || "你").slice(0,1);
}
async function loadMemories() {
  const grid = $("memoriesGrid"); grid.innerHTML = "";
  try {
    const q = query(collection(db, "spaces", "couple-space", "memories"), orderBy("createdAt", "desc"), limit(60));
    const snap = await getDocs(q);
    $("emptyMemories").classList.toggle("hidden", !snap.empty);
    snap.forEach(item => {
      const m = item.data();
      const card = document.createElement("article"); card.className = "memory-card";
      const image = m.imageUrl && /^https?:\/\//i.test(m.imageUrl)
        ? `<img class="memory-image" src="${escapeHtml(m.imageUrl)}" alt="${escapeHtml(m.title || "回忆照片")}" loading="lazy" referrerpolicy="no-referrer">`
        : `<div class="memory-placeholder" aria-hidden="true">✧</div>`;
      card.innerHTML = `${image}<div class="memory-body"><div class="memory-date">${escapeHtml(safeDate(m.date))}</div><h3>${escapeHtml(m.title || "未命名回忆")}</h3><p>${escapeHtml(m.text || "")}</p><div class="memory-by">记录者 · ${escapeHtml(m.authorName || "我们")}</div></div>`;
      grid.appendChild(card);
    });
  } catch (error) {
    $("emptyMemories").classList.remove("hidden");
    showToast("回忆读取失败，请检查 Firebase 配置和数据库规则。");
    console.error(error);
  }
}
async function loadMessages() {
  const list = $("messagesList"); list.innerHTML = "";
  try {
    const q = query(collection(db, "spaces", "couple-space", "messages"), orderBy("createdAt", "desc"), limit(80));
    const snap = await getDocs(q);
    $("emptyMessages").classList.toggle("hidden", !snap.empty);
    $("messageCount").textContent = String(snap.size);
    snap.forEach(item => {
      const m = item.data(), card = document.createElement("article"); card.className = "message-card";
      const time = m.createdAt?.toDate ? m.createdAt.toDate() : null;
      const date = time ? new Intl.DateTimeFormat("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(time) : "刚刚";
      card.innerHTML = `<div class="message-meta"><span>${escapeHtml(m.authorName || "我们")}</span><span>${escapeHtml(date)}</span></div><p>${escapeHtml(m.text || "")}</p>`;
      list.appendChild(card);
    });
  } catch (error) { showToast("留言读取失败，请检查数据库规则。"); console.error(error); }
}
async function refreshContent() { await Promise.all([loadProfile(), loadMemories(), loadMessages()]); }
function openEditor(id) { $(id).classList.remove("hidden"); $(id).scrollIntoView({behavior:"smooth",block:"center"}); }
function closeEditor(id) { $(id).classList.add("hidden"); }
function currentAuthor() {
  const name = profileData?.nameOne || "我们";
  return currentUser?.displayName || currentUser?.email?.split("@")[0] || name;
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configured) { setMessage("authMessage", "请先在 app.js 中填写 Firebase Web 配置，再部署网站。", true); return; }
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true; setMessage("authMessage", "正在验证账号…");
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    setMessage("authMessage", "");
  } catch (error) {
    const messages = { "auth/invalid-credential":"邮箱或密码不正确。", "auth/too-many-requests":"尝试次数过多，请稍后再试。", "auth/network-request-failed":"网络连接失败，请检查网络。" };
    setMessage("authMessage", messages[error.code] || "登录失败，请检查账号、密码和 Firebase 配置。", true);
  } finally { button.disabled = false; }
});
$("logoutBtn").addEventListener("click", async () => { if (auth) await signOut(auth); });
$("addMemoryBtn").addEventListener("click", () => openEditor("memoryForm"));
$("emptyAddBtn").addEventListener("click", () => openEditor("memoryForm"));
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => closeEditor(button.dataset.close)));
document.querySelectorAll("[data-dialog-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.dialogClose).close()));
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b === button));
  $("memoriesSection").classList.toggle("hidden", button.dataset.target !== "memoriesSection");
  $("messagesSection").classList.toggle("hidden", button.dataset.target !== "messagesSection");
}));
$("memoryForm").addEventListener("submit", async (event) => {
  event.preventDefault(); if (!currentUser) return;
  const payload = {title:$("memoryTitle").value.trim(), date:$("memoryDate").value, imageUrl:$("memoryImage").value.trim(), text:$("memoryText").value.trim(), authorUid:currentUser.uid, authorName:currentAuthor(), createdAt:serverTimestamp()};
  try {
    await addDoc(collection(db, "spaces", "couple-space", "memories"), payload);
    event.currentTarget.reset(); closeEditor("memoryForm"); await loadMemories(); showToast("这段回忆已收藏。");
  } catch (error) { setMessage("memoryMessage", "保存失败，请检查数据库规则和网络。", true); console.error(error); }
});
$("messageForm").addEventListener("submit", async (event) => {
  event.preventDefault(); if (!currentUser) return;
  const text = $("messageText").value.trim(); if (!text) return;
  try {
    await addDoc(collection(db, "spaces", "couple-space", "messages"), {text, authorUid:currentUser.uid, authorName:currentAuthor(), createdAt:serverTimestamp()});
    event.currentTarget.reset(); setMessage("messageFeedback", "已把这句话留在你们的空间里。"); await loadMessages();
  } catch (error) { setMessage("messageFeedback", "发送失败，请检查数据库规则和网络。", true); console.error(error); }
});
$("editProfilesBtn").addEventListener("click", () => {
  const p = profileData || defaultProfile();
  $("profileNameOne").value = p.nameOne; $("profileNameTwo").value = p.nameTwo;
  $("profileBioOne").value = p.bioOne || ""; $("profileBioTwo").value = p.bioTwo || "";
  $("profileDialog").showModal();
});
$("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault(); if (!currentUser) return;
  const p = {nameOne:$("profileNameOne").value.trim(), nameTwo:$("profileNameTwo").value.trim(), bioOne:$("profileBioOne").value.trim(), bioTwo:$("profileBioTwo").value.trim(), updatedAt:serverTimestamp()};
  try {
    await setDoc(doc(db, "spaces", "couple-space", "settings", "profile"), p, {merge:true});
    profileData = p; renderProfile(); $("profileDialog").close(); showToast("双人档案已更新。");
  } catch (error) { setMessage("profileFeedback", "保存失败，请检查数据库规则。", true); console.error(error); }
});
$("todayLabel").textContent = new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date());
$("year").textContent = new Date().getFullYear();
$("memoryDate").value = new Date().toISOString().slice(0,10);

if (!configured) {
  setMessage("authMessage", "首次使用：先配置 Firebase，步骤见 README.md。");
} else {
  const app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app);
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (!user) { switchView(false); return; }
    switchView(true);
    try { await refreshContent(); }
    catch (error) { console.error(error); showToast("初始化失败，请检查 Firestore 规则。"); }
  });
}
