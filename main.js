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

// 1) ページロード時に既存セッションを強制クリア
auth.signOut().catch(err=>{
  console.warn("初期サインアウト失敗:", err);
});

// 2) 以降のサインインをメモリ（NONE）に限定
auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
  .catch(err=>{
    console.error("永続化設定エラー:", err);
  });

const db   = firebase.database();

// --- モバイル判定 ---
//const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// キャリアラベル
const carrierLabels = {
  sagawa:  "佐川急便",
  yamato:  "ヤマト運輸",
  fukutsu: "福山通運",
  seino:   "西濃運輸",
  tonami:  "トナミ運輸",
  hida:  "飛騨運輸"
};

// 各社の追跡ページURL
const carrierUrls = {
  sagawa:  "https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=",
  yamato:  "https://member.kms.kuronekoyamato.co.jp/parcel/detail?pno=",
  fukutsu: "https://corp.fukutsu.co.jp/situation/tracking_no_hunt/",
  seino:   "https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=",
  tonami:  "https://trc1.tonami.co.jp/trc/search3/excSearch3?id[0]=",
  hida:  "http://www.hida-unyu.co.jp/tsuiseki/sho100.html?okurijoNo="
};

let isAdmin = false;
let sessionTimer;
let currentOrderId = null;

// --- DOM取得 ---
const loginView             = document.getElementById("login-view");
const mainView              = document.getElementById("main-view");
const loginErrorEl          = document.getElementById("login-error");
const emailInput            = document.getElementById("email");
const passwordInput         = document.getElementById("password");
const loginBtn              = document.getElementById("login-btn");
const signupBtn             = document.getElementById("signup-btn");
const guestBtn              = document.getElementById("guest-btn");
const resetBtn              = document.getElementById("reset-btn");
const logoutBtn             = document.getElementById("logout-btn");

const navAddBtn             = document.getElementById("nav-add-btn");
const navSearchBtn          = document.getElementById("nav-search-btn");

const scanModeDiv           = document.getElementById("scan-mode");
const manualModeDiv         = document.getElementById("manual-mode");
const startManualBtn        = document.getElementById("start-manual-btn");
const caseBarcodeInput      = document.getElementById("case-barcode");
const manualOrderIdInput    = document.getElementById("manual-order-id");
const manualCustomerInput   = document.getElementById("manual-customer");
const manualTitleInput      = document.getElementById("manual-title");
const manualConfirmBtn      = document.getElementById("manual-confirm-btn");
const startScanBtn          = document.getElementById("start-scan-btn");

const caseDetailsDiv        = document.getElementById("case-details");
const detailOrderId         = document.getElementById("detail-order-id");
const detailCustomer        = document.getElementById("detail-customer");
const detailTitle           = document.getElementById("detail-title");

const fixedCarrierCheckbox  = document.getElementById("fixed-carrier-checkbox");
const fixedCarrierSelect    = document.getElementById("fixed-carrier-select");
const trackingRows          = document.getElementById("tracking-rows");
const addTrackingRowBtn     = document.getElementById("add-tracking-row-btn");
const confirmAddCaseBtn     = document.getElementById("confirm-add-case-btn");
const addCaseMsg            = document.getElementById("add-case-msg");
const anotherCaseBtn        = document.getElementById("another-case-btn");

const searchView            = document.getElementById("search-view");
const searchInput           = document.getElementById("search-input");
const searchBtn             = document.getElementById("search-btn");
const listAllBtn            = document.getElementById("list-all-btn");
const searchResults         = document.getElementById("search-results");

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

const btnScan2D             = document.getElementById("btnScan2D");
const btnScan1D             = document.getElementById("btnScan1D");
const video1d               = document.getElementById("video1d");

// モバイル判定に応じてグローバルボタンを表示/無効化
//if (!isMobile) {
//  btnScan2D.style.display = "none";
//  btnScan1D.style.display = "none";
//} else {
  // 追跡番号用カメラ起動（グローバル）
//  btnScan1D.addEventListener("click", () => {
//    let target = document.activeElement;
//    if (!(target && target.tagName==="INPUT" && target.parentElement.classList.contains("tracking-row"))) {
//      target = trackingRows.querySelector("input");
//    }
//    if (target) start1DScanner(target.id);
//  });
//}

// ─────────────────────────────────────────────────────────────────
// セッションタイムスタンプ管理
// ─────────────────────────────────────────────────────────────────

const SESSION_LIMIT_MS = 30 * 60 * 1000;

