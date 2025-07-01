// TODO: Nahraďte následující konfigurační údaje vašimi vlastními z Firebase konzoly!
const firebaseConfig = {
    apiKey: "AIzaSyAbeLxHKyRmhqQDwm8shvoiTZGKT8IjwHM",
    authDomain: "kvizomat-288d0.firebaseapp.com",
    databaseURL: "https://kvizomat-288d0-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "kvizomat-288d0",
    storageBucket: "kvizomat-288d0.firebasestorage.app",
    messagingSenderId: "427745601590",
    appId: "1:427745601590:web:5a6882d3a7a55a9ee41097"
  };

// Inicializace Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Globální proměnné
let currentQuestion = null;
let currentUser = {
    name: null, pin: null, id: null,
    score: 0, streak: 0, lastAnswerDate: null, lastStreakDate: null,
};
const quizStartDate = new Date('2025-07-01T00:00:00');
let allQuestionsFromDB = [];
const QUESTION_TIME_LIMIT = 20;
let questionTimerInterval = null;

// Elementy DOM
const userSetupDiv = document.getElementById('user-setup');
const usernameInput = document.getElementById('username');
const pinInput = document.getElementById('pin');
const saveUsernameButton = document.getElementById('saveUsername');
const quizAreaDiv = document.getElementById('quiz-area');
const leaderboardAreaDiv = document.getElementById('leaderboard-area');
const questionTextEl = document.getElementById('question-text');
const optionsContainerEl = document.getElementById('options-container');
const submitAnswerButton = document.getElementById('submit-answer');
const feedbackEl = document.getElementById('feedback');
const leaderboardBody = document.getElementById('leaderboard').getElementsByTagName('tbody')[0];
const currentDateEl = document.getElementById('current-date');
const dayNumberDisplayEl = document.getElementById('day-number-display');
const nextQuestionTimerDiv = document.getElementById('next-question-timer');
const timerEl = document.getElementById('timer');
const startMessageEl = document.getElementById('start-message');
const changeAccountButton = document.getElementById('change-account-btn');
const motivationSection = document.getElementById('motivation-section');
const adminControlsDiv = document.getElementById('admin-controls');
const resetLeaderboardBtn = document.getElementById('reset-leaderboard-btn');
const archiveWinnerBtn = document.getElementById('archive-winner-btn');
const hallOfFameArea = document.getElementById('hall-of-fame-area');
const hallOfFameBody = document.getElementById('hall-of-fame-body');
const quizInfoBar = document.getElementById('quiz-info-bar');
const timerProgressBar = document.getElementById('timer-progress-bar');
const questionTimerText = document.getElementById('question-timer-text');
const streakDisplay = document.getElementById('streak-display');
const currentStreakEl = document.getElementById('current-streak');

// --- Logika pro uživatele ---
saveUsernameButton.addEventListener('click', () => processUserLogin(true));
changeAccountButton.addEventListener('click', () => {
    localStorage.clear();
    resetUIForLogout();
});

function resetUIForLogout() {
    currentUser = { name: null, pin: null, id: null, score: 0, streak: 0, lastAnswerDate: null, lastStreakDate: null };

    // Skrýt všechny herní sekce
    quizAreaDiv.style.display = 'none';
    leaderboardAreaDiv.style.display = 'none';
    hallOfFameArea.style.display = 'none';
    motivationSection.style.display = 'none';
    adminControlsDiv.style.display = 'none';
    changeAccountButton.style.display = 'none';

    // Zobrazit přihlašovací formulář
    userSetupDiv.style.display = 'block';
    startMessageEl.style.display = 'block';
    usernameInput.value = '';
    pinInput.value = '';
}

