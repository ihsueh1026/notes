/**
 * NoteStorage — localStorage CRUD wrapper
 * Keys:  ali_n_{id}     → custom content
 *        ali_modified   → JSON array of modified note IDs
 */
var NoteStorage = (function () {
  var PREFIX  = 'ali_n_';
  var MOD_KEY = 'ali_modified';
  var DEL_KEY = 'ali_deleted';

  function getMod() {
    try { return JSON.parse(localStorage.getItem(MOD_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function setMod(ids) {
    localStorage.setItem(MOD_KEY, JSON.stringify(ids));
  }

  return {
    /** Return saved content string, or null if not saved */
    load: function (id) {
      return localStorage.getItem(PREFIX + id);
    },

    /** Persist content and mark note as modified */
    save: function (id, content) {
      localStorage.setItem(PREFIX + id, content);
      var mod = getMod();
      if (mod.indexOf(id) < 0) { mod.push(id); setMod(mod); }
    },

    /** Delete saved content and remove modified mark */
    reset: function (id) {
      localStorage.removeItem(PREFIX + id);
      setMod(getMod().filter(function (x) { return x !== id; }));
    },

    isModified: function (id) {
      return getMod().indexOf(id) >= 0;
    },

    getModifiedIds: function () {
      return getMod();
    },

    /**
     * Export all notes to a JSON string.
     * @param {Array} notes - NOTES_META array
     * @param {Function} getContent - function(note) => string
     */
    exportJSON: function (notes, getContent) {
      var data = {
        version: 1,
        exported: new Date().toISOString(),
        notes: notes.map(function (n) {
          return { id: n.id, title: n.title, content: getContent(n) };
        })
      };
      return JSON.stringify(data, null, 2);
    },

    /**
     * Import notes from a JSON string produced by exportJSON.
     * Returns the number of notes imported.
     */
    importJSON: function (str) {
      var data = JSON.parse(str);
      var count = 0;
      (data.notes || []).forEach(function (n) {
        if (n.id && typeof n.content === 'string') {
          NoteStorage.save(n.id, n.content);
          count++;
        }
      });
      return count;
    },

    getDeletedIds: function () {
      try { return JSON.parse(localStorage.getItem(DEL_KEY) || '[]'); }
      catch (e) { return []; }
    },

    markDeleted: function (id) {
      var ids = this.getDeletedIds();
      if (ids.indexOf(id) < 0) ids.push(id);
      localStorage.setItem(DEL_KEY, JSON.stringify(ids));
    },

    clearDeleted: function () {
      localStorage.removeItem(DEL_KEY);
    }
  };
})();
