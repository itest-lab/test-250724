// --- 1) Firebase 初期化 ---
const firebaseConfig = {
  apiKey:            "AIzaSyArSM1XI5MLkZDiDdzkLJxBwvjM4xGWS70",
  authDomain:        "test-250724.firebaseapp.com",
  databaseURL:       "https://test-250724-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "test-250724",
  storageBucket:     "test-250724.appspot.com",
  messagingSenderId: "252374655568",
  appId:             "1:252374655568:web:3e583b46468714b7b7a755",
  measurementId:     "G-5WGPKD9BP2"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// --- 2) キャリアコード⇒日本語ラベル マップ ---
const carrierLabels = {
  sagawa:  "佐川急便",
  yamato:  "ヤマト運輸",
  fukutsu: "福山通運",
  seino:   "西濃運輸",
  tonami:  "トナミ運輸"
};

// --- 3) グローバル state ---
let isAdmin = false;

// --- 4) DOM 要素 ---
const loginView    = document.getElementById("login-view");
const mainView     = document.getElementById("main-view");
const loginErrorEl = document.getElementById("login-error");
const emailInput   = document.getElementById("email");
const passwordInput        = document.getElementById("password");
const passwordConfirmInput = document.getElementById("password-confirm");
const loginBtn             = document.getElementById("login-btn");
const signupBtn            = document.getElementById("signup-btn");
const guestBtn             = document.getElementById("guest-btn");
const resetBtn             = document.getElementById("reset-btn");
const logoutBtn            = document.getElementById("logout-btn");

const scanModeDiv       = document.getElementById("scan-mode");
const manualModeDiv     = document.getElementById("manual-mode");
const startManualBtn    = document.getElementById("start-manual-btn");
const caseBarcodeInput  = document.getElementById("case-barcode");
const manualOrderIdInput   = document.getElementById("manual-order-id");
const manualCustomerInput  = document.getElementById("manual-customer");
const manualProductInput   = document.getElementById("manual-product-name");
const manualConfirmBtn     = document.getElementById("manual-confirm-btn");
const startScanBtn         = document.getElementById("start-scan-btn");

const caseDetailsDiv        = document.getElementById("case-details");
const detailOrderId          = document.getElementById("detail-order-id");
const detailCustomer         = document.getElementById("detail-customer");
const detailProductName      = document.getElementById("detail-product-name");
const fixedCarrierCheckbox   = document.getElementById("fixed-carrier-checkbox");
const fixedCarrierSelect     = document.getElementById("fixed-carrier-select");
const trackingRows           = document.getElementById("tracking-rows");
const addTrackingRowBtn      = document.getElementById("add-tracking-row-btn");
const confirmAddCaseBtn      = document.getElementById("confirm-add-case-btn");
const addCaseMsg             = document.getElementById("add-case-msg");
const anotherCaseBtn         = document.getElementById("another-case-btn");

const searchView             = document.getElementById("search-view");
const searchInput            = document.getElementById("search-input");
const searchBtn              = document.getElementById("search-btn");
const listAllBtn             = document.getElementById("list-all-btn");
const searchResults          = document.getElementById("search-results");

const caseDetailView         = document.getElementById("case-detail-view");
const detailInfoDiv          = document.getElementById("detail-info");
const detailShipmentsUl      = document.getElementById("detail-shipments");
const backToSearchBtn        = document.getElementById("back-to-search-btn");
const anotherCaseBtn2        = document.getElementById("another-case-btn-2");

// --- 5) showView helper ---
function showView(id) {
  document.querySelectorAll(".subview").forEach(el => el.style.display = "none");
  document.getElementById(id).style.display = "block";
}

// --- 6) ナビゲーション設定 ---
document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

// --- 7) 認証状態監視 + admin クレームチェック ---
auth.onAuthStateChanged(user => {
  if (user) {
    // admin クレーム確認
    user.getIdTokenResult().then(({ claims }) => {
      isAdmin = !!claims.admin;
    });
    loginView.style.display = "none";
    mainView.style.display  = "block";
    showView("add-case-view");
    initAddCaseView();
  } else {
    emailInput.value = passwordInput.value = passwordConfirmInput.value = "";
    loginErrorEl.textContent = "";
    loginView.style.display = "block";
    mainView.style.display  = "none";
  }
});

// --- 8) 認証操作 ---
loginBtn.onclick = () =>
  auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
    .catch(e => loginErrorEl.textContent = e.message);

signupBtn.onclick = () => {
  if (passwordInput.value !== passwordConfirmInput.value) {
    loginErrorEl.textContent = "パスワードが一致しません";
    return;
  }
  auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value)
    .catch(e => loginErrorEl.textContent = e.message);
};

