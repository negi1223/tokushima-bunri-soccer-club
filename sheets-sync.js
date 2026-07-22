/* =========================================================================
   Googleスプレッドシート連携（ニュース・試合結果）
   =========================================================================
   ここは「data.js を直接書き換えなくても、Googleフォームに入力するだけで
   ニュースや試合結果がサイトに反映される」ための仕組みです。

   ★このファイルは基本的に編集不要です。
   　設定するのは data.js の sheetsSyncConfig（URLを貼るだけ）です。

   ★安全設計：
   　- sheetsSyncConfig にURLが入っていない／通信に失敗した場合は、
   　  自動的に data.js の newsData / scheduleData（今まで通りの手書きデータ）
   　  が使われます。サイトが真っ白になることはありません。
   　- 通信は最大5秒でタイムアウトします。
   ========================================================================= */

(function () {
  const FETCH_TIMEOUT_MS = 5000;
  // 通信自体の安全上限（万一シートに大量の行があっても処理が重くならないための保険）。
  // 実際に表示する件数は sheetsSyncConfig.newsMaxItems / currentSeason で決まります。
  const SAFETY_MAX_ROWS = 100;

  // Googleフォームが自動生成する列名（質問文）。
  // フォームの質問文を変えた場合は、ここも同じ文言に合わせてください。
  const NEWS_COLUMNS = {
    tag: "種類",       // "試合" / "お知らせ" / "募集"
    date: "日付",
    title: "タイトル",
    text: "本文",
    link: "リンクURL"
  };
  const NEWS_TAG_MAP = { "試合": "match", "お知らせ": "info", "募集": "recruit" };

  const SCHEDULE_COLUMNS = {
    date: "日付",
    season: "年度",         // 例: "2026"。currentSeasonと一致する行だけが表示される
    competition: "大会名",
    opponent: "対戦相手",
    resultType: "結果",     // "未定" / "リンクで確認" / "スコア確定"
    resultLink: "リンクURL",
    resultScore: "スコア",   // 例: "3-1"
    resultOutcome: "勝敗"    // "勝" / "負" / "分"
  };

  // ---- タイムアウト付きfetch ----
  async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error("HTTPエラー: " + res.status);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- CSVパーサー（ダブルクォート・カンマ入りの値に対応した最小実装） ----
  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\r") {
        // 無視
      } else if (c === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // CSVの2次元配列を「列名: 値」のオブジェクト一覧に変換
  function csvToObjects(csvText) {
    const rows = parseCsv(csvText).filter((r) => r.some((v) => v !== ""));
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
      return obj;
    });
  }

  function buildNewsData(objects) {
    return objects
      .map((o) => ({
        tag: NEWS_TAG_MAP[o[NEWS_COLUMNS.tag]] || "info",
        date: o[NEWS_COLUMNS.date] || "",
        title: o[NEWS_COLUMNS.title] || "",
        text: o[NEWS_COLUMNS.text] || "",
        link: o[NEWS_COLUMNS.link] || ""
      }))
      .filter((n) => n.title)
      .slice(-SAFETY_MAX_ROWS); // 念のための安全上限（新しい日付順への並び替えと件数の絞り込みは script.js 側で行う）
  }

  // 同じ「日付＋対戦相手」の行が複数あるとき、最後に入力されたものだけを残す
  // （試合結果を後から訂正・追記した場合に、古い行と新しい行が二重表示されるのを防ぐ）
  function dedupeBySameMatch(rows) {
    const map = new Map();
    rows.forEach((row) => {
      const key = `${row.date.trim()}__${row.opponent.trim()}`;
      map.set(key, row); // 同じキーに再度setすると中身は最新のもので上書きされる
    });
    return Array.from(map.values());
  }

  function buildScheduleData(objects) {
    const currentSeason = (typeof sheetsSyncConfig !== "undefined" && sheetsSyncConfig.currentSeason) || "";
    const rows = objects
      .map((o) => {
        const type = o[SCHEDULE_COLUMNS.resultType] || "";
        let result;
        if (type === "リンクで確認") {
          result = { type: "link", url: o[SCHEDULE_COLUMNS.resultLink] || "", label: "SNSで確認" };
        } else if (type === "スコア確定") {
          const outcome = o[SCHEDULE_COLUMNS.resultOutcome] || "";
          const win = outcome === "勝" ? true : outcome === "負" ? false : null;
          const badgeText = [o[SCHEDULE_COLUMNS.resultScore], outcome].filter(Boolean).join(" ");
          result = { type: "score", text: badgeText || "結果未入力", win };
        } else {
          result = { type: "pending", text: "日程確定次第更新" };
        }
        return {
          date: o[SCHEDULE_COLUMNS.date] || "",
          season: o[SCHEDULE_COLUMNS.season] || "",
          competition: o[SCHEDULE_COLUMNS.competition] || "",
          opponent: o[SCHEDULE_COLUMNS.opponent] || "",
          result
        };
      })
      .filter((s) => s.date || s.opponent);

    return dedupeBySameMatch(rows)
      // 年度が入力されていて、かつ今年度と一致しないものは表示しない
      // （年度が空欄の行は、記入漏れとみなして念のため表示する）
      .filter((s) => !currentSeason || !s.season || s.season === currentSeason)
      .slice(0, SAFETY_MAX_ROWS);
      // ※1月→12月の順への並び替えは script.js 側で日付を見て行うので、
      //   フォームにはどの順番で入力しても大丈夫です。
  }

  // ---- メイン処理：data.js の sheetsSyncConfig を見て、あれば読み込む ----
  window.loadSheetsData = async function loadSheetsData() {
    if (typeof sheetsSyncConfig === "undefined") return;

    const tasks = [];

    if (sheetsSyncConfig.newsCsvUrl) {
      tasks.push(
        fetchWithTimeout(sheetsSyncConfig.newsCsvUrl)
          .then((text) => { window.__syncedNewsData = buildNewsData(csvToObjects(text)); })
          .catch((err) => { console.warn("[news連携] 読み込みに失敗したため、data.js の内容を表示します:", err); })
      );
    }

    if (sheetsSyncConfig.scheduleCsvUrl) {
      tasks.push(
        fetchWithTimeout(sheetsSyncConfig.scheduleCsvUrl)
          .then((text) => { window.__syncedScheduleData = buildScheduleData(csvToObjects(text)); })
          .catch((err) => { console.warn("[試合結果連携] 読み込みに失敗したため、data.js の内容を表示します:", err); })
      );
    }

    // どちらかが失敗しても、成功した方だけは反映されるようにする
    await Promise.allSettled(tasks);
  };
})();
