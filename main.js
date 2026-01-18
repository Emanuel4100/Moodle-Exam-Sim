// main.js
import { initPyodideEngine, runPythonCode } from './modules/pyodide-engine.js';
import { applyTheme, escapeHTML, clearAnswerStorage, createAceEditor } from './modules/utils.js';

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const screens = {
        setup: document.getElementById('setupScreen'),
        exam: document.getElementById('examScreen'),
        review: document.getElementById('reviewScreen')
    };
    
    // --- State ---
    let questions = [];
    let timeLeft = 0;
    let timerId = null;
    let isUnlimitedTime = false; // דגל לזמן ללא הגבלה

    // --- Initialization ---
    const themeSelect = document.getElementById('themeSelect');
    themeSelect.addEventListener("change", e => applyTheme(e.target.value));
    applyTheme(localStorage.getItem("exam_theme") || "moodle");

    document.getElementById('addQuestion').addEventListener('click', () => addQuestionUI());
    document.getElementById('startExam').addEventListener('click', startExam);
    document.getElementById('finishExam').addEventListener('click', () => finishExam(false));
    
    // כפתורי הורדה
    document.getElementById('downloadAnswers').addEventListener('click', downloadJSON);
    document.getElementById('downloadText').addEventListener('click', downloadAsPythonFile);

    document.getElementById('restartFresh').addEventListener('click', () => {
        if(confirm("New Exam?")) location.reload();
    });

    initPyodideEngine().then(() => {
        console.log("Python engine loaded.");
    }).catch(err => {
        alert("Error loading Python engine.");
    });

    // הוספת שאלה ראשונה
    addQuestionUI();

    // --- Core Logic: Setup UI ---
    // שינינו את השם ל-addQuestionUI כי הוא עכשיו רק בונה את ה-DOM
    // המערך questions ייבנה מחדש רק כשמתחילים מבחן
    function addQuestionUI() {
        const questionsList = document.getElementById('questionsList');
        const count = questionsList.children.length; // מספר השאלות הנוכחי

        const div = document.createElement('div');
        div.classList.add('question-card');
        
        // יצירת מזהה ייחודי זמני לעורך
        const editorId = `preEditor_temp_${Date.now()}`;

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <label><strong>Question Setup</strong></label>
                <button class="remove-btn" style="background:#dc2626; font-size:0.8rem; padding:4px 8px; margin:0;">❌ Remove</button>
            </div>
            <textarea class='qText' dir='rtl' placeholder="Write question text here..."></textarea>
            
            <label>Images (select multiple):</label>
            <input type='file' class='qImage' accept='image/*' multiple> 
            <div class='imgPreview'></div>
            
            <label style="display:block; margin-top:8px;">
                <input type="checkbox" class="usePreCode" checked> Use pre-written starter code
            </label>
            <div id='${editorId}' class='editor small'></div>
        `;
        questionsList.appendChild(div);

        // --- Editor Setup ---
        const preEditor = createAceEditor(editorId);
        const usePreCheckbox = div.querySelector('.usePreCode');
        const editorContainer = div.querySelector(`#${editorId}`);
        
        // שמירת רפרנס לעורך על האלמנט עצמו כדי שנוכל לשלוף אותו אח"כ
        div.dataset.editorId = editorId; 
        div.aceEditorInstance = preEditor; 

        const syncPreVisibility = () => {
            editorContainer.style.display = usePreCheckbox.checked ? 'block' : 'none';
        };
        usePreCheckbox.addEventListener('change', syncPreVisibility);
        syncPreVisibility();

        // --- Image Logic ---
        // נשמור את התמונות במאפיין על האלמנט עצמו
        div.uploadedImages = [];
        
        div.querySelector('.qImage').addEventListener('change', e => {
            const files = Array.from(e.target.files);
            const previewDiv = div.querySelector('.imgPreview');
            div.uploadedImages = []; 
            previewDiv.innerHTML = ''; 
            
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = ev => {
                    div.uploadedImages.push(ev.target.result);
                    previewDiv.innerHTML += `<img src='${ev.target.result}' class='preview-thumb'>`;
                };
                reader.readAsDataURL(file);
            });
        });

        // --- פיצ'ר 1: מחיקת שאלה ---
        div.querySelector('.remove-btn').addEventListener('click', () => {
            // אם זו השאלה היחידה, לא נמחוק או שננקה אותה
            if (questionsList.children.length === 1) {
                alert("Cannot remove the last question.");
                return;
            }
            if(confirm("Remove this question?")) {
                div.remove();
            }
        });
    }

    // --- Core Logic: Start Exam ---
    function startExam() {
        // פיצ'ר 1 המשך: בניית המערך מחדש על סמך מה שנשאר במסך
        questions = [];
        const cards = document.querySelectorAll('.question-card');
        
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
            
            // שליפת הקוד מהעורך ששמרנו
            const usePre = card.querySelector('.usePreCode').checked;
            if (usePre && card.aceEditorInstance) {
                q.preCode = card.aceEditorInstance.getValue();
            }
            
            questions.push(q);
        });

        clearAnswerStorage();
        switchScreen('exam');
        
        // פיצ'ר 2: זמן ללא הגבלה
        isUnlimitedTime = document.getElementById('noTimeLimit').checked;
        if (!isUnlimitedTime) {
            timeLeft = parseInt(document.getElementById('examTime').value, 10) * 60;
        }
        
        startTimer();
        buildExamUI();
    }

    // --- Timer Logic ---
    function startTimer() {
        const timerEl = document.getElementById('timer');
        
        if (isUnlimitedTime) {
            timerEl.textContent = "∞ No Limit";
            timerEl.style.backgroundColor = "#dcfce7"; // צבע ירוק בהיר
            timerEl.style.color = "#166534";
            return; // לא מפעילים את ה-interval
        }

        function tick() {
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            if (timeLeft > 0) {
                timeLeft--;
                timerId = setTimeout(tick, 1000);
            } else {
                finishExam(true);
            }
        }
        tick();
    }

    function buildExamUI() {
        const tabsDiv = document.getElementById('tabs');
        const examContent = document.getElementById('examContent');
        tabsDiv.innerHTML = '';
        examContent.innerHTML = '';

        questions.forEach((q, i) => {
            // Tab
            const tab = document.createElement('div');
            tab.className = 'tab';
            tab.textContent = `Q${i + 1}`;
            tab.onclick = () => switchTab(i);
            tabsDiv.appendChild(tab);

            // Images
            const imagesHTML = q.images.length ? 
                `<div class='question-images'>${q.images.map(src => `<img src='${src}' class='question-img'>`).join('')}</div>` : '';

            // Content
            const section = document.createElement('div');
            section.className = 'question hidden';
            section.innerHTML = `
                <div class='question-block'>
                    <h3>Question ${i + 1}</h3>
                    <p class='question-text'>${escapeHTML(q.text)}</p>
                    ${imagesHTML}
                </div>
                <div class='answer-section'>
                    <div id='editor${i}' class='editor'></div>
                    <div class='buttons'>
                        <button class='reset-btn'>Reset</button>
                        <button class='check-btn'>Check</button>
                        <button class='flag-btn'>Flag</button>
                    </div>
                    <div class='output' id='output${i}'></div>
                </div>
            `;
            examContent.appendChild(section);
            initQuestionLogic(q, i, tab, section);
        });
        switchTab(0);
    }

    function initQuestionLogic(q, index, tab, section) {
        const editor = createAceEditor(`editor${index}`, q.preCode);
        const outDiv = section.querySelector('.output');
        q.answer = editor.getValue();

        editor.on('change', () => {
            q.answer = editor.getValue();
            localStorage.setItem(`q${index}_code`, q.answer);
        });

        section.querySelector('.check-btn').addEventListener('click', async () => {
            outDiv.textContent = 'Running...';
            try {
                const output = await runPythonCode(editor.getValue());
                q.output = output;
                outDiv.textContent = output || "No output.";
            } catch (err) {
                outDiv.textContent = "Error: " + err.message;
            }
        });

        section.querySelector('.reset-btn').addEventListener('click', () => {
            if(confirm("Reset answer?")) {
                editor.setValue(q.preCode || '', 1);
                outDiv.textContent = '';
            }
        });

        section.querySelector('.flag-btn').addEventListener('click', () => {
            q.flagged = !q.flagged;
            tab.classList.toggle('flagged', q.flagged);
        });
    }

    // --- Helper Functions ---
    function switchScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[screenName].classList.remove('hidden');
    }

    function switchTab(index) {
        document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === index));
        document.querySelectorAll('.question').forEach((q, i) => q.classList.toggle('hidden', i !== index));
    }

    function finishExam(force = false) {
        if (!force && !confirm('Finish exam?')) return;
        if (timerId) clearTimeout(timerId);
        switchScreen('review');
        
        const reviewContent = document.getElementById('reviewContent');
        reviewContent.innerHTML = '';
        
        questions.forEach((q, i) => {
            const block = document.createElement('div');
            block.className = 'question-block';
            block.innerHTML = `
                <h3>Q${i+1} ${q.flagged ? '(Flagged)' : ''}</h3>
                <div id='reviewEditor${i}' class='editor' style='height:200px'></div>
                <h4>Output:</h4>
                <div class='output'>${q.output || "Not executed."}</div>
            `;
            reviewContent.appendChild(block);
            createAceEditor(`reviewEditor${i}`, q.answer || q.preCode, true);
        });
    }

    function downloadJSON() {
        const data = JSON.stringify(questions, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        triggerDownload(blob, "exam_answers.json");
    }

    // --- פיצ'ר 3: הורדה כקובץ פייתון/טקסט ---
    function downloadAsPythonFile() {
        let content = `"""\nEXAM SUBMISSION\nGenerated by Moodle Exam Simulator\n"""\n\n`;

        questions.forEach((q, i) => {
            content += `# ==========================================\n`;
            content += `# QUESTION ${i + 1}\n`;
            content += `# ==========================================\n`;
            content += `"""\n${q.text.replace(/"/g, "'")}\n"""\n\n`;
            
            content += `# --- Your Code: ---\n`;
            content += `${q.answer}\n\n`;
            
            content += `# --- Execution Output: ---\n`;
            // הופך את הפלט להערות כדי שהקובץ יהיה פייתון תקין
            const commentedOutput = (q.output || "No output").split('\n').map(line => `# ${line}`).join('\n');
            content += `${commentedOutput}\n\n\n`;
        });

        const blob = new Blob([content], { type: "text/x-python" });
        triggerDownload(blob, "exam_submission.py");
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
});