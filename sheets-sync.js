/* =========================================================================
   Googleスプレッドシート連携（ニュース・試合結果）
   =========================================================================
   ここは「data.js を直接書き換えなくても、Googleフォームに入力するだけで
   ニュースや試合結果がサイトに反映される」ための仕組みです。

   ★このファイルは基本的に編集不要です。
   　設定するのは data.js の sheetsSyncConfig（URLを貼るだけ）です。

   ★列名は「完全一致」ではなく「キーワードを含むか」で自動的に探します。
   　Googleフォームの質問文は、たとえば
   　「日付を入力してください（例：2026.06.01）」のように、人によって
   　書き方が変わります。この仕組みでは、質問文の中に "日付" という
   　キーワードが含まれていれば自動的にその列だと判断するので、
   　質問文を多少書き換えても壊れません。

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

  // 列を探すためのキーワード（この文字を「含む」列を、その項目の列とみなす）。
  // 配列の順番 = 探す優先順位。同じキーワードが複数の列に含まれてしまう事故を防ぐため、
  // 一度どれかの項目に使われた列は、他の項目の候補からは除外される。
  // なので「リンク」「スコア」「勝敗」のような具体的なキーワードを先に、
  // 「結果」のような広い意味になりがちなキーワードは後ろに置いてある。
  const NEWS_KEYWORDS = [
    ["date", "日付"],
    ["tag", "種類"],
    ["title", "タイトル"],
    ["text", "本文"],
    ["link", "リンク"]
  ];
  const NEWS_TAG_MAP = { "試合": "match", "お知らせ": "info", "募集": "recruit" };

  const SCHEDULE_KEYWORDS = [
    ["resultLink", "リンク"],
    ["resultScore", "スコア"],
    ["resultOutcome", "勝敗"],
    ["season", "年度"],
    ["date", "日付"],
    ["competition", "大会"],
    ["opponent", "対戦相手"],
    ["resultType", "結果"]   // 広い意味になりがちなキーワードなので最後に探す
  ];

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

  // CSVの2次元配列を { headers: [...], objects: [{列名: 値}, ...] } に変換
  function csvToTable(csvText) {
    const rows = parseCsv(csvText).filter((r) => r.some((v) => v !== ""));
    if (rows.length < 2) return { headers: [], objects: [] };
    const headers = rows[0].map((h) => h.trim());
    const objects = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
      return obj;
    });
    return { headers, objects };
  }

  // headers（実際にシートに並んでいる列名）の中から、keywordEntries の
  // キーワードを含む列を探して { 項目名: 実際の列名 } の対応表を作る
  function resolveColumns(headers, keywordEntries) {
    const remaining = headers.slice();
    const resolved = {};
    keywordEntries.forEach(([key, keyword]) => {
      const idx = remaining.findIndex((h) => h.includes(keyword));
      if (idx !== -1) {
        resolved[key] = remaining[idx];
        remaining.splice(idx, 1); // 一度使った列は他の項目の候補から外す
      } else {
        resolved[key] = null; // 見つからなかった（フォームにその質問が無い等）
      }
    });
    return resolved;
  }

  const getVal = (obj, cols, key) => (cols[key] ? (obj[cols[key]] || "") : "");

  function buildNewsData(headers, objects) {
    const cols = resolveColumns(headers, NEWS_KEYWORDS);
    return objects
      .map((o) => ({
        tag: NEWS_TAG_MAP[getVal(o, cols, "tag")] || "info",
        date: getVal(o, cols, "date"),
        title: getVal(o, cols, "title"),
        text: getVal(o, cols, "text"),
        link: getVal(o, cols, "link")
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

  function buildScheduleData(headers, objects) {
    const cols = resolveColumns(headers, SCHEDULE_KEYWORDS);
    const currentSeason = (typeof sheetsSyncConfig !== "undefined" && sheetsSyncConfig.currentSeason) || "";
    const rows = objects
      .map((o) => {
        const type = getVal(o, cols, "resultType");
        let result;
        if (type.includes("リンク")) {
          result = { type: "link", url: getVal(o, cols, "resultLink"), label: "SNSで確認" };
        } else if (type.includes("スコア") || type.includes("確定")) {
          const outcome = getVal(o, cols, "resultOutcome");
          const win = outcome === "勝" ? true : outcome === "負" ? false : null;
          const badgeText = [getVal(o, cols, "resultScore"), outcome].filter(Boolean).join(" ");
          result = { type: "score", text: badgeText || "結果未入力", win };
        } else {
          result = { type: "pending", text: "日程確定次第更新" };
        }
        return {
          date: getVal(o, cols, "date"),
          season: getVal(o, cols, "season"),
          competition: getVal(o, cols, "competition"),
          opponent: getVal(o, cols, "opponent"),
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
          .then((text) => {
            const { headers, objects } = csvToTable(text);
            window.__syncedNewsData = buildNewsData(headers, objects);
          })
          .catch((err) => { console.warn("[news連携] 読み込みに失敗したため、data.js の内容を表示します:", err); })
      );
    }

    if (sheetsSyncConfig.scheduleCsvUrl) {
      tasks.push(
        fetchWithTimeout(sheetsSyncConfig.scheduleCsvUrl)
          .then((text) => {
            const { headers, objects } = csvToTable(text);
            window.__syncedScheduleData = buildScheduleData(headers, objects);
          })
          .catch((err) => { console.warn("[試合結果連携] 読み込みに失敗したため、data.js の内容を表示します:", err); })
      );
    }

    // どちらかが失敗しても、成功した方だけは反映されるようにする
    await Promise.allSettled(tasks);
  };
})();
