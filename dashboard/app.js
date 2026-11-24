// Token Radar dashboard. Reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, filters, a per-protocol detail view
// with the model's breakdown and farm plan, live-peer comparison, and a model
// sandbox that re-ranks from the same snapshot figures. No network: every
// byte shown is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var rows = DATA.rows || [];
  var live = DATA.live || [];
  var model = DATA.model || {};
  var state = { q: '', category: 'all', chain: 'all', scope: 'all', sort: 'rank', dir: 1, selected: null };
  var sandbox = { cap: model.peer_cap || 0.5, growth: model.growth_weight || 0.5, active: false };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + Number(n).toFixed(2) + '%';
  }
  function fmtAge(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.round(d) + 'd';
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  // The sandbox recompute, mirroring lib/model.ts: peer multiple capped by
  // the slider, growth weight from the slider, maturity and chain reach fixed.
  function rescore(row) {
    var peer = Math.min(row.model.peer_multiple, sandbox.cap);
    var growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growthPct / 100) * sandbox.growth;
    var age = row.age_days === null ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chainMult = 1 + model.chain_step * Math.min(Math.max(row.chains.length - 1, 0), model.chain_cap);
    return Math.max(1, Math.round(row.tvl_usd * peer * growthMult * maturity * chainMult));
  }
  function shownValue(row) { return sandbox.active ? rescore(row) : row.implied_value_usd; }

  function fillSelect(sel, values) {
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  }
  var categories = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && categories.indexOf(r.category) < 0) categories.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  categories.sort(); chains.sort();
  fillSelect(document.getElementById('categoryFilter'), categories);
  fillSelect(document.getElementById('chainFilter'), chains);

  var top = rows[0];
  document.getElementById('lede').textContent =
    DATA.board_size + ' pre-token protocols ranked by what their launch would be worth, ' +
    'from a snapshot of ' + DATA.as_of + '. ' + DATA.watchlist_size + ' are on the watchlist ' +
    '(TVL at or above $' + Math.round(DATA.floor_usd / 1e6) + 'M with no token recorded); ' +
    DATA.early_size + ' more below the floor were found by the radar. Rank 1 is ' +
    (top ? top.name + ' at ' + fmtUsd(top.implied_value_usd) : '—') + '.';
  document.getElementById('asof').innerHTML = '';
  var asofBox = document.getElementById('asof');
  asofBox.appendChild(el('b', null, 'Snapshot ' + DATA.as_of));
  asofBox.appendChild(el('span', null, 'Model ' + DATA.model_version + ' · peer-multiple, capped at ' + (model.peer_cap || 0.5)));
  document.getElementById('model').innerHTML = '';
  var modelBox = document.getElementById('model');
  var strong = el('b', null, 'How a row is valued: ');
  modelBox.appendChild(strong);
  modelBox.appendChild(document.createTextNode(
    'implied = TVL × peer multiple × growth × maturity × chain reach. ' +
    'The peer multiple is the median market-cap/TVL of live-token protocols in the same category ' +
    '(capped at ' + (model.peer_cap || 0.5) + '; a category needs at least 3 live peers, else the global median is used). ' +
    'Growth is the 7-day TVL change, clamped to ' + (model.growth_floor || -60) + '%…+' + (model.growth_cap || 120) +
    '%, weighted ' + (model.growth_weight || 0.5) + '. Maturity runs 0.6–1.0 over three years on the record ' +
    '(unknown age counts as 365 days). Each extra chain adds 3%, up to five. ' +
    'No protocol name is special-cased.'));

  function filtered() {
    var q = state.q.toLowerCase();
    var out = rows.filter(function (r) {
      if (state.scope === 'watch' && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort, dir = state.dir;
    out.sort(function (a, b) {
      var av = key === 'implied_value_usd' ? shownValue(a) : a[key];
      var bv = key === 'implied_value_usd' ? shownValue(b) : b[key];
      if (key === 'rank') { av = shownValue(a); bv = shownValue(b); dir = -1; }
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return out;
  }

  function render() {
    var list = filtered();
    var tbody = document.getElementById('rows');
    tbody.innerHTML = '';
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.addEventListener('click', function () { openDetail(r.slug); });
      var rankCell = el('td', 'num', String(sandbox.active ? list.indexOf(r) + 1 : r.rank));
      tr.appendChild(rankCell);
      var nameCell = document.createElement('td');
      nameCell.appendChild(el('b', null, r.name));
      if (r.watchlist) { nameCell.appendChild(document.createTextNode(' ')); nameCell.appendChild(el('span', 'watch', 'Watchlist')); }
      tr.appendChild(nameCell);
      tr.appendChild(el('td', null, r.category || '—'));
      var chainCell = document.createElement('td');
      (r.chains || []).slice(0, 3).forEach(function (c) { chainCell.appendChild(el('span', 'tag', c)); });
      if ((r.chains || []).length > 3) chainCell.appendChild(el('span', 'tag', '+' + (r.chains.length - 3)));
      tr.appendChild(chainCell);
      tr.appendChild(el('td', 'num', fmtUsd(r.tvl_usd)));
      var chg = el('td', 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), fmtPct(r.change_7d));
      tr.appendChild(chg);
      tr.appendChild(el('td', 'num', fmtUsd(shownValue(r))));
      tbody.appendChild(tr);
    });
    document.getElementById('count').textContent =
      list.length + ' of ' + rows.length + ' protocols shown' +
      (sandbox.active ? ' · sandbox model active (re-ranked)' : '');
  }

  function renderLive() {
    var tbody = document.getElementById('liveRows');
    live.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, p.name));
      tr.appendChild(el('td', null, p.category || '—'));
      tr.appendChild(el('td', 'num', fmtUsd(p.tvl_usd)));
      tr.appendChild(el('td', 'num', fmtUsd(p.mcap_usd)));
      tr.appendChild(el('td', 'num', p.multiple === null ? 'n/a' : Number(p.multiple).toFixed(2) + '×'));
      tbody.appendChild(tr);
    });
  }

  function peersFor(row) {
    var peers = DATA.peers || [];
    return peers
      .filter(function (p) { return p.category === row.category; })
      .sort(function (a, b) { return (b.multiple || 0) - (a.multiple || 0); })
      .slice(0, 5);
  }

  function openDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    state.selected = slug;
    var d = document.getElementById('detail');
    d.innerHTML = '';
    d.appendChild(el('h2', null, '#' + (sandbox.active ? '' : r.rank + ' ') + r.name));
    var facts = el('p', 'facts',
      (r.category || 'No category') + ' · ' + (r.chains || []).join(', ') +
      ' · TVL ' + fmtUsd(r.tvl_usd) + ' · 7d ' + fmtPct(r.change_7d) +
      ' · tracked since ' + (r.listed_at || 'unknown') + ' (' + fmtAge(r.age_days) + ')' +
      (r.watchlist ? ' · on the watchlist' : ' · found below the watchlist floor'));
    d.appendChild(facts);
    d.appendChild(el('h3', null, 'Implied value: ' + fmtUsd(shownValue(r))));
    var m = r.model;
    var tbl = document.createElement('table');
    var tb = document.createElement('tbody');
    [
      ['TVL', fmtUsd(r.tvl_usd)],
      ['Peer multiple (' + (m.peer_category ? m.peer_category + ', ' + m.peer_count + ' live peers' : 'global median — fewer than 3 live peers in this category') + ')', Number(m.peer_multiple).toFixed(2) + '×'],
      ['Growth (' + m.growth_pct + '% over 7d)', '×' + Number(m.growth_multiplier).toFixed(2)],
      ['Maturity (' + fmtAge(m.age_days) + ' on record)', '×' + Number(m.maturity_multiplier).toFixed(2)],
      ['Chain reach (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')', '×' + Number(m.chain_multiplier).toFixed(2)]
    ].forEach(function (row) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, row[0]));
      tr.appendChild(el('td', 'num', row[1]));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    d.appendChild(tbl);
    d.appendChild(el('h3', null, 'How to farm it'));
    var ol = document.createElement('ol');
    (r.farm_steps || []).forEach(function (s) { ol.appendChild(el('li', null, s)); });
    d.appendChild(ol);
    var peers = peersFor(r);
    d.appendChild(el('h3', null, 'Live peers in ' + (r.category || 'this category')));
    if (peers.length === 0) {
      d.appendChild(el('p', 'facts', 'No live-token protocol in this category is in the live set.'));
    } else {
      var pt = document.createElement('table');
      pt.className = 'peers';
      var ptb = document.createElement('tbody');
      peers.forEach(function (p) {
        var tr = document.createElement('tr');
        tr.appendChild(el('td', null, p.name));
        tr.appendChild(el('td', 'num', 'TVL ' + fmtUsd(p.tvl_usd)));
        tr.appendChild(el('td', 'num', 'mcap ' + fmtUsd(p.mcap_usd)));
        tr.appendChild(el('td', 'num', (p.multiple === null ? 'n/a' : Number(p.multiple).toFixed(2) + '×')));
        ptb.appendChild(tr);
      });
      pt.appendChild(ptb);
      d.appendChild(pt);
    }
    document.getElementById('modal').hidden = false;
  }

  function closeDetail() {
    document.getElementById('modal').hidden = true;
    state.selected = null;
  }

  document.getElementById('search').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  document.getElementById('categoryFilter').addEventListener('change', function (e) { state.category = e.target.value; render(); });
  document.getElementById('chainFilter').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  document.getElementById('scopeAll').addEventListener('click', function () {
    state.scope = 'all';
    document.getElementById('scopeAll').classList.add('on');
    document.getElementById('scopeWatch').classList.remove('on');
    render();
  });
  document.getElementById('scopeWatch').addEventListener('click', function () {
    state.scope = 'watch';
    document.getElementById('scopeWatch').classList.add('on');
    document.getElementById('scopeAll').classList.remove('on');
    render();
  });
  document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = key === 'name' || key === 'category' ? 1 : -1; }
      render();
    });
  });
  document.getElementById('modalClose').addEventListener('click', closeDetail);
  document.getElementById('modal').addEventListener('click', function (e) { if (e.target === this) closeDetail(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

  var capSlider = document.getElementById('capSlider');
  var growthSlider = document.getElementById('growthSlider');
  function applySandbox() {
    sandbox.cap = parseFloat(capSlider.value);
    sandbox.growth = parseFloat(growthSlider.value);
    sandbox.active = sandbox.cap !== model.peer_cap || sandbox.growth !== model.growth_weight;
    document.getElementById('capVal').textContent = sandbox.cap.toFixed(2);
    document.getElementById('growthVal').textContent = sandbox.growth.toFixed(2);
    render();
  }
  capSlider.addEventListener('input', applySandbox);
  growthSlider.addEventListener('input', applySandbox);
  document.getElementById('resetSandbox').addEventListener('click', function () {
    capSlider.value = String(model.peer_cap || 0.5);
    growthSlider.value = String(model.growth_weight || 0.5);
    applySandbox();
  });

  // Hash states for deep links and screenshots: #detail=<slug>,
  // #filter=watchlist, #filter=category:<name>.
  function applyHash() {
    var h = window.location.hash || '';
    var m = h.match(/#detail=([A-Za-z0-9-]+)/);
    if (m) { openDetail(m[1]); return; }
    var f = h.match(/#filter=(.+)$/);
    if (f) {
      var v = decodeURIComponent(f[1]);
      if (v === 'watchlist') {
        state.scope = 'watch';
        document.getElementById('scopeWatch').classList.add('on');
        document.getElementById('scopeAll').classList.remove('on');
      } else if (v.indexOf('category:') === 0) {
        state.category = v.slice(9);
        document.getElementById('categoryFilter').value = state.category;
      }
      render();
    }
  }

  renderLive();
  render();
  applyHash();
})();
