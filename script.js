document.addEventListener("DOMContentLoaded", async () => {
  const setupScreen = document.getElementById('setupScreen');
  const examScreen = document.getElementById('examScreen');
  const reviewScreen = document.getElementById('reviewScreen');
  const questionsList = document.getElementById('questionsList');
  const tabsDiv = document.getElementById('tabs');
  const examContent = document.getElementById('examContent');
  const timerEl = document.getElementById('timer');
  const examTimeInput = document.getElementById('examTime');
  const themeSelect = document.getElementById('themeSelect');
  const reviewContent = document.getElementById('reviewContent');
  const downloadBtn = document.getElementById('downloadAnswers');
  const restartSameBtn = document.getElementById('restartSame');
  const restartFreshBtn = document.getElementById('restartFresh');

  let questions = [];
  let currentQuestion = 0;
  let timeLeft = 0;
  let pyodide = null;
  let timerId = null; 


  function applyTheme(theme) {
    document.body.className = theme;
    localStorage.setItem("exam_theme", theme);
  }

  function clearAnswerStorage() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('q') && key.endsWith('_code')) {
        localStorage.removeItem(key);
      }
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Theme ----------

  themeSelect.addEventListener("change", e => applyTheme(e.target.value));
  applyTheme(localStorage.getItem("exam_theme") || "moodle");

  // ---------- Pyodide ----------

  async function initPyodide() {
    pyodide = await loadPyodide();
    console.log("Pyodide ready ✅");
  }
  await initPyodide();

  // ---------- Setup: Add Question ----------

function addQuestion() {
    // שינוי: images הוא מערך
    const q = { text: '', images: [], preCode: '', answer: '', output: '', flagged: false };
    questions.push(q);
    const i = questions.length - 1;

    const div = document.createElement('div');
    div.classList.add('question-card');
    
    // שינוי: הוספתי multiple ל-input ושיניתי את הטקסט
    div.innerHTML = `
      <label>Question ${i + 1} Text:</label>
      <textarea class='qText' dir='rtl'></textarea>
      <label>Images (optional - select multiple):</label>
      <input type='file' class='qImage' accept='image/*' multiple> 
      <div class='imgPreview'></div>
      <label style="display:block; margin-top:8px;">
        <input type="checkbox" class="usePreCode" checked>
        Use pre-written starter code
      </label>
      <div id='preEditor${i}' class='editor small'></div>
    `;
    questionsList.appendChild(div);

    const usePreCheckbox = div.querySelector('.usePreCode');

    // Pre-written code editor logic (ללא שינוי)
    const preEditor = ace.edit(`preEditor${i}`);
    preEditor.setTheme('ace/theme/monokai');
    preEditor.session.setMode('ace/mode/python');
    preEditor.setValue('', 1);
    preEditor.setFontSize(16);

    function syncPreVisibility() {
      if (usePreCheckbox.checked) {
        preEditor.container.style.display = 'block';
        q.preCode = preEditor.getValue();
      } else {
        preEditor.container.style.display = 'none';
        q.preCode = '';
      }
    }

    preEditor.session.on('change', () => {
      if (usePreCheckbox.checked) {
        q.preCode = preEditor.getValue();
      }
    });

    usePreCheckbox.addEventListener('change', syncPreVisibility);
    syncPreVisibility();

    // Image upload logic - תומך בריבוי תמונות
    const fileInput = div.querySelector('.qImage');
    const previewDiv = div.querySelector('.imgPreview');

    fileInput.addEventListener('change', e => {
      const files = Array.from(e.target.files); // המרה למערך
      if (!files.length) return;
      
      // איפוס אם רוצים להחליף את הסט הקיים (או שאפשר להוסיף, כאן זה מחליף את הסט הקודם בבחירה חדשה)
      q.images = []; 
      previewDiv.innerHTML = ''; 

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          const result = ev.target.result;
          q.images.push(result); // דחיפה למערך
          // הוספת תמונה לתצוגה המקדימה
          const img = document.createElement('img');
          img.src = result;
          img.classList.add('preview-thumb');
          previewDiv.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  function startExam() {
    const cards = questionsList.querySelectorAll('.question-card');
    cards.forEach((card, i) => {
      questions[i].text = card.querySelector('.qText').value;
    });

    if (questions.length === 0) {
      alert('Add at least one question.');
      return;
    }

    clearAnswerStorage();
    console.log("Previous exam answers cleared at start.");

    setupScreen.classList.add('hidden');
    examScreen.classList.remove('hidden');

    timeLeft = parseInt(examTimeInput.value, 10) * 60;
    startTimer();
    buildExamTabs();
    switchTab(0);
  }

  function startTimer() {
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


  function buildExamTabs() {
    tabsDiv.innerHTML = '';
    examContent.innerHTML = '';

    questions.forEach((q, i) => {
      // Tab
      const tab = document.createElement('div');
      tab.className = 'tab';
      tab.textContent = `Q${i + 1}`;
      if (q.flagged) tab.classList.add('flagged');
      tab.addEventListener('click', () => switchTab(i));
      tabsDiv.appendChild(tab);

      // יצירת ה-HTML של התמונות
      let imagesHTML = '';
      if (q.images && q.images.length > 0) {
        imagesHTML = `<div class='question-images'>
          ${q.images.map(src => `<img src='${src}' class='question-img'>`).join('')}
        </div>`;
      } 
      // תמיכה לאחור בגרסאות ישנות (אם הייתה רק תמונה אחת)
      else if (q.image) {
         imagesHTML = `<div class='question-images'><img src='${q.image}' class='question-img'></div>`;
      }

      // Question / answer block
      const section = document.createElement('div');
      section.className = 'question hidden';
      section.innerHTML = `
        <div class='question-block'>
          <h3>Question ${i + 1}</h3>
          <p class='question-text'>${escapeHTML(q.text)}</p>
          ${imagesHTML}
        </div>
        <div class='answer-section'>
          <h4>Answer:</h4>
          <div id='editor${i}' class='editor'></div>
          <div class='buttons'>
            <button class='reset-btn'>Reset answer</button>
            <button class='check-btn'>Check</button>
            <button class='flag-btn'>Flag</button>
          </div>
          <div class='output' id='output${i}'></div>
        </div>
      `;
      examContent.appendChild(section);

      // Attach editor & buttons
      initExamQuestionControls(q, i, tab, section);
    });
  }

  function initExamQuestionControls(question, index, tabEl, sectionEl) {
    const editor = ace.edit(`editor${index}`);
    editor.setTheme('ace/theme/monokai');
    editor.session.setMode('ace/mode/python');
    editor.setFontSize(16);
    editor.setValue(question.preCode || '', 1);

    question.answer = editor.getValue();

    const resetBtn = sectionEl.querySelector('.reset-btn');
    const checkBtn = sectionEl.querySelector('.check-btn');
    const flagBtn = sectionEl.querySelector('.flag-btn');
    const outDiv = sectionEl.querySelector('.output');

    function updateFlagUI() {
      if (question.flagged) {
        tabEl.classList.add('flagged');
        flagBtn.textContent = "Unflag";
      } else {
        tabEl.classList.remove('flagged');
        flagBtn.textContent = "Flag";
      }
    }

    editor.on('change', () => {
      question.answer = editor.getValue();
      localStorage.setItem(`q${index}_code`, question.answer);
    });

    resetBtn.addEventListener('click', () => {
      if (!confirm("Reset this answer?")) return;
      editor.setValue(question.preCode || '', 1);
      question.answer = question.preCode || '';
      question.output = '';
      localStorage.removeItem(`q${index}_code`);
      outDiv.textContent = '';
    });

    checkBtn.addEventListener('click', async () => {
      outDiv.textContent = 'Running...';
      try {
        const code = editor.getValue();
        question.answer = code;
        localStorage.setItem(`q${index}_code`, code);

        pyodide.runPython(`import io, sys; sys.stdout = io.StringIO()`);
        await pyodide.runPythonAsync(code);
        const stdout = pyodide.runPython("sys.stdout.getvalue()");

        let lastResult = "";
        try {
          const lastLine = code.split('\n').filter(Boolean).pop() || "";
          lastResult = lastLine
            ? await pyodide.runPythonAsync(`_ = (${lastLine})\n_`)
            : "";
        } catch {
          
        }

        const combined = (stdout + (lastResult ? `\n${lastResult}` : '')).trim();
        question.output = combined;
        outDiv.textContent = combined || "No output.";
      } catch (err) {
        outDiv.textContent = "Error: " + err;
      }
    });

    flagBtn.addEventListener('click', () => {
      question.flagged = !question.flagged;
      updateFlagUI();
    });

    updateFlagUI();
  }


  function switchTab(i) {
    currentQuestion = i;
    document.querySelectorAll('.tab').forEach((t, idx) =>
      t.classList.toggle('active', idx === i)
    );
    document.querySelectorAll('.question').forEach((q, idx) =>
      q.classList.toggle('hidden', idx !== i)
    );
  }

  function lockExam(message) {
    examScreen.querySelectorAll('button').forEach(b => (b.disabled = true));
    timerEl.textContent = message;
  }


  function finishExam(force = false) {
    if (!force && !confirm('Finish exam and review?')) return;
    
    if (timerId) clearTimeout(timerId);

    if (force) alert("Time is up! Exam finished.");

    lockExam('Exam finished');
    examScreen.classList.add('hidden');
    reviewScreen.classList.remove('hidden');

    clearAnswerStorage();
    buildReview();
  }

  function buildReview() {
    reviewContent.innerHTML = '';

    questions.forEach((q, i) => {
      let imagesHTML = '';
      if (q.images && q.images.length > 0) {
        imagesHTML = `<div class='question-images'>
          ${q.images.map(src => `<img src='${src}' class='question-img'>`).join('')}
        </div>`;
      } else if (q.image) {
         imagesHTML = `<div class='question-images'><img src='${q.image}' class='question-img'></div>`;
      }

      const block = document.createElement('div');
      block.className = 'question-block';
      block.innerHTML = `
        <h3>Question ${i + 1} ${q.flagged ? '(Flagged)' : ''}</h3>
        <p class='question-text'>${escapeHTML(q.text)}</p>
        ${imagesHTML}
        <h4>Your Answer:</h4>
        <div id='reviewEditor${i}' class='editor'></div>
        <h4>Output:</h4>
        <div class='output'>${q.output || "Not executed."}</div>
      `;
      reviewContent.appendChild(block);

      const reviewEditor = ace.edit(`reviewEditor${i}`);
      reviewEditor.setTheme('ace/theme/monokai');
      reviewEditor.session.setMode('ace/mode/python');
      reviewEditor.setValue(q.answer || q.preCode || '', 1); // כאן תוקן הבאג של הצגת תשובה ריקה
      reviewEditor.setReadOnly(true);
      reviewEditor.setFontSize(16);
    });
  }


  function downloadAnswers() {
    const data = JSON.stringify(questions, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exam_answers.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function restartSameExam() {
    if (!confirm("Restart the same exam with answers cleared?")) return;

    questions.forEach((q, i) => {
      q.answer = '';
      q.output = '';
      q.flagged = false;
      localStorage.removeItem(`q${i}_code`);
    });

    reviewScreen.classList.add('hidden');
    examScreen.classList.remove('hidden');

    timeLeft = parseInt(examTimeInput.value, 10) * 60;
    startTimer();
    buildExamTabs();
    switchTab(0);
  }

  function restartFreshExam() {
    if (!confirm("Start a completely new exam and clear everything?")) return;

    questions = [];
    questionsList.innerHTML = '';
    tabsDiv.innerHTML = '';
    examContent.innerHTML = '';
    reviewContent.innerHTML = '';

    clearAnswerStorage();

    reviewScreen.classList.add('hidden');
    examScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');

    addQuestion();
  }


  addQuestion();
  document.getElementById('addQuestion').addEventListener('click', addQuestion);
  document.getElementById('startExam').addEventListener('click', startExam);
  
  document.getElementById('finishExam').addEventListener('click', () => finishExam(false));
  
  downloadBtn.addEventListener('click', downloadAnswers);
  restartSameBtn.addEventListener('click', restartSameExam);
  restartFreshBtn.addEventListener('click', restartFreshExam);
});