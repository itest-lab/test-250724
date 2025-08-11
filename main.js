/**
 * main.js
 * 概要: 受注案件の登録・検索・詳細表示・追跡番号管理（固定キャリア対応）
 * 変更点（要件反映）:
 *  - 固定ONでも各行<select>は消さない（行選択が優先。未選択は固定値で補完）
 *  - 固定<select>変更時は「未選択」の行にだけ反映
 *  - バリデーションは「行選択 or 固定値」のどちらかがあれば通過
 *  - 進捗ホイールは案件詳細の「最後のステータス取得完了」まで表示
 */

/* ------------------------------
 * Firebase 初期化
 * ------------------------------ */
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
const db = firebase.database();

/* ------------------------------
 * Firebase 認証エラーメッセージ整形
 * ------------------------------ */
function authErrorToMessage(e){
  const code = (e && e.code) ? String(e.code) : "";
  switch(code){
    case "auth/invalid-email": return "メールアドレスの形式が正しくありません";
    case "auth/user-disabled": return "このユーザーは無効化されています";
    case "auth/user-not-found": return "ユーザーが見つかりません";
    case "auth/wrong-password": return "パスワードが正しくありません";
    case "auth/network-request-failed": return "ネットワークエラーが発生しました";
    case "auth/too-many-requests": return "試行回数が多すぎます。しばらくしてから再試行してください";
    case "auth/invalid-credential": return "認証情報が無効です";
    default: return (e && e.message) ? e.message : "ログインに失敗しました";
  }
}


// セッション永続化: ブラウザのタブ単位（閉じると失効）
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
  .catch(err => console.error("永続化設定エラー:", err));

// 事業者名ラベルと各社の追跡ページURL
const carrierLabels = {
  yamato:  "ヤマト運輸",
  fukuyama: "福山通運",
  seino:   "西濃運輸",
  tonami:  "トナミ運輸",
  hida:    "飛騨運輸",
  sagawa:  "佐川急便"
};
const carrierUrls = {
  yamato:  "https://member.kms.kuronekoyamato.co.jp/parcel/detail?pno=",
  fukuyama: "https://corp.fukutsu.co.jp/situation/tracking_no_hunt/",
  seino:   "https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=",
  tonami:  "https://trc1.tonami.co.jp/trc/search3/excSearch3?id[0]=",
  // 飛騨運輸: 追跡API非対応のため固定URL
  hida:    "http://www.hida-unyu.co.jp/WP_HIDAUNYU_WKSHO_GUEST/KW_UD04015.do?_Action_=a_srcAction",
  sagawa:  "https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo="
};

/* ------------------------------
 * モバイル用カメラ読取（html5-qrcode）
 * ------------------------------ */
function isMobileDevice() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return /android|iPad|iPhone|iPod/i.test(ua);
}
let html5QrCode = null;
let torchOn = false;
function mmToPx(mm) { return mm * (96 / 25.4); }

// 背面カメラ優先選択
async function selectBackCamera() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const backs = devices.filter(d => d.kind === 'videoinput' && /back|rear|environment/i.test(d.label));
    if (backs.length > 1) return backs[1].deviceId;
    if (backs.length === 1) return backs[0].deviceId;
  } catch (_) {}
  return null;
}

/* ------------------------------
 * 追跡番号のフォーマット/正規化（福山の末尾01対応）
 * ------------------------------ */
function formatTrackingForDisplay(carrier, tracking) {
  if (carrier === "fukuyama" && typeof tracking === "string" && tracking.length > 2 && tracking.endsWith("01")) {
    return tracking.slice(0, -2);
  }
  return tracking;
}
function trackingForApi(carrier, tracking) {
  if (carrier === "fukuyama" && typeof tracking === "string" && tracking.length > 2 && tracking.endsWith("01")) {
    return tracking.slice(0, -2);
  }
  return tracking;
}
function normalizeTrackingForSave(carrier, tracking) {
  if (carrier === "fukuyama" && typeof tracking === "string" && tracking.length > 2 && tracking.endsWith("01")) {
    return tracking.slice(0, -2);
  }
  return tracking;
}

/* ------------------------------
 * CODABAR の A/B/C/D を両端から除去（ラベル部）
 * ------------------------------ */
function normalizeCodabar(value){
  if (!value || value.length < 2) return value || '';
  const pre = value[0], suf = value[value.length - 1];
  if (/[ABCD]/i.test(pre) && /[ABCD]/i.test(suf)) {
    const core = value.substring(1, value.length - 1);
    return (core.length <= 9) ? '' : core;
  }
  return value;
}

/* ------------------------------
 * カメラ読取開始（PCは無効）
 * ------------------------------ */
async function startScanning(formats, inputId) {
  if (!isMobileDevice()) { alert('このデバイスではカメラ機能を利用できません'); return; }
  if (html5QrCode) { try { await html5QrCode.stop(); html5QrCode.clear(); } catch (_) {} html5QrCode = null; }

  // 画面オーバーレイのリサイズ
  const margin = mmToPx(5) * 2;
  const vw = window.innerWidth, vh = window.innerHeight, ratio = 9/16;
  let w = vw - margin, h = vh - margin;
  if (w / h > ratio) w = h * ratio; else h = w / ratio;
  const sc = document.getElementById('scanner-container');
  if (sc) { sc.style.width = w + 'px'; sc.style.height = h + 'px'; }

  const overlay = document.getElementById('scanner-overlay');
  if (overlay) { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; }

  // カメラ起動
  html5QrCode = new Html5Qrcode('video-container', false);
  const backId = await selectBackCamera();

  // ★端末側制約：連続AFとフレームレート控えめ
  // html5-qrcode の cameraConfig は video ラッパーなし
  const cameraConfig = backId
    ? { deviceId: { exact: backId } }
    : { facingMode: "environment" };
  
  // ★読取り設定
  const isCodabarOnly = (formats.length === 1 && formats[0] === Html5QrcodeSupportedFormats.CODABAR);
  const config = {
    fps: 8, // ← 下げて安定化
    formatsToSupport: formats,
    // CODABARは BarCodeDetector を使わない方が安定
    useBarCodeDetectorIfSupported: isCodabarOnly ? false : true,
    // スキャン窓（横長）。PCでもモバイルでも過負荷を避ける
    qrbox: isCodabarOnly
      ? { width: Math.min(window.innerWidth - 40, 320), height: 120 }
      : { width: Math.min(window.innerWidth - 40, 320), height: Math.min(window.innerWidth - 40, 320) }
  };

  // デコード成功時のハンドラ
  const onSuccess = decoded => {
    try {
      const inputEl = document.getElementById(inputId);
      if (!inputEl) { stopScanning(); return; }

      let value = String(decoded);
// CODABAR最短長チェック: A-Dがなくても数字のみ9桁以下は無視
{
  const hasCodabar = Array.isArray(formats) && formats.includes(Html5QrcodeSupportedFormats.CODABAR);
  if (hasCodabar) {
    const pre = value[0], suf = value[value.length - 1];
    const core = (/[ABCD]/i.test(pre) && /[ABCD]/i.test(suf)) ? value.substring(1, value.length - 1) : value;
    if (/^\d{1,9}$/.test(core)) return; // 継続スキャン
  }
}

      // CODABAR: 両端A/B/C/Dが付いている場合は常に正規化。9文字以下は継続スキャン
      {
        const pre = value[0], suf = value[value.length - 1];
        if (/[ABCD]/i.test(pre) && /[ABCD]/i.test(suf)) {
          value = normalizeCodabar(value);
          if (!value) return; // 継続
        }
      }

            // 追跡番号系の短桁誤読防止: case-barcode 以外で純数字9桁以下は無視
      if (inputId !== 'case-barcode') {
        const pre2 = value[0], suf2 = value[value.length - 1];
        const core2 = (/^[ABCD]$/i.test(pre2) && /^[ABCD]$/i.test(suf2)) ? value.substring(1, value.length - 1) : value;
        if (/^\d{1,9}$/.test(core2)) return; // 継続スキャン
      }
inputEl.value = value;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));

      // 案件バーコード欄のみ自動確定
      if (inputId === 'case-barcode') processCaseBarcode(value);
      stopScanning();
    } catch (err) {
      console.error(err);
      stopScanning();
    }
  };

  try {
    await html5QrCode.start(cameraConfig, config, onSuccess, () => {});
    // ★起動直後にAFを一度だけ強制（対応端末のみ）
    setTimeout(() => {
      if (html5QrCode) {
        html5QrCode.applyVideoConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(()=>{});
      }
    }, 200);
  } catch (e) {
    console.error(e);
    alert('カメラ起動に失敗しました');
    stopScanning();
  }

  // ワンタップAF（対応端末）
  const videoContainer = document.getElementById('video-container');
  if (videoContainer) {
    videoContainer.addEventListener('click', async () => {
      if (html5QrCode) { try { await html5QrCode.applyVideoConstraints({ advanced: [{ focusMode: 'single-shot' }] }); } catch (_) {} }
    });
  }
}
async function stopScanning() {
  if (html5QrCode) { try { await html5QrCode.stop(); html5QrCode.clear(); } catch (_) {} html5QrCode = null; }
  const overlay = document.getElementById('scanner-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  torchOn = false;
}
async function toggleTorch() {
  if (!html5QrCode) return;
  try {
    const settings = html5QrCode.getRunningTrackSettings();
    if (!('torch' in settings)) { alert('このデバイスはライトに対応していません'); return; }
    torchOn = !torchOn;
    await html5QrCode.applyVideoConstraints({ advanced: [{ torch: torchOn }] });
  } catch (e) { console.warn(e); }
}

// カメラUIの初期化（DOMContentLoaded）
window.addEventListener('DOMContentLoaded', () => {
  try{ ensureFixedCarrierToolbar('add'); }catch(_){}
  const closeBtn = document.getElementById('close-button');
  if (closeBtn) closeBtn.addEventListener('click', () => stopScanning());
  const torchBtn = document.getElementById('torch-button');
  if (torchBtn) torchBtn.addEventListener('click', () => toggleTorch());

  const caseCameraBtn = document.getElementById('case-camera-btn');
  if (caseCameraBtn) {
    if (isMobileDevice()) {
      caseCameraBtn.style.display = 'block';
      caseCameraBtn.addEventListener('click', () => {
        startScanning([Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.PDF_417], 'case-barcode');
      });
    } else {
      caseCameraBtn.style.display = 'none';
    }
  }
  // ページ上部へ戻るボタン
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      backToTopBtn.style.display = window.scrollY > 100 ? 'block' : 'none';
    });
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});

