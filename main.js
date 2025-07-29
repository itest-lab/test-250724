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
  console.log("QR debug:",matches);
  detailOrderId.textContent  =matches[0]||"";
  detailCustomer.textContent=matches[1]||"";
  detailTitle.textContent   =matches[2]||"";
  scanModeDiv.style.display="none";
  caseDetailsDiv.style.display="block";
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
confirmAddCaseBtn.onclick=async()=>{
  const orderId=detailOrderId.textContent.trim(),
        customer=detailCustomer.textContent.trim(),
        title=detailTitle.textContent.trim();
  if(!orderId||!customer||!title){addCaseMsg.textContent="情報不足";return;}
  const snap=await db.ref(`shipments/${orderId}`).once("value");
  const exist=snap.val()||{};const existSet=new Set(Object.values(exist).map(i=>i.tracking));
  const items=[];
  Array.from(trackingRows.children).forEach(row=>{
    const tn=row.querySelector("input").value.trim();if(!tn||existSet.has(tn))return;
    const carrier=fixedCarrierCheckbox.checked
      ?fixedCarrierSelect.value
      :row.querySelector("select")?.value;
    if(!carrier)return;
    items.push({carrier,tracking:tn});
  });
  if(!items.length){alert("新規追跡なし");return;}
  await db.ref(`cases/${orderId}`).set({注番:orderId,得意先:customer,品名:title,createdAt:Date.now()});
  items.forEach(it=>db.ref(`shipments/${orderId}`).push({carrier:it.carrier,tracking:it.tracking,createdAt:Date.now()}));
  addCaseMsg.textContent="登録完了";
};

// --- 別案件追加 ---
anotherCaseBtn.onclick=()=>{showView("add-case-view");initAddCaseView();};

// --- 検索結果描画 ---
function renderSearchResults(list){
  searchResults.innerHTML="";
  list.forEach(item=>{
    const li=document.createElement("li");
    li.textContent=`${item.orderId} / ${item.得意先} / ${item.品名}`;
    if(isAdmin){
      const btn=document.createElement("button");
      btn.textContent="削除";btn.className="delete-case-btn";
      btn.onclick=async e=>{e.stopPropagation();if(!confirm(`${item.orderId}を削除?`))return;
        await db.ref(`cases/${item.orderId}`).remove();
        await db.ref(`shipments/${item.orderId}`).remove();li.remove();
      };
      li.appendChild(btn);
    }
    li.onclick=()=>showCaseDetail(item.orderId,item);
    searchResults.appendChild(li);
  });
}

// --- 検索/全件 ---
function searchAll(kw=""){
  db.ref("cases").once("value").then(snap=>{
    const data=snap.val()||{},res=[];
    Object.entries(data).forEach(([orderId,obj])=>{
      if(!kw||orderId.includes(kw)||obj.得意先.includes(kw)||obj.品名.includes(kw))
        res.push({orderId,...obj});
    });
    renderSearchResults(res);
  });
}
searchBtn.onclick=()=>{showView("search-view");searchAll(searchInput.value.trim());};
listAllBtn.onclick=()=>{showView("search-view");searchAll();};

// --- 詳細＋ステータス取得 ---
async function showCaseDetail(orderId, obj){
  showView("case-detail-view");
  detailInfoDiv.innerHTML = `
    <div>受注番号: ${orderId}</div>
    <div>得意先:   ${obj.得意先}</div>
    <div>品名: ${obj.品名}</div>`;
  detailShipmentsUl.innerHTML = "";
  addTrackingDetail.style.display = "none";
  detailTrackingRows.innerHTML = "";
  detailAddMsg.textContent = "";

  // DB から追跡リスト取得
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
      // ← ここを Vercel API に変更
      const res = await fetch(
        "https://tracking-api-eta.vercel.app/fetchStatus",
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
      console.log("[client] fetchStatus →", json);

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

backToSearchBtn.onclick     = () => showView("search-view");
anotherCaseBtn2.onclick     = () => { showView("add-case-view"); initAddCaseView(); };
