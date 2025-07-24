// server.js
// ────────────────────────────────────────────────────────────────────────────────
// Node.js + Express + axios + cheerio で各社追跡ステータスをスクレイピングする
// エンドポイントを提供するサーバー実装例
// ────────────────────────────────────────────────────────────────────────────────

// 1. モジュールのインポート
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";      // cheerio はデフォルトエクスポートがないため * as で
import path from "path";
import { fileURLToPath } from "url";

// 2. __dirname / __filename を ES モジュール環境で定義
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// 3. Express アプリの初期化
const app  = express();
const PORT = process.env.PORT || 3000;

// 4. ミドルウェア設定
//   ・JSON ボディを自動でパース
app.use(express.json());
//   ・カレントディレクトリを静的ファイルのルートに
app.use(express.static(path.join(__dirname)));


// 5. 各キャリアごとの URL + ステータス抽出ロジック定義
const carrierConfigs = {
  // 佐川急便
  sagawa: {
    url: tracking =>
      `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${tracking}`,
    extract: html => {
      const $ = cheerio.load(html);
      return $("span.state").first().text().trim();
    }
  },

  // ヤマト運輸
  yamato: {
    // POST の場合は options を使ってフォーム送信
    options: tracking => ({
      method: "POST",
      url:    "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: new URLSearchParams({
        number00: "1",      // 1:詳細あり、2:詳細なし
        number01: tracking
      }).toString()
    }),
    extract: html => {
      const $ = cheerio.load(html);
      return $('h4.tracking-invoice-block-state-title')
        .first().text().trim();
    }
  },

  // 福山通運
  fukutsu: {
    url: tracking =>
      `https://corp.fukutsu.co.jp/situation/tracking_no_hunt/${tracking}`,
    extract: html => {
      const $ = cheerio.load(html);
      return $("strong.redbold").first().text().trim();
    }
  },

  // 西濃運輸
  seino: {
    url: tracking =>
      `http://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=${tracking}`,
    extract: html => {
      const $ = cheerio.load(html);
      // <input id="haitatsuJokyo0" value="…">
      return $('input#haitatsuJokyo0').attr("value") || "";
    }
  },

  // トナミ運輸
  tonami: {
    url: tracking =>
      `https://trc1.tonami.co.jp/trc/search3/excSearch3?id[0]=${tracking}`,
    extract: html => {
      const $ = cheerio.load(html);
      const labels = $("label.col-form-label");
      // 2番目の<label>要素にステータスが入っている
      if (labels.length >= 2) {
        return $(labels[1]).text().trim();
      }
      return "";
    }
  }
};


// 6. POST /fetchStatus エンドポイント
//    リクエストボディに { carrier: "...", tracking: "..." }
app.post("/fetchStatus", async (req, res) => {
  const { carrier, tracking } = req.body;

  // バリデーション
  if (!carrier || !tracking) {
    return res.status(400).json({ error: "carrier と tracking が必須です" });
  }

  const cfg = carrierConfigs[carrier];
  if (!cfg) {
    return res
      .status(400)
      .json({ error: `非対応のキャリアです: ${carrier}` });
  }

  try {
    // axios でスクレイピング対象ページを取得
    let response;
    if (cfg.options) {
      response = await axios(cfg.options(tracking));
    } else {
      response = await axios.get(cfg.url(tracking));
    }

    const html = response.data;
    // cheerio でステータス抽出
    let status = cfg.extract(html);
    if (!status) status = "情報取得できませんでした";

    return res.json({ status });

  } catch (err) {
    console.error("スクレイピングエラー:", err);
    return res
      .status(500)
      .json({ error: "スクレイピング失敗: " + err.message });
  }
});


// 7. サーバー起動
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
