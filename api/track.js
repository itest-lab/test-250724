// api/track.js
import axios from "axios";
import * as cheerio from "cheerio";

// CORS ヘッダーを一括設定
const enableCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

export default async function handler(req, res) {
  enableCors(res);
  if (req.method === "OPTIONS") {
    // プリフライト応答
    res.status(204).end();
    return;
  }

  const { carrier, number } = req.query;
  if (!carrier || !number) {
    return res
      .status(400)
      .json({ error: "クエリパラメータ carrier と number が必要です" });
  }

  // 小文字英数字化したキーを生成
  const key = carrier
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace("ヤマト運輸", "yamato")
    .replace("佐川急便", "sagawa")
    .replace("トナミ運輸", "tonami");

  const cfg = carrierConfigs[key];
  if (!cfg) {
    return res
      .status(400)
      .json({ error: `未対応キャリア: ${carrier}` });
  }

  try {
    const response = cfg.options
      ? await axios(cfg.options(number))
      : await axios.get(cfg.url(number));
    const { status, time } = cfg.extract(response.data);
    return res.status(200).json({ status, time });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "スクレイピング失敗" });
  }
}

// ───────────────────────────────────────────
// 元の server.js からスクレイピング設定をそのまま流用
// 詳細は server.js を参照してください :contentReference[oaicite:1]{index=1}
const carrierConfigs = {
  // 佐川急便
  sagawa: {
    url: t => `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${t}`,
    extract: html => {
      const $ = cheerio.load(html);
      let status = $("span.state").first().text().trim();
      if (status === "該当なし") status = "伝票番号未登録";
      let time = "";
      $("dl.okurijo_info dt").each((i, el) => {
        if ($(el).text().includes("配達完了日")) {
          time = $(el).next("dd").text().trim()
            .replace(/年|月/g, "/")
            .replace(/日/, "")
            .replace("時", ":")
            .replace("分", "");
          return false;
        }
      });
      return { status, time };
    }
  },
  // ヤマト運輸
  yamato: {
    options: tracking => ({
      method: "POST",
      url: "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: new URLSearchParams({
        number00: "1",
        number01: tracking
      }).toString()
    }),
    extract: html => {
      const $ = cheerio.load(html);
      const status = $('h4.tracking-invoice-block-state-title').first().text().trim();
      let time = "";
      $('div.tracking-invoice-block-detail ol li').each((i, li) => {
        const item = $(li).find("div.item").text().trim();
        if (item.includes("配達完了")) {
          time = $(li).find("div.date").text().trim();
          return false;
        }
      });
      const finalStatus = time ? `${status}：配達日時 ${time}` : status;
      return { status: finalStatus, time };
    }
  },
  // トナミ運輸
  tonami: {
    url: t => `https://trc1.tonami.co.jp/trc/search3/excSearch3?id[0]=${t}`,
    extract: html => {
      const $ = cheerio.load(html);
      let cnt = 0, secondLatest = "";
      $("th").each((i, el) => {
        if ($(el).text().trim() === "最新状況") {
          cnt++;
          if (cnt === 2) {
            secondLatest = $(el).parent().find("td").first().text().trim();
            return false;
          }
        }
      });
      let firstDelivery = "";
      $("table.statusTable tr").each((i, tr) => {
        if ($(tr).find("th").first().text().trim() === "配完") {
          firstDelivery = $(tr).find("td").first().text().trim();
          return false;
        }
      });
      const status = secondLatest || firstDelivery || "情報取得できませんでした";
      return { status, time: firstDelivery };
    }
  }
};
