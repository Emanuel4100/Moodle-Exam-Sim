// modules/pyodide-engine.js

let pyodide = null;
let isReady = false;

export async function initPyodideEngine() {
    if (pyodide) return; // שכבת הגנה
    try {
        pyodide = await loadPyodide();
        // תיקון באג 3: נטרול input כדי למנוע תקיעת דפדפן
        await pyodide.runPythonAsync("def input(prompt=''): return 'Input is disabled in exam mode'");
        console.log("Pyodide ready ✅");
        isReady = true;
    } catch (err) {
        console.error("Failed to load Pyodide:", err);
    }
}

export async function runPythonCode(code) {
    if (!isReady) throw new Error("Python engine is still loading...");

    // הפניית הפלט למחרוזת
    pyodide.runPython(`import io, sys; sys.stdout = io.StringIO()`);
    
    // הרצת הקוד של הסטודנט
    await pyodide.runPythonAsync(code);
    
    // שליפת הפלט (print)
    const stdout = pyodide.runPython("sys.stdout.getvalue()");

    // ניסיון להריץ את השורה האחרונה (כמו ב-Console)
    // תיקון באג 1: בדיקה שהשורה לא מוזחת (Indented) כדי למנוע קריסה
    let lastResult = "";
    try {
        const lines = code.split('\n').filter(line => line.trim() !== "");
        const lastLine = lines.pop() || "";
        
        // מריצים רק אם זו לא שורה בתוך בלוק (if/for/def) וזו לא הערה
        if (lastLine && !/^\s/.test(lastLine) && !lastLine.trim().startsWith("#")) {
            lastResult = await pyodide.runPythonAsync(`_ = (${lastLine})\n_`);
        }
    } catch (e) {
        // מתעלמים משגיאות בשורה האחרונה בלבד (כדי לא להכשיל הרצה תקינה)
    }

    return (stdout + (lastResult ? `\n${lastResult}` : '')).trim();
}