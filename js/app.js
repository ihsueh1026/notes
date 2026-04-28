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

  /* ── Content helpers ── */
  function getOriginal(id) {
    var el = document.getElementById('nc-' + id);
    return el ? el.textContent.trim() : '';
  }

  function getContent(note) {
    var saved = NoteStorage.load(note.id);
    return saved !== null ? saved : getOriginal(note.id);
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

    /* Edit button */
    document.getElementById('editBtn').addEventListener('click', function () {
      editNote(note);
    });

    renderSidebar();
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
    if (!modified.length) { alert('沒有已修改的筆記'); return; }

    var btn = document.getElementById('pushBtn');
    if (btn) { btn.disabled = true; btn.textContent = '推送中…'; }

    var api = 'https://api.github.com/repos/ihsueh1026/notes/contents/index.html';
    var headers = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' };

    fetch(api, { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (file) {
        var sha = file.sha;
        /* Decode base64 → UTF-8 string */
        var raw = atob(file.content.replace(/\n/g, ''));
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        var html = new TextDecoder('utf-8').decode(bytes);

        /* Replace each modified nc-{id} block */
        modified.forEach(function (id) {
          var saved = NoteStorage.load(id);
          if (saved === null) return;
          html = html.replace(
            new RegExp('(<script type="text\\/plain" id="nc-' + id + '">)[\\s\\S]*?(<\\/script>)'),
            function (_, open, close) { return open + '\n' + saved + '\n' + close; }
          );
        });

        /* Encode UTF-8 string → base64 */
        var encoded = new TextEncoder().encode(html);
        var bin = '';
        encoded.forEach(function (b) { bin += String.fromCharCode(b); });

        return fetch(api, {
          method: 'PUT',
          headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
          body: JSON.stringify({
            message: 'Update ' + modified.length + ' note(s) via browser',
            content: btoa(bin),
            sha: sha
          })
        });
      })
      .then(function (r) {
        if (r.ok) {
          modified.forEach(function (id) { NoteStorage.reset(id); });
          alert('推送成功！' + modified.length + ' 個筆記已更新');
          if (state.active) openNote(state.active);
          else renderSidebar();
        } else {
          return r.json().then(function (e) { throw new Error(e.message || r.status); });
        }
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