/* ------------------------------
 * 画面共通状態・DOM参照
 * ------------------------------ */
let isAdmin = false;
let sessionTimer;
let currentOrderId = null;

// 主要ビュー
const loginView             = document.getElementById("login-view");
const mainView              = document.getElementById("main-view");
const loginErrorEl          = document.getElementById("login-error");

// ログインフォーム
const emailInput            = document.getElementById("email");
const passwordInput         = document.getElementById("password");
const loginBtn              = document.getElementById("login-btn");
const signupBtn             = document.getElementById("signup-btn");
const guestBtn              = document.getElementById("guest-btn");
const resetBtn              = document.getElementById("reset-btn");
const logoutBtn             = document.getElementById("logout-btn");

// 新規登録ビュー
const signupView            = document.getElementById("signup-view");
const signupEmail           = document.getElementById("signup-email");
const signupPassword        = document.getElementById("signup-password");
const signupConfirmPassword = document.getElementById("signup-confirm-password");
const signupConfirmBtn      = document.getElementById("signup-confirm-btn");
const backToLoginBtn        = document.getElementById("back-to-login-btn");
const signupErrorEl         = document.getElementById("signup-error");

// ナビゲーション
const navAddBtn             = document.getElementById("nav-add-btn");
const navSearchBtn          = document.getElementById("nav-search-btn");

// 追加画面（QR/手動）
const scanModeDiv           = document.getElementById("scan-mode");
const manualModeDiv         = document.getElementById("manual-mode");
const startManualBtn        = document.getElementById("start-manual-btn");
const caseBarcodeInput      = document.getElementById("case-barcode");
const manualOrderIdInput    = document.getElementById("manual-order-id");
const manualCustomerInput   = document.getElementById("manual-customer");
const manualTitleInput      = document.getElementById("manual-title");
const manualPlateDateInput  = document.getElementById("manual-plate-date");
const manualConfirmBtn      = document.getElementById("manual-confirm-btn");
const startScanBtn          = document.getElementById("start-scan-btn");

// QR展開後の表示ブロック
const caseDetailsDiv        = document.getElementById("case-details");
const detailOrderId         = document.getElementById("detail-order-id");
const detailCustomer        = document.getElementById("detail-customer");
const detailTitle           = document.getElementById("detail-title");
const detailPlateDate       = document.getElementById("detail-plate-date");

// 追跡番号入力（案件追加画面）
const fixedCarrierCheckbox  = document.getElementById("fixed-carrier-checkbox");
const fixedCarrierSelect    = document.getElementById("fixed-carrier-select");
const trackingRows          = document.getElementById("tracking-rows");
const addTrackingRowBtn     = document.getElementById("add-tracking-row-btn");
const confirmAddCaseBtn     = document.getElementById("confirm-add-case-btn");
const addCaseMsg            = document.getElementById("add-case-msg");
const anotherCaseBtn        = document.getElementById("another-case-btn");

// ▼ 追跡入力のキーボード移動（委譲）
function wireDelegatedNav(container, addBtn, context){
  if(!container) return;
  container.addEventListener('keydown', e => {
    const t = e.target;
    if(!(t && t.matches && t.matches('input[type="text"].tracking-input'))) return;
    if(e.key !== 'Enter' && e.key !== 'Tab') return;
    e.preventDefault();
    const inputs = Array.from(container.querySelectorAll('input[type="text"].tracking-input'));
    const countBefore = inputs.length;
    const idx = inputs.indexOf(t);
    if(idx !== -1 && idx < countBefore - 1){
      inputs[idx+1].focus();
    } else {
      if(addBtn) addBtn.click();
      setTimeout(() => {
        const newInputs = Array.from(container.querySelectorAll('input[type="text"].tracking-input'));
        if(newInputs[countBefore]) newInputs[countBefore].focus();
        try{ renumberTrackingRows(context||'add'); }catch(_){}
      },0);
    }
  });
  container.addEventListener('beforeinput', e => {
    const t = e.target;
    if(!(t && t.matches && t.matches('input[type="text"].tracking-input'))) return;
    if(e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return;
    e.preventDefault();
    const inputs = Array.from(container.querySelectorAll('input[type="text"].tracking-input'));
    const countBefore = inputs.length;
    const idx = inputs.indexOf(t);
    if(idx !== -1 && idx < countBefore - 1){ inputs[idx+1].focus(); }
    else {
      if(addBtn) addBtn.click();
      setTimeout(() => {
        const newInputs = Array.from(container.querySelectorAll('input[type="text"].tracking-input'));
        if(newInputs[countBefore]) newInputs[countBefore].focus();
        try{ renumberTrackingRows(context||'add'); }catch(_){}
      },0);
    }
  });
}
wireDelegatedNav(trackingRows, addTrackingRowBtn, 'add');
try{ wireDelegatedNav(document.getElementById('detail-tracking-rows'), document.getElementById('detail-add-tracking-row-btn'), 'detail'); }catch(_){}

// 検索ビュー
const searchView            = document.getElementById("search-view");
const searchInput           = document.getElementById("search-input");
const searchDateType        = document.getElementById("search-date-type");
const startDateInput        = document.getElementById("start-date");
const endDateInput          = document.getElementById("end-date");
const searchBtn             = document.getElementById("search-btn");
const listAllBtn            = document.getElementById("list-all-btn");
const searchResults         = document.getElementById("search-results");
const deleteSelectedBtn     = document.getElementById("delete-selected-btn");


// ▼ 追加：ページング関連
const pageSizeSelect        = document.getElementById("page-size-select");
const paginationDiv         = document.getElementById("pagination");
let fullResults = [];
let currentPage = 1;
let pageSize = 50;
if (pageSizeSelect) {
  pageSizeSelect.value = String(pageSize);
  pageSizeSelect.onchange = () => {
    pageSize = parseInt(pageSizeSelect.value, 10) || 50;
    currentPage = 1;
    renderPage();
  };
}
// 一覧の全選択
const selectAllContainer    = document.getElementById("select-all-container");
const selectAllCheckbox     = document.getElementById("select-all-checkbox");
if (selectAllCheckbox) {
  selectAllCheckbox.onchange = () => {
    const check = selectAllCheckbox.checked;
    const boxes = searchResults.querySelectorAll(".select-case-checkbox");
    boxes.forEach(cb => { cb.checked = check; });
  };
}

// 詳細ビュー
const caseDetailView        = document.getElementById("case-detail-view");
const detailInfoDiv         = document.getElementById("detail-info");
const detailShipmentsUl     = document.getElementById("detail-shipments");
const showAddTrackingBtn    = document.getElementById("show-add-tracking-btn");
const addTrackingDetail     = document.getElementById("add-tracking-detail");
const detailTrackingRows    = document.getElementById("detail-tracking-rows");
const detailAddRowBtn       = document.getElementById("detail-add-tracking-row-btn");
const confirmDetailAddBtn   = document.getElementById("confirm-detail-add-btn");
const detailAddMsg          = document.getElementById("detail-add-msg");
const cancelDetailAddBtn    = document.getElementById("cancel-detail-add-btn");
const fixedCarrierCheckboxDetail = document.getElementById("fixed-carrier-checkbox-detail");
const fixedCarrierSelectDetail   = document.getElementById("fixed-carrier-select-detail");
const backToSearchBtn       = document.getElementById("back-to-search-btn");
const anotherCaseBtn2       = document.getElementById("another-case-btn-2");

// 進捗ホイール
const loadingOverlay = document.getElementById("loadingOverlay");
function showLoading(){ if (loadingOverlay) loadingOverlay.classList.remove("hidden"); }
function hideLoading(){ if (loadingOverlay) loadingOverlay.classList.add("hidden"); }

/* ------------------------------
 * セッションタイムアウト制御（10分）
 * ------------------------------ */
const SESSION_LIMIT_MS = 10 * 60 * 1000;
function clearLoginTime() { localStorage.removeItem('loginTime'); }
function markLoginTime()  { localStorage.setItem('loginTime', Date.now().toString()); }
function isSessionExpired(){
  const t = parseInt(localStorage.getItem('loginTime') || '0', 10);
  return (Date.now() - t) > SESSION_LIMIT_MS;
}
// ページ読込時に期限切れなら強制サインアウト
if (auth && auth.currentUser && isSessionExpired()) {
  auth.signOut().catch(err => console.warn("セッションタイムアウト時サインアウト失敗:", err));
  try { localStorage.removeItem('loginTime'); } catch (_) {}
  clearLoginTime();
}

// サブビュー切替
function showView(id){
  document.querySelectorAll(".subview").forEach(el=>el.style.display="none");
  const target = document.getElementById(id);
  if (target) target.style.display = "block";
}

// ヘッダのログイン状態ラベル更新
auth.onAuthStateChanged(user => {
  const statusContainer = document.getElementById('login-status-container');
  statusContainer.textContent = '';
  statusContainer.textContent = user ? (user.email || '匿名') + ' でログイン中' : 'ログインしてください';
});

// --- モバイルメニューの表示制御 ---
const mobileMenuBtn   = document.getElementById('mobile-menu-btn');
const mobileMenuPanel = document.getElementById('mobile-menu-panel');
const mobileMenuAdd   = document.getElementById('mobile-menu-add');
const mobileMenuSearch= document.getElementById('mobile-menu-search');

function updateMobileMenuVisibility(){
  if (!isMobileDevice()) { mobileMenuBtn.style.display = 'none'; mobileMenuPanel.style.display = 'none'; return; }
  // 上から少しスクロールしたら表示
  mobileMenuBtn.style.display = (window.scrollY > 24) ? 'block' : 'none';
  if (window.scrollY <= 24) mobileMenuPanel.style.display = 'none';
}
window.addEventListener('scroll', updateMobileMenuVisibility, { passive:true });
window.addEventListener('resize', updateMobileMenuVisibility);
updateMobileMenuVisibility();

mobileMenuBtn.addEventListener('click', ()=>{
  mobileMenuPanel.style.display = (mobileMenuPanel.style.display === 'none' || !mobileMenuPanel.style.display) ? 'block' : 'none';
});
document.addEventListener('click', (e)=>{
  if (!mobileMenuPanel.contains(e.target) && e.target !== mobileMenuBtn) mobileMenuPanel.style.display = 'none';
});

mobileMenuAdd.addEventListener('click', ()=>{
  mobileMenuPanel.style.display = 'none';
  showView('add-case-view');
  initAddCaseView();
});
mobileMenuSearch.addEventListener('click', ()=>{
  mobileMenuPanel.style.display = 'none';
  showView('search-view');
  searchInput.value = ""; startDateInput.value = ""; endDateInput.value = "";
  searchAll();
});

/* ------------------------------
 * 認証操作（ログイン/新規/匿名/再発行/サインアウト）
 * ------------------------------ */

loginBtn.onclick = async () => {
  const email = (emailInput.value || "").trim();
  const password = passwordInput.value || "";
  loginErrorEl.textContent = "";
  if (!email || !password) { loginErrorEl.textContent = "メールとパスワードを入力してください"; return; }
  try { await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); } catch(_) {}
  try {
    await auth.signInWithEmailAndPassword(email, password);
    markLoginTime();
  } catch (e) {
    console.error("signIn error:", e);
    loginErrorEl.textContent = authErrorToMessage(e);
  }
};

