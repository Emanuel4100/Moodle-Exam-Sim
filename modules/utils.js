// modules/utils.js

export function applyTheme(theme) {
    document.body.className = theme;
    localStorage.setItem("exam_theme", theme);
}

export function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
}

export function clearAnswerStorage() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('q') && key.endsWith('_code')) {
        localStorage.removeItem(key);
      }
    });
    console.log("Exam storage cleared.");
}

// עזר ליצירת עורך Ace
export function createAceEditor(elementId, initialValue = '', readOnly = false) {
    const editor = ace.edit(elementId);
    editor.setTheme('ace/theme/monokai');
    editor.session.setMode('ace/mode/python');
    editor.setFontSize(16);
    editor.setValue(initialValue, 1);
    if (readOnly) {
        editor.setReadOnly(true);
    }
    return editor;
}