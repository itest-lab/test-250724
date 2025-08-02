// main.js

// --- Firebase 初期化 ---
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

// --- 認証設定 ---
auth.signOut().catch(err => console.warn("初期サインアウト失敗:", err));
auth.setPersistence(firebase.auth.Auth.Persistence.NONE);

// --- 定数 ---
const API_BASE_URL = "https://tracking-api-worker.hr46-ksg.workers.dev"; // tracking-api Worker URL

// --- ユーティリティ関数 ---
function clearLoginTime() {
  localStorage.removeItem("loginTime");
}
function markLoginTime() {
  localStorage.setItem("loginTime", Date.now());
}
function showLoading() {
  document.getElementById("loading-overlay").classList.remove("hidden");
}
function hideLoading() {
  document.getElementById("loading-overlay").classList.add("hidden");
}
function showView(el) {
  document.querySelectorAll(".subview").forEach(v => v.classList.add("hidden"));
  el.classList.remove("hidden");
}

// --- DOM 要素取得 ---
// ナビゲーション
const navLogin           = document.getElementById("nav-login");
const navAddCase         = document.getElementById("nav-add-case");
const navSearchCase      = document.getElementById("nav-search-case");
// ビュー
const loginView          = document.getElementById("login-view");
const addCaseView        = document.getElementById("add-case-view");
const searchCaseView     = document.getElementById("search-case-view");
const caseDetailView     = document.getElementById("case-detail-view");
// ログインフォーム
const emailInput         = document.getElementById("email-input");
const passwordInput      = document.getElementById("password-input");
const loginBtn           = document.getElementById("login-btn");
const loginErrorEl       = document.getElementById("login-error");
// 案件追加フォーム
const switchToManualBtn  = document.getElementById("switch-to-manual");
const manualInputForm    = document.getElementById("manual-input-form");
const caseOrderIdInput   = document.getElementById("case-order-id");
const caseClientInput    = document.getElementById("case-client");
const caseItemInput      = document.getElementById("case-item");
const fixedCarrierSelect = document.getElementById("fixed-carrier");
const trackingRowsDiv    = document.getElementById("tracking-rows");
const addTrackingRowBtn  = document.getElementById("add-tracking-row-btn");
const registerCaseBtn    = document.getElementById("register-case-btn");
const cancelAddCaseBtn   = document.getElementById("cancel-add-case-btn");
// 案件検索フォーム
const searchKeywordInput = document.getElementById("search-keyword");
const searchBtn          = document.getElementById("search-btn");
const searchResultsUl    = document.getElementById("search-results");
// 案件詳細
const detailInfoDiv      = document.getElementById("detail-info");
const detailShipmentsUl  = document.getElementById("detail-shipments");
const detailAddRowBtn    = document.getElementById("detail-add-row-btn");
const detailAddForm      = document.getElementById("detail-add-form");
const detailFixedCarrier = document.getElementById("detail-fixed-carrier");
const detailTrackingRows = document.getElementById("detail-tracking-rows");
const detailConfirmAddBtn= document.getElementById("detail-confirm-add-btn");
const detailCancelAddBtn = document.getElementById("detail-cancel-add-btn");
const detailAddMsg       = document.getElementById("detail-add-msg");
// ローディング
const loadingOverlay     = document.getElementById("loading-overlay");

// --- イベント：ナビゲーション ---
navLogin.addEventListener("click", () => showView(loginView));
navAddCase.addEventListener("click", () => showView(addCaseView));
navSearchCase.addEventListener("click", () => showView(searchCaseView));

// --- ログイン処理 ---
loginBtn.addEventListener("click", async () => {
  loginErrorEl.textContent = "";
  clearLoginTime();
  try {
    await auth.signInWithEmailAndPassword(
      emailInput.value.trim(),
      passwordInput.value
    );
    markLoginTime();
    showView(addCaseView);
  } catch (e) {
    loginErrorEl.textContent = e.message;
  }
});