signupBtn.onclick = () => {
  loginView.style.display = "none";
  signupView.style.display = "block";
  signupEmail.value = emailInput.value.trim() || "";
  signupPassword.value = "";
  signupConfirmPassword.value = "";
  signupErrorEl.textContent = "";
};
guestBtn.onclick = () => { auth.signInAnonymously().catch(e => loginErrorEl.textContent = e.message); };
resetBtn.onclick = () => {
  const email = emailInput.value.trim();
  auth.sendPasswordResetEmail(email)
    .then(() => loginErrorEl.textContent = "再発行メール送信")
    .catch(e => loginErrorEl.textContent = e.message);
};
logoutBtn.onclick = async () => {
  try { await auth.signOut(); } catch (e) { console.error("サインアウトエラー:", e); }
  emailInput.value = ""; passwordInput.value = ""; clearLoginTime(); localStorage.clear();
};

/* ------------------------------
 * 新規登録処理
 * ------------------------------ */
signupConfirmBtn.onclick = async () => {
  const email = signupEmail.value.trim();
  const pass  = signupPassword.value;
  const confirmPass = signupConfirmPassword.value;
  signupErrorEl.textContent = "";
  if (!email || !pass || !confirmPass) { signupErrorEl.textContent = "全て入力してください"; return; }
  if (pass !== confirmPass) { signupErrorEl.textContent = "パスワードが一致しません"; return; }
  try { await auth.createUserWithEmailAndPassword(email, pass); markLoginTime(); }
  catch (e) { signupErrorEl.textContent = e.message; }
};
backToLoginBtn.onclick = () => {
  signupView.style.display = "none"; loginView.style.display  = "block";
  signupErrorEl.textContent = ""; loginErrorEl.textContent = "";
};

/* ------------------------------
 * ナビゲーション
 * ------------------------------ */
navAddBtn.addEventListener("click", () => { showView("add-case-view"); initAddCaseView(); });
navSearchBtn.addEventListener("click", () => {
  showView("search-view");
  if (pageSizeSelect) pageSizeSelect.value = "50";
  pageSize = parseInt((pageSizeSelect && pageSizeSelect.value) || "50", 10) || 50;
  currentPage = 1;
  searchAll("");
});

/* ------------------------------
 * 画像/PDF から PDF417・CODABAR を抽出（PC補助）
 * ------------------------------ */
async function decodeWithBarcodeDetectorFromBitmap(bitmap){
  if (!('BarcodeDetector' in window)) return null;
  try {
    const det = new BarcodeDetector({ formats: ['pdf417','codabar'] });
    const results = await det.detect(bitmap);
    if (results && results.length) return results[0].rawValue || '';
  } catch (_) {}
  return null;
}
async function decodeFromImage(fileOrBlob){
  try {
    const bmp = await createImageBitmap(fileOrBlob);
    const v = await decodeWithBarcodeDetectorFromBitmap(bmp);
    if (v) return v;
  } catch (_) {}
  if (window.Html5Qrcode) {
    const tmpId = 'file-decode-' + Date.now();
    const div = document.createElement('div');
    div.id = tmpId; div.style.display='none'; document.body.appendChild(div);
    const h5 = new Html5Qrcode(tmpId, false);
    try { return await h5.scanFile(fileOrBlob, false); }
    catch(_) {}
    finally { try { await h5.clear(); } catch (_) {} div.remove(); }
  }
  return null;
}
// pdf.js を遅延ロード
async function ensurePdfJsLoaded() {
  if (window.pdfjsLib) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = resolve; s.onerror = () => reject(new Error('pdf.js の読み込みに失敗'));
    document.head.appendChild(s);
  });
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
}
async function decodeFromPdf(file){
  await ensurePdfJsLoaded();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise(res => canvas.toBlob(res));
    if (!blob) continue;
    const v = await decodeFromImage(blob);
    if (v) return v;
  }
  return null;
}
async function scanFileForCodes(file){
  const type = (file.type || '').toLowerCase();
  let v = null;
  if (type.includes('pdf')) v = await decodeFromPdf(file);
  else v = await decodeFromImage(file);
  if (!v) return null;

  const n = normalizeCodabar(String(v));
  return (/^\d{1,9}$/.test(n) ? null : n);
}

/* ------------------------------
 * 行番号付与と固定キャリアツールバー配置
 * ------------------------------ */
function renumberTrackingRows(context="add"){
  const container = (context === "detail") ? detailTrackingRows : trackingRows;
  if (!container) return;
  const rows = Array.from(container.children);
  rows.forEach((row, idx) => {
    let badge = row.querySelector('.row-no');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'row-no'; badge.style.cssText = 'display:inline-block;width:3ch;text-align:right;margin-right:.25em;font-weight:600;font-variant-numeric:tabular-nums;';
      row.insertBefore(badge, row.firstChild);
    }
    badge.textContent = String(Math.min(idx + 1, 999));
  });
}
function ensureFixedCarrierToolbar(context="add"){
  const rows = (context === "detail") ? detailTrackingRows : trackingRows;
  if (!rows || !rows.parentElement) return;
  const toolbarId = (context === "detail") ? 'fixed-toolbar-detail' : 'fixed-toolbar-add';
  let bar = document.getElementById(toolbarId);
  if (!bar) {
    bar = document.createElement('div');
    bar.id = toolbarId;
    bar.style.cssText = 'padding:.5em .75em;border:1px dashed #bbb;background:#f9fafb;margin:.5em 0;display:flex;align-items:center;gap:.5em;position:sticky;top:.5rem;z-index:20;flex-wrap:wrap;';
    rows.parentElement.insertBefore(bar, rows);
  }
  // 再構築して過剰な文言を排除
  bar.textContent = '';
  const group = document.createElement('div');
  group.style.cssText = 'display:inline-flex;align-items:center;gap:.5em;';
  const label = document.createElement('span');
  label.textContent = '固定';
  label.style.cssText = 'font-weight:600;';
  group.appendChild(label);
  const cb  = (context === "detail") ? fixedCarrierCheckboxDetail : fixedCarrierCheckbox;
  const sel = (context === "detail") ? fixedCarrierSelectDetail   : fixedCarrierSelect;
  if (cb) { cb.style.margin = '0'; cb.style.transform = 'scale(1.0)'; group.appendChild(cb); }
  if (sel) {
    sel.style.display = (cb && cb.checked) ? 'inline-block' : 'none';
    sel.style.width = 'auto';
    sel.style.minWidth = '140px';
    sel.style.maxWidth = '180px';
    sel.style.flex = '0 0 auto';
    group.appendChild(sel);
  }
  bar.appendChild(group);
}
/* ------------------------------
 * 追跡番号入力行の生成（add/detailで共通。常に<select>を持つ）
 * ------------------------------ */
