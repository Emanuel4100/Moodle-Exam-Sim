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

// modules/utils.js

export function createAceEditor(elementId, initialValue = '', readOnly = false) {
    const editor = ace.edit(elementId);
    editor.setTheme('ace/theme/chrome'); 
    editor.session.setMode('ace/mode/python');
    editor.setFontSize(16);
    editor.setValue(initialValue, 1);
    editor.setShowPrintMargin(false); 
    editor.renderer.setShowGutter(true); 
    if (readOnly) {
        editor.setReadOnly(true);
        editor.container.style.backgroundColor = "#f9f9f9";
    }
    return editor;
}