async function processUserLogin(isNewLogin = false) {
    if (isNewLogin) {
        const rawUsername = usernameInput.value.trim();
        const pin = pinInput.value.trim();
        if (!rawUsername || !/^\d{4}$/.test(pin)) {
            alert('Prosím, zadejte platné jméno a 4místný PIN.');
            return;
        }
        currentUser.name = rawUsername;
        currentUser.pin = pin;
        currentUser.id = rawUsername.replace(/[.#$[\]]/g, '_') + '_' + pin;
        localStorage.setItem('quizUsername', currentUser.name);
        localStorage.setItem('quizUserPin', currentUser.pin);
        localStorage.setItem('quizUserId', currentUser.id);
    }
    
    if (!currentUser.id) { userSetupDiv.style.display = 'block'; return; }
    
    try {
        const userRef = db.ref('users/' + currentUser.id);
        const snapshot = await userRef.once('value');
        if (snapshot.exists()) {
            const data = snapshot.val();
            currentUser.score = data.score || 0;
            currentUser.lastAnswerDate = data.lastAnswerDate ? new Date(data.lastAnswerDate) : null;
            currentUser.streak = data.streak || 0;
            currentUser.lastStreakDate = data.lastStreakDate ? new Date(data.lastStreakDate) : null;
        } else {
             await userRef.set({ name: currentUser.name, score: 0, streak: 0, lastAnswerDate: null, lastStreakDate: null });
        }

        userSetupDiv.style.display = 'none';
        motivationSection.style.display = 'block';
        quizAreaDiv.style.display = 'block';
        leaderboardAreaDiv.style.display = 'block';
        hallOfFameArea.style.display = 'block';
        changeAccountButton.style.display = 'block';
        startMessageEl.style.display = 'none';

        if (currentUser.name === 'Kuba') { adminControlsDiv.style.display = 'flex'; }

        listenForLeaderboardUpdates();
        loadHallOfFame();
        loadTodaysQuestion();
        updateStreakDisplay();

    } catch (error) {
        console.error("Chyba při přihlašování: ", error);
        alert("Chyba při komunikaci s databází.");
    }
}

async function updateUser(updates) {
    if (!currentUser.id) return;
    await db.ref('users/' + currentUser.id).update(updates);
}

// --- Logika pro otázky a časovač ---
function loadTodaysQuestion() {
    const today = new Date();
    currentDateEl.innerHTML = `<i class="far fa-calendar-alt"></i> ${today.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    const dayNumber = getDayNumber(quizStartDate, today);
    dayNumberDisplayEl.textContent = `Den kvízu: ${dayNumber + 1}`;

    if (hasUserAnsweredToday()) {
        displayAlreadyAnswered();
        return;
    }
    
    currentQuestion = allQuestionsFromDB.find(q => q.day === dayNumber);
    if (currentQuestion) {
        displayQuestion(currentQuestion);
        startQuestionTimer();
    } else {
        displayNoQuestion();
    }
}

function displayQuestion(question) {
    questionTextEl.innerHTML = `<i class="fas fa-question-circle"></i> ${question.text}`;
    optionsContainerEl.innerHTML = "";
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.innerHTML = option;
        button.addEventListener('click', () => selectOption(button));
        optionsContainerEl.appendChild(button);
    });
    quizInfoBar.style.display = 'flex';
    submitAnswerButton.style.display = 'block';
    submitAnswerButton.disabled = true;
    feedbackEl.style.display = 'none';
    nextQuestionTimerDiv.style.display = 'none';
}

function startQuestionTimer() {
    clearInterval(questionTimerInterval);

    // Reset progress baru
    timerProgressBar.style.transition = 'none';
    timerProgressBar.style.width = '100%';
    timerProgressBar.style.backgroundColor = 'var(--timer-start-color)';
    
    // Nucený reflow pro zajištění, že se transition aplikuje správně
    void timerProgressBar.offsetWidth; 

    // Start animace a odpočtu
    timerProgressBar.style.transition = `width ${QUESTION_TIME_LIMIT}s linear, background-color 5s linear`;
    timerProgressBar.style.width = '0%';
    timerProgressBar.style.backgroundColor = 'var(--timer-end-color)';

    let timeLeft = QUESTION_TIME_LIMIT;
    questionTimerText.textContent = timeLeft;

    questionTimerInterval = setInterval(() => {
        timeLeft--;
        questionTimerText.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(questionTimerInterval);
            handleTimeUp();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(questionTimerInterval);
    const computedStyle = window.getComputedStyle(timerProgressBar);
    const currentWidth = computedStyle.getPropertyValue('width');
    timerProgressBar.style.transition = 'none';
    timerProgressBar.style.width = currentWidth;
}

function handleTimeUp() {
    feedbackEl.innerHTML = `<i class="fas fa-clock"></i> Čas vypršel! Správná odpověď byla: <strong>${currentQuestion.correctAnswer}</strong>`;
    feedbackEl.className = 'feedback-message incorrect';
    feedbackEl.style.display = 'block';
    
    const todayISO = new Date().toISOString();
    currentUser.lastAnswerDate = new Date(todayISO);
    currentUser.streak = 0;
    
    updateUser({ lastAnswerDate: todayISO, streak: 0 });

    optionsContainerEl.querySelectorAll('button').forEach(btn => btn.disabled = true);
    submitAnswerButton.style.display = 'none';
    showNextQuestionTimer();
    updateStreakDisplay();
}

submitAnswerButton.addEventListener('click', handleSubmitAnswer);

function handleSubmitAnswer() {
    stopTimer();
    const selectedOptionButton = optionsContainerEl.querySelector('button.selected');
    if (!selectedOptionButton) return;

    const userAnswer = selectedOptionButton.textContent;
    const isCorrect = userAnswer === currentQuestion.correctAnswer;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let updates = { lastAnswerDate: today.toISOString() };

    if (isCorrect) {
        feedbackEl.innerHTML = `<i class="fas fa-check-circle"></i> Správně! Skvělá práce!`;
        feedbackEl.className = 'feedback-message correct';
        currentUser.score++;
        updates.score = currentUser.score;

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const lastStreakDay = currentUser.lastStreakDate ? new Date(currentUser.lastStreakDate) : null;
        if (lastStreakDay && lastStreakDay.getTime() === yesterday.getTime()) {
            currentUser.streak++;
        } else {
            currentUser.streak = 1;
        }
        updates.streak = currentUser.streak;
        updates.lastStreakDate = today.toISOString();
        currentUser.lastStreakDate = today;

    } else {
        feedbackEl.innerHTML = `<i class="fas fa-times-circle"></i> Špatně. Správná odpověď: <strong>${currentQuestion.correctAnswer}</strong>`;
        feedbackEl.className = 'feedback-message incorrect';
        currentUser.streak = 0;
        updates.streak = 0;
    }

    updateUser(updates);
    currentUser.lastAnswerDate = today;

    optionsContainerEl.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === currentQuestion.correctAnswer) btn.classList.add('correct');
        else if (btn.classList.contains('selected')) btn.classList.add('incorrect');
    });

    submitAnswerButton.style.display = 'none';
    feedbackEl.style.display = 'block';
    showNextQuestionTimer();
    updateStreakDisplay();
}

// --- Funkce pro Sérii, Síň slávy a Admin ---
function updateStreakDisplay() {
    currentStreakEl.textContent = currentUser.streak;
    streakDisplay.classList.toggle('active', currentUser.streak > 0);
}

async function loadHallOfFame() {
    db.ref('hallOfFame').orderByChild('timestamp').on('value', (snapshot) => {
        hallOfFameBody.innerHTML = "";
        if (!snapshot.exists()) {
            hallOfFameBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Síň slávy je zatím prázdná. 🏆</td></tr>`;
            return;
        }
        
        let winnersData = [];
        snapshot.forEach(child => { winnersData.push(child.val()); });

        const winCounts = winnersData.reduce((acc, winner) => {
            acc[winner.name] = (acc[winner.name] || 0) + 1;
            return acc;
        }, {});
        
        winnersData.reverse().forEach(winner => {
            const wins = winCounts[winner.name] > 1 ? ` (${winCounts[winner.name]}x vítěz)` : '';
            const row = hallOfFameBody.insertRow();
            row.innerHTML = `<td>${winner.month}</td><td>${winner.name} ${wins}</td><td>${winner.score}</td>`;
        });
    });
}

