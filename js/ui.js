/**
 * UI — pure DOM-building module.
 * All functions return HTML strings or update specific elements.
 * No state is stored here.
 */
var UI = (function () {

  /* ── Helpers ── */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tagsHtml(tags) {
    return tags.map(function (t) {
      return '<span class="tag">' + esc(t) + '</span>';
    }).join(' ');
  }

  function svgIcon(d, size) {
    size = size || 13;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + d + '</svg>';
  }

  var ICONS = {
    edit:    '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    extlink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    push:    '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',
    copy:   '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    save:   '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    reset:  '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.73"/>',
    upload: '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',
    download: '<polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>',
    file:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
  };

  /* ── Sidebar ── */
  function renderCategories(notes, activeCat) {
    var map = { all: 0 };
    notes.forEach(function (n) {
      map.all++;
      map[n.category] = (map[n.category] || 0) + 1;
    });
    return Object.keys(map).map(function (k) {
      var label = k === 'all' ? '全部' : k;
      var cls = 'cat-item' + (activeCat === k ? ' active' : '');
      return '<div class="' + cls + '" data-cat="' + esc(k) + '">'
        + '<span>' + esc(label) + '</span>'
        + '<span class="badge">' + map[k] + '</span></div>';
    }).join('');
  }

  function renderList(filteredNotes, activeId, modifiedIds) {
    if (!filteredNotes.length) return '<div class="empty-list">找不到筆記</div>';
    return filteredNotes.map(function (n) {
      var cls = 'note-item' + (n.id === activeId ? ' active' : '');
      var dot = modifiedIds.indexOf(n.id) >= 0
        ? '<span class="modified-dot" title="已修改"></span>' : '';
      return '<div class="' + cls + '" data-id="' + n.id + '">'
        + '<div class="note-item-title"><span>' + esc(n.title) + '</span>' + dot + '</div>'
        + '<div class="note-item-meta">'
        + '<span class="lang-badge">' + esc(n.lang) + '</span>'
        + '<span>' + esc(n.date) + '</span>'
        + '</div></div>';
    }).join('');
  }

  /* ── Accordion sidebar ── */
  function renderAccordion(notes, expandedCats, activeId, modifiedIds, query) {
    var q = (query || '').toLowerCase();

    /* Build ordered category → notes map */
    var cats = [];
    var catMap = {};
    notes.forEach(function (n) {
      if (!catMap[n.category]) { catMap[n.category] = []; cats.push(n.category); }
      catMap[n.category].push(n);
    });

    return cats.map(function (cat) {
      var all = catMap[cat];
      var visible = q ? all.filter(function (n) {
        return n.title.toLowerCase().indexOf(q) >= 0
          || n.tags.some(function (t) { return t.toLowerCase().indexOf(q) >= 0; })
          || (n.description || '').toLowerCase().indexOf(q) >= 0;
      }) : all;

      if (q && !visible.length) return '';

      var expanded = q || expandedCats.indexOf(cat) >= 0;
      var arrow = expanded ? '▾' : '▸';

      var notesHtml = visible.map(function (n) {
        var cls = 'note-item' + (n.id === activeId ? ' active' : '');
        var dot = modifiedIds.indexOf(n.id) >= 0
          ? '<span class="modified-dot" title="已修改"></span>' : '';
        return '<div class="' + cls + '" data-id="' + n.id + '">'
          + '<div class="note-item-title"><span>' + esc(n.title) + '</span>' + dot + '</div>'
          + '<div class="note-item-meta">'
          + '<span class="lang-badge">' + esc(n.lang) + '</span>'
          + '<span>' + esc(n.date) + '</span>'
          + '</div></div>';
      }).join('');

      return '<div class="acc-cat" data-cat="' + esc(cat) + '">'
        + '<div class="acc-header">'
        + '<span class="acc-arrow">' + arrow + '</span>'
        + '<span class="acc-label">' + esc(cat) + '</span>'
        + '<span class="badge">' + visible.length + '</span>'
        + '</div>'
        + (expanded ? '<div class="acc-notes">' + notesHtml + '</div>' : '')
        + '</div>';
    }).join('');
  }

  /* ── Links renderer (lang === 'links') ── */
  function renderLinksContent(content) {
    var lines = content.split('\n');
    var html = '<div class="links-panel">';
    var groupOpen = false;

    function closeGroup() { if (groupOpen) { html += '</div>'; groupOpen = false; } }
    function openGroup()  { if (!groupOpen) { html += '<div class="links-group">'; groupOpen = true; } }

    lines.forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (/^# /.test(line)) {
        closeGroup();
        html += '<div class="links-title">' + esc(line.slice(2)) + '</div>';
      } else if (/^## /.test(line)) {
        closeGroup();
        html += '<div class="links-h2">' + esc(line.slice(3)) + '</div>';
      } else if (/^### /.test(line)) {
        closeGroup();
        html += '<div class="links-h3">' + esc(line.slice(4)) + '</div>';
      } else if (/^https?:\/\//.test(line)) {
        openGroup();
        var parts = line.replace(/\/$/, '').split('/');
        var raw = decodeURIComponent(parts[parts.length - 1]).replace(/_/g, ' ');
        var label = raw || line;
        html += '<a href="' + esc(line) + '" class="link-btn" target="_blank" rel="noopener">'
             + svgIcon(ICONS.extlink, 11) + esc(label) + '</a>';
      }
    });

    closeGroup();
    html += '</div>';
    return html;
  }

  /* ── Note View (read mode) ── */
  function renderNoteView(note, content, isModified) {
    var modBadge = isModified
      ? '<span class="modified-badge">已修改</span>' : '';

    return ''
      + '<div class="note-toolbar">'
      +   '<div class="note-title-area">'
      +     '<h1>' + esc(note.title) + '</h1>'
      +     '<div class="meta">'
      +       '<span>' + esc(note.date) + '</span>'
      +       '<span>' + esc(note.category) + '</span>'
      +       tagsHtml(note.tags) + modBadge
      +     '</div>'
      +   '</div>'
      +   '<div class="toolbar-actions">'
      +     '<button class="btn" id="editBtn">' + svgIcon(ICONS.edit) + ' 編輯</button>'
      +     (isModified ? '<button class="btn danger" id="resetBtn">' + svgIcon(ICONS.reset) + ' 還原</button>' : '')
      +     '<button class="btn" id="copyAllBtn">' + svgIcon(ICONS.copy) + ' 複製</button>'
      +     '<button class="btn success" id="pushBtn">' + svgIcon(ICONS.push) + ' Push</button>'
      +   '</div>'
      + '</div>'
      + '<div class="note-body">'
      + (note.description ? '<p class="note-desc">' + esc(note.description) + '</p>' : '')
      + (note.lang === 'links'
          ? renderLinksContent(content)
          : '<div class="code-wrap">'
            +   '<div class="code-header">'
            +     '<div class="code-header-left">'
            +       '<span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>'
            +       '<span class="code-lang">' + esc(note.lang) + '</span>'
            +     '</div>'
            +     '<button class="copy-btn" id="copyCodeBtn">複製</button>'
            +   '</div>'
            +   '<pre><code id="codeBlock" class="language-' + esc(note.lang) + '">'
            +     esc(content)
            +   '</code></pre>'
            + '</div>')
      + '</div>';
  }

  /* ── Editor View (edit mode) ── */
  function renderEditorView(note, content, isModified) {
    var modBadge = isModified ? '<span class="modified-badge">已修改</span>' : '';
    var lines = content.split('\n').length;
    var chars = content.length;

    return ''
      + '<div class="note-toolbar">'
      +   '<div class="note-title-area">'
      +     '<h1>' + esc(note.title) + '</h1>'
      +     '<div class="meta">'
      +       '<span>' + esc(note.category) + '</span>'
      +       modBadge
      +       '<span class="edit-mode-badge">編輯模式</span>'
      +     '</div>'
      +   '</div>'
      +   '<div class="toolbar-actions">'
      +     '<button class="btn danger" id="resetBtn">' + svgIcon(ICONS.reset) + ' 還原原始</button>'
      +     '<button class="btn" id="cancelBtn">取消</button>'
      +     '<button class="btn primary" id="saveBtn">' + svgIcon(ICONS.save) + ' 儲存</button>'
      +   '</div>'
      + '</div>'
      + '<div class="editor-body">'
      + (note.description ? '<p class="note-desc">' + esc(note.description) + '</p>' : '')
      +   '<div class="editor-area">'
      +     '<div class="editor-header">'
      +       '<span class="code-lang">' + esc(note.lang) + '</span>'
      +       '<span id="lineCount">' + lines + ' 行</span>'
      +     '</div>'
      +     '<textarea id="editorTextarea" class="editor-textarea" spellcheck="false">'
      +       esc(content)
      +     '</textarea>'
      +     '<div class="editor-footer">'
      +       '<span id="charCount">' + chars + ' 字元</span>'
      +       '<span>Tab → 4 spaces &nbsp;|&nbsp; Ctrl+S 儲存</span>'
      +     '</div>'
      +   '</div>'
      + '</div>';
  }

  /* ── Empty State ── */
  function renderEmpty() {
    return '<div class="empty-state">'
      + svgIcon(ICONS.file, 48)
      + '<p>選擇左側筆記來查看內容</p>'
      + '</div>';
  }

  /* Public API */
  return {
    renderAccordion:  renderAccordion,
    renderNoteView:   renderNoteView,
    renderEditorView: renderEditorView,
    renderEmpty:      renderEmpty
  };
})();
