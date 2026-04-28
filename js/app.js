/**
 * App — main controller.
 * Orchestrates UI, NoteStorage, and state transitions.
 */
var App = (function () {

  /* ── State ── */
  var state = {
    notes: typeof NOTES_META !== 'undefined' ? NOTES_META : [],
    active: null,   // currently open note object
    cat: 'all',     // active category filter
    query: '',      // search query
    mode: 'view'    // 'view' | 'edit'
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

  function filtered() {
    var q = state.query.toLowerCase();
    return state.notes.filter(function (n) {
      if (state.cat !== 'all' && n.category !== state.cat) return false;
      if (!q) return true;
      return n.title.toLowerCase().indexOf(q) >= 0
        || n.tags.some(function (t) { return t.toLowerCase().indexOf(q) >= 0; })
        || (n.description || '').toLowerCase().indexOf(q) >= 0;
    });
  }

  /* ── Sidebar ── */
  function renderSidebar() {
    var mod = NoteStorage.getModifiedIds();
    var activeId = state.active ? state.active.id : null;

    document.getElementById('catList').innerHTML =
      UI.renderCategories(state.notes, state.cat);

    document.getElementById('notesList').innerHTML =
      UI.renderList(filtered(), activeId, mod);

    /* Category clicks */
    document.querySelectorAll('#catList .cat-item').forEach(function (el) {
      el.addEventListener('click', function () {
        state.cat = el.dataset.cat;
        renderSidebar();
      });
    });

    /* Note item clicks */
    document.querySelectorAll('#notesList .note-item').forEach(function (el) {
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
    var content = getContent(note);
    var isModified = NoteStorage.isModified(note.id);

    document.getElementById('mainContent').innerHTML =
      UI.renderNoteView(note, content, isModified);

    /* Syntax highlight */
    var codeEl = document.getElementById('codeBlock');
    if (codeEl) Prism.highlightElement(codeEl);

    /* Copy code button */
    var copyCodeBtn = document.getElementById('copyCodeBtn');
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