// --- API 呼び出し：追跡ステータス取得 ---
async function fetchTrackingStatus(carrier, tracking) {
  try {
    const res = await axios.get(API_BASE_URL, {
      params: { carrier, tracking }
    });
    return res.data; // { status, time }
  } catch (e) {
    console.error("API取得エラー:", e);
    return { status: "取得エラー", time: "" };
  }
}

// --- 案件追加：追跡行追加 ---
function createTrackingRow(container) {
  const row = document.createElement("div");
  row.className = "tracking-row";
  row.innerHTML = `
    <input class="tracking-input" placeholder="追跡番号" />
    <select class="carrier-select">
      <option value="">運送会社を選択</option>
      <option value="sagawa">佐川急便</option>
      <option value="yamato">ヤマト運輸</option>
      <option value="fukuyama">福山通運</option>
      <option value="seino">西濃運輸</option>
      <option value="tonami">トナミ運輸</option>
      <option value="hida">飛騨運輸</option>
    </select>
    <button class="remove-row-btn">×</button>
  `;
  // ライブラリ化せず、直接イベントをセット
  row.querySelector(".remove-row-btn").addEventListener("click", () => {
    container.removeChild(row);
  });
  container.appendChild(row);
}

// 初期行を 1 行追加
addTrackingRowBtn.addEventListener("click", () => {
  createTrackingRow(trackingRowsDiv);
});
// キャンセル
cancelAddCaseBtn.addEventListener("click", () => {
  showView(addCaseView); // 戻す（詳細に遷移させるなら調整）
});

// --- 案件登録処理 ---
registerCaseBtn.addEventListener("click", async () => {
  const orderId = caseOrderIdInput.value.trim();
  const client  = caseClientInput.value.trim();
  const item    = caseItemInput.value.trim();
  if (!orderId || !client || !item) {
    alert("受注番号・得意先・品名をすべて入力してください。");
    return;
  }

  // 追跡情報取得
  const rows = Array.from(trackingRowsDiv.querySelectorAll(".tracking-row"));
  const shipments = rows.map(r => {
    const tracking = r.querySelector(".tracking-input").value.trim();
    const carrier  = r.querySelector(".carrier-select").value;
    return (tracking && carrier) ? { tracking, carrier } : null;
  }).filter(x => x);

  if (shipments.length === 0) {
    alert("少なくとも1件の追跡番号と運送会社を入力してください。");
    return;
  }

  showLoading();
  try {
    // ケース情報
    await db.ref(`cases/${orderId}`).set({ client, item });

    // 各追跡情報を登録
    const updates = {};
    shipments.forEach(s => {
      const key = db.ref().child(`shipments/${orderId}`).push().key;
      updates[`shipments/${orderId}/${key}`] = {
        tracking: s.tracking,
        carrier: s.carrier,
        addedAt: Date.now()
      };
    });
    await db.ref().update(updates);

    alert("案件と追跡情報を登録しました。");
    // フォームクリア
    caseOrderIdInput.value = "";
    caseClientInput.value  = "";
    caseItemInput.value    = "";
    trackingRowsDiv.innerHTML = "";
  } catch (e) {
    console.error(e);
    alert("登録中にエラーが発生しました。");
  } finally {
    hideLoading();
  }
});

// --- 案件検索処理 ---
searchBtn.addEventListener("click", async () => {
  const kw = searchKeywordInput.value.trim().toLowerCase();
  if (!kw) {
    alert("検索キーワードを入力してください。");
    return;
  }

  showLoading();
  try {
    const snap = await db.ref("cases").once("value");
    const cases = snap.val() || {};
    searchResultsUl.innerHTML = "";

    Object.entries(cases).forEach(([orderId, data]) => {
      if (
        orderId.toLowerCase().includes(kw) ||
        data.client.toLowerCase().includes(kw) ||
        data.item.toLowerCase().includes(kw)
      ) {
        const li = document.createElement("li");
        li.textContent = `受注番号: ${orderId} / 得意先: ${data.client} / 品名: ${data.item}`;
        li.style.cursor = "pointer";
        li.addEventListener("click", () => {
          showCaseDetail(orderId, data);
        });
        searchResultsUl.appendChild(li);
      }
    });

    if (!searchResultsUl.hasChildNodes()) {
      searchResultsUl.innerHTML = "<li>該当する案件がありません。</li>";
    }
    showView(searchCaseView);
  } catch (e) {
    console.error(e);
    alert("検索中にエラーが発生しました。");
  } finally {
    hideLoading();
  }
});

