// main.js
import { initPyodideEngine, runPythonCode } from './modules/pyodide-engine.js';
import { applyTheme, escapeHTML, clearAnswerStorage, createAceEditor } from './modules/utils.js';

document.addEventListener("DOMContentLoaded", async () => {
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

    // --- Initialization ---
    await initPyodideEngine();
    
    const themeSelect = document.getElementById('themeSelect');
    themeSelect.addEventListener("change", e => applyTheme(e.target.value));
    applyTheme(localStorage.getItem("exam_theme") || "moodle");

    // --- Core Logic: Add Question ---
    function addQuestion() {
        const q = { text: '', images: [], preCode: '', answer: '', output: '', flagged: false };
        questions.push(q);
        const idx = questions.length - 1;

        const div = document.createElement('div');
        div.classList.add('question-card');
        div.innerHTML = `
            <label>Question ${idx + 1} Text:</label>
            <textarea class='qText' dir='rtl'></textarea>
            <label>Images (select multiple):</label>
            <input type='file' class='qImage' accept='image/*' multiple> 
            <div class='imgPreview'></div>
            <label style="display:block; margin-top:8px;">
                <input type="checkbox" class="usePreCode" checked> Use pre-written starter code
            </label>
            <div id='preEditor${idx}' class='editor small'></div>
        `;
        document.getElementById('questionsList').appendChild(div);

        // Setup Editor
        const preEditor = createAceEditor(`preEditor${idx}`);
        const usePreCheckbox = div.querySelector('.usePreCode');
        
        // Event Listeners for this question setup
        const syncPreVisibility = () => {
            div.querySelector(`#preEditor${idx}`).style.display = usePreCheckbox.checked ? 'block' : 'none';
            q.preCode = usePreCheckbox.checked ? preEditor.getValue() : '';
        };
        usePreCheckbox.addEventListener('change', syncPreVisibility);
        preEditor.session.on('change', () => { if(usePreCheckbox.checked) q.preCode = preEditor.getValue(); });
        syncPreVisibility();

        // Image Logic
        div.querySelector('.qImage').addEventListener('change', e => {
            const files = Array.from(e.target.files);
            const previewDiv = div.querySelector('.imgPreview');
            q.images = []; 
            previewDiv.innerHTML = ''; 
            
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = ev => {
                    q.images.push(ev.target.result);
                    previewDiv.innerHTML += `<img src='${ev.target.result}' class='preview-thumb'>`;
                };
                reader.readAsDataURL(file);
            });
        });
    }

    // --- Core Logic: Exam ---
    function startExam() {
        // Collect Texts
        const cards = document.querySelectorAll('.question-card');
        cards.forEach((card, i) => questions[i].text = card.querySelector('.qText').value);

        if (!questions.length) return alert('Add at least one question.');

        clearAnswerStorage();
        switchScreen('exam');
        
        // Timer Setup
        timeLeft = parseInt(document.getElementById('examTime').value, 10) * 60;
        startTimer();
        
        // Build UI
        buildExamUI();
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

            // Images HTML
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

            // Logic for specific question
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

    function startTimer() {
        const timerEl = document.getElementById('timer');
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

    function finishExam(force = false) {
        if (!force && !confirm('Finish exam?')) return;
        clearTimeout(timerId);
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

    // --- Global Buttons ---
    document.getElementById('addQuestion').addEventListener('click', addQuestion);
    document.getElementById('startExam').addEventListener('click', startExam);
    document.getElementById('finishExam').addEventListener('click', () => finishExam(false));
    
    document.getElementById('restartFresh').addEventListener('click', () => {
        if(confirm("New Exam?")) location.reload();
    });
    
    // Start with one question
    addQuestion();
});