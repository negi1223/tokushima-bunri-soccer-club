document.addEventListener('DOMContentLoaded', () => {

  const escapeHtml = (str = '') =>
    String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  /* =========================================================
     モバイルナビゲーションの開閉
  ========================================================= */
  const navToggle = document.getElementById('navToggle');
  const primaryNav = document.getElementById('primaryNav');

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = primaryNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    });

    primaryNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        primaryNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'メニューを開く');
      });
    });
  }

  /* =========================================================
     0. サイト全体の設定（siteData）を反映
     ヘッダー／フッター／各所のSNSリンク・連絡先はここでまとめて反映されます
  ========================================================= */
  if (typeof siteData !== 'undefined') {
    document.querySelectorAll('.js-club-name-jp').forEach((el) => { el.textContent = siteData.clubNameJp; });
    document.querySelectorAll('.js-club-name-en').forEach((el) => { el.textContent = siteData.clubNameEn; });
    document.querySelectorAll('.js-logo-initial').forEach((el) => {
      if (siteData.logoImage) {
        el.innerHTML = `<img src="${escapeHtml(siteData.logoImage)}" alt="${escapeHtml(siteData.clubNameJp)}" class="logo-mark-img">`;
      } else {
        el.textContent = siteData.logoInitial;
      }
    });

    // Instagramへのリンク（ボタンやテキストリンクなど、サイト内の複数箇所に反映）
    document.querySelectorAll('.js-instagram-link').forEach((el) => { el.href = siteData.instagramUrl; });
    document.querySelectorAll('.js-instagram-handle').forEach((el) => { el.textContent = siteData.instagramHandle; });
    document.querySelectorAll('.js-x-link').forEach((el) => { el.href = siteData.xUrl; });

    // 企業様・スポンサー様向けメールアドレス
    document.querySelectorAll('.js-sponsor-email').forEach((el) => {
      el.href = `mailto:${siteData.sponsorEmail}`;
      el.textContent = siteData.sponsorEmail;
    });

    // Googleフォーム（企業様・スポンサー様向け）※埋め込みプレビューは廃止し、ボタンリンクのみ
    const gformButton = document.getElementById('gformButton');
    if (gformButton) gformButton.href = siteData.sponsorFormUrl;

    // フッター著作権表記
    const footerCopy = document.getElementById('footerCopy');
    if (footerCopy) footerCopy.textContent = `© ${siteData.copyrightYear} ${siteData.copyrightEn}`;
  }

  /* =========================================================
     1. トップビジュアル（heroData）
  ========================================================= */
  if (typeof heroData !== 'undefined') {
    const eyebrowEl = document.getElementById('heroEyebrow');
    if (eyebrowEl) eyebrowEl.textContent = heroData.eyebrow;

    const headlineEl = document.getElementById('heroHeadline');
    if (headlineEl) {
      headlineEl.innerHTML = `${escapeHtml(heroData.headline)}<br><span class="hero-copy-accent">${escapeHtml(heroData.headlineAccent)}</span>${escapeHtml(heroData.headlineSuffix)}`;
    }

    const subEl = document.getElementById('heroSub');
    if (subEl) subEl.textContent = heroData.sub;

    const statsEl = document.getElementById('heroStats');
    if (statsEl && heroData.stats) {
      statsEl.innerHTML = heroData.stats.map((s) => `
        <div><dt>${escapeHtml(s.label)}</dt><dd>${escapeHtml(s.value)}<span>${escapeHtml(s.suffix || '')}</span></dd></div>
      `).join('');
    }

    const heroPhotoWrap = document.getElementById('heroPhoto');
    if (heroPhotoWrap && heroData.photo) {
      const img = document.createElement('img');
      img.src = heroData.photo;
      img.alt = heroData.photoAlt || '活動中の様子';
      img.className = 'hero-photo-img';
      img.onerror = () => img.remove(); // 画像が見つからない場合はダミー表示のまま
      heroPhotoWrap.prepend(img);
    }
  }

  /* =========================================================
     2. 部の紹介・練習日時（aboutData）
  ========================================================= */
  if (typeof aboutData !== 'undefined') {
    const sloganEl = document.getElementById('aboutSlogan');
    if (sloganEl) sloganEl.textContent = aboutData.slogan;

    const textEl = document.getElementById('aboutText');
    if (textEl) textEl.textContent = aboutData.text;

    const factsEl = document.getElementById('aboutFacts');
    if (factsEl && aboutData.facts) {
      factsEl.innerHTML = aboutData.facts.map((f) => `
        <div class="fact-card">
          <dt>${escapeHtml(f.label)}</dt>
          <dd>${escapeHtml(f.value)}${f.note ? `<br><span class="fact-note">${escapeHtml(f.note)}</span>` : ''}</dd>
        </div>
      `).join('');
    }

    const yearEl = document.getElementById('yearScheduleGrid');
    if (yearEl && aboutData.yearSchedule) {
      yearEl.innerHTML = aboutData.yearSchedule.map((y) => `
        <div class="ys-card"><span class="ys-month">${escapeHtml(y.month)}</span><span class="ys-body">${escapeHtml(y.body)}</span></div>
      `).join('');
    }
  }

  /* =========================================================
     3. ニュース
  ========================================================= */
  const newsTagLabel = { match: '試合', info: 'お知らせ', recruit: '募集' };
  const newsGrid = document.getElementById('newsGrid');
  if (newsGrid && typeof newsData !== 'undefined') {
    newsGrid.innerHTML = newsData.map((item) => `
      <article class="news-card">
        <span class="news-tag news-tag--${item.tag}">${newsTagLabel[item.tag] || 'お知らせ'}</span>
        <time class="news-date">${escapeHtml(item.date)}</time>
        <h3 class="news-title">${escapeHtml(item.title)}</h3>
        <p class="news-text">${escapeHtml(item.text)}</p>
        ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener" class="news-more">詳しく見る</a>` : ''}
      </article>
    `).join('');
  }

  /* =========================================================
     4. 試合日程・結果
  ========================================================= */
  const scheduleBody = document.getElementById('scheduleBody');
  if (scheduleBody && typeof scheduleData !== 'undefined') {
    const renderResult = (result) => {
      if (result.type === 'link') {
        return `<a class="badge badge-link" href="${escapeHtml(result.url)}" target="_blank" rel="noopener">${escapeHtml(result.label)}</a>`;
      }
      if (result.type === 'score') {
        return `<span class="badge ${result.win ? 'badge-win' : 'badge-lose'}">${escapeHtml(result.text)}</span>`;
      }
      return `<span class="badge badge-pending">${escapeHtml(result.text)}</span>`;
    };

    scheduleBody.innerHTML = scheduleData.map((row) => `
      <div class="scoreboard-row" role="row">
        <span role="cell" data-label="日付">${escapeHtml(row.date)}</span>
        <span role="cell" data-label="大会">${escapeHtml(row.competition)}</span>
        <span role="cell" data-label="対戦相手">${escapeHtml(row.opponent)}</span>
        <span role="cell" data-label="結果">${renderResult(row.result)}</span>
      </div>
    `).join('');
  }

  /* =========================================================
     5. 監督・コーチのコメント
  ========================================================= */
  const staffComments = document.getElementById('staffComments');
  if (staffComments && typeof staffData !== 'undefined') {
    staffComments.innerHTML = staffData.map((s) => `
      <blockquote class="comment-card">
        ${s.photo ? `<img src="${escapeHtml(s.photo)}" alt="${escapeHtml(s.name)}" class="comment-avatar" loading="lazy">` : ''}
        <p class="comment-role">${escapeHtml(s.role)}</p>
        <p class="comment-name">${escapeHtml(s.name)}</p>
        <p class="comment-text">${escapeHtml(s.comment)}</p>
      </blockquote>
    `).join('');
  }

  /* =========================================================
     6. 選手・スタッフ
  ========================================================= */
  const playerGrid = document.getElementById('playerGrid');
  const filterEmpty = document.getElementById('filterEmpty');
  if (playerGrid && typeof playersData !== 'undefined') {
    playerGrid.innerHTML = playersData.map((p) => `
      <article class="player-card${p.isStaff ? ' player-card--staff' : ''}" data-grade="${escapeHtml(p.grade)}">
        <div class="player-photo">
          ${p.photo
            ? `<img src="${escapeHtml(p.photo)}" alt="${escapeHtml(p.name)}" class="player-photo-img" loading="lazy">`
            : `<span class="player-initial">${escapeHtml(p.initial)}</span>`}
        </div>
        <h3 class="player-name">${escapeHtml(p.name)}</h3>
        <p class="player-meta">${escapeHtml(p.role)}</p>
        ${p.sub ? `<p class="player-quote">${escapeHtml(p.sub)}</p>` : ''}
      </article>
    `).join('');
  }

  /* =========================================================
     7. よくある質問（アコーディオン本体もここで組み立てます）
  ========================================================= */
  const faqAccordion = document.getElementById('faqAccordion');
  if (faqAccordion && typeof faqData !== 'undefined') {
    const tokens = {
      '{instagramUrl}': (typeof siteData !== 'undefined' && siteData.instagramUrl) || '',
      '{instagramHandle}': (typeof siteData !== 'undefined' && siteData.instagramHandle) || '',
      '{adviserName}': (typeof siteData !== 'undefined' && siteData.adviserName) || ''
    };
    const applyTokens = (str) => Object.keys(tokens).reduce((acc, key) => acc.split(key).join(tokens[key]), str);

    faqAccordion.innerHTML = faqData.map((item, i) => {
      const n = i + 1;
      const answer = item.aHtml ? applyTokens(item.aHtml) : escapeHtml(item.a || '');
      return `
        <div class="accordion-item">
          <h3>
            <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-a${n}" id="faq-q${n}">
              <span class="q-mark">Q</span>${escapeHtml(item.q)}
            </button>
          </h3>
          <div class="accordion-panel" id="faq-a${n}" role="region" aria-labelledby="faq-q${n}" hidden>
            <p>${answer}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // アコーディオンの開閉（FAQが動的に生成されるため、イベント委譲で処理）
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.accordion-trigger');
    if (!trigger) return;
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!isExpanded));
    if (panel) panel.hidden = isExpanded;
  });

  /* =========================================================
     8. スポンサー
  ========================================================= */
  const sponsorGrid = document.getElementById('sponsorGrid');
  if (sponsorGrid && typeof sponsorsData !== 'undefined') {
    sponsorGrid.innerHTML = sponsorsData.map((s) => `
      <li class="sponsor-card">
        <a class="sponsor-logo" href="${escapeHtml(s.url)}" target="_blank" rel="noopener sponsored">
          ${s.imageUrl
            ? `<img src="${escapeHtml(s.imageUrl)}" alt="${escapeHtml(s.name)}" loading="lazy">`
            : `<span>${escapeHtml(s.shortName || s.name)}</span>`}
        </a>
        <div class="sponsor-info">
          <p class="sponsor-name">${escapeHtml(s.name)}</p>
          ${s.address ? `<p class="sponsor-address">${escapeHtml(s.address)}</p>` : ''}
          ${s.description ? `<p class="sponsor-desc">${escapeHtml(s.description)}</p>` : ''}
        </div>
      </li>
    `).join('');
  }

  /* =========================================================
     9. 企業様向けご支援案内
  ========================================================= */
  const supportGrid = document.getElementById('supportGrid');
  if (supportGrid && typeof supportData !== 'undefined') {
    supportGrid.innerHTML = supportData.map((s) => `
      <article class="support-card">
        ${s.image ? `<img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.title)}" class="support-image" loading="lazy">` : ''}
        <h4 class="support-title">${escapeHtml(s.title)}</h4>
        <p class="support-lead">${escapeHtml(s.lead)}</p>
        <ul class="support-list">
          ${s.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </article>
    `).join('');
  }

  /* =========================================================
     選手・指導者紹介：フィルター機能
     （data.js のレンダリングより後に実行する必要があるためここに配置）
  ========================================================= */
  const filterButtons = document.querySelectorAll('.filter-btn');

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const target = btn.dataset.filter;
      let visibleCount = 0;
      const cards = document.querySelectorAll('.player-card');

      cards.forEach((card) => {
        const matches = target === 'all' || card.dataset.grade === target;
        card.classList.toggle('is-hidden', !matches);
        if (matches) visibleCount += 1;
      });

      if (filterEmpty) filterEmpty.hidden = visibleCount !== 0;
    });
  });

});