// --- 案件詳細表示 & 追跡ステータス取得 ---
async function showCaseDetail(orderId, caseObj) {
  showView(caseDetailView);
  detailInfoDiv.innerHTML = `
    <p>受注番号: ${orderId}</p>
    <p>得意先: ${caseObj.client}</p>
    <p>品名: ${caseObj.item}</p>
  `;
  detailShipmentsUl.innerHTML = "";
  detailAddForm.classList.add("hidden");
  detailAddMsg.textContent = "";

  showLoading();
  try {
    const snap = await db.ref(`shipments/${orderId}`).once("value");
    const list = snap.val() || {};

    for (const [key, it] of Object.entries(list)) {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${it.tracking}</span>
        <span class="status">取得中...</span>
        <span class="time"></span>
      `;
      detailShipmentsUl.appendChild(li);

      const { status, time } = await fetchTrackingStatus(it.carrier, it.tracking);
      li.querySelector(".status").textContent = status;
      li.querySelector(".time").textContent   = time;
    }
  } catch (e) {
    console.error(e);
    alert("詳細取得中にエラーが発生しました。");
  } finally {
    hideLoading();
  }
}

// --- 案件詳細：追跡追加 ---
detailAddRowBtn.addEventListener("click", () => {
  detailAddForm.classList.remove("hidden");
  createTrackingRow(detailTrackingRows);
});
detailCancelAddBtn.addEventListener("click", () => {
  detailAddForm.classList.add("hidden");
  detailTrackingRows.innerHTML = "";
  detailAddMsg.textContent = "";
});
detailConfirmAddBtn.addEventListener("click", async () => {
  const orderId = detailInfoDiv.querySelector("p").textContent.split("受注番号: ")[1];
  const rows = Array.from(detailTrackingRows.querySelectorAll(".tracking-row"));
  const newShipments = rows.map(r => {
    const tracking = r.querySelector(".tracking-input").value.trim();
    const carrier  = r.querySelector(".carrier-select").value;
    return (tracking && carrier) ? { tracking, carrier } : null;
  }).filter(x => x);

  if (newShipments.length === 0) {
    alert("追加する追跡情報を入力してください。");
    return;
  }

  showLoading();
  try {
    const updates = {};
    newShipments.forEach(s => {
      const key = db.ref().child(`shipments/${orderId}`).push().key;
      updates[`shipments/${orderId}/${key}`] = {
        tracking: s.tracking,
        carrier: s.carrier,
        addedAt: Date.now()
      };
    });
    await db.ref().update(updates);

    detailAddMsg.textContent = "追加登録しました。";
    detailTrackingRows.innerHTML = "";
    detailAddForm.classList.add("hidden");
    // 再読み込み
    await showCaseDetail(orderId, {
      client: detailInfoDiv.querySelectorAll("p")[1].textContent.split("得意先: ")[1],
      item:   detailInfoDiv.querySelectorAll("p")[2].textContent.split("品名: ")[1]
    });
  } catch (e) {
    console.error(e);
    alert("追加登録中にエラーが発生しました。");
  } finally {
    hideLoading();
  }
});

// --- ビュー切り替えボタン（詳細 → 検索 or 追加） ---
document.getElementById("back-to-search-btn").addEventListener("click", () => {
  showView(searchCaseView);
});
document.getElementById("back-to-add-case-btn").addEventListener("click", () => {
  showView(addCaseView);
});

// --- ページロード時 初期表示 ---
showView(loginView);
createTrackingRow(trackingRowsDiv);      // 登録フォームに 1 行目追加