guestBtn.onclick = () =>
  auth.signInAnonymously().catch(e => loginErrorEl.textContent = e.message);

resetBtn.onclick = () => {
  const email = emailInput.value.trim();
  if (!email) {
    loginErrorEl.textContent = "メールアドレスを入力してください";
    return;
  }
  auth.sendPasswordResetEmail(email)
    .then(()=> loginErrorEl.textContent = "再発行メールを送信しました")
    .catch(e=> loginErrorEl.textContent = e.message);
};

logoutBtn.onclick = () => auth.signOut();

// --- 9) 得意先追加: 初期化 + 追跡行管理 ---
function createTrackingRow() {
  const row = document.createElement("div");
  row.className = "tracking-row";
  if (!fixedCarrierCheckbox.checked) {
    const sel = document.createElement("select");
    sel.innerHTML = `
      <option value="">運送会社</option>
      <option value="sagawa">佐川急便</option>
      <option value="yamato">ヤマト運輸</option>
      <option value="fukutsu">福山通運</option>
      <option value="seino">西濃運輸</option>
      <option value="tonami">トナミ運輸</option>
    `;
    row.appendChild(sel);
  }
  const inp = document.createElement("input");
  inp.type = "text";
  inp.placeholder = "追跡番号";
  inp.inputMode = "numeric";
  row.appendChild(inp);
  return row;
}

function initAddCaseView() {
  scanModeDiv.style.display     = "block";
  manualModeDiv.style.display   = "none";
  caseDetailsDiv.style.display  = "none";
  caseBarcodeInput.value        = "";
  manualOrderIdInput.value      = "";
  manualCustomerInput.value     = "";
  manualProductInput.value      = "";
  addCaseMsg.textContent        = "";
  fixedCarrierCheckbox.checked  = false;
  fixedCarrierSelect.style.display = "none";
  fixedCarrierSelect.value      = "";
  trackingRows.innerHTML        = "";
  for (let i=0; i<10; i++) trackingRows.appendChild(createTrackingRow());
}

addTrackingRowBtn.onclick = () => {
  for (let i=0; i<10; i++) trackingRows.appendChild(createTrackingRow());
};

fixedCarrierCheckbox.onchange = () => {
  fixedCarrierSelect.style.display = fixedCarrierCheckbox.checked ? "block" : "none";
  initAddCaseView();
};

// スキャン→JSON展開
caseBarcodeInput.addEventListener("keydown", e=>{
  if (e.key!=="Enter") return;
  const raw = caseBarcodeInput.value.trim();
  if (!raw) return;
  let obj, text;
  try {
    if (raw.startsWith("ZLIB64:")) {
      const b64 = raw.slice(7),
            bin = atob(b64),
            arr = new Uint8Array([...bin].map(c=>c.charCodeAt(0))),
            dec = pako.inflate(arr);
      text = new TextDecoder().decode(dec);
    } else {
      text = raw;
    }
    obj = JSON.parse(text);
  } catch(err) {
    alert("QR解析失敗: "+err.message);
    return;
  }
  detailOrderId.textContent     = obj["受注No"]   || "";
  detailCustomer.textContent    = obj["得意先"]   || "";
  detailProductName.textContent = obj["品名"]     || "";
  scanModeDiv.style.display     = "none";
  caseDetailsDiv.style.display  = "block";
});

startManualBtn.onclick = ()=>{
  scanModeDiv.style.display   = "none";
  manualModeDiv.style.display = "block";
};
startScanBtn.onclick = ()=>{
  manualModeDiv.style.display = "none";
  scanModeDiv.style.display   = "block";
};

// 手動確定
manualConfirmBtn.onclick = ()=>{
  if (!manualOrderIdInput.value||!manualCustomerInput.value||!manualProductInput.value) {
    alert("必須項目を入力してください");
    return;
  }
  detailOrderId.textContent     = manualOrderIdInput.value.trim();
  detailCustomer.textContent    = manualCustomerInput.value.trim();
  detailProductName.textContent = manualProductInput.value.trim();
  manualModeDiv.style.display   = "none";
  caseDetailsDiv.style.display  = "block";
};

