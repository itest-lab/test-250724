// --- 1) Firebase 初期化 ---
const firebaseConfig = {
  apiKey: "AIzaSyArSM1XI5MLkZDiDdzkLJxBwvjM4xGWS70",
  authDomain: "test-250724.firebaseapp.com",
  databaseURL: "https://test-250724-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "test-250724",
  storageBucket: "test-250724.firebasestorage.app",
  messagingSenderId: "252374655568",
  appId: "1:252374655568:web:3e583b46468714b7b7a755",
  measurementId: "G-5WGPKD9BP2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// ——— Apps Script エンドポイント ———
const STATUS_ENDPOINT = "https://script.google.com/macros/s/【あなたのID】/exec";

// ——— 2) DOM 要素取得 ———
const loginView     = document.getElementById("login-view");
const mainView      = document.getElementById("main-view");
const loginErrorEl  = document.getElementById("login-error");
const emailInput    = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordConfirmInput = document.getElementById("password-confirm");
const loginBtn      = document.getElementById("login-btn");
const signupBtn     = document.getElementById("signup-btn");
const guestBtn      = document.getElementById("guest-btn");
const resetBtn      = document.getElementById("reset-btn");
const logoutBtn     = document.getElementById("logout-btn");

const scanModeDiv        = document.getElementById("scan-mode");
const manualModeDiv      = document.getElementById("manual-mode");
const caseDetailsDiv     = document.getElementById("case-details");
const startManualBtn     = document.getElementById("start-manual-btn");
const caseBarcodeInput   = document.getElementById("case-barcode");
const manualOrderIdInput = document.getElementById("manual-order-id");
const manualCustomerInput= document.getElementById("manual-customer");
const manualProductInput = document.getElementById("manual-product-name");
const manualConfirmBtn   = document.getElementById("manual-confirm-btn");

const detailOrderId      = document.getElementById("detail-order-id");
const detailCustomer     = document.getElementById("detail-customer");
const detailProductName  = document.getElementById("detail-product-name");
const trackingRows       = document.getElementById("tracking-rows");
const addTrackingRowBtn  = document.getElementById("add-tracking-row-btn");
const confirmAddCaseBtn  = document.getElementById("confirm-add-case-btn");
const addCaseMsg         = document.getElementById("add-case-msg");
const anotherCaseBtn     = document.getElementById("another-case-btn");

const searchView         = document.getElementById("search-view");
const searchInput        = document.getElementById("search-input");
const searchBtn          = document.getElementById("search-btn");
const searchResults      = document.getElementById("search-results");

const caseDetailView     = document.getElementById("case-detail-view");
const detailInfoDiv      = document.getElementById("detail-info");
const detailShipmentsUl  = document.getElementById("detail-shipments");
const backToSearchBtn    = document.getElementById("back-to-search-btn");
const anotherCaseBtn2    = document.getElementById("another-case-btn-2");

// ——— 3) showView 関数 ———
function showView(id) {
  document.querySelectorAll(".subview").forEach(el => el.style.display = "none");
  document.getElementById(id).style.display = "block";
}

// ——— 4) ナビゲーション設定 ———
document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    const viewId = btn.dataset.view;
    showView(viewId);
  });
});

// ——— 5) 認証状態監視 ———
auth.onAuthStateChanged(user => {
  if (user) {
    loginView .style.display = "none";
    mainView  .style.display = "block";
    showView("add-case-view");
    initAddCaseView();
  } else {
    // フォームクリア
    emailInput.value = passwordInput.value = passwordConfirmInput.value = "";
    loginErrorEl.textContent = "";
    loginView .style.display = "block";
    mainView  .style.display = "none";
  }
});

// ——— 6) 認証操作 ———
// 通常ログイン
loginBtn.onclick = () => {
  auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
      .catch(e => loginErrorEl.textContent = e.message);
};
// 新規登録
signupBtn.onclick = () => {
  if (passwordInput.value !== passwordConfirmInput.value) {
    loginErrorEl.textContent = "パスワードが一致しません";
    return;
  }
  auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value)
      .catch(e => loginErrorEl.textContent = e.message);
};
// ゲストログイン
guestBtn.onclick = () => {
  auth.signInAnonymously()
      .catch(e => loginErrorEl.textContent = e.message);
};
// パスワード再発行
resetBtn.onclick = () => {
  const email = emailInput.value.trim();
  if (!email) {
    loginErrorEl.textContent = "メールアドレスを入力してください";
    return;
  }
  auth.sendPasswordResetEmail(email)
      .then(() => loginErrorEl.textContent = "再発行メールを送信しました")
      .catch(e => loginErrorEl.textContent = e.message);
};
// ログアウト
logoutBtn.onclick = () => auth.signOut();

// ——— 7) 得意先追加 初期化 & 行追加 ———
function createTrackingRow() {
  const row = document.createElement("div");
  row.className = "tracking-row";
  row.innerHTML = `
    <select>
      <option value="">運送会社</option>
      <option value="sagawa">佐川急便</option>
      <option value="yamato">ヤマト運輸</option>
      <option value="fukutsu">福山通運</option>
      <option value="seino">西濃運輸</option>
      <option value="tonami">トナミ運輸</option>
    </select>
    <input type="text" placeholder="追跡番号" inputmode="numeric">
  `;
  return row;
}
function initAddCaseView() {
  scanModeDiv.style.display    = "block";
  manualModeDiv.style.display  = "none";
  caseDetailsDiv.style.display = "none";
  caseBarcodeInput.value = manualOrderIdInput.value = manualCustomerInput.value = manualProductInput.value = "";
  addCaseMsg.textContent = "";
  trackingRows.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    trackingRows.appendChild(createTrackingRow());
  }
}
addTrackingRowBtn.onclick = () => {
  trackingRows.appendChild(createTrackingRow());
};

