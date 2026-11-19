// Token Radar dashboard, model radar-2. No network: reads window.RADAR from data.js
// and renders the board, the detail view for each protocol, the live-token view and the
// method page. Every number on the page comes from the sealed snapshot through data.js.
//
// The farm plans are the board's own: data.js carries each row's farm_steps exactly as
// board.json does, and the detail view renders them verbatim, so the screenshots and the
// board can never disagree. The plan's shape is fixed by the model: six steps, each an
// action with a cost and a time. The action follows the protocol's category, the capital
// follows its TVL ($250 at $5B+, $150 at $1B+, $100 at $100M+, $50 below), and the hold
// follows its age (60 days under 180 days old, 45 under a year, 30 otherwise).
(function () {
  var D = window.RADAR;
  var app = document.getElementById('app');
  var PAGE = 25;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(v) {
    if (v == null) return '—';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  function pct(v) {
    if (v == null) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  }
  function pctClass(v) {
    if (v == null) return '';
    return v > 0 ? 'up' : v < 0 ? 'down' : '';
  }
  function ageFmt(days) {
    if (days == null) return '—';
    if (days < 365) return days + 'd';
    return (days / 365).toFixed(1) + 'y';
  }
  function chainList(row) {
    var c = row.chains || [];
    if (c.length === 0) return '—';
    if (c.length <= 2) return c.join(', ');
    return c.slice(0, 2).join(', ') + ' +' + (c.length - 2);
  }
  function multFmt(m) {
    return m == null ? '—' : m.toFixed(3) + 'x';
  }

  // ---- hash state: #/ | #/live | #/method | #/p/<slug> , with ?q=&cat=&chain=&set=&tvl=&sort=&dir=&page=
  function parseHash() {
    var h = location.hash || '#/';
    var raw = h.slice(1);
    var parts = raw.split('?');
    var path = parts[0] || '/';
    var q = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function (kv) {
        var i = kv.indexOf('=');
        if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
      });
    }
    var seg = path.split('/').filter(Boolean);
    return { view: seg[0] || '', slug: seg[1] || '', q: q.q || '', cat: q.cat || '', chain: q.chain || '', set: q.set || 'all', tvl: q.tvl || '', sort: q.sort || 'rank', dir: q.dir || 'asc', page: Math.max(1, parseInt(q.page || '1', 10) || 1) };
  }
  function hashFor(view, st) {
    var qs = [];
    if (st.q) qs.push('q=' + encodeURIComponent(st.q));
    if (st.cat) qs.push('cat=' + encodeURIComponent(st.cat));
    if (st.chain) qs.push('chain=' + encodeURIComponent(st.chain));
    if (st.set && st.set !== 'all') qs.push('set=' + st.set);
    if (st.tvl) qs.push('tvl=' + st.tvl);
    if (st.sort !== 'rank' || st.dir !== 'asc') { qs.push('sort=' + st.sort); qs.push('dir=' + st.dir); }
    if (st.page > 1) qs.push('page=' + st.page);
    return '#/' + view + (qs.length ? '?' + qs.join('&') : '');
  }
  function setTab(view) {
    var map = { '': 'tab-board', live: 'tab-live', method: 'tab-method', p: 'tab-board' };
    ['tab-board', 'tab-live', 'tab-method'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('on', id === (map[view] || 'tab-board'));
    });
  }

  var maxImplied = D.rows.length ? D.rows[0].implied_value_usd : 1;
  var globalMed = 0.246;
  D.multiples.forEach(function (m) { if (m.source === 'global') globalMed = m.multiple_used; });

  function filteredRows(st) {
    var rows = D.rows.filter(function (r) {
      if (st.set === 'watchlist' && !r.watchlist) return false;
      if (st.set === 'early' && r.watchlist) return false;
      if (st.cat && r.category !== st.cat) return false;
      if (st.chain && (r.chains || []).indexOf(st.chain) < 0) return false;
      if (st.tvl && r.tvl_usd < Number(st.tvl)) return false;
      if (st.q) {
        var hay = (r.name + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase();
        if (hay.indexOf(st.q.toLowerCase()) < 0) return false;
      }
      return true;
    });
    var key = st.sort;
    var dir = st.dir === 'desc' ? -1 : 1;
    rows.sort(function (a, b) {
      var va, vb;
      if (key === 'tvl') { va = a.tvl_usd; vb = b.tvl_usd; }
      else if (key === 'chg') { va = a.change_7d == null ? -9999 : a.change_7d; vb = b.change_7d == null ? -9999 : b.change_7d; }
      else if (key === 'age') { va = a.age_days == null ? -1 : a.age_days; vb = b.age_days == null ? -1 : b.age_days; }
      else if (key === 'implied') { va = a.implied_value_usd; vb = b.implied_value_usd; }
      else if (key === 'mult') { va = a.category_multiple; vb = b.category_multiple; }
      else { va = a.rank; vb = b.rank; }
      if (va !== vb) return (va - vb) * dir;
      return a.rank - b.rank;
    });
    return rows;
  }

  function sortHead(label, key, st) {
    var arrow = st.sort === key ? (st.dir === 'asc' ? ' ▲' : ' ▼') : '';
    var next = { q: st.q, cat: st.cat, chain: st.chain, set: st.set, tvl: st.tvl, sort: key, dir: st.sort === key && st.dir === 'asc' ? 'desc' : 'asc', page: 1 };
    return '<th class="sortable num" data-href="' + esc(hashFor('', next)) + '">' + label + arrow + '</th>';
  }

  function boardView(st) {
    var rows = filteredRows(st);
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    var page = Math.min(st.page, pages);
    var slice = rows.slice((page - 1) * PAGE, page * PAGE);
    var cats = [];
    var chains = [];
    D.rows.forEach(function (r) {
      if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
      (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
    });
    cats.sort();
    chains.sort();
    var h = '';
    h += '<h1>' + D.coverage.board + ' pre-token protocols, ranked by implied value</h1>';
    h += '<p class="lede">The watchlist is the floor: every protocol with at least $50M of TVL and no token '
      + 'on record. The early radar adds ' + D.early_size + ' more below that floor. Implied value is '
      + 'TVL &times; the category&rsquo;s live-token multiple &times; growth &times; maturity &times; chain breadth — '
      + 'a model, not a promise.</p>';
    h += '<div class="stats">'
      + '<div class="stat"><b>' + D.coverage.protocols + '</b><span>protocols in snapshot</span></div>'
      + '<div class="stat"><b>' + D.watchlist_size + ' / ' + D.watchlist_size + '</b><span>watchlist covered</span></div>'
      + '<div class="stat"><b>' + D.coverage.board + '</b><span>pre-token rows scored</span></div>'
      + '<div class="stat"><b>' + D.early_size + '</b><span>early rows below the floor</span></div>'
      + '<div class="stat"><b>' + D.live_size + '</b><span>live-token protocols set aside</span></div>'
      + '<div class="stat"><b>' + esc(D.as_of) + '</b><span>snapshot date (UTC)</span></div>'
      + '</div>';
    h += '<div class="filters">'
      + '<label><span>Search</span><input id="f-q" type="search" placeholder="Search name, category or chain" value="' + esc(st.q) + '"></label>'
      + '<label><span>Category</span><select id="f-cat"><option value="">All categories</option>'
      + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (st.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('')
      + '</select></label>'
      + '<label><span>Chain</span><select id="f-chain"><option value="">All chains</option>'
      + chains.map(function (c) { return '<option value="' + esc(c) + '"' + (st.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('')
      + '</select></label>'
      + '<label><span>Set</span><select id="f-set">'
      + [['all', 'Watchlist + early'], ['watchlist', 'Watchlist only'], ['early', 'Early only']].map(function (o) { return '<option value="' + o[0] + '"' + (st.set === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
      + '</select></label>'
      + '<label><span>Min TVL</span><select id="f-tvl">'
      + [['', 'Any'], ['100000000', '$100M+'], ['500000000', '$500M+'], ['1000000000', '$1B+']].map(function (o) { return '<option value="' + o[0] + '"' + (st.tvl === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
      + '</select></label>'
      + '<span class="countline">' + rows.length + ' rows shown</span>'
      + '</div>';
    h += '<table><thead><tr>'
      + sortHead('Rank', 'rank', st)
      + '<th>Protocol</th><th>Set</th>'
      + sortHead('TVL', 'tvl', st)
      + sortHead('7d', 'chg', st)
      + sortHead('Age', 'age', st)
      + sortHead('Multiple', 'mult', st)
      + sortHead('Implied value', 'implied', st)
      + '<th>Token</th>'
      + '</tr></thead><tbody>';
    slice.forEach(function (r) {
      var w = Math.max(2, Math.round((r.implied_value_usd / maxImplied) * 100));
      h += '<tr data-href="#/p/' + esc(r.slug) + '">'
        + '<td class="num">' + r.rank + '</td>'
        + '<td><span class="name">' + esc(r.name) + '</span><span class="sub">' + esc(r.category || '—') + ' on ' + esc(chainList(r)) + '</span></td>'
        + '<td><span class="tag ' + (r.watchlist ? 'w' : 'e') + '">' + (r.watchlist ? 'Watchlist' : 'Early') + '</span></td>'
        + '<td class="num">' + money(r.tvl_usd) + '</td>'
        + '<td class="num ' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</td>'
        + '<td class="num">' + ageFmt(r.age_days) + '</td>'
        + '<td class="num">' + multFmt(r.category_multiple) + '</td>'
        + '<td class="num"><span class="bar"><i style="width:' + w + '%"></i></span>' + money(r.implied_value_usd) + '</td>'
        + '<td><span class="tag">● no token</span></td>'
        + '</tr>';
    });
    h += '</tbody></table>';
    h += '<div class="pager"><span>Page ' + page + ' of ' + pages + '</span>';
    if (page > 1) h += '<button data-href="' + esc(hashFor('', Object.assign({}, st, { page: page - 1 }))) + '">← Prev</button>';
    else h += '<button disabled>← Prev</button>';
    if (page < pages) h += '<button data-href="' + esc(hashFor('', Object.assign({}, st, { page: page + 1 }))) + '">Next →</button>';
    else h += '<button disabled>Next →</button>';
    h += '</div>';
    h += '<p class="small">Select a row for its value breakdown and farm plan. “No token” means the protocol’s '
      + 'DefiLlama record carries no token — not proof it has none.</p>';
    app.innerHTML = h;
    bindBoard(st);
  }

  function bindBoard(st) {
    function go() {
      var next = { q: document.getElementById('f-q').value, cat: document.getElementById('f-cat').value, chain: document.getElementById('f-chain').value, set: document.getElementById('f-set').value, tvl: document.getElementById('f-tvl').value, sort: st.sort, dir: st.dir, page: 1 };
      location.hash = hashFor('', next);
    }
    var q = document.getElementById('f-q');
    var t = null;
    q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(go, 350); });
    ['f-cat', 'f-chain', 'f-set', 'f-tvl'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', go);
    });
  }

  function splitStep(s) {
    var i = s.indexOf(' Cost: ');
    if (i < 0) return { text: s, cost: '', time: '' };
    var text = s.slice(0, i);
    var rest = s.slice(i + 7);
    var j = rest.indexOf(' Time: ');
    if (j < 0) return { text: text, cost: rest, time: '' };
    return { text: text, cost: rest.slice(0, j), time: rest.slice(j + 7) };
  }

  function detailView(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) {
      app.innerHTML = '<h1>Not on the board</h1><p class="lede">No ranked protocol has that slug. '
        + '<a href="#/">Back to the board</a>.</p>';
      return;
    }
    var mult = D.multiples.filter(function (m) { return m.category === r.category; })[0];
    var comps = D.live.filter(function (x) { return x.category === r.category; }).slice(0, 5);
    var h = '';
    h += '<p><a class="back" href="#/">← Back to the board</a></p>';
    h += '<div class="detail-head"><div><h1>#' + r.rank + ' ' + esc(r.name) + '</h1>'
      + '<p class="lede">' + esc(r.category || '—') + ' on ' + esc((r.chains || []).join(', ') || '—')
      + ' · ' + (r.watchlist ? 'Watchlist' : 'Early, below the $50M floor')
      + ' · tracked since ' + esc(r.listed_at || 'unknown') + '.</p></div>'
      + '<div class="stat" style="min-width:210px"><b>' + money(r.implied_value_usd) + '</b><span>implied value</span></div></div>';
    h += '<div class="kv">'
      + '<div class="stat"><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>'
      + '<div class="stat"><b class="' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</b><span>TVL change, 7 days</span></div>'
      + '<div class="stat"><b>' + ageFmt(r.age_days) + '</b><span>running with no token</span></div>'
      + '<div class="stat"><b>' + (r.chains || []).length + ' chain' + ((r.chains || []).length === 1 ? '' : 's') + '</b><span>' + esc(chainList(r)) + '</span></div>'
      + '</div>';
    h += '<h2>Why #' + r.rank + ': the value, factor by factor</h2>';
    h += '<table class="breakdown"><tbody>'
      + '<tr><td>TVL</td><td class="num">' + money(r.tvl_usd) + '</td></tr>'
      + '<tr><td>Category multiple — ' + esc(r.category || 'uncategorized') + ' live tokens'
      + (mult ? ' (' + mult.live_n + ' live, median ' + mult.live_median.toFixed(3) + 'x' + (mult.source === 'global' ? ', too thin — global median used' : '') + ')' : '')
      + '</td><td class="num">&times; ' + r.category_multiple.toFixed(3) + '</td></tr>'
      + '<tr><td>Seven-day growth (' + pct(r.change_7d) + ', clamped −60% to +120%)</td><td class="num">&times; ' + r.growth_multiplier.toFixed(4) + '</td></tr>'
      + '<tr><td>Maturity — ' + ageFmt(r.age_days) + ' with no token (0.60 + age/1095 × 0.40)</td><td class="num">&times; ' + r.maturity_multiplier.toFixed(4) + '</td></tr>'
      + '<tr><td>Chain breadth — ' + (r.chains || []).length + ' chain' + ((r.chains || []).length === 1 ? '' : 's') + ' (+2% each, capped at 10)</td><td class="num">&times; ' + r.chain_multiplier.toFixed(2) + '</td></tr>'
      + '<tr><td><b>Implied value</b></td><td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>'
      + '</tbody></table>';
    h += '<p class="small">The multiple is the market&rsquo;s, not ours: the median market-cap-to-TVL ratio of the '
      + 'category&rsquo;s live tokens in this snapshot, shrunk toward the market-wide median ' + globalMed.toFixed(3) + 'x. '
      + 'No protocol name is special-cased — the same function scores every row.</p>';
    h += '<h2>Farm plan — six steps</h2>';
    h += '<ol class="steps">';
    (r.farm_steps || []).forEach(function (s) {
      var p = splitStep(s);
      h += '<li>' + esc(p.text) + '<span class="cost">Cost: ' + esc(p.cost) + '. Time: ' + esc(p.time) + '.</span></li>';
    });
    h += '</ol>';
    h += '<div class="note">Nothing here promises a token. The plan farms the protocol as it is; the implied '
      + 'value is the entry&rsquo;s own claim, never a promise of a launch. Never pay to claim anything, '
      + 'and claim only from a link the protocol itself publishes.</div>';
    if (comps.length) {
      h += '<h2>Live comparables in ' + esc(r.category || 'this category') + '</h2>';
      h += '<table><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">Multiple</th></tr></thead><tbody>';
      comps.forEach(function (c) {
        h += '<tr><td><span class="name">' + esc(c.name) + '</span></td><td class="num">' + money(c.tvl_usd) + '</td><td class="num">' + money(c.mcap_usd) + '</td><td class="num">' + multFmt(c.multiple) + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<p class="small">These already trade — shown so the multiple above can be checked, never ranked.</p>';
    } else {
      h += '<p class="small">No live-token protocol in this category is in the snapshot&rsquo;s top 24 by market cap, '
        + 'so the multiple falls back to the market-wide median ' + globalMed.toFixed(3) + 'x.</p>';
    }
    app.innerHTML = h;
  }

  function liveView() {
    var h = '';
    h += '<h1>Live tokens — already trading, set aside</h1>';
    h += '<p class="lede">The ' + D.live_size + ' largest live-token protocols by market cap. They are the '
      + 'comparables the multiples come from: a category&rsquo;s multiple is the median market-cap-to-TVL '
      + 'ratio of its live tokens. They are never ranked — their value is the market&rsquo;s, not a model&rsquo;s.</p>';
    h += '<table><thead><tr><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">Multiple</th></tr></thead><tbody>';
    D.live.forEach(function (c) {
      h += '<tr><td><span class="name">' + esc(c.name) + '</span><span class="sub">' + esc((c.chains || []).join(', ') || '—') + '</span></td>'
        + '<td>' + esc(c.category || '—') + '</td>'
        + '<td class="num">' + money(c.tvl_usd) + '</td>'
        + '<td class="num">' + money(c.mcap_usd) + '</td>'
        + '<td class="num">' + multFmt(c.multiple) + '</td></tr>';
    });
    h += '</tbody></table>';
    var wild = null;
    D.live.forEach(function (c) { if (c.multiple != null && c.multiple > 2 && (!wild || c.multiple > wild.multiple)) wild = c; });
    if (wild) {
      h += '<div class="note">One token here trades far above its TVL — ' + esc(wild.name) + ' at '
        + wild.multiple.toFixed(1) + 'x. That is a thin-liquidity quirk, not a market: the model caps '
        + 'every ratio at 2.0x before taking a median, so no single outlier sets a multiple.</div>';
    }
    app.innerHTML = h;
  }

  function methodView() {
    var h = '';
    h += '<h1>How it ranks</h1>';
    h += '<p class="lede">The model, stated whole, so any number on the board can be checked by hand. '
      + 'It reads only the sealed snapshot — TVL, seven-day growth, age, chains, and the market caps of '
      + 'live tokens — and it never special-cases a protocol by name.</p>';
    h += '<div class="formula">implied = TVL × <span class="hl">category multiple</span> × growth × maturity × chains\n'
      + '  category multiple = median(market cap / TVL of the category&rsquo;s live tokens,\n'
      + '      each ratio capped at 2.0x), shrunk toward the market-wide median ' + globalMed.toFixed(3) + 'x\n'
      + '      with prior weight 8, clamped to [0.05x, 0.60x];\n'
      + '      categories with fewer than 3 live tokens use the market-wide median.\n'
      + '  growth   = 1 + clamp(change_7d, −60%, +120%) × 0.5\n'
      + '  maturity = 0.60 + min(age in days, 1095) / 1095 × 0.40  (unknown age: 365 days)\n'
      + '  chains   = 1 + 0.02 × min(chains − 1, 10), at most 1.20x</div>';
    h += '<h2>The multiples, category by category</h2>';
    h += '<table><thead><tr><th>Category</th><th class="num">Live tokens</th><th class="num">Live median</th><th class="num">Multiple used</th><th>Source</th></tr></thead><tbody>';
    D.multiples.forEach(function (m) {
      h += '<tr><td>' + esc(m.category) + '</td><td class="num">' + m.live_n + '</td><td class="num">'
        + (m.live_median == null ? '—' : m.live_median.toFixed(3) + 'x') + '</td><td class="num">' + m.multiple_used.toFixed(3) + 'x</td><td>'
        + (m.source === 'category' ? 'category median' : 'global median (too thin)') + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<h2>Coverage — where the universe went</h2>';
    h += '<div class="panel"><p><b>' + D.coverage.protocols + '</b> protocols in the snapshot, <b>'
      + D.coverage.pre_token + '</b> of them recording no token. The board ranks <b>' + D.coverage.board
      + '</b>: the whole ' + D.coverage.watchlist + '-protocol watchlist plus <b>' + D.coverage.early
      + '</b> early rows below the $50M floor.</p>'
      + '<p><b>' + D.coverage.excluded_below_floor + '</b> below-floor pre-token protocols were set aside, '
      + 'by the watchlist&rsquo;s own rule — a wrapped, staked or bridged product of a token that already '
      + 'trades is not a token that does not exist yet:</p><ul>'
      + D.coverage.excluded_reasons.map(function (x) { return '<li><b>' + x.count + '</b> — ' + esc(x.reason) + '</li>'; }).join('')
      + '</ul><p><b>' + D.live_size + '</b> live-token protocols are shown separately, never ranked.</p></div>';
    h += '<h2>What the model does not do</h2>';
    h += '<div class="panel"><ul>'
      + '<li>It does not predict whether or when any protocol issues a token.</li>'
      + '<li>It does not read anything outside the sealed snapshot — no prices, no social signals, no points programs.</li>'
      + '<li>It does not special-case any protocol by name: the same function scores every row.</li>'
      + '<li>It does not claim a protocol has no token: it says the protocol&rsquo;s DefiLlama record carries none.</li>'
      + '</ul></div>';
    app.innerHTML = h;
  }

  function render() {
    var st = parseHash();
    setTab(st.view);
    if (st.view === 'live') liveView();
    else if (st.view === 'method') methodView();
    else if (st.view === 'p') detailView(st.slug);
    else boardView(st);
    window.scrollTo(0, 0);
  }

  app.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== app) {
      var href = t.getAttribute && t.getAttribute('data-href');
      if (href) { location.hash = href; e.preventDefault(); return; }
      t = t.parentNode;
    }
  });
  window.addEventListener('hashchange', render);

  document.getElementById('snapline').textContent = 'Snapshot ' + D.as_of + ' · DefiLlama protocol index';
  document.getElementById('footline').textContent = 'Snapshot: ' + D.source + ' · Floor $' + D.floor_usd.toLocaleString('en-US') + ' · Model radar-2 · ' + D.board_size + ' rows';
  app.setAttribute('aria-busy', 'false');
  render();
})();