function createTrackingRow(context="add"){
  const row = document.createElement("div");
  row.className = "tracking-row";
  row.style.display = row.style.display || "flex";
  row.style.alignItems = row.style.alignItems || "center";
  row.style.gap = row.style.gap || ".5em";

  // 運送会社<select>は常に表示。固定ONなら未選択行に初期値を適用
  const sel = document.createElement("select");
  sel.tabIndex = -1; // キーボード移動で選択肢に飛ばない
  sel.innerHTML = `
    <option value="">運送会社選択してください</option>
    <option value="yamato">ヤマト運輸</option>
    <option value="fukuyama">福山通運</option>
    <option value="seino">西濃運輸</option>
    <option value="tonami">トナミ運輸</option>
    <option value="hida">飛騨運輸</option>
    <option value="sagawa">佐川急便</option>`;
  const fixedValInit = (context === "add")
    ? (fixedCarrierCheckbox && fixedCarrierCheckbox.checked ? (fixedCarrierSelect?.value || "") : "")
    : (fixedCarrierCheckboxDetail && fixedCarrierCheckboxDetail.checked ? (fixedCarrierSelectDetail?.value || "") : "");
  if (fixedValInit) sel.value = fixedValInit;
  row.appendChild(sel);

  // 追跡番号<input>
  const inp = document.createElement("input");
  inp.classList.add("tracking-input");
  inp.type = "text";
  inp.placeholder = "追跡番号を入力してください";
  inp.inputMode = "numeric";
  const uniqueId = `tracking-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  inp.id = uniqueId;
  inp.addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, ""); });

  // Enter/Tab で次行へ。最終行なら新規行を自動追加
  inp.addEventListener("keydown", e => {
    if(e.key === "Enter" || e.key === "Tab"){
      e.preventDefault();
      const inputs = Array.from(row.parentElement.querySelectorAll('input[type="text"].tracking-input'));
      const countBefore = inputs.length;
      const idx = inputs.indexOf(inp);
      if (idx !== -1 && idx < countBefore - 1) {
        inputs[idx + 1].focus();
      } else {
        if (context === "detail") { detailAddRowBtn.click(); } else { addTrackingRowBtn.click(); }
        setTimeout(() => {
          const newInputs = Array.from(row.parentElement.querySelectorAll('input[type="text"].tracking-input'));
          if (newInputs[countBefore]) newInputs[countBefore].focus();
          try{ renumberTrackingRows(context); }catch(_){}
        }, 0);
      }
    }
  });
  inp.addEventListener("beforeinput", e => {
  const t = e.inputType;
  if (t === "insertLineBreak" || t === "insertParagraph") {
    e.preventDefault();
    const inputs = Array.from(row.parentElement.querySelectorAll('input[type="text"].tracking-input'));
    const countBefore = inputs.length;
    const idx = inputs.indexOf(inp);
    if (idx !== -1 && idx < countBefore - 1) {
      inputs[idx + 1].focus();
    } else {
      if (context === "detail") { detailAddRowBtn.click(); } else { addTrackingRowBtn.click(); }
      setTimeout(() => {
        const newInputs = Array.from(row.parentElement.querySelectorAll('input[type="text"].tracking-input'));
        if (newInputs[countBefore]) newInputs[countBefore].focus();
        try{ renumberTrackingRows(context); }catch(_){ }
      }, 0);
    }
  }
});
row.appendChild(inp);

  
  (function ensureBadge(){
    if (!row.querySelector('.row-no')) {
      const badge = document.createElement('span');
      badge.className = 'row-no'; badge.style.cssText = 'display:inline-block;width:3ch;text-align:right;margin-right:.25em;font-weight:600;font-variant-numeric:tabular-nums;';
      row.insertBefore(badge, row.firstChild);
    }
  })();
// モバイルならカメラボタンを添付
  (function attachCaptureControls(){
    const canCamera = isMobileDevice() && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (canCamera) {
      const camBtn = document.createElement('button');
      camBtn.type = 'button';
      camBtn.textContent = 'カメラ起動';
      camBtn.className = 'camera-btn';
      camBtn.addEventListener('click', () => {
        startScanning([Html5QrcodeSupportedFormats.CODABAR], uniqueId);
      });
      row.appendChild(camBtn);
    }
  })();

  // 行強調: 追跡入力済みなのにキャリア未選択なら強調（行選択 or 固定値）
  function updateMissingHighlight() {
    const tnVal = inp.value.trim();
    const rowVal = sel.value || "";
    const fixedVal = (context === "add")
      ? (fixedCarrierCheckbox && fixedCarrierCheckbox.checked ? (fixedCarrierSelect?.value || "") : "")
      : (fixedCarrierCheckboxDetail && fixedCarrierCheckboxDetail.checked ? (fixedCarrierSelectDetail?.value || "") : "");
    const carrierVal = rowVal || fixedVal || "";
    if (tnVal && !carrierVal) row.classList.add('missing-carrier'); else row.classList.remove('missing-carrier');
  }
  inp.addEventListener('input', updateMissingHighlight);
  sel.addEventListener('change', updateMissingHighlight);

  
  // ▼ 幅自動調整: 運送会社<select>は最小5全角を下限にフレキシブル。カメラ含めて1行内に収める
  row.style.flexWrap = 'nowrap'; row.style.width = '100%';
  sel.style.flex = '1 1 auto'; inp.style.flex = '1 1 auto';
  function fitRow(){
    try{
      const gap = parseFloat(getComputedStyle(row).gap || '8');
      const btn = row.querySelector('button.camera-btn');
      const btnMin = 48; // px
      const fs = parseFloat(getComputedStyle(inp).fontSize || '16');
      const ch = fs * 0.5; const zen = fs;
      const minInput = Math.round(16 * ch + 16);
      const minSelect = Math.round(4 * zen + 24);
      let btnW = btn ? btn.offsetWidth : 0;
      let availRow = row.clientWidth - gap*2;
      let remain = availRow - btnW;
      if (remain < minInput + minSelect && btn) {
        const targetBtn = Math.max(btnMin, btnW - ((minInput + minSelect) - remain));
        btn.style.flex = '0 1 auto'; btn.style.maxWidth = targetBtn + 'px';
        btnW = btn.offsetWidth; remain = availRow - btnW;
      }
      let selectW = Math.max(minSelect, Math.min(remain - minInput, Math.floor(remain * 0.5)));
      if (selectW < minSelect) selectW = minSelect;
      const inputW = Math.max(minInput, remain - selectW);
      sel.style.maxWidth = selectW + 'px'; sel.style.width = selectW + 'px';
      inp.style.maxWidth = inputW + 'px'; inp.style.width = inputW + 'px';
    }catch(_){ }
  }
  setTimeout(fitRow, 0);
  window.addEventListener('resize', fitRow);
  sel.addEventListener('change', fitRow);
// ▼ 幅自動調整: 画面幅に追従（ADD/DETAIL 共通）
  row.style.flexWrap = 'nowrap'; row.style.width = '100%';
  sel.style.flex = '1 1 auto'; inp.style.flex = '1 1 auto';
  function fitRow(){
    try{
      const gap = parseFloat(getComputedStyle(row).gap || '8');
      const btn = row.querySelector('button.camera-btn');
      const btnMin = 48; // px
      const fs = parseFloat(getComputedStyle(inp).fontSize || '16');
      const ch = fs * 0.5, zen = fs;
      const minInput = Math.round(16 * ch + 16);
      const minSelect = Math.round(4 * zen + 24);
      let btnW = btn ? btn.offsetWidth : 0;
      let availRow = row.clientWidth - gap*2;
      let remain = availRow - btnW;
      if (remain < minInput + minSelect && btn) {
        const targetBtn = Math.max(btnMin, btnW - ((minInput + minSelect) - remain));
        btn.style.flex = '0 1 auto'; btn.style.maxWidth = targetBtn + 'px';
        btnW = btn.offsetWidth; remain = availRow - btnW;
      }
      let selectW = Math.max(minSelect, Math.min(remain - minInput, Math.floor(remain * 0.5)));
      if (selectW < minSelect) selectW = minSelect;
      const inputW = Math.max(minInput, remain - selectW);
      sel.style.maxWidth = selectW + 'px'; sel.style.width = selectW + 'px';
      inp.style.maxWidth = inputW + 'px'; inp.style.width = inputW + 'px';
    }catch(_){ }
  }
  setTimeout(fitRow, 0);
  window.addEventListener('resize', fitRow);
  sel.addEventListener('change', fitRow);
  return row;
}

/* ------------------------------
 * 詳細画面：固定キャリア切替（行<select>は消さない）
 *  - 固定ON/変更時に全行へ固定値を適用（手動選択済みも上書き）
 * ------------------------------ */
function applyFixedToUnselectedRows(context = "detail"){
  const rows = Array.from((context === "detail" ? detailTrackingRows : trackingRows).children);
  const fixedOn = (context === "detail") ? (fixedCarrierCheckboxDetail?.checked) : (fixedCarrierCheckbox?.checked);
  const fixedVal = (context === "detail") ? (fixedCarrierSelectDetail?.value || "") : (fixedCarrierSelect?.value || "");
  if (!fixedOn || !fixedVal) return;
  rows.forEach(row => {
    const sel = row.querySelector("select");
    if (sel) sel.value = fixedVal;
  });
}
// 詳細側
if (fixedCarrierCheckboxDetail) {
  fixedCarrierCheckboxDetail.onchange = () => {
    fixedCarrierSelectDetail.style.display = fixedCarrierCheckboxDetail.checked ? "inline-block" : "none";
    applyFixedToUnselectedRows("detail");
  };
}
if (fixedCarrierSelectDetail) {
  fixedCarrierSelectDetail.onchange = () => {
    if (!fixedCarrierCheckboxDetail.checked) return;
    applyFixedToUnselectedRows("detail");
  };
}

// 追加画面側（同じロジック）
if (fixedCarrierCheckbox) {
  fixedCarrierCheckbox.onchange = () => {
    fixedCarrierSelect.style.display = fixedCarrierCheckbox.checked ? "block" : "none";
    try{ ensureFixedCarrierToolbar('add'); }catch(_){}
    applyFixedToUnselectedRows("add");
  };
}
if (fixedCarrierSelect) {
  fixedCarrierSelect.onchange = () => {
    if (!fixedCarrierCheckbox.checked) return;
    applyFixedToUnselectedRows("add");
  };
}

/* ------------------------------
 * 追加画面の初期化
 * ------------------------------ */
function initAddCaseView(){
  scanModeDiv.style.display     = "block";
  manualModeDiv.style.display   = "none";
  caseDetailsDiv.style.display  = "none";
  caseBarcodeInput.value        = "";
  manualOrderIdInput.value      = "";
  manualCustomerInput.value     = "";
  manualTitleInput.value        = "";
  manualPlateDateInput.value    = "";
  addCaseMsg.textContent        = "";
  if (fixedCarrierCheckbox) fixedCarrierCheckbox.checked  = false;
  if (fixedCarrierSelect) { fixedCarrierSelect.style.display = "none"; fixedCarrierSelect.value = ""; }
  trackingRows.innerHTML        = "";
  for(let i=0;i<10;i++) trackingRows.appendChild(createTrackingRow("add"));
  renumberTrackingRows('add');
  renumberTrackingRows('add');
  ensureFixedCarrierToolbar('add');
}

// 追跡行の追加（追加画面）
addTrackingRowBtn.onclick = () => {
  for(let i=0;i<10;i++) trackingRows.appendChild(createTrackingRow("add"));
  renumberTrackingRows('add');
  renumberTrackingRows('add');
  ensureFixedCarrierToolbar('add');
};

// IME無効（QR欄）
caseBarcodeInput.addEventListener("compositionstart", e => e.preventDefault());

/* ------------------------------
 * 日付の緩い正規化（YYYY-MM-DD）と下版日抽出
 * ------------------------------ */
function normalizeDateString(s) {
  if (!s) return "";
  const nums = (s.match(/\d{1,4}/g) || []).map(n => parseInt(n, 10));
  if (nums.length >= 3) {
    let y = nums[0]; let m = nums[1]; let d = nums[2];
    if (y < 100) y = 2000 + y;
    m = Math.max(1, Math.min(12, m|0));
    d = Math.max(1, Math.min(31, d|0));
    const dt = new Date(Date.UTC(y, m-1, d));
    const mm = String(dt.getUTCMonth()+1).padStart(2,'0');
    const dd = String(dt.getUTCDate()).padStart(2,'0');
    return `${dt.getUTCFullYear()}-${mm}-${dd}`;
  }
  return "";
}
function extractPlateDateField(text) {
  let fields = Array.from(text.matchAll(/"([^"]*)"/g), m=>m[1]);
  if (fields.length === 0) fields = text.split(/[\,\t\r\n]+/).map(s => s.trim()).filter(Boolean);
  let val = "";
  if (fields.length === 4) val = fields[3];
  else if (fields.length >= 10) val = fields[9];
  return normalizeDateString(val);
}

/* ------------------------------
 * 案件バーコード確定処理（ZLIB64対応）
 * ------------------------------ */
function processCaseBarcode(raw){
  if(!raw) return;
  let text;
  try{
    if(raw.startsWith("ZLIB64:")){
      const b64 = raw.slice(7);
      const bin = atob(b64);
      const arr = new Uint8Array([...bin].map(c=>c.charCodeAt(0)));
      const dec = pako.inflate(arr);
      text = new TextDecoder().decode(dec);
    } else {
      text = raw;
    }
  }catch(err){
    alert("QRデコード失敗: "+err.message);
    return;
  }
  text = text.trim().replace(/「[^」]*」/g, "");
  const matches = Array.from(text.matchAll(/"([^"]*)"/g), m=>m[1]);
  detailOrderId.textContent  = matches[0] || "";
  detailCustomer.textContent = matches[1] || "";
  detailTitle.textContent    = matches[2] || "";
  const plate = extractPlateDateField(text);
  detailPlateDate.textContent = plate;
  scanModeDiv.style.display = "none";
  caseDetailsDiv.style.display = "block";
}

// EnterでQR欄確定
caseBarcodeInput.addEventListener("keydown", e => {
  if(e.key !== "Enter") return;
  processCaseBarcode(caseBarcodeInput.value.trim());
});

// 手動入力モードと往復
startManualBtn.onclick = () => { scanModeDiv.style.display = "none"; manualModeDiv.style.display = "block"; };
startScanBtn.onclick   = () => { manualModeDiv.style.display = "none"; scanModeDiv.style.display  = "block"; };
manualConfirmBtn.onclick = () => {
  if(!manualOrderIdInput.value || !manualCustomerInput.value || !manualTitleInput.value){
    alert("必須項目を入力"); return;
  }
  const plateNorm = normalizeDateString(manualPlateDateInput.value);
  if(!plateNorm){ alert("下版日を入力してください（YYYY-MM-DD）"); return; }
  detailOrderId.textContent  = manualOrderIdInput.value.trim();
  detailCustomer.textContent = manualCustomerInput.value.trim();
  detailTitle.textContent    = manualTitleInput.value.trim();
  detailPlateDate.textContent = plateNorm;
  manualModeDiv.style.display = "none";
  caseDetailsDiv.style.display = "block";
};

/* ------------------------------
 * 暗号化ユーティリティ（AES-GCM + PBKDF2）
 * ------------------------------ */
const PEPPER = "p9r7WqZ1-LocalPepper-ChangeIfNeeded";
function b64(bytes){ return btoa(String.fromCharCode(...bytes)); }
function b64dec(str){ return new Uint8Array([...atob(str)].map(c=>c.charCodeAt(0))); }

async function deriveKey(uid, saltBytes){
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(uid + ":" + PEPPER),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: 120000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt","decrypt"]
  );
}
async function encryptForUser(uid, payloadObj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(uid || "guest", salt);
  const data = new TextEncoder().encode(JSON.stringify(payloadObj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, data));
  return { iv: b64(iv), s: b64(salt), c: b64(ct) };
}
async function decryptForUser(uid, encObj){
  if (!encObj) return null;
  const iv = b64dec(encObj.iv);
  const salt = b64dec(encObj.s);
  const key = await deriveKey(uid || "guest", salt);
  const ct = b64dec(encObj.c);
  const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
}

/* ------------------------------
 * 案件登録（案件情報 + 追跡）
 * ------------------------------ */
confirmAddCaseBtn.onclick = async () => {
  const orderId  = detailOrderId.textContent.trim();
  const customer = detailCustomer.textContent.trim();
  const title    = detailTitle.textContent.trim();
  const plateStr = (detailPlateDate.textContent || "").trim();
  const plateTs  = plateStr ? new Date(plateStr).getTime() : null;

  
  if (!plateStr || isNaN(new Date(plateStr).getTime())) { addCaseMsg.textContent = "下版日は必須です"; return; }
  if (!orderId || !customer || !title) { addCaseMsg.textContent = "情報不足"; return; }

  showLoading();
  confirmAddCaseBtn.disabled = true;
  anotherCaseBtn.disabled = true;

  try {
    // 既存追跡の重複抑止セット
    const snap = await db.ref(`shipments/${orderId}`).once("value");
    const existObj = snap.val() || {};
    const existSet = new Set(Object.values(existObj).map(it => `${it.carrier}:${it.tracking}`));
    const items = [];
    let missingCarrier = false;

    // 行強調リセット
    Array.from(trackingRows.children).forEach(row => row.classList.remove('missing-carrier'));

    // 入力走査（行<select>優先。未選択は固定値）
    Array.from(trackingRows.children).forEach(row => {
      const rowSelVal = row.querySelector("select")?.value || "";
      const fixedVal  = (fixedCarrierCheckbox?.checked ? (fixedCarrierSelect?.value || "") : "");
      const carrier   = rowSelVal || fixedVal || "";
      let tn = row.querySelector("input")?.value?.trim() || "";
      if (!tn) return;
      if (!carrier) { missingCarrier = true; row.classList.add('missing-carrier'); return; }
      tn = normalizeTrackingForSave(carrier, tn);
      const key = `${carrier}:${tn}`;
      if (existSet.has(key)) return;
      existSet.add(key);
      items.push({ carrier, tracking: tn });
    });

    if (missingCarrier) { addCaseMsg.textContent = "運送会社を選択してください（固定または行ごとに選択）"; return; }
    if (items.length === 0) { alert("新規追跡なし"); return; }

    // 案件情報を暗号化し保存
    const uid = (auth.currentUser && auth.currentUser.uid) || "guest";
    const enc = await encryptForUser(uid, { 得意先: customer, 品名: title, 下版日: plateStr || null });

    await db.ref(`cases/${orderId}`).set({
      注番: orderId,
      createdAt: Date.now(),
      plateDateTs: plateTs,
      enc
    });

    // 追跡を追加
    for (const it of items) {
      await db.ref(`shipments/${orderId}`).push({
        carrier: it.carrier,
        tracking: it.tracking,
        createdAt: Date.now()
      });
    }

    addCaseMsg.textContent = "登録完了";
    await showCaseDetail(orderId, { 注番: orderId, enc, plateDateTs: plateTs });
  } catch (err) {
    console.error(err);
    addCaseMsg.textContent = "登録に失敗しました";
  } finally {
    hideLoading();
    confirmAddCaseBtn.disabled = false;
    anotherCaseBtn.disabled = false;
  }
};

/* ------------------------------
 * 検索結果描画と全選択状態更新
 * ------------------------------ */
anotherCaseBtn.onclick = () => { showView("add-case-view"); initAddCaseView(); };
if (anotherCaseBtn2) anotherCaseBtn2.onclick = () => { showView("add-case-view"); initAddCaseView(); };

function renderSearchResults(list){
  searchResults.innerHTML = "";
  list.forEach(item => {
    const li = document.createElement("li");
    li.dataset.orderId = item.orderId;
    if(isAdmin){
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "select-case-checkbox";
      checkbox.dataset.orderId = item.orderId;
      li.appendChild(checkbox);
    }
    const span = document.createElement("span");
    span.textContent = `${item.orderId} / ${item.得意先 || ""} / ${item.品名 || ""} / 下版日:${item.下版日 || (item.plateDateTs ? new Date(item.plateDateTs).toLocaleDateString('ja-JP') : "")}`;
    li.appendChild(span);
    li.onclick = (e) => {
      if(e.target instanceof HTMLInputElement) return;
      showCaseDetail(item.orderId, item);
    };
    searchResults.appendChild(li);
  });
  deleteSelectedBtn.style.display = isAdmin ? "block" : "none";
  if (isAdmin) selectAllContainer.style.display = "block"; else selectAllContainer.style.display = "none";
  if (selectAllCheckbox) selectAllCheckbox.checked = false;
  const boxes = searchResults.querySelectorAll(".select-case-checkbox");
  boxes.forEach(cb => { cb.onchange = updateSelectAllState; });
  updateSelectAllState();
}
function updateSelectAllState() {
  if (!isAdmin) return;
  const boxes = searchResults.querySelectorAll(".select-case-checkbox");
  const checked = searchResults.querySelectorAll(".select-case-checkbox:checked");
  selectAllCheckbox.checked = (boxes.length > 0 && boxes.length === checked.length);
}

/* ------------------------------
 * 検索／全件一覧（createdAt or plateDateTs）
 * ------------------------------ */
function searchAll(kw=""){
  db.ref("cases").once("value").then(async snap => {
    const data = snap.val() || {};
    const res = [];
    const startVal = startDateInput.value;
    const endVal   = endDateInput.value;
    const basis    = (searchDateType && searchDateType.value) === 'created' ? 'createdAt' : 'plateDateTs';

    let startTs = null, endTs = null;
    if (startVal) startTs = new Date(startVal + 'T00:00:00').getTime();
    if (endVal)   endTs   = new Date(endVal   + 'T23:59:59').getTime();

    const uid = (auth.currentUser && auth.currentUser.uid) || "guest";

    for (const [orderId, obj] of Object.entries(data)) {
      const baseTs = obj[basis] ?? obj.createdAt ?? 0;
      if (startTs !== null && baseTs < startTs) continue;
      if (endTs   !== null && baseTs > endTs)   continue;

      // 復号（表示用）
      let view = { orderId, 注番: orderId, plateDateTs: obj.plateDateTs, createdAt: obj.createdAt };
      if (obj.enc) {
        try {
          const dec = await decryptForUser(uid, obj.enc);
          view.得意先 = dec?.得意先 || "";
          view.品名   = dec?.品名   || "";
          view.下版日 = dec?.下版日 || (obj.plateDateTs ? new Date(obj.plateDateTs).toISOString().slice(0,10) : "");
        } catch(_) {
          view.得意先 = obj.得意先 || "";
          view.品名   = obj.品名   || "";
          view.下版日 = obj.下版日 || "";
        }
      } else {
        view.得意先 = obj.得意先 || "";
        view.品名   = obj.品名   || "";
        view.下版日 = obj.下版日 || (obj.plateDateTs ? new Date(obj.plateDateTs).toISOString().slice(0,10) : "");
      }

      const matchKw = !kw || orderId.includes(kw) || (view.得意先 || "").includes(kw) || (view.品名 || "").includes(kw);
      if (!matchKw) continue;
      res.push(view);
    }

    // 登録日の新→古
    res.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    fullResults = res; currentPage = 1; renderPage();
  });
}

// 検索UI
searchBtn.onclick = () => {
  const kw = searchInput.value.trim();
  const hasKw = kw.length > 0;
  const hasPeriod = startDateInput.value || endDateInput.value;
  if (!hasKw && !hasPeriod) {
    searchAll("");
  } else {
    searchAll(kw);
  }
};
listAllBtn.onclick = () => {
  searchInput.value = "";
  startDateInput.value = "";
  endDateInput.value = "";
  pageSize = parseInt((pageSizeSelect && pageSizeSelect.value) || "50", 10) || 50;
  currentPage = 1;
  searchAll("");
};

/* ------------------------------
 * 管理者のみ：選択削除（cases と shipments の両方削除）
 * ------------------------------ */


// ▼ 追加：ページ描画とページングUI
function renderPage(){
  const total = fullResults.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const end   = start + pageSize;
  const slice = fullResults.slice(start, end);
  renderSearchResults(slice);
  renderPagination(total, totalPages);
}

function renderPagination(total, totalPages){
  if (!paginationDiv) return;
  paginationDiv.innerHTML = "";

  const first = document.createElement("button");
  first.textContent = "≪";
  first.title = "最初へ";
  first.disabled = currentPage <= 1;
  first.onclick = () => { currentPage = 1; renderPage(); };

  const prev = document.createElement("button");
  prev.textContent = "＜";
  prev.title = "前へ";
  prev.disabled = currentPage <= 1;
  prev.onclick = () => { currentPage--; renderPage(); };

  const info = document.createElement("div");
  const from = total === 0 ? 0 : ((currentPage - 1) * pageSize + 1);
  const to   = Math.min(currentPage * pageSize, total);
  info.id = "page-info";
  info.textContent = `${from}-${to} / ${total}件`;

  const pageInput = document.createElement("input");
  pageInput.type = "number";
  pageInput.id = "page-number-input";
  pageInput.min = 1;
  pageInput.max = totalPages;
  pageInput.value = String(currentPage);
  pageInput.title = `1〜${totalPages}`;
  pageInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      const v = Math.max(1, Math.min(totalPages, parseInt(pageInput.value||"1", 10) || 1));
      currentPage = v;
      renderPage();
    }
  };

  const gotoBtn = document.createElement("button");
  gotoBtn.textContent = "移動";
  gotoBtn.onclick = () => {
    const v = Math.max(1, Math.min(totalPages, parseInt(pageInput.value||"1", 10) || 1));
    currentPage = v;
    renderPage();
  };

  const totalLabel = document.createElement("span");
  totalLabel.textContent = ` / ${totalPages}ページ`;

  const next = document.createElement("button");
  next.textContent = "＞";
  next.title = "次へ";
  next.disabled = currentPage >= totalPages;
  next.onclick = () => { currentPage++; renderPage(); };

  const last = document.createElement("button");
  last.textContent = "≫";
  last.title = "最後へ";
  last.disabled = currentPage >= totalPages;
  last.onclick = () => { currentPage = totalPages; renderPage(); };

  paginationDiv.appendChild(first);
  paginationDiv.appendChild(prev);
  paginationDiv.appendChild(info);
  paginationDiv.appendChild(pageInput);
  paginationDiv.appendChild(totalLabel);
  paginationDiv.appendChild(gotoBtn);
  paginationDiv.appendChild(next);
  paginationDiv.appendChild(last);
}
deleteSelectedBtn.onclick = async () => {
  const checkboxes = searchResults.querySelectorAll(".select-case-checkbox:checked");
  const count = checkboxes.length;
  if (count === 0) return;
  if (count === 1) {
    const orderId = checkboxes[0].dataset.orderId;
    if (!confirm(`「${orderId}」を削除しますか？`)) return;
  } else {
    if (!confirm('選択案件を削除しますか？')) return;
  }
  for (const cb of checkboxes) {
    const orderId = cb.dataset.orderId;
    try {
      await db.ref(`cases/${orderId}`).remove();
      await db.ref(`shipments/${orderId}`).remove();
    } catch (e) { console.error(e); }
    cb.closest('li').remove();
  }
  updateSelectAllState();
};

/* ------------------------------
 * 追跡ステータス分類と表記生成
 * ------------------------------ */
function classifyStatus(status){
  const s = String(status || "");
  if (/(配達完了|お届け完了|配達済みです|配達済み)/.test(s)) return "delivered";
  if (/(配達中|お届け中|輸送中|移動中|配送中)/.test(s))          return "intransit";
  if (/(受付|荷受|出荷|発送|引受|持出|到着|作業中|準備中)/.test(s))  return "info";
  if (/(持戻|不在|保管|調査中|返送|破損|誤配送|エラー|該当なし|未登録)/.test(s)) return "exception";
  return "unknown";
}

// Cloudflare Worker 経由でステータス取得
async function fetchStatus(carrier, tracking) {
  const c = carrier;
  if (c === 'hida') return { status: '非対応', time: null };
  const sendTracking = trackingForApi(c, tracking);
  const url = `https://track-api.hr46-ksg.workers.dev/?carrier=${encodeURIComponent(c)}&tracking=${encodeURIComponent(sendTracking)}`;
  let res;
  try { res = await fetch(url); }
  catch (e) { console.error('fetch network error', { url, carrier: c, tracking: sendTracking, error: e }); throw e; }
  if (!res.ok) {
    const msg = await res.text().catch(()=> '');
    console.error('fetch http error', { url, status: res.status, body: msg });
    throw new Error(`HTTP ${res.status} ${msg}`);
  }
  return res.json();
}
function getTimeLabel(carrier, status, time) {
  if (!time || time.includes('：')) return '';
  if (carrier === 'seino') return (status === '配達済みです') ? '配達日時:' : '最新日時:';
  if (carrier === 'yamato' || carrier === 'tonami') {
    if (status === '配達完了' || status === 'お届け完了' || status === '配達済み') return '配達日時:';
    return '予定日時:';
  }
  if (status && status.includes('配達完了')) return '配達日時:';
  return '予定日時:';
}
function formatShipmentText(seqNum, carrier, tracking, status, time, location) {
  const label = carrierLabels[carrier] || carrier;
  const displayTracking = formatTrackingForDisplay(carrier, tracking);
  if (carrier === 'hida') return `${seqNum}：${label}：${displayTracking}：${status}`;
  const tl = getTimeLabel(carrier, status, time);
  if (location && String(location).trim() !== "") {
    if (time) return `${seqNum}：${label}：${displayTracking}：担当店名：${location}：${status}　${tl ? tl : ''}${time}`;
    return `${seqNum}：${label}：${displayTracking}：担当店名：${location}：${status}`;
  }
  if (time) return `${seqNum}：${label}：${displayTracking}：${status}　${tl ? tl : ''}${time}`;
  return `${seqNum}：${label}：${displayTracking}：${status}`;
}

