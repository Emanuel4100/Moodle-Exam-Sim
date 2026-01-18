// modules/pyodide-engine.js

let pyodide = null;
let isReady = false;

export async function initPyodideEngine() {
    if (pyodide) return; 
    try {
        pyodide = await loadPyodide();
        await pyodide.runPythonAsync("def input(prompt=''): return 'Input is disabled in exam mode'");
        console.log("Pyodide ready ✅");
        isReady = true;
    } catch (err) {
        console.error("Failed to load Pyodide:", err);
    }
}

export async function runPythonCode(code) {
    if (!isReady) throw new Error("Python engine is still loading...");

    pyodide.runPython(`import io, sys; sys.stdout = io.StringIO()`);
    
    await pyodide.runPythonAsync(code);
    
    const stdout = pyodide.runPython("sys.stdout.getvalue()");
    let lastResult = "";
    try {
        const lines = code.split('\n').filter(line => line.trim() !== "");
        const lastLine = lines.pop() || "";
        
        if (lastLine && !/^\s/.test(lastLine) && !lastLine.trim().startsWith("#")) {
            lastResult = await pyodide.runPythonAsync(`_ = (${lastLine})\n_`);
        }
    } catch (e) {
    }

    return (stdout + (lastResult ? `\n${lastResult}` : '')).trim();
}