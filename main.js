// main.js

// --- Tracking API URL (Vercel にデプロイしたエンドポイント) ---
const API_URL = "https://tracking-api-yourname.vercel.app/fetchStatus";

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

// キャリアラベル
const carrierLabels = {
  sagawa:  "佐川急便",
  yamato:  "ヤマト運輸",
  fukutsu: "福山通運",
  seino:   "西濃運輸",
  tonami:  "トナミ運輸"
};

// 各社の公式追跡ページURLベース
const carrierUrls = {
  sagawa:  "https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=",
  yamato:  "https://member.kms.kuronekoyamato.co.jp/parcel/detail?pno=",
  fukutsu: "https://corp.fukutsu.co.jp/situation/tracking_no_hunt/",
  seino:   "https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=",
  tonami:  "https://trc1.tonami.co.jp/trc/search3/excSearch3?id[0]="
};

let isAdmin = false;

// --- DOM取得 ---
const loginView          = document.getElementById("login-view");
const mainView           = document.getElementById("main-view");
const loginErrorEl       = document.getElementById("login-error");
const emailInput         = document.getElementById("email");
const passwordInput      = document.getElementById("password");
const loginBtn           = document.getElementById("login-btn");
const signupBtn          = document.getElementById("signup-btn");
const guestBtn           = document.getElementById("guest-btn");
const resetBtn           = document.getElementById("reset-btn");
const logoutBtn          = document.getElementById("logout-btn");

const navAddBtn          = document.getElementById("nav-add-btn");
const navSearchBtn       = document.getElementById("nav-search-btn");

const scanModeDiv        = document.getElementById("scan-mode");
const manualModeDiv      = document.getElementById("manual-mode");
const startManualBtn     = document.getElementById("start-manual-btn");
const caseBarcodeInput   = document.getElementById("case-barcode");
const manualOrderIdInput = document.getElementById("manual-order-id");
const manualCustomerInput= document.getElementById("manual-customer");
const manualTitleInput   = document.getElementById("manual-title");
const manualConfirmBtn   = document.getElementById("manual-confirm-btn");
const startScanBtn       = document.getElementById("start-scan-btn");

const caseDetailsDiv     = document.getElementById("case-details");
const detailOrderId      = document.getElementById("detail-order-id");
const detailCustomer     = document.getElementById("detail-customer");
const detailTitle        = document.getElementById("detail-title");

const fixedCarrierCheckbox = document.getElementById("fixed-carrier-checkbox");
const fixedCarrierSelect   = document.getElementById("fixed-carrier-select");
const trackingRows         = document.getElementById("tracking-rows");
const addTrackingRowBtn    = document.getElementById("add-tracking-row-btn");
const confirmAddCaseBtn    = document.getElementById("confirm-add-case-btn");
const addCaseMsg           = document.getElementById("add-case-msg");
const anotherCaseBtn       = document.getElementById("another-case-btn");

const searchView         = document.getElementById("search-view");
const searchInput        = document.getElementById("search-input");
const searchBtn          = document.getElementById("search-btn");
const listAllBtn         = document.getElementById("list-all-btn");
const searchResults      = document.getElementById("search-results");

const caseDetailView     = document.getElementById("case-detail-view");
const detailInfoDiv      = document.getElementById("detail-info");
const detailShipmentsUl  = document.getElementById("detail-shipments");
const showAddTrackingBtn = document.getElementById("show-add-tracking-btn");
const addTrackingDetail  = document.getElementById("add-tracking-detail");
const detailTrackingRows = document.getElementById("detail-tracking-rows");
const detailAddRowBtn    = document.getElementById("detail-add-tracking-row-btn");
const confirmDetailAddBtn= document.getElementById("confirm-detail-add-btn");
const detailAddMsg       = document.getElementById("detail-add-msg");
const cancelDetailAddBtn = document.getElementById("cancel-detail-add-btn");
const backToSearchBtn    = document.getElementById("back-to-search-btn");
const anotherCaseBtn2    = document.getElementById("another-case-btn-2");

// --- ビュー切替ヘルパー ---
function showView(id){
  document.querySelectorAll(".subview").forEach(el=>el.style.display="none");
  document.getElementById(id).style.display="block";
}

// --- 認証監視 ---
auth.onAuthStateChanged(async user=>{
  if(user){
    const snap = await db.ref(`admins/${user.uid}`).once("value");
    isAdmin = snap.val()===true;
    loginView.style.display="none";
    mainView.style.display="block";
    showView("add-case-view");
    initAddCaseView();
  } else {
    isAdmin=false;
    loginView.style.display="block";
    mainView.style.display="none";
  }
});

// --- 認証操作 ---
loginBtn.onclick=async()=>{
  const id=emailInput.value.trim(), pw=passwordInput.value;
  loginErrorEl.textContent="";
  try{
    if(id==="admin"&&pw==="admin"){
      await auth.signInWithEmailAndPassword("admin@test.com","admin");
    } else {
      await auth.signInWithEmailAndPassword(id,pw);
    }
  }catch(e){
    loginErrorEl.textContent=e.message;
  }
};
signupBtn.onclick=()=>auth.createUserWithEmailAndPassword(emailInput.value.trim(),passwordInput.value)
  .catch(e=>loginErrorEl.textContent=e.message);