/* ------------------------------
 * 案件詳細＋ステータス取得
 *  - pushキー昇順で描画し、非同期でもラベル連番を固定
 *  - 最後の fetch が終わるまでホイール維持
 * ------------------------------ */
async function showCaseDetail(orderId, obj){
  showLoading();
  showView("case-detail-view");

  // 復号＋ヘッダ表示
  let view = { 注番: orderId, 得意先: "", 品名: "", 下版日: "", plateDateTs: obj?.plateDateTs, createdAt: obj?.createdAt };
  try {
    if (obj && obj.enc) {
      const dec = await decryptForUser((auth.currentUser && auth.currentUser.uid) || "guest", obj.enc);
      view.得意先 = dec?.得意先 || "";
      view.品名   = dec?.品名   || "";
      view.下版日 = dec?.下版日 || (obj.plateDateTs ? new Date(obj.plateDateTs).toISOString().slice(0,10) : "");
    } else {
      view.得意先 = obj?.得意先 || "";
      view.品名   = obj?.品名   || "";
      view.下版日 = obj?.下版日 || (obj?.plateDateTs ? new Date(obj.plateDateTs).toISOString().slice(0,10) : "");
    }
  } catch(_) {}
  const plateView = view.下版日 || (view.plateDateTs ? new Date(view.plateDateTs).toLocaleDateString('ja-JP') : "");
  detailInfoDiv.innerHTML = `<div>受注番号: ${orderId}</div><div>得意先: ${view.得意先}</div><div>品名: ${view.品名}</div><div>下版日: ${plateView}</div>`;

  // 追跡一覧の初期化
  detailShipmentsUl.innerHTML = "";
  currentOrderId = orderId;
  addTrackingDetail.style.display = "none";
  try{ ensureFixedCarrierToolbar('detail'); }catch(_){}
  detailTrackingRows.innerHTML = "";
  detailAddMsg.textContent = "";
  if (detailAddRowBtn)     detailAddRowBtn.disabled = false;
  if (confirmDetailAddBtn) confirmDetailAddBtn.disabled = false;
  if (cancelDetailAddBtn)  cancelDetailAddBtn.disabled = false;

  showAddTrackingBtn.style.display = "inline-block";

  try {
    // pushキー昇順（= 追加順）で取得
    const snap = await db.ref(`shipments/${orderId}`).orderByKey().once("value");

    if (!snap.exists()) {
      const li = document.createElement("li");
      li.textContent = "追跡が登録されていません";
      li.className = "ship-empty";
      detailShipmentsUl.appendChild(li);
      return;
    }

    let lastStatusPromise = null;
    let rowSeq = 1; // 画面上の連番

    snap.forEach(child => {
      const it = child.val();
      const label = carrierLabels[it.carrier] || it.carrier;

      const seqNum = rowSeq++; // ここで確定しクロージャへ渡す

      const a = document.createElement("a");
      a.href = it.carrier === 'hida'
        ? carrierUrls[it.carrier]
        : (carrierUrls[it.carrier] + encodeURIComponent(it.tracking));
      a.target = "_blank";
      a.textContent = `${label}：${formatTrackingForDisplay(it.carrier, it.tracking)}：読み込み中…`;

      const li = document.createElement("li");
      li.appendChild(a);
      detailShipmentsUl.appendChild(li);

      const p = fetchStatus(it.carrier, it.tracking)
        .then(({ status, time, location }) => {
          a.textContent = formatShipmentText(seqNum, it.carrier, it.tracking, status, time, location);
          li.className = "ship-" + classifyStatus(status);
        })
        .catch(err => {
          console.error("fetchStatus error:", err);
          a.textContent = `${label}：${formatTrackingForDisplay(it.carrier, it.tracking)}：取得失敗`;
          li.className = "ship-exception";
        });

      lastStatusPromise = p;
    });

    if (lastStatusPromise) await lastStatusPromise;
  } finally {
    hideLoading();
  }
}

