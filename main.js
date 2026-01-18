// main.js - Final Version with Cumulative Image Upload
import { initPyodideEngine, runPythonCode } from './modules/pyodide-engine.js';
import { applyTheme, escapeHTML, clearAnswerStorage, createAceEditor } from './modules/utils.js';

document.addEventListener("DOMContentLoaded", () => {
    // --- State ---
    let questions = [];
    let timeLeft = 0;
    let timerId = null;
    let isUnlimitedTime = false;
    let currentQuestionIndex = 0;
    let isPythonReady = false;

    // --- Initialization ---
    applyTheme("moodle");

    document.getElementById('addQuestion').addEventListener('click', () => addQuestionUI());
    document.getElementById('startExam').addEventListener('click', startExam);
    
    document.getElementById('downloadAnswers').addEventListener('click', downloadJSON);
    document.getElementById('downloadText').addEventListener('click', downloadAsPythonFile);
    document.getElementById('restartFresh').addEventListener('click', () => {
        if(confirm("Start a completely new exam? All data will be lost.")) location.reload();
    });

    // טעינת פייתון
    initPyodideEngine().then(() => {
        console.log("Python engine loaded.");
        isPythonReady = true;
        updatePythonStatus(true);
    }).catch(err => {
        console.error("Failed to load Python:", err);
        updatePythonStatus(false, "Error loading Python");
    });

    addQuestionUI();

    // --- Helper: Update Python Status UI ---
    function updatePythonStatus(ready, text) {
        const dot = document.getElementById('statusDot');
        const txt = document.getElementById('statusText');
        if (ready) {
            dot.style.backgroundColor = "green";
            txt.textContent = "Python Ready";
            txt.style.color = "green";
            const checkBtn = document.getElementById('checkBtn');
            if (checkBtn) {
                checkBtn.disabled = false;
                checkBtn.textContent = "Check";
                checkBtn.style.opacity = "1";
            }
        } else {
            dot.style.backgroundColor = "red";
            txt.textContent = text || "Loading Python...";
        }
    }

// בתוך main.js - החלף את הפונקציה addQuestionUI בגרסה הזו:


function addQuestionUI() {
    const questionsList = document.getElementById('questionsList');
    const div = document.createElement('div');
    div.classList.add('question-card'); 
    div.style.marginBottom = "15px";
    div.style.padding = "20px";
    div.style.border = "1px solid #dee2e6";
    div.style.background = "#fff";
    div.style.borderRadius = "4px";
    
    const editorId = `preEditor_temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <label style="font-weight:bold; font-size:1.1rem; color:#701e51;">Question Setup</label>
            <button class="remove-btn" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">🗑 Remove</button>
        </div>
        
        <label>Question Text:</label>
        <textarea class='qText' dir='rtl' placeholder="Enter the question text here..." style="width:100%; height:100px; margin-top:5px; padding:10px; border:1px solid #ccc; border-radius:4px; font-family:inherit;"></textarea>
        
        <div style="margin-top:15px; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #e9ecef;">
            <label style="font-weight:bold;">Images:</label>
            <div style="margin-top:5px; display:flex; gap:10px; align-items:center;">
                <input type='file' class='qImage' accept='image/*' multiple>
                <button class="clear-imgs-btn" style="background:#ffc107; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.9rem;">Clean Images</button>
            </div>
            <div class='imgPreview' style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; min-height:20px;"></div>
        </div>
        
        <label style="display:block; margin-top:15px;">
            <input type="checkbox" class="usePreCode" checked> Use pre-written starter code
        </label>
        <div id='${editorId}' class='editor small' style="height:150px; border:1px solid #ccc; margin-top:5px;"></div>
    `;
    questionsList.appendChild(div);

    const preEditor = createAceEditor(editorId);
    const usePreCheckbox = div.querySelector('.usePreCode');
    const editorContainer = div.querySelector(`#${editorId}`);
    
    div.dataset.editorId = editorId; 
    div.aceEditorInstance = preEditor; 

    const syncPreVisibility = () => {
        editorContainer.style.display = usePreCheckbox.checked ? 'block' : 'none';
    };
    usePreCheckbox.addEventListener('change', syncPreVisibility);
    syncPreVisibility();

    // --- לוגיקת תמונות מצטברת (התיקון החשוב) ---
    div.uploadedImages = []; // אתחול המערך
    
    const imgInput = div.querySelector('.qImage');
    const previewDiv = div.querySelector('.imgPreview');
    const clearImgsBtn = div.querySelector('.clear-imgs-btn');

    imgInput.addEventListener('change', e => {
        const files = Array.from(e.target.files);
        // כאן הוסר ה-div.uploadedImages = [] כדי לא למחוק קודמים
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = ev => {
                div.uploadedImages.push(ev.target.result);
                // הוספה לתצוגה במקום דריסה
                previewDiv.innerHTML += `<img src='${ev.target.result}' class='preview-thumb' style='height:60px; border:1px solid #ddd; padding:2px; background:white;'>`;
            };
            reader.readAsDataURL(file);
        });
        imgInput.value = ''; // איפוס ה-input כדי שאפשר יהיה להעלות שוב
    });

    clearImgsBtn.addEventListener('click', () => {
        div.uploadedImages = [];
        previewDiv.innerHTML = '';
        imgInput.value = '';
    });

    div.querySelector('.remove-btn').addEventListener('click', () => {
        if (questionsList.children.length === 1) return alert("Cannot remove last question.");
        if(confirm("Remove this question?")) div.remove();
    });
}
    // --- Core Logic: Start Exam ---
    function startExam() {
        questions = [];
        const cards = document.querySelectorAll('#questionsList > div');
        
        if (cards.length === 0) return alert('Add at least one question.');

        cards.forEach((card) => {
            const q = {
                text: card.querySelector('.qText').value,
                images: card.uploadedImages || [],
                preCode: '',
                answer: '',
                output: '',
                flagged: false
            };
            const usePre = card.querySelector('.usePreCode').checked;
            if (usePre && card.aceEditorInstance) {
                q.preCode = card.aceEditorInstance.getValue();
            }
            questions.push(q);
        });

        clearAnswerStorage();
        switchScreen('exam');
        
        isUnlimitedTime = document.getElementById('noTimeLimit').checked;
        if (!isUnlimitedTime) {
            timeLeft = parseInt(document.getElementById('examTime').value, 10) * 60;
        }
        startTimer();
        
        currentQuestionIndex = 0;
        renderQuestion(currentQuestionIndex);
    }

    // --- Render Question ---
    function renderQuestion(index) {
        const examScreen = document.getElementById('examScreen');
        const q = questions[index];
        
        examScreen.innerHTML = `
            <div class="question-sidebar">
                <div class="q-info-block">
                    <h4>Question ${index + 1}</h4>
                    <span class="q-status" style="color:${q.answer ? 'green' : '#d9534f'}">${q.answer ? 'Answer saved' : 'Not complete'}</span>
                    <small style="display:block; margin-top:5px; color:#666;">Marked out of 1.00</small>
                    <div class="q-flag ${q.flagged ? 'flagged' : ''}" id="flagBtn">
                        <span style="font-size:1.2rem;">${q.flagged ? '⚑' : '⚐'}</span> 
                        ${q.flagged ? 'Remove flag' : 'Flag question'}
                    </div>
                </div>
            </div>

            <div class="exam-main-content">
                <div class="question-card-moodle">
                    <div class="q-text">${escapeHTML(q.text)}</div>
                    
                    ${q.images.length ? `<div class='question-images' style='display:flex; flex-direction:column; gap:10px;'>${q.images.map(src => `<img src='${src}' style='max-width:100%; border:1px solid #ccc;'>`).join('')}</div>` : ''}

                    <div style="margin-top:20px;">
                        <span class="answer-label">Answer: <small>(penalty regime: 0 %)</small></span>
                        <button class="btn-moodle-reset" id="resetBtn">Reset answer</button>
                        <div id="editorCurrent" class="editor" style="height:350px;"></div>
                    </div>
                    
                    <div style="margin-top:15px;">
                        <button class="btn-moodle-primary" id="checkBtn">Check</button>
                    </div>
                    
                    <div class="output" id="outputArea" style="background:#333; color:white; padding:10px; margin-top:10px; display:none; white-space:pre-wrap; font-family:monospace;"></div>
                </div>

                <div class="nav-buttons">
                    ${index > 0 ? `<button class="btn-moodle-secondary" id="prevBtn">Previous page</button>` : '<div></div>'}
                    ${index < questions.length - 1 
                        ? `<button class="btn-moodle-primary" id="nextBtn">Next page</button>` 
                        : `<button class="btn-moodle-secondary" id="finishBtn" style="background-color:#4a5568;">Finish attempt ...</button>`}
                </div>
            </div>
        `;

        const editor = createAceEditor('editorCurrent', q.answer || q.preCode);
        editor.on('change', () => {
            q.answer = editor.getValue();
            const statusEl = document.querySelector('.q-status');
            statusEl.textContent = "Answer saved";
            statusEl.style.color = "green";
        });

        const checkBtn = document.getElementById('checkBtn');
        const outDiv = document.getElementById('outputArea');

        if (!isPythonReady) {
            checkBtn.disabled = true;
            checkBtn.textContent = "Loading Python...";
            checkBtn.style.opacity = "0.6";
        }

        checkBtn.addEventListener('click', async () => {
            if (!isPythonReady) return;
            outDiv.style.display = 'block';
            outDiv.textContent = 'Running...';
            try {
                const output = await runPythonCode(editor.getValue());
                q.output = output;
                outDiv.textContent = output || "No output.";
            } catch (err) {
                outDiv.textContent = "Error: " + err.message;
            }
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            if(confirm("Reset answer?")) editor.setValue(q.preCode || '', 1);
        });

        document.getElementById('flagBtn').addEventListener('click', () => {
            q.flagged = !q.flagged;
            renderQuestion(index);
        });

        if(document.getElementById('prevBtn')) {
            document.getElementById('prevBtn').addEventListener('click', () => {
                currentQuestionIndex--;
                renderQuestion(currentQuestionIndex);
            });
        }
        if(document.getElementById('nextBtn')) {
            document.getElementById('nextBtn').addEventListener('click', () => {
                currentQuestionIndex++;
                renderQuestion(currentQuestionIndex);
            });
        }
        if(document.getElementById('finishBtn')) {
            document.getElementById('finishBtn').addEventListener('click', () => finishExam(false));
        }
    }

    function switchScreen(screenName) {
        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('examScreen').classList.add('hidden');
        document.getElementById('reviewScreen').classList.add('hidden');
        document.getElementById(`${screenName}Screen`).classList.remove('hidden');
    }

    function finishExam(force = false) {
        if (!force && !confirm('Finish attempt?')) return;
        if (timerId) clearTimeout(timerId);
        
        switchScreen('review');
        
        const reviewContent = document.getElementById('reviewContent');
        reviewContent.innerHTML = ''; 
        
        questions.forEach((q, i) => {
            const block = document.createElement('div');
            block.style.marginBottom = "30px";
            block.style.borderBottom = "1px solid #eee";
            block.style.paddingBottom = "20px";
            
            const reviewEditorId = `reviewEditor_${i}`;
            
            block.innerHTML = `
                <h4 style="color:#0f6c74; margin-bottom:10px;">Question ${i+1} ${q.flagged ? '<span style="color:red; font-size:1.2em;">⚑</span>' : ''}</h4>
                <div style="margin-bottom:10px; font-weight:bold;">Your Code:</div>
                <div id='${reviewEditorId}' class='editor' style='height:200px; border:1px solid #ccc;'></div>
                
                <div style="margin-top:10px; font-weight:bold;">Execution Output:</div>
                <pre style="background:#f5f5f5; padding:10px; border:1px solid #ddd; min-height:40px;">${q.output || "No execution recorded."}</pre>
            `;
            reviewContent.appendChild(block);
            createAceEditor(reviewEditorId, q.answer || q.preCode, true);
        });
    }

    function downloadJSON() {
        if(questions.length === 0) return alert("No answers to download.");
        const data = JSON.stringify(questions, null, 2);
        triggerDownload(new Blob([data], { type: "application/json" }), "huji_exam_answers.json");
    }

    function downloadAsPythonFile() {
        if(questions.length === 0) return alert("No answers to download.");
        let content = `"""\nHUJI EXAM SUBMISSION\nDate: ${new Date().toLocaleString()}\n"""\n\n`;
        questions.forEach((q, i) => {
            content += `# ==========================================\n`;
            content += `# QUESTION ${i + 1}\n`;
            content += `# ==========================================\n`;
            content += `# --- Code ---\n${q.answer}\n\n`;
            content += `# --- Output ---\n# ${ (q.output || "No output").replace(/\n/g, "\n# ") }\n\n\n`;
        });
        triggerDownload(new Blob([content], { type: "text/x-python" }), "huji_exam_submission.py");
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function startTimer() {
        const timerEl = document.getElementById('timer');
        if (isUnlimitedTime) {
            timerEl.textContent = "Time: ∞";
            return; 
        }
        function tick() {
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            timerEl.textContent = `Time left: ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            if (timeLeft > 0) {
                timeLeft--;
                timerId = setTimeout(tick, 1000);
            } else {
                finishExam(true);
            }
        }
        tick();
    }
});