async function archiveWinner() {
    const monthYear = prompt("Zadejte název měsíce a rok pro archivaci (např. 'Červenec 2025'):");
    if (!monthYear) return;

    const usersRef = db.ref('users').orderByChild('score').limitToLast(1);
    const snapshot = await usersRef.once('value');
    if (!snapshot.exists()) { alert("Nenalezen žádný hráč k archivaci."); return; }

    const winnerData = Object.values(snapshot.val())[0];
    const newEntry = {
        month: monthYear, name: winnerData.name, score: winnerData.score,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    await db.ref('hallOfFame').push(newEntry);
    alert(`Vítěz ${winnerData.name} s ${winnerData.score} body byl archivován pro ${monthYear}.`);
}
if(archiveWinnerBtn) archiveWinnerBtn.addEventListener('click', archiveWinner);

async function resetLeaderboard() {
    if (!confirm("Opravdu resetovat celou tabulku a série všech hráčů? Tato akce je nevratná.")) return;
    const snapshot = await db.ref('users').once('value');
    if (snapshot.exists()) {
        const updates = {};
        snapshot.forEach(child => {
            updates[`/${child.key}/score`] = 0;
            updates[`/${child.key}/streak`] = 0;
            updates[`/${child.key}/lastAnswerDate`] = null;
            updates[`/${child.key}/lastStreakDate`] = null;
        });
        await db.ref('users').update(updates);
        alert("Tabulka byla úspěšně resetována.");
        resetUIForLogout();
    }
}
if(resetLeaderboardBtn) resetLeaderboardBtn.addEventListener('click', resetLeaderboard);


// --- Pomocné funkce a Inicializace ---
function hasUserAnsweredToday() {
    if (!currentUser.lastAnswerDate) return false;
    const lastAnswerDay = new Date(currentUser.lastAnswerDate);
    lastAnswerDay.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return lastAnswerDay.getTime() === today.getTime();
}

function displayAlreadyAnswered() {
    questionTextEl.innerHTML = `<i class="fas fa-check-circle"></i> Dnešní otázku jsi již zodpověděl/a. Uvidíme se zítra!`;
    optionsContainerEl.innerHTML = "";
    submitAnswerButton.style.display = 'none';
    quizInfoBar.style.display = 'flex';
    showNextQuestionTimer();
}

function displayNoQuestion() {
     questionTextEl.innerHTML = `<i class="fas fa-ghost"></i> Pro dnešek bohužel nemáme otázku. Zkus to zítra!`;
     optionsContainerEl.innerHTML = "";
     submitAnswerButton.style.display = 'none';
     quizInfoBar.style.display = 'none';
     showNextQuestionTimer();
}

function getDayNumber(startDate, currentDate) {
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const current = new Date(currentDate); current.setHours(0,0,0,0);
    return Math.floor((current - start) / (1000 * 60 * 60 * 24));
}

function selectOption(selectedButton) {
    optionsContainerEl.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
    selectedButton.classList.add('selected');
    submitAnswerButton.disabled = false;
}

function showNextQuestionTimer() {
    nextQuestionTimerDiv.style.display = 'block';
    const interval = setInterval(() => {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const diff = tomorrow - now;
        if(diff <= 0) { clearInterval(interval); location.reload(); return; }
        const h = Math.floor(diff / (1000*60*60));
        const m = Math.floor((diff / 1000/60) % 60);
        const s = Math.floor((diff/1000) % 60);
        timerEl.textContent = `${h}h ${m}m ${s}s`;
    }, 1000);
}

function listenForLeaderboardUpdates() {
    db.ref('users').orderByChild('score').on('value', (snapshot) => {
        let users = [];
        snapshot.forEach(child => { users.push(child.val()); });
        leaderboardBody.innerHTML = "";
        users.reverse().slice(0, 10).forEach((user, index) => {
            const rank = index + 1;
            const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
            const row = leaderboardBody.insertRow();
            row.innerHTML = `<td>${rankIcon}</td><td>${user.name}</td><td>${user.score}</td>`;
        });
    });
}

async function fetchQuestionsFromDB() {
    try {
        const snapshot = await db.ref('questions').once('value');
        if (snapshot.exists()) { allQuestionsFromDB = Object.values(snapshot.val()).filter(Boolean); }
    } catch (error) { console.error("Chyba při načítání otázek z Firebase:", error); }
}

async function init() {
    console.log("Inicializace aplikace...");
    await fetchQuestionsFromDB();
    currentUser.name = localStorage.getItem('quizUsername');
    currentUser.pin = localStorage.getItem('quizUserPin');
    currentUser.id = localStorage.getItem('quizUserId');
    if (currentUser.id) { await processUserLogin(); } 
    else { userSetupDiv.style.display = 'block'; }
}

document.addEventListener('DOMContentLoaded', init);