backToSearchBtn.onclick = () => showView("search-view");

/* ------------------------------
 * 追跡番号追加（詳細画面）
 *  - 行<select>優先、未選択は固定値。
 *  - 追加後は最後のステータス反映までホイール維持
 * ------------------------------ */
showAddTrackingBtn.onclick = () => {
  
  
  // 固定キャリアを初期化
  try { if (typeof fixedCarrierCheckboxDetail !== 'undefined' && fixedCarrierCheckboxDetail) fixedCarrierCheckboxDetail.checked = false; } catch(_) {}
  try { if (typeof fixedCarrierSelectDetail   !== 'undefined' && fixedCarrierSelectDetail) { fixedCarrierSelectDetail.value=''; fixedCarrierSelectDetail.style.display='none'; } } catch(_) {}
// 追跡追加パネルを開く＋必須ボタンを確実に表示
  try { if (addTrackingDetail) addTrackingDetail.style.display = 'block'; } catch(_) {}
  try { if (detailAddMsg) detailAddMsg.textContent = ''; } catch(_) {}
  try {
    if (detailTrackingRows){
      detailTrackingRows.innerHTML = '';
      for (let i = 0; i < 5; i++) detailTrackingRows.appendChild(createTrackingRow('detail'));
    renumberTrackingRows('detail');
    ensureFixedCarrierToolbar('detail');
    }
  } catch(_) {}
  try { if (confirmDetailAddBtn) { confirmDetailAddBtn.style.display = 'inline-block'; confirmDetailAddBtn.disabled = false; } } catch(_) {}
  try { if (cancelDetailAddBtn)  { cancelDetailAddBtn.style.display  = 'inline-block'; cancelDetailAddBtn.disabled  = false; } } catch(_) {}
  try { if (showAddTrackingBtn)  { showAddTrackingBtn.style.display  = 'none'; } } catch(_) {}

};
detailAddRowBtn.onclick = () => { for (let i = 0; i < 5; i++) detailTrackingRows.appendChild(createTrackingRow("detail")); renumberTrackingRows('detail'); };
cancelDetailAddBtn.onclick = () => {
  addTrackingDetail.style.display = "none";
  try{ ensureFixedCarrierToolbar('detail'); }catch(_){}
  detailTrackingRows.innerHTML = "";
  detailAddMsg.textContent = "";
  showAddTrackingBtn.style.display = "inline-block";

  // 固定キャリア初期化
  if (fixedCarrierCheckboxDetail) fixedCarrierCheckboxDetail.checked = false;
  if (fixedCarrierSelectDetail) {
    fixedCarrierSelectDetail.value = ""; // 運送会社選択してください を選択
    fixedCarrierSelectDetail.style.display = "none";
  }
};

