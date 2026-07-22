/* =========================================================================
   更新一覧ページ（news.html）専用のスクリプト
   ・ホームと同じ .news-card デザインを流用して、全件・新しい日付順に表示する
   ・ホームの「詳しく見る」はInstagramへのリンクだったが、
     このページでは「詳しく見る」がアコーディオンの開閉ボタンになる
   ・detail（詳しい内容）があればそれを、無ければ text（短い説明文）を表示する
   ・試合／お知らせ／募集で絞り込むフィルターボタンつき
   ========================================================================= */
document.addEventListener('DOMContentLoaded', async () => {
  // ホーム（script.js）と同じく、Googleスプレッドシート連携があれば読み込む
  if (typeof window.loadSheetsData === 'function') {
    await window.loadSheetsData();
  }

  const escapeHtml = (str = '') =>
    String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  // "2026.06.01" 等の日付文字列を並び替え用の数値に変換（script.jsと同じロジック）
  const parseDateValue = (str) => {
    const m = String(str || '').match(/(\d{4})[.\/\-](\d{1,2})[.\/\-](\d{1,2})/);
    if (!m) return null;
    const [, y, mo, d] = m;
    return Number(y) * 10000 + Number(mo) * 100 + Number(d);
  };

  const list = document.getElementById('archiveList');
  const empty = document.getElementById('archiveEmpty');
  if (!list) return;

  // フォームを設定しているのに読み込みに失敗し、サンプルデータで代用している場合だけ、
  // 控えめな注意書きを表示する（フォーム未設定の場合は表示しない）
  const newsSyncWarning = document.getElementById('newsSyncWarning');
  const cfg = (typeof sheetsSyncConfig !== 'undefined') ? sheetsSyncConfig : {};
  if (newsSyncWarning) newsSyncWarning.hidden = !(window.__newsSyncFailed && cfg.newsCsvUrl);

  const newsTagLabel = { match: '試合', info: 'お知らせ', recruit: '募集' };

  const rawNewsData = window.__syncedNewsData || (typeof newsData !== 'undefined' ? newsData : []);
  // ホームと違い、件数は絞り込まない。新しい日付順にすべて並べる
  const allNews = [...rawNewsData].sort(
    (a, b) => (parseDateValue(b.date) ?? -Infinity) - (parseDateValue(a.date) ?? -Infinity)
  );

  if (allNews.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }

  // --- カードを描画（ホームの .news-card と同じ構造＋開閉ボタン＋詳細パネル） ---
  list.innerHTML = allNews.map((item, i) => {
    const detailId = `news-detail-${i}`;
    const toggleId = `news-toggle-${i}`;
    // 「詳しい内容」が未入力の場合は、ホームと同じ短い説明文をそのまま表示する
    const detail = item.detail || item.text || '';
    return `
      <article class="news-card" data-tag="${escapeHtml(item.tag)}">
        <span class="news-tag news-tag--${escapeHtml(item.tag)}">${escapeHtml(newsTagLabel[item.tag] || 'お知らせ')}</span>
        <time class="news-date">${escapeHtml(item.date)}</time>
        <h3 class="news-title">${escapeHtml(item.title)}</h3>
        <p class="news-text">${escapeHtml(item.text)}</p>
        <button class="news-more" type="button" aria-expanded="false" aria-controls="${detailId}" id="${toggleId}">詳しく見る</button>
        <div class="news-detail" id="${detailId}" role="region" aria-labelledby="${toggleId}" hidden>
          <p>${escapeHtml(detail)}</p>
          ${item.link ? `<p><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">投稿を見る →</a></p>` : ''}
        </div>
      </article>
    `;
  }).join('');

  // --- 開閉ボタンの動き（FAQのアコーディオンと同じ仕組み） ---
  list.querySelectorAll('.news-more').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const panel = document.getElementById(toggle.getAttribute('aria-controls'));
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isExpanded));
      if (panel) panel.hidden = isExpanded;
    });
  });

  // --- カテゴリで絞り込むフィルターボタン（Membersの学年フィルターと同じ仕組み） ---
  const filterButtons = document.querySelectorAll('.filter-btn');
  const cards = list.querySelectorAll('.news-card');

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const target = btn.dataset.filter;
      let visibleCount = 0;

      cards.forEach((card) => {
        const matches = target === 'all' || card.dataset.tag === target;
        card.classList.toggle('is-hidden', !matches);
        if (matches) visibleCount += 1;
      });

      if (empty) empty.hidden = visibleCount !== 0;
    });
  });
});
