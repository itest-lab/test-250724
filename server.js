// server.js

import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

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

      console.log("[sagawa] status =", status);
      console.log("[sagawa] time   =", time);
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
      number00: "1",      // 詳細あり
      number01: tracking
    }).toString()
  }),
  extract: html => {
    const $ = cheerio.load(html);

    // ■ ステータス取得
    const status = $('h4.tracking-invoice-block-state-title')
      .first().text().trim();

    // ■ 詳細ブロックから「配達完了」の日時を取得
    let time = "";
    $('div.tracking-invoice-block-detail ol li').each((i, li) => {
      const itemText = $(li).find('div.item').text().trim();
      if (itemText.includes('配達完了')) {
        time = $(li).find('div.date').text().trim();
        return false; // ループを抜ける
      }
    });

    // ■ フォールバック：summary からの抽出（なければ不要）
    if (!time) {
      const summaryText = $('div.tracking-invoice-block-summary').first().text().trim();
      const m = summaryText.match(/([0-9]{1,2}月[0-9]{1,2}日\s*[0-9]{1,2}[:：][0-9]{2})/);
      if (m) time = m[0];
    }

    console.log("[yamato] status =", status);
    console.log("[yamato] time   =", time);

    // ■ 最終ステータス文字列を組み立て
    const finalStatus = time
      ? `${status}：配達日時 ${time}`
      : status;

    return { status: finalStatus, time };
  }
},

  // 福山通運
  fukutsu: {
    url: t => `https://corp.fukutsu.co.jp/situation/tracking_no_hunt/${t}`,
    extract: html => {
      const $ = cheerio.load(html);
      let status = $("strong.redbold").first().text().trim();
      let time = "";

      if (status === "配達完了です") {
        status = "配達完了";
        time = $("strong").eq(4).text().trim();
      } else if (status === "該当データはありません。") {
        status = "伝票番号未登録";
      }

      console.log("[fukutsu] status =", status);
      console.log("[fukutsu] time   =", time);
      return { status, time };
    }
  },

  // 西濃運輸
  seino: {
    url: t => `https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=${t}`,
    extract: html => {
      const $ = cheerio.load(html);
      let status = $('input#haitatsuJokyo0').attr("value")?.trim() || "";
      let time = "";

      if (/配達済み/.test(status)) {
        status = "配達完了";
        time = $('input#haitatsuTenshoDate0').attr("value")?.trim() || "";
      } else if (/未登録|誤り/.test(status)) {
        status = "伝票番号未登録";
      }

      console.log("[seino] status =", status);
      console.log("[seino] time   =", time);
      return { status, time };
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
        const th = $(tr).find("th").first();
        if (th.text().trim() === "配完") {
          firstDelivery = $(tr).find("td").first().text().trim();
          return false;
        }
      });

      const status = secondLatest || firstDelivery || "情報取得できませんでした";
      const time   = firstDelivery;

      console.log("[tonami] status =", status);
      console.log("[tonami] time   =", time);
      return { status, time };
    }
  }
};

app.post("/fetchStatus", async (req, res) => {
  const { carrier, tracking } = req.body;
  if (!carrier || !tracking) {
    return res.status(400).json({ status: "carrier/tracking 必須", time: "" });
  }
  const cfg = carrierConfigs[carrier];
  if (!cfg) {
    return res.status(400).json({ status: `未対応: ${carrier}`, time: "" });
  }

  try {
    const response = cfg.options
      ? await axios(cfg.options(tracking))
      : await axios.get(cfg.url(tracking));
    const { status, time } = cfg.extract(response.data);
    res.json({ status, time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "スクレイピング失敗", time: "" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