function getFixedCarrierValue(){
  const detailOn = !!(window.fixedCarrierCheckboxDetail && fixedCarrierCheckboxDetail.checked);
  const commonOn = !!(window.fixedCarrierCheckbox && fixedCarrierCheckbox.checked);
  if (detailOn)  return (window.fixedCarrierSelectDetail && fixedCarrierSelectDetail.value) || "";
  if (commonOn)  return (window.fixedCarrierSelect && fixedCarrierSelect.value) || "";
  return "";
}

// 追跡番号追加 確定
document.addEventListener("DOMContentLoaded", () => {
  if (!confirmDetailAddBtn) { console.error("#confirm-detail-add-btn が見つかりません"); return; }

  confirmDetailAddBtn.onclick = async () => {
    showLoading();
    confirmDetailAddBtn.disabled = true;
    detailAddRowBtn.disabled = true;
    cancelDetailAddBtn.disabled = true;
    detailAddMsg.textContent = "";
    const detailAddWarn = document.getElementById("detailAddWarn");
    if (detailAddWarn) detailAddWarn.textContent = "";

    try {
      if (!currentOrderId) throw new Error("currentOrderId 未設定");

      // 既存重複の抑止
      const snap = await db.ref(`shipments/${currentOrderId}`).once("value");
      const exist = snap.val() || {};
      const existSet = new Set(Object.values(exist).map(v => `${v.carrier}:${v.tracking}`));

      // 固定値（空でも可）
      const fixedVal = getFixedCarrierValue();

      // 入力集約（行<select>優先。未選択は固定値）
      const rows = Array.from(detailTrackingRows.querySelectorAll(".tracking-row"));
      rows.forEach(r => r.classList.remove("missing-carrier"));

      const items = [];
      let missingCarrier = false;

      for (const r of rows) {
        const rowSelVal = r.querySelector("select")?.value || "";
        const carrier = rowSelVal || fixedVal || "";
        let tracking  = (r.querySelector('input[type="text"]')?.value || "").trim();

        if (!tracking) continue;
        if (!carrier) { missingCarrier = true; r.classList.add("missing-carrier"); continue; }

        tracking = normalizeTrackingForSave(carrier, tracking);
        const k = `${carrier}:${tracking}`;
        if (existSet.has(k)) continue;
        existSet.add(k);
        items.push({ carrier, tracking });
      }

      if (missingCarrier) {
        const msg = "運送会社を選択してください（固定または行ごとに選択）";
        detailAddMsg.textContent = msg;
        if (detailAddWarn) detailAddWarn.textContent = msg;
        return;
      }
      if (items.length === 0) { detailAddMsg.textContent = "追加対象がありません"; return; }

      // DB 登録（並列）
      const ref = db.ref(`shipments/${currentOrderId}`);
      await Promise.all(items.map(it => ref.push({ carrier: it.carrier, tracking: it.tracking, createdAt: Date.now() })));

      // 即時描画＋ステータス反映
      let seqBase = detailShipmentsUl.children.length;
      let lastP = null;
      for (const it of items) {
        const li = document.createElement("li");
        const label = carrierLabels[it.carrier] || it.carrier;
        const a = document.createElement("a");
        a.target = "_blank";
        a.href = it.carrier === "hida" ? carrierUrls[it.carrier] : (carrierUrls[it.carrier] + encodeURIComponent(it.tracking));
        a.textContent = `${label}：${formatTrackingForDisplay(it.carrier, it.tracking)}：読み込み中…`;
        li.appendChild(a);
        detailShipmentsUl.appendChild(li);

        const p = fetchStatus(it.carrier, it.tracking)
          .then(({ status, time, location }) => {
            const seq = ++seqBase;
            a.textContent = formatShipmentText(seq, it.carrier, it.tracking, status, time, location);
            li.className = "ship-" + classifyStatus(status);
          })
          .catch(e => {
            console.error(e);
            a.textContent = `${label}：${formatTrackingForDisplay(it.carrier, it.tracking)}：取得失敗`;
            li.className = 'ship-exception';
          });

        lastP = p;
      }
      if (lastP) await lastP;

      // 追加登録完了時のUI処理
      detailAddMsg.textContent = "追加しました";
      if (detailAddWarn) detailAddWarn.textContent = "";
      
      // 固定キャリア状態をリセット
      if (fixedCarrierCheckboxDetail) fixedCarrierCheckboxDetail.checked = false;
      if (fixedCarrierSelectDetail) {
        fixedCarrierSelectDetail.value = ""; // 運送会社選択してください を選択
        fixedCarrierSelectDetail.style.display = "none";
      }
      
      // 追跡番号入力行をクリア
      detailTrackingRows.innerHTML = "";
      
      // 次回追加時も初期化状態で表示
      addTrackingDetail.style.display = "none";
  try{ ensureFixedCarrierToolbar('detail'); }catch(_){}
      showAddTrackingBtn.style.display = "inline-block";
      
    } catch (e) {
      const msg = `追加に失敗しました: ${e.message || e}`;
      detailAddMsg.textContent = msg;
      const warn = document.getElementById("detailAddWarn");
      if (warn) warn.textContent = msg;
      console.error("追跡番号追加エラー:", e);
    } finally {
      hideLoading();
      if (detailAddRowBtn)     detailAddRowBtn.disabled = false;
      if (confirmDetailAddBtn) confirmDetailAddBtn.disabled = false;
      if (cancelDetailAddBtn)  cancelDetailAddBtn.disabled = false;
    }
  };
});