function clearLoginTime() {
  // ログイン画面を開くたびに前回のタイムスタンプを消去
  localStorage.removeItem('loginTime');
}

function markLoginTime() {
  // 認証成功時に記録
  localStorage.setItem('loginTime', Date.now().toString());
}

function isSessionExpired() {
  const t = parseInt(localStorage.getItem('loginTime') || '0', 10);
  return (Date.now() - t) > SESSION_LIMIT_MS;
}

// --- ビュー切替ヘルパー ---
function showView(id){
  document.querySelectorAll(".subview").forEach(el=>el.style.display="none");
  document.getElementById(id).style.display="block";
  // 画面ごとに最上部入力要素へフォーカス
  switch(id){
    case "add-case-view":
      // 初期状態ならスキャンモード。手動モード時はそちら
      if(scanModeDiv.style.display !== "none"){
        caseBarcodeInput.focus();
      } else if(manualModeDiv.style.display !== "none"){
        manualOrderIdInput.focus();
      }
      break;

    case "search-view":
      searchInput.focus();
      break;

    case "case-detail-view":
      // 詳細画面では「追跡番号追加」ボタンにフォーカス
      showAddTrackingBtn.focus();
      break;
  }
}

// ページロード直後に、未ログインならメール入力へフォーカス
if(loginView.style.display !== "none"){
  emailInput.focus();
}

// --- 認証監視 ---
auth.onAuthStateChanged(async user => {
  if (user) {
    try {
      // Realtime DB の admins/{uid} が true なら管理者扱い
      const snap = await db.ref(`admins/${user.uid}`).once("value");
      isAdmin = snap.val() === true;
    } catch (e) {
      console.error("管理者判定エラー:", e);
      isAdmin = false;
    }

    loginView.style.display = "none";
    mainView.style.display = "block";
    showView("add-case-view");
    initAddCaseView();
    startSessionTimer();
  } else {
    // ログアウト時
    isAdmin = false;
    loginView.style.display = "block";
    mainView.style.display = "none";
    emailInput.focus();
    clearLoginTime();
  }
});

// --- 認証操作 ---
loginBtn.onclick = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  loginErrorEl.textContent = "";
  clearLoginTime();  // 既存タイムスタンプをクリア

  try {
    // メール／パスワードでログイン（admin判定はDBで後述）
    await auth.signInWithEmailAndPassword(email, password);
    markLoginTime();  // 認証成功時にタイムスタンプを記録
  } catch (e) {
    loginErrorEl.textContent = e.message;
  }
};

signupBtn.onclick = () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  // 新規登録後は admins ノードに自動で書き込まない ⇒ 管理者は手動でDBに追加
  auth.createUserWithEmailAndPassword(email, password)
    .catch(e => loginErrorEl.textContent = e.message);
};

guestBtn.onclick = () => {
  auth.signInAnonymously()
    .catch(e => loginErrorEl.textContent = e.message);
};

resetBtn.onclick = () => {
  const email = emailInput.value.trim();
  auth.sendPasswordResetEmail(email)
    .then(() => loginErrorEl.textContent = "再発行メール送信")
    .catch(e => loginErrorEl.textContent = e.message);
};

logoutBtn.onclick = () => auth.signOut();

// --- ナビゲーション ---
navAddBtn.addEventListener("click", () => {
  showView("add-case-view");
  initAddCaseView();
});
navSearchBtn.addEventListener("click", ()=>{
  showView("search-view");
  searchAll(searchInput.value.trim());
});