guestBtn.onclick=()=>auth.signInAnonymously().catch(e=>loginErrorEl.textContent=e.message);
resetBtn.onclick=()=>auth.sendPasswordResetEmail(emailInput.value.trim())
  .then(()=>loginErrorEl.textContent="再発行メール送信")
  .catch(e=>loginErrorEl.textContent=e.message);
logoutBtn.onclick=()=>auth.signOut();

// --- ナビゲーション ---
navAddBtn.addEventListener("click",   ()=>{showView("add-case-view");initAddCaseView();});
navSearchBtn.addEventListener("click",()=>{showView("search-view");searchAll(searchInput.value.trim());});

// --- 追跡行生成 ---
function createTrackingRow(context="add"){
  const row=document.createElement("div");row.className="tracking-row";
  if(!fixedCarrierCheckbox.checked||context==="detail"){
    const sel=document.createElement("select");
    sel.innerHTML=`
      <option value="">運送会社</option>
      <option value="sagawa">佐川急便</option>
      <option value="yamato">ヤマト運輸</option>
      <option value="fukutsu">福山通運</option>
      <option value="seino">西濃運輸</option>
      <option value="tonami">トナミ運輸</option>`;
    row.appendChild(sel);
  }
  const inp=document.createElement("input");
  inp.type="text";inp.placeholder="追跡番号";inp.inputMode="numeric";
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
  return row;
}

// --- 初期化：案件追加 ---
function initAddCaseView(){
  scanModeDiv.style.display     ="block";
  manualModeDiv.style.display   ="none";
  caseDetailsDiv.style.display  ="none";
  caseBarcodeInput.value        ="";
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
fixedCarrierCheckbox.onchange=()=>{…};

// --- IME無効化 ---
caseBarcodeInput.addEventListener("compositionstart",e=>e.preventDefault());

// --- QR→テキスト展開＆表示 ---
caseBarcodeInput.addEventListener("keydown", e=>{…});

// --- 手動確定 ---
startManualBtn.onclick=()=>{…};
startScanBtn.onclick=()=>{…};
manualConfirmBtn.onclick=()=>{…};

// --- 登録 ---
confirmAddCaseBtn.onclick=async()=>{…};

// --- 別案件追加 ---
anotherCaseBtn.onclick=()=>{…};

// --- 検索結果描画 ---
function renderSearchResults(list){…}

// --- 検索/全件 ---
function searchAll(kw=""){…}
searchBtn.onclick=()=>{…};
listAllBtn.onclick=()=>{…};

// --- 詳細＋ステータス取得 ---
async function showCaseDetail(orderId,obj){
  showView("case-detail-view");
  detailInfoDiv.innerHTML=`<div>受注番号:${orderId}</div><div>得意先:${obj.得意先}</div><div>品名:${obj.品名}</div>`;
  detailShipmentsUl.innerHTML="";
  addTrackingDetail.style.display="none";
  detailTrackingRows.innerHTML="";
  detailAddMsg.textContent="";

  const snap=await db.ref(`shipments/${orderId}`).once("value"),list=snap.val()||{};
  for(const key of Object.keys(list)){
    const it=list[key],label=carrierLabels[it.carrier]||it.carrier;
    const li=document.createElement("li");
    const a=document.createElement("a");
    a.href=(carrierUrls[it.carrier]||"")+encodeURIComponent(it.tracking);
    a.target="_blank";
    a.textContent=`${label}：${it.tracking}：読み込み中…`;
    li.appendChild(a);
    detailShipmentsUl.appendChild(li);

    try{
      // ← ここを Vercel API_URL に変更！
      const res=await fetch(API_URL, {
        method:  "POST",
        headers: {"Content-Type":"application/json"},
        body:    JSON.stringify(it)
      });
      const json=await res.json();
      console.log("[client] fetchStatus →",json);

      let statusVal, timeVal;
      if(typeof json.status==="object"){
        statusVal=json.status.status||"";
        timeVal  =json.status.time  ||json.time||"";
      } else {
        statusVal=json.status||"";
        timeVal  =json.time||"";
      }

      a.textContent=timeVal
        ? `${label}：${it.tracking}：${statusVal}　配達日時:${timeVal}`
        : `${label}：${it.tracking}：${statusVal}`;

    } catch(err){
      console.error("fetchStatus error:",err);
      a.textContent=`${label}：${it.tracking}：取得失敗`;
    }
  }

  showAddTrackingBtn.onclick=()=>{…};
  detailAddRowBtn.onclick=()=>{…};
  cancelDetailAddBtn.onclick=()=>{…};
  confirmDetailAddBtn.onclick=async()=>{…};
}

backToSearchBtn.onclick=()=>showView("search-view");
anotherCaseBtn2.onclick=()=>{showView("add-case-view");initAddCaseView();};