/* ------------------------------
 * 初期表示（ログイン状態に応じてビュー切替）
 * ------------------------------ */
auth.onAuthStateChanged(async user => {
  if (user) {
    try {
      const snap = await db.ref(`admins/${user.uid}`).once("value");
      isAdmin = snap.val() === true;
    } catch (e) {
      console.error("管理者判定エラー:", e);
      isAdmin = false;
    }
    loginView.style.display = "none";
    signupView.style.display = "none";
    mainView.style.display = "block";
    showView('add-case-view');
    showView("add-case-view");
    initAddCaseView();
    startSessionTimer();
    deleteSelectedBtn.style.display = isAdmin ? "block" : "none";
  } else {
    isAdmin = false;
    loginView.style.display = "block";
    signupView.style.display = "none";
    mainView.style.display = "none";
  }
});

/* ------------------------------
 * セッション延長タイマー
 * ------------------------------ */
function resetSessionTimer() {
  try { markLoginTime(); } catch (_) {}
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    alert('セッションが10分を超えました。再度ログインしてください。');
    try { if (auth && auth.currentUser) auth.signOut(); } catch (_) {}
    try { if (emailInput) emailInput.value = ""; } catch (_) {}
    try { if (passwordInput) passwordInput.value = ""; } catch (_) {}
    try { localStorage.removeItem('loginTime'); } catch (_) {}
  }, SESSION_LIMIT_MS);
}
function startSessionTimer() {
  resetSessionTimer();
  ['click','keydown','touchstart','input','change'].forEach(evt =>
    document.addEventListener(evt, resetSessionTimer, true));
  if (!window.__inactivityInterval) {
    window.__inactivityInterval = setInterval(() => {
      try {
        if (auth && auth.currentUser && isSessionExpired()) {
          alert('セッションが10分を超えました。再度ログインしてください。');
          auth.signOut().catch(()=>{});
          clearInterval(window.__inactivityInterval);
          window.__inactivityInterval = null;
        }
      } catch (_) {}
    }, 30 * 1000);
  }
}

// Enter でログイン
if (passwordInput) {
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (loginBtn) loginBtn.click(); }
  });
}

// --- 固定キャリア(詳細)の委譲ハンドラ ---
document.addEventListener('change', (e) => {
  const t = e.target;
  if (!t || t.id !== 'fixed-carrier-checkbox-detail') return;
  try {
    if (typeof fixedCarrierSelectDetail !== 'undefined' && fixedCarrierSelectDetail) {
      fixedCarrierSelectDetail.style.display = t.checked ? 'inline-block' : 'none';
    }
    if (typeof applyFixedToUnselectedRows === 'function') applyFixedToUnselectedRows('detail');
  } catch(_) {}
}, true);
