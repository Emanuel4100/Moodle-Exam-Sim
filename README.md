# Moodle Exam Simulator

This project is a local web-based environment that simulates the experience of taking a Moodle-style coding exam.  
It allows you to write, run, and review code directly in the browser using a built-in Python interpreter (Pyodide).  
The goal is to provide a realistic practice setup for computer science exams that use open-code questions.

## Features

- Multiple questions per exam, each with its own text, image, and optional starter code.
- Right-to-left support for Hebrew questions.
- Python code editor with syntax highlighting (Ace Editor).
- Shared timer across all questions.
- Ability to flag questions for later review.
- Run code directly in the browser (no server required).
- Automatic saving during the exam.
- Review screen showing all answers and program outputs after finishing.
- Options to restart the same exam or start a new one from scratch.
- Configurable themes (Moodle, light, dark).

## Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/moodle-exam-simulator.git
   cd moodle-exam-simulator