// スキャン→JSON展開
caseBarcodeInput.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const raw = caseBarcodeInput.value.trim();
  if (!raw) return;
  let obj, jsonText;
  try {
    if (raw.startsWith("ZLIB64:")) {
      const b64 = raw.slice(7),
            bin = atob(b64),
            arr = new Uint8Array([...bin].map(c=>c.charCodeAt(0))),
            dec = pako.inflate(arr);
      jsonText = new TextDecoder().decode(dec);
    } else {
      jsonText = raw;
    }
    obj = JSON.parse(jsonText);
  } catch (err) {
    alert("QRコード解析失敗: "+err.message);
    return;
  }
  // マッピング
  detailOrderId     .textContent = obj["受注No"]   || "";
  detailCustomer    .textContent = obj["得意先"]   || "";
  detailProductName .textContent = obj["品名"]     || "";
  scanModeDiv.style.display    = "none";
  manualModeDiv.style.display  = "none";
  caseDetailsDiv.style.display = "block";
});

// 手動確定
manualConfirmBtn.onclick = () => {
  if (!manualOrderIdInput.value || !manualCustomerInput.value || !manualProductInput.value) {
    alert("必須項目を入力してください");
    return;
  }
  detailOrderId     .textContent = manualOrderIdInput.value.trim();
  detailCustomer    .textContent = manualCustomerInput.value.trim();
  detailProductName .textContent = manualProductInput.value.trim();
  scanModeDiv.style.display    = "none";
  manualModeDiv.style.display  = "none";
  caseDetailsDiv.style.display = "block";
};
startManualBtn.onclick = () => {
  scanModeDiv.style.display   = "none";
  manualModeDiv.style.display = "block";
};

// 登録
confirmAddCaseBtn.onclick = () => {
  const uid = auth.currentUser.uid,
        orderId  = detailOrderId.textContent.trim(),
        customer = detailCustomer.textContent.trim(),
        product  = detailProductName.textContent.trim();
  if (!orderId||!customer||!product) {
    addCaseMsg.textContent = "案件情報が不足しています";
    return;
  }
  // 案件保存
  db.ref(`cases/${uid}/${orderId}`).set({ 注番:orderId, 得意先:customer, 品名:product, createdAt:Date.now() });
  // 追跡保存
  [...trackingRows.children].forEach(row=>{
    const sel = row.querySelector("select").value,
          tn  = row.querySelector("input").value.trim();
    if (sel&&tn) {
      db.ref(`shipments/${uid}/${orderId}`).push({ carrier:sel, tracking:tn, createdAt:Date.now() });
    }
  });
  addCaseMsg.textContent = "登録完了";
};
anotherCaseBtn.onclick = () => { initAddCaseView(); showView("add-case-view"); };

// ——— 8) 検索 ———
searchBtn.onclick = () => {
  const kw = searchInput.value.trim(),
        uid= auth.currentUser.uid;
  db.ref(`cases/${uid}`)
    .orderByChild("注番")
    .startAt(kw).endAt(kw+"\uf8ff")
    .once("value")
    .then(snap => {
      searchResults.innerHTML = "";
      const data = snap.val()||{};
      Object.entries(data).forEach(([id,obj])=>{
        const li = document.createElement("li");
        li.textContent = `${id} / ${obj.得意先} / ${obj.品名}`;
        li.onclick = ()=> showCaseDetail(id,obj);
        searchResults.append(li);
      });
    });
};

// ——— 9) 詳細表示＆ステータス取得 ———
function showCaseDetail(orderId,obj) {
  mainView.querySelectorAll(".subview").forEach(el=>el.style.display="none");
  caseDetailView.style.display="block";
  detailInfoDiv.innerHTML = `
    <div>受注番号: ${orderId}</div>
    <div>得意先:   ${obj.得意先}</div>
    <div>品名:     ${obj.品名}</div>
  `;
  detailShipmentsUl.innerHTML = "";
  db.ref(`shipments/${auth.currentUser.uid}/${orderId}`)
    .once("value").then(snap=>{
      Object.values(snap.val()||{}).forEach(item=>{
        const li = document.createElement("li");
        li.textContent = `${item.carrier}:${item.tracking} → 読み込み中...`;
        detailShipmentsUl.append(li);
        // Apps Script へPOST
        fetch(STATUS_ENDPOINT, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ carrier:item.carrier, tracking:item.tracking })
        })
        .then(r=>r.json())
        .then(json=>{
          li.textContent = `${item.carrier}:${item.tracking} → ${json.status||json.error}`;
        })
        .catch(_=>{
          li.textContent = `${item.carrier}:${item.tracking} → 取得失敗`;
        });
      });
    });
}
backToSearchBtn.onclick = () => showView("search-view");
anotherCaseBtn2.onclick  = () => { initAddCaseView(); showView("add-case-view"); };