// 登録確定
confirmAddCaseBtn.onclick = ()=>{
  const orderId  = detailOrderId.textContent.trim();
  const customer = detailCustomer.textContent.trim();
  const product  = detailProductName.textContent.trim();
  if (!orderId||!customer||!product) {
    addCaseMsg.textContent = "案件情報が不足しています";
    return;
  }
  const items = [];
  Array.from(trackingRows.children).forEach(row=>{
    const tn = row.querySelector("input").value.trim();
    if (!tn) return;
    const carrier = fixedCarrierCheckbox.checked
      ? fixedCarrierSelect.value
      : row.querySelector("select")?.value;
    if (!carrier) return;
    items.push({ carrier, tracking: tn });
  });
  if (items.length===0) {
    alert("追跡番号を最低1件入力してください");
    return;
  }
  const uid = auth.currentUser.uid;
  db.ref(`cases/${uid}/${orderId}`).set({
    注番:orderId, 得意先:customer, 品名:product, createdAt:Date.now()
  });
  items.forEach(item=>{
    db.ref(`shipments/${uid}/${orderId}`).push({
      carrier:item.carrier, tracking:item.tracking, createdAt:Date.now()
    });
  });
  addCaseMsg.textContent = "登録完了";
};

anotherCaseBtn.onclick = ()=>{
  showView("add-case-view");
  initAddCaseView();
};

// --- 10) 検索 & 一覧表示 ---
function renderSearchResults(data) {
  searchResults.innerHTML = "";
  Object.entries(data).forEach(([id,obj])=>{
    const li = document.createElement("li");
    li.textContent = `${id} / ${obj.得意先} / ${obj.品名}`;
    // 管理者なら削除ボタン
    if (isAdmin) {
      const btn = document.createElement("button");
      btn.textContent = "削除";
      btn.className = "delete-case-btn";
      btn.onclick = ()=>{
        if (!confirm("この案件を削除しますか？")) return;
        const uid = auth.currentUser.uid;
        db.ref(`cases/${uid}/${id}`).remove();
        db.ref(`shipments/${uid}/${id}`).remove();
        li.remove();
      };
      li.appendChild(btn);
    }
    li.onclick = ()=> showCaseDetail(id,obj);
    searchResults.append(li);
  });
}

searchBtn.onclick = ()=> {
  const kw = searchInput.value.trim();
  const uid= auth.currentUser.uid;
  db.ref(`cases/${uid}`)
    .orderByChild("注番")
    .startAt(kw).endAt(kw+"\uf8ff")
    .once("value")
    .then(snap=> renderSearchResults(snap.val()||{}));
};

listAllBtn.onclick = ()=>{
  const uid= auth.currentUser.uid;
  db.ref(`cases/${uid}`)
    .once("value")
    .then(snap=> renderSearchResults(snap.val()||{}));
};

// --- 11) 詳細表示 & ステータス取得 ---
async function showCaseDetail(orderId,obj) {
  showView("case-detail-view");
  detailInfoDiv.innerHTML = `
    <div>受注番号: ${orderId}</div>
    <div>得意先:   ${obj.得意先}</div>
    <div>品名:     ${obj.品名}</div>
  `;
  detailShipmentsUl.innerHTML = "";
  const snap = await db.ref(`shipments/${auth.currentUser.uid}/${orderId}`).once("value");
  const list = snap.val()||{};
  for (const key of Object.keys(list)) {
    const item = list[key];
    const label = carrierLabels[item.carrier]||item.carrier;
    const li = document.createElement("li");
    li.textContent = `${label}：${item.tracking} – 読み込み中…`;
    detailShipmentsUl.append(li);
    try {
      const res = await fetch("/fetchStatus", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(item)
      });
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      li.textContent = `${label}：${item.tracking} – ${json.status||json.error}`;
    } catch {
      li.textContent = `${label}：${item.tracking} – 取得失敗`;
    }
  }
}
backToSearchBtn.onclick = ()=> showView("search-view");
anotherCaseBtn2.onclick  = ()=> { showView("add-case-view"); initAddCaseView(); };