// --- 追跡行生成 ---
function createTrackingRow(context="add"){
  const row = document.createElement("div");
  row.className = "tracking-row";

  // ── 運送会社セレクトの付与 ──
  if (context === "add") {
    if (!fixedCarrierCheckbox.checked) {
      const sel = document.createElement("select");
      sel.innerHTML = `
        <option value="">運送会社</option>
        <option value="sagawa">佐川急便</option>
        <option value="yamato">ヤマト運輸</option>
        <option value="fukutsu">福山通運</option>
        <option value="seino">西濃運輸</option>
        <option value="tonami">トナミ運輸</option>
        <option value="hida">飛騨運輸</option>`;
      row.appendChild(sel);
    }
  } else {  // context === "detail"
    if (!fixedCarrierCheckboxDetail.checked) {
      const sel = document.createElement("select");
      sel.innerHTML = `
        <option value="">運送会社</option>
        <option value="sagawa">佐川急便</option>
        <option value="yamato">ヤマト運輸</option>
        <option value="fukutsu">福山通運</option>
        <option value="seino">西濃運輸</option>
        <option value="tonami">トナミ運輸</option>
        <option value="hida">飛騨運輸</option>`;
      row.appendChild(sel);
    }
  }
  const inp=document.createElement("input");
  inp.type="text";
  inp.placeholder="追跡番号";
  inp.inputMode="numeric";
  const uniqueId = `tracking-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  inp.id = uniqueId;
  inp.addEventListener("input",e=>{e.target.value=e.target.value.replace(/\D/g,"");});
  inp.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key==="Tab"){
      e.preventDefault();
      const inputs=[...row.parentElement.querySelectorAll("input")];
      const idx=inputs.indexOf(inp);
      if(idx<inputs.length-1){
        inputs[idx+1].focus();
      } else {
        if(context==="detail") detailAddRowBtn.click();
        else addTrackingRowBtn.click();
        setTimeout(()=>{
          const arr=[...row.parentElement.querySelectorAll("input")];
          arr[arr.length-1].focus();
        },0);
      }
    }
  });
  row.appendChild(inp);
//  if (isMobile) {
//    const scanBtn = document.createElement("button");
//    scanBtn.type = "button";
//    scanBtn.textContent = "カメラ起動";
//    scanBtn.addEventListener("click", () => start1DScanner(uniqueId));
//    row.appendChild(scanBtn);
//  }
  return row;
}

// ── 詳細画面：一括運送会社指定 ──
fixedCarrierCheckboxDetail.onchange = () => {
  // セレクトの表示／非表示
  fixedCarrierSelectDetail.style.display = fixedCarrierCheckboxDetail.checked
    ? "inline-block"
    : "none";

  // 既に追加済みの行についても select を追加／削除
  Array.from(detailTrackingRows.children).forEach(row => {
    const sel = row.querySelector("select");
    if (fixedCarrierCheckboxDetail.checked) {
      if (sel) row.removeChild(sel);
    } else {
      if (!sel) {
        const newSel = document.createElement("select");
        newSel.innerHTML = `
          <option value="">運送会社</option>
          <option value="sagawa">佐川急便</option>
          <option value="yamato">ヤマト運輸</option>
          <option value="fukutsu">福山通運</option>
          <option value="seino">西濃運輸</option>
          <option value="tonami">トナミ運輸</option>
          <option value="hida">飛騨運輸</option>`;
        row.insertBefore(newSel, row.firstChild);
      }
    }
  });
};

// --- 初期化：案件追加 ---
function initAddCaseView(){
  scanModeDiv.style.display     ="block";
  manualModeDiv.style.display   ="none";
  caseDetailsDiv.style.display  ="none";
  caseBarcodeInput.value        ="";
//  if (!isMobile) btnScan2D.disabled = true;
  manualOrderIdInput.value      ="";
  manualCustomerInput.value     ="";
  manualTitleInput.value        ="";
  addCaseMsg.textContent        ="";
  fixedCarrierCheckbox.checked  =false;
  fixedCarrierSelect.style.display="none";
  fixedCarrierSelect.value      ="";
  trackingRows.innerHTML        ="";
  for(let i=0;i<10;i++) trackingRows.appendChild(createTrackingRow());
}

// --- 行追加・固定キャリア切替 ---
addTrackingRowBtn.onclick=()=>{for(let i=0;i<10;i++)trackingRows.appendChild(createTrackingRow());};
fixedCarrierCheckbox.onchange=()=>{
  fixedCarrierSelect.style.display=fixedCarrierCheckbox.checked?"block":"none";
  Array.from(trackingRows.children).forEach(row=>{
    const sel=row.querySelector("select");
    if(fixedCarrierCheckbox.checked){
      if(sel)row.removeChild(sel);
    } else {
      if(!sel)row.insertBefore(createTrackingRow().querySelector("select"),row.firstChild);
    }
  });
};

// --- IME無効化 ---
caseBarcodeInput.addEventListener("compositionstart",e=>e.preventDefault());

// --- QR→テキスト展開＆表示 ---
caseBarcodeInput.addEventListener("keydown", e=>{
  if(e.key!=="Enter")return;
  const raw=caseBarcodeInput.value.trim();if(!raw)return;
  let text;
  try{
    if(raw.startsWith("ZLIB64:")){
      const b64=raw.slice(7),bin=atob(b64),
            arr=new Uint8Array([...bin].map(c=>c.charCodeAt(0))),
            dec=pako.inflate(arr);
      text=new TextDecoder().decode(dec);
    } else text=raw;
  }catch(err){
    alert("QRデコード失敗: "+err.message);return;
  }
  text=text.trim().replace(/「[^」]*」/g,"");
  const matches=Array.from(text.matchAll(/"([^"]*)"/g),m=>m[1]);
  detailOrderId.textContent  =matches[0]||"";
  detailCustomer.textContent=matches[1]||"";
  detailTitle.textContent   =matches[2]||"";
  scanModeDiv.style.display="none";
  caseDetailsDiv.style.display="block";
//  if (isMobile) {
//    btnScan2D.addEventListener("click", () => start2DScanner('case-barcode'));
//  }
});

// --- 手動確定 ---
startManualBtn.onclick=()=>{
  scanModeDiv.style.display="none";
  manualModeDiv.style.display="block";
};
startScanBtn.onclick=()=>{
  manualModeDiv.style.display="none";
  scanModeDiv.style.display="block";
};
manualConfirmBtn.onclick=()=>{
  if(!manualOrderIdInput.value||!manualCustomerInput.value||!manualTitleInput.value){
    alert("必須項目を入力");return;
  }
  detailOrderId.textContent  =manualOrderIdInput.value.trim();
  detailCustomer.textContent=manualCustomerInput.value.trim();
  detailTitle.textContent   =manualTitleInput.value.trim();
  manualModeDiv.style.display="none";
  caseDetailsDiv.style.display="block";
};

// --- 登録 ---
confirmAddCaseBtn.onclick = async () => {
  const orderId  = detailOrderId.textContent.trim(),
        customer = detailCustomer.textContent.trim(),
        title    = detailTitle.textContent.trim();
  if (!orderId || !customer || !title) {
    addCaseMsg.textContent = "情報不足";
    return;
  }

  // 既存データを取得し、「carrier:tracking」のキーでセットを作成
  const snap      = await db.ref(`shipments/${orderId}`).once("value");
  const existObj  = snap.val() || {};
  const existSet  = new Set(
    Object.values(existObj)
          .map(it => `${it.carrier}:${it.tracking}`)
  );

  const items = [];

  // 入力行をループし、carrier と tracking の組み合わせで重複をスキップ
  Array.from(trackingRows.children).forEach(row => {
    const tn = row.querySelector("input").value.trim();
    const carrier = fixedCarrierCheckbox.checked
      ? fixedCarrierSelect.value
      : row.querySelector("select")?.value;

    if (!tn || !carrier) return;           // 入力不足はスキップ

    const key = `${carrier}:${tn}`;
    if (existSet.has(key)) return;         // 既存／新規で重複していたらスキップ

    existSet.add(key);                     // 同じセッション内での重複防止
    items.push({ carrier, tracking: tn });
  });

  if (items.length === 0) {
    alert("新規追跡なし");
    return;
  }

  // ケース情報をセット
  await db.ref(`cases/${orderId}`).set({
    注番: orderId,
    得意先: customer,
    品名: title,
    createdAt: Date.now()
  });

  // 重複チェック済みの items を一括プッシュ
  for (const it of items) {
    await db.ref(`shipments/${orderId}`).push({
      carrier: it.carrier,
      tracking: it.tracking,
      createdAt: Date.now()
    });
  }

  addCaseMsg.textContent = "登録完了";
};

// --- 別案件追加（追加画面／詳細画面 両方共通） ---
anotherCaseBtn.onclick=()=>{
  showView("add-case-view");
  initAddCaseView();
};
anotherCaseBtn2.onclick=()=>{
  showView("add-case-view");
  initAddCaseView();
};

// --- 検索結果描画 ---
function renderSearchResults(list){
  searchResults.innerHTML="";
  list.forEach(item=>{
    const li=document.createElement("li");
    li.textContent=`${item.orderId} / ${item.得意先} / ${item.品名}`;
    if(isAdmin){
      const btn=document.createElement("button");
      btn.textContent="削除";btn.className="delete-case-btn";
      btn.onclick=async e=>{
        e.stopPropagation();
        if(!confirm(`${item.orderId}を削除?`))return;
        await db.ref(`cases/${item.orderId}`).remove();
        await db.ref(`shipments/${item.orderId}`).remove();
        li.remove();
      };
      li.appendChild(btn);
    }
    li.onclick=()=>showCaseDetail(item.orderId,item);
    searchResults.appendChild(li);
  });
}

// --- 検索／全件 ---
function searchAll(kw=""){
  db.ref("cases").once("value").then(snap=>{
    const data = snap.val() || {},
          res  = [];

    // フィルタ＆配列化
    Object.entries(data).forEach(([orderId,obj])=>{
      if (!kw
          || orderId.includes(kw)
          || obj.得意先.includes(kw)
          || obj.品名.includes(kw)
      ) {
        res.push({ orderId, ...obj });
      }
    });

    // 新→古順にソート（createdAt がタイムスタンプで入っている前提）
    res.sort((a, b) => b.createdAt - a.createdAt);

    renderSearchResults(res);
  });
}

searchBtn.onclick=()=>{
  showView("search-view");
  searchAll(searchInput.value.trim());
};
listAllBtn.onclick=()=>{
  showView("search-view");
  searchAll();
};

// --- 詳細＋ステータス取得 ---
async function showCaseDetail(orderId, obj){
  showView("case-detail-view");
  detailInfoDiv.innerHTML = `
    <div>受注番号: ${orderId}</div>
    <div>得意先:   ${obj.得意先}</div>
    <div>品名: ${obj.品名}</div>`;
  detailShipmentsUl.innerHTML = "";
  currentOrderId = orderId;            // いま操作している注文番号を保存
  addTrackingDetail.style.display = "none";
  detailTrackingRows.innerHTML = "";   // 以前の行をクリア
  detailAddMsg.textContent = "";
  detailAddRowBtn.disabled = false;
  confirmDetailAddBtn.disabled = false;
  cancelDetailAddBtn.disabled = false;

  const snap = await db.ref(`shipments/${orderId}`).once("value");
  const list = snap.val() || {};

  for (const key of Object.keys(list)) {
    const it = list[key];
    const label = carrierLabels[it.carrier] || it.carrier;
    const a = document.createElement("a");
    a.href = carrierUrls[it.carrier] + encodeURIComponent(it.tracking);
    a.target = "_blank";
    a.textContent = `${label}：${it.tracking}：読み込み中…`;

    const li = document.createElement("li");
    li.appendChild(a);
    detailShipmentsUl.appendChild(li);

    try {
      const res = await fetch(
        "https://track-api.hr46-ksg.workers.dev/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carrier: it.carrier,
            tracking: it.tracking
          })
        }
      );
      const json = await res.json();
      const statusVal = json.status || "";
      const timeVal   = json.time   || "";
      a.textContent = timeVal
        ? `${label}：${it.tracking}：${statusVal}　配達日時:${timeVal}`
        : `${label}：${it.tracking}：${statusVal}`;
    } catch (err) {
      console.error("fetchStatus error:", err);
      a.textContent = `${label}：${it.tracking}：取得失敗`;
    }
  }
}

backToSearchBtn.onclick=()=>showView("search-view");

// ─────────────────────────────────────────────────────────────────
// ３）２次元コード読み取り (jsQR)
// ─────────────────────────────────────────────────────────────────
const canvas = document.createElement('canvas');
async function start2DScanner(inputId) {
  const video = document.getElementById('video2d');
  video.style.display = 'block';
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
  video.srcObject = stream;
  video.play();
  scan2D(video, inputId);
}
function stop2DScanner() {
  const video = document.getElementById('video2d');
  (video.srcObject?.getTracks() || []).forEach(t => t.stop());
  video.srcObject = null;
  video.style.display = 'none';
}
function scan2D(video, inputId) {
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height);
    if (code) {
      document.getElementById(inputId).value = code.data;
      stop2DScanner();
      return;
    }
  }
  requestAnimationFrame(() => scan2D(video, inputId));
}

// ─────────────────────────────────────────────────────────────────
// ４）１次元バーコード読み取り (QuaggaJS)
// ─────────────────────────────────────────────────────────────────
function start1DScanner(inputId) {
  const video = document.getElementById('video1d');
  video.style.display = 'block';
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: video,
      constraints: { facingMode: "environment" }
    },
    decoder: {
      readers: [
        "code_128_reader",
        "ean_reader",
        "ean_8_reader",
        "upc_reader",
        "upc_e_reader"
      ]
    }
  }, err => {
    if (err) return console.error(err);
    Quagga.start();
  });
  Quagga.onDetected(result => {
    const code = result.codeResult?.code;
    if (code) {
      document.getElementById(inputId).value = code;
      Quagga.stop();
      video.style.display = 'none';
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// ５）セッションタイムアウト（30分）
// ─────────────────────────────────────────────────────────────────
function resetSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    alert('セッションが30分を超えました。再度ログインしてください。');
    auth.signOut();
  }, 30 * 60 * 1000);
}
function startSessionTimer() {
  resetSessionTimer();
  ['click','keydown','touchstart'].forEach(evt => document.addEventListener(evt, resetSessionTimer));
}

// ─────────────────────────────────────────────────────────────────
// 詳細画面：追跡番号追加フォーム操作
// ─────────────────────────────────────────────────────────────────
// 「追跡番号追加」ボタン
showAddTrackingBtn.onclick = () => {
  addTrackingDetail.style.display = "block";
  detailTrackingRows.innerHTML = "";
  // 最初に5行追加
  for (let i = 0; i < 5; i++) {
    detailTrackingRows.appendChild(createTrackingRow("detail"));
  }
  // 初回追加後は「追跡番号追加」ボタン自体を非表示に
  showAddTrackingBtn.style.display = "none";
};

// 「＋追跡番号行を5行ずつ追加」
detailAddRowBtn.onclick = () => {
  for (let i = 0; i < 5; i++) {
    detailTrackingRows.appendChild(createTrackingRow("detail"));
  }
};

// 「キャンセル」
cancelDetailAddBtn.onclick = () => {
  addTrackingDetail.style.display = "none";
  detailTrackingRows.innerHTML = "";
  detailAddMsg.textContent = "";
};

// ① fetchStatus ヘルパーを定義
async function fetchStatus(carrier, tracking) {
  const res = await fetch("https://track-api.hr46-ksg.workers.dev/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carrier, tracking })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();  // { status: "...", time: "..." }
}

// 「追加登録」
confirmDetailAddBtn.onclick = async () => {
  if (!currentOrderId) return;

  // 0) 既存データの読み込みと重複チェック
  const snap = await db.ref(`shipments/${currentOrderId}`).once("value");
  const existObj = snap.val() || {};
  const existSet = new Set(
    Object.values(existObj).map(it => `${it.carrier}:${it.tracking}`)
  );

  // 1) 入力行から新規追加分をピックアップ
  const newItems = [];
  detailTrackingRows.querySelectorAll(".tracking-row").forEach(row => {
    const tn = row.querySelector("input").value.trim();
    if (!tn) return;
    const carrier = fixedCarrierCheckboxDetail.checked
      ? fixedCarrierSelectDetail.value
      : row.querySelector("select")?.value;
    if (!carrier) return;

    const key = `${carrier}:${tn}`;
    if (existSet.has(key)) return;        // 重複はスキップ
    existSet.add(key);
    newItems.push({ carrier, tracking: tn });
  });

  if (newItems.length === 0) {
    alert("新規の追跡番号がありません（既に登録済み）");
    return;
  }

  // 1) DB プッシュ
  for (const it of newItems) {
    await db.ref(`shipments/${currentOrderId}`)
            .push({ carrier: it.carrier, tracking: it.tracking, createdAt: Date.now() });
  }

  // 2) UI に「読み込み中…」リンクを追加しつつ anchorEls に保持
  const anchorEls = newItems.map(it => {
    const label = carrierLabels[it.carrier] || it.carrier;
    const a = document.createElement("a");
    a.href        = carrierUrls[it.carrier] + encodeURIComponent(it.tracking);
    a.target      = "_blank";
    a.textContent = `${label}：${it.tracking}：読み込み中…`;
    const li = document.createElement("li");
    li.appendChild(a);
    detailShipmentsUl.appendChild(li);
    return a;
  });

  // 3) フォームを閉じ＆クリア
  addTrackingDetail.style.display  = "none";
  detailTrackingRows.innerHTML     = "";
  showAddTrackingBtn.style.display = "inline-block";
  detailAddMsg.textContent         = "追加しました";

  // 4) 追加分だけ逐次 fetchStatus を回してテキストを更新
  newItems.forEach((it, idx) => {
    const a = anchorEls[idx];
    fetchStatus(it.carrier, it.tracking)
      .then(json => {
        const label = carrierLabels[it.carrier] || it.carrier;
        const { status, time } = json;
        a.textContent = time
          ? `${label}：${it.tracking}：${status}　配達日時:${time}`
          : `${label}：${it.tracking}：${status}`;
      })
      .catch(err => {
        console.error("fetchStatus error:", err);
        a.textContent = `${label}：${it.tracking}：取得失敗`;
      });
  });
};
