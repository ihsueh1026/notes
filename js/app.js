/**
 * App — main controller.
 * Orchestrates UI, NoteStorage, and state transitions.
 */
var App = (function () {

  /* ── State ── */
  var state = {
    notes: typeof NOTES_META !== 'undefined' ? NOTES_META : [],
    active: null,        // currently open note object
    expandedCats: [],    // expanded category names
    query: '',           // search query
    mode: 'view'         // 'view' | 'edit'
  };

  var dragId = null;    // id of the note currently being dragged

  /* ── Content helpers ── */
  function getOriginal(id) {
    var el = document.getElementById('nc-' + id);
    return el ? el.textContent.trim() : '';
  }

  function getContent(note) {
    var saved = NoteStorage.load(note.id);
    return saved !== null ? saved : getOriginal(note.id);
  }

  /* ── Order persistence ── */
  function saveOrder() {
    localStorage.setItem('ali_order', JSON.stringify(
      state.notes.map(function (n) { return n.id; })
    ));
  }

  /* ── Sidebar ── */
  function renderSidebar() {
    var mod = NoteStorage.getModifiedIds();
    var activeId = state.active ? state.active.id : null;

    document.getElementById('catList').innerHTML =
      UI.renderAccordion(state.notes, state.expandedCats, activeId, mod, state.query);

    /* Category header clicks — single-open accordion */
    document.querySelectorAll('.acc-header').forEach(function (el) {
      el.addEventListener('click', function () {
        var cat = el.parentElement.dataset.cat;
        state.expandedCats = state.expandedCats[0] === cat ? [] : [cat];
        renderSidebar();
      });
    });

    /* Note item clicks */
    document.querySelectorAll('.acc-notes .note-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var note = state.notes.find(function (n) {
          return n.id === parseInt(el.dataset.id, 10);
        });
        if (note) openNote(note);
      });
    });

    /* Drag-to-reorder */
    document.querySelectorAll('.acc-notes .note-item').forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        dragId = parseInt(el.dataset.id, 10);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(function () { el.classList.add('dragging'); }, 0);
      });

      el.addEventListener('dragend', function () {
        el.classList.remove('dragging');
        document.querySelectorAll('.note-item.drag-over').forEach(function (x) {
          x.classList.remove('drag-over');
        });
      });

      el.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (parseInt(el.dataset.id, 10) === dragId) return;
        document.querySelectorAll('.note-item.drag-over').forEach(function (x) {
          x.classList.remove('drag-over');
        });
        el.classList.add('drag-over');
      });

      el.addEventListener('dragleave', function (e) {
        if (!el.contains(e.relatedTarget)) {
          el.classList.remove('drag-over');
        }
      });

      el.addEventListener('drop', function (e) {
        e.preventDefault();
        el.classList.remove('drag-over');
        var targetId = parseInt(el.dataset.id, 10);
        if (!dragId || dragId === targetId) return;

        var fromIdx = -1, toIdx = -1;
        state.notes.forEach(function (n, i) {
          if (n.id === dragId)   fromIdx = i;
          if (n.id === targetId) toIdx   = i;
        });
        if (fromIdx < 0 || toIdx < 0) return;

        /* Insert before or after target based on mouse vertical position */
        var rect = el.getBoundingClientRect();
        var before = e.clientY < rect.top + rect.height / 2;

        var moved = state.notes.splice(fromIdx, 1)[0];
        if (toIdx > fromIdx) toIdx--;
        state.notes.splice(before ? toIdx : toIdx + 1, 0, moved);

        saveOrder();
        renderSidebar();
      });
    });
  }

  /* ── View mode ── */
  function openNote(note) {
    state.active = note;
    state.mode = 'view';
    state.expandedCats = [note.category];
    var content = getContent(note);
    var isModified = NoteStorage.isModified(note.id);

    document.getElementById('mainContent').innerHTML =
      UI.renderNoteView(note, content, isModified);

    /* Syntax highlight */
    var codeEl = document.getElementById('codeBlock');
    if (codeEl) Prism.highlightElement(codeEl);

    /* Copy code button (absent for lang === 'links') */
    var copyCodeBtn = document.getElementById('copyCodeBtn');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(content).then(function () {
          copyCodeBtn.textContent = '已複製!';
          copyCodeBtn.classList.add('copied');
          setTimeout(function () {
            copyCodeBtn.textContent = '複製';
            copyCodeBtn.classList.remove('copied');
          }, 2000);
        });
      });
    }

    /* Copy all button */
    var copyAllBtn = document.getElementById('copyAllBtn');
    copyAllBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(content).then(function () {
        copyAllBtn.innerHTML = copyAllBtn.innerHTML.replace('複製', '已複製!');
        setTimeout(function () {
          copyAllBtn.innerHTML = copyAllBtn.innerHTML.replace('已複製!', '複製');
        }, 2000);
      });
    });

    /* Reset button (view mode, only when modified) */
    var resetViewBtn = document.getElementById('resetBtn');
    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', function () {
        if (!confirm('確定要還原成原始內容嗎？目前的修改將全部捨棄。')) return;
        NoteStorage.reset(note.id);
        openNote(note);
      });
    }

    /* Push to GitHub */
    document.getElementById('pushBtn').addEventListener('click', pushToGitHub);

    /* Delete button */
    document.getElementById('deleteBtn').addEventListener('click', function () {
      deleteNote(note);
    });

    /* Edit button */
    document.getElementById('editBtn').addEventListener('click', function () {
      editNote(note);
    });

    renderSidebar();
  }

  /* ── Delete note ── */
  function deleteNote(note) {
    if (!confirm('確定要刪除「' + note.title + '」？\n\n筆記將立即從介面移除，推送後從原始檔案永久刪除。')) return;
    NoteStorage.markDeleted(note.id);
    NoteStorage.reset(note.id);

    var idx = -1;
    state.notes.forEach(function (n, i) { if (n.id === note.id) idx = i; });
    if (idx >= 0) state.notes.splice(idx, 1);

    state.active = null;
    if (state.notes.length) {
      openNote(state.notes[Math.min(idx, state.notes.length - 1)]);
    } else {
      document.getElementById('mainContent').innerHTML = UI.renderEmpty();
      renderSidebar();
    }
  }

  /* ── Edit mode ── */
  function editNote(note) {
    state.mode = 'edit';
    var content = getContent(note);
    var isModified = NoteStorage.isModified(note.id);

    document.getElementById('mainContent').innerHTML =
      UI.renderEditorView(note, content, isModified);

    var ta        = document.getElementById('editorTextarea');
    var lineCount = document.getElementById('lineCount');
    var charCount = document.getElementById('charCount');

    /* Tab key → 4 spaces */
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.substring(0, s) + '    ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = s + 4;
        updateStats();
      }
      /* Ctrl+S or Cmd+S → save */
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        doSave();
      }
    });

    function updateStats() {
      lineCount.textContent = ta.value.split('\n').length + ' 行';
      charCount.textContent = ta.value.length + ' 字元';
    }

    ta.addEventListener('input', updateStats);

    /* Focus at top */
    ta.focus();
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0;

    function doSave() {
      NoteStorage.save(note.id, ta.value);
      openNote(note);
    }

    document.getElementById('saveBtn').addEventListener('click', doSave);

    document.getElementById('cancelBtn').addEventListener('click', function () {
      openNote(note);
    });

    document.getElementById('resetBtn').addEventListener('click', function () {
      if (NoteStorage.isModified(note.id)) {
        if (!confirm('確定要還原成原始內容嗎？目前的修改將全部捨棄。')) return;
        NoteStorage.reset(note.id);
      }
      openNote(note);
    });
  }

  /* ── Export / Import ── */
  function exportNotes() {
    var json = NoteStorage.exportJSON(state.notes, function (n) {
      return getContent(n);
    });
    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ali_notes_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function importNotes() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', function () {
      if (!input.files.length) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var count = NoteStorage.importJSON(e.target.result);
          alert('匯入成功：' + count + ' 個筆記已更新');
          if (state.active) openNote(state.active);
          else renderSidebar();
        } catch (err) {
          alert('匯入失敗：' + err.message);
        }
      };
      reader.readAsText(input.files[0]);
    });
    input.click();
  }

  /* ── Push to GitHub ── */
  function pushToGitHub() {
    var TOKEN_KEY = 'ali_github_token';
    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = prompt('請輸入 GitHub Personal Access Token：');
      if (!token) return;
      localStorage.setItem(TOKEN_KEY, token.trim());
      token = token.trim();
    }

    var modified = NoteStorage.getModifiedIds();
    var deleted  = NoteStorage.getDeletedIds();
    var savedOrder = localStorage.getItem('ali_order');
    if (!modified.length && !deleted.length && !savedOrder) { alert('沒有已修改、刪除或重新排序的筆記'); return; }

    var btn = document.getElementById('pushBtn');
    if (btn) { btn.disabled = true; btn.textContent = '推送中…'; }

    var REPO    = 'https://api.github.com/repos/ihsueh1026/notes/contents/';
    var headers = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' };

    function ghGet(path) {
      return fetch(REPO + path, { headers: headers }).then(function (r) { return r.json(); });
    }

    function ghPut(path, sha, content, msg) {
      var encoded = new TextEncoder().encode(content);
      var bin = '';
      encoded.forEach(function (b) { bin += String.fromCharCode(b); });
      return fetch(REPO + path, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify({ message: msg, content: btoa(bin), sha: sha })
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.message || r.status); });
      });
    }

    function b64decode(str) {
      var raw = atob(str.replace(/\n/g, ''));
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }

    var parts = [];
    if (modified.length) parts.push('Update ' + modified.length + ' note(s)');
    if (deleted.length)  parts.push('Delete ' + deleted.length + ' note(s)');
    if (savedOrder)      parts.push('Reorder notes');
    var commitMsg = parts.join(', ') + ' via browser';

    /* Step 1: update index.html (content edits + remove deleted blocks) */
    ghGet('index.html')
      .then(function (file) {
        var html = b64decode(file.content);

        modified.forEach(function (id) {
          var saved = NoteStorage.load(id);
          if (saved === null) return;
          html = html.replace(
            new RegExp('(<script type="text\\/plain" id="nc-' + id + '">)[\\s\\S]*?(<\\/script>)'),
            function (_, open, close) { return open + '\n' + saved + '\n' + close; }
          );
        });

        deleted.forEach(function (id) {
          html = html.replace(
            new RegExp('\\n?<script type="text\\/plain" id="nc-' + id + '">[\\s\\S]*?<\\/script>\\n?'),
            '\n'
          );
        });

        return ghPut('index.html', file.sha, html, commitMsg);
      })
      /* Step 2: always update data.js (order + deletions) */
      .then(function () {
        return ghGet('js/data.js').then(function (file) {
          var js = 'var NOTES_META = [\n';
          state.notes.forEach(function (n, i) {
            js += '  {\n'
              + '    id: '          + n.id                         + ',\n'
              + '    title: '       + JSON.stringify(n.title)       + ',\n'
              + '    category: '    + JSON.stringify(n.category)    + ',\n'
              + '    tags: '        + JSON.stringify(n.tags)        + ',\n'
              + '    date: '        + JSON.stringify(n.date)        + ',\n'
              + '    lang: '        + JSON.stringify(n.lang)        + ',\n'
              + '    description: ' + JSON.stringify(n.description) + '\n'
              + '  }' + (i < state.notes.length - 1 ? ',' : '') + '\n';
          });
          js += '];\n';
          return ghPut('js/data.js', file.sha, js, commitMsg);
        });
      })
      /* Step 3: clean up localStorage and notify */
      .then(function () {
        modified.forEach(function (id) { NoteStorage.reset(id); });
        if (deleted.length) NoteStorage.clearDeleted();
        if (savedOrder) localStorage.removeItem('ali_order');

        var msg = [];
        if (modified.length) msg.push(modified.length + ' 個筆記已更新');
        if (deleted.length)  msg.push(deleted.length  + ' 個筆記已永久刪除');
        if (savedOrder)      msg.push('排序已同步');
        alert('推送成功！' + msg.join('，') + '\n\n請在 WSL 終端機執行：\ncd /mnt/d/notes && git pull');

        if (state.active) openNote(state.active);
        else renderSidebar();
      })
      .catch(function (e) {
        alert('推送失敗：' + e.message);
        if (e.message === 'Bad credentials') localStorage.removeItem(TOKEN_KEY);
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.innerHTML = ''; btn.textContent = 'Push'; }
      });
  }

  /* ── Init ── */
  function init() {
    /* Filter soft-deleted notes before first render */
    var deletedOnLoad = NoteStorage.getDeletedIds();
    if (deletedOnLoad.length) {
      state.notes = state.notes.filter(function (n) {
        return deletedOnLoad.indexOf(n.id) < 0;
      });
    }

    /* Apply saved note order */
    try {
      var savedOrder = JSON.parse(localStorage.getItem('ali_order') || 'null');
      if (savedOrder) {
        var noteMap = {};
        state.notes.forEach(function (n) { noteMap[n.id] = n; });
        var reordered = [];
        savedOrder.forEach(function (id) { if (noteMap[id]) reordered.push(noteMap[id]); });
        /* Append any new notes not yet in saved order */
        state.notes.forEach(function (n) {
          if (savedOrder.indexOf(n.id) < 0) reordered.push(n);
        });
        state.notes = reordered;
      }
    } catch (e) {}

    /* Search */
    document.getElementById('search').addEventListener('input', function () {
      state.query = this.value;
      renderSidebar();
    });

    /* Export / Import */
    document.getElementById('exportBtn').addEventListener('click', exportNotes);
    document.getElementById('importBtn').addEventListener('click', importNotes);

    /* Initial render */
    renderSidebar();
    if (state.notes.length) openNote(state.notes[0]);
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', function () { App.init(); });
