// --- Firebase & Globální proměnné ---
const firebaseConfig = {
    apiKey: "AIzaSyAbeLxHKyRmhqQDwm8shvoiTZGKT8IjwHM",
    authDomain: "kvizomat-288d0.firebaseapp.com",
    databaseURL: "https://kvizomat-288d0-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "kvizomat-288d0",
    storageBucket: "kvizomat-288d0.firebasestorage.app",
    messagingSenderId: "427745601590",
    appId: "1:427745601590:web:5a6882d3a7a55a9ee41097"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentQuestion = null;
let currentUser = { name: null, pin: null, id: null, score: 0, streak: 0, lastAnswerDate: null, lastStreakDate: null, lastAnswerCorrect: null };
const quizStartDate = new Date('2026-01-01T00:00:00');
let allQuestionsFromDB = [];
const QUESTION_TIME_LIMIT = 30;
let questionTimerInterval = null;

// Elementy DOM
const welcomeSection = document.getElementById('welcome-section');
const usernameInput = document.getElementById('username');
const pinInput = document.getElementById('pin');
const saveUsernameButton = document.getElementById('saveUsername');
const quizAreaDiv = document.getElementById('quiz-area');
const leaderboardAreaDiv = document.getElementById('leaderboard-area');
const questionTextEl = document.getElementById('question-text');
const optionsContainerEl = document.getElementById('options-container');
const submitAnswerButton = document.getElementById('submit-answer');
const feedbackEl = document.getElementById('feedback');
const explainAnswerContainer = document.getElementById('explain-answer-container');
const explainAnswerBtn = document.getElementById('explain-answer-btn');
const leaderboardBody = document.getElementById('leaderboard').getElementsByTagName('tbody')[0];
const currentDateEl = document.getElementById('current-date');
const dayNumberDisplayEl = document.getElementById('day-number-display');
const nextQuestionTimerDiv = document.getElementById('next-question-timer');
const timerEl = document.getElementById('timer');
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
const archiveModal = document.getElementById('archive-modal');
const pinResetModal = document.getElementById('pin-reset-modal');
const confirmArchiveBtn = document.getElementById('confirm-archive-btn');
const winnerSelect = document.getElementById('winner-select');
const archiveMonthInput = document.getElementById('archive-month-input');
const forgotPinLink = document.getElementById('forgot-pin-link');
const confirmPinResetBtn = document.getElementById('confirm-pin-reset-btn');
const resetUsernameInput = document.getElementById('reset-username');
const newPinInput = document.getElementById('new-pin');


// --- Inicializace aplikace ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log("Inicializace aplikace...");
    await fetchQuestionsFromDB();
    currentUser.id = localStorage.getItem('quizUserId');
    
    if (currentUser.id) {
        currentUser.name = localStorage.getItem('quizUsername');
        currentUser.pin = localStorage.getItem('quizUserPin');
        await processUserLogin();
    } else {
        welcomeSection.style.display = 'block';
        showDailyQuote(); 
    }
}

// --- Logika Motivačních citátů s časovačem ---
function showDailyQuote(onCompleteCallback = null) {
    const quotes = [
        "Každý nový den je nová šance změnit svůj život.",
        "Neúspěch je jen příležitost začít znovu, tentokrát inteligentněji.",
        "Věř, že to dokážeš, a jsi v polovině cesty.",
        "Tvé sny nemají datum vypršení. Zhluboka se nadechni a zkus to znovu.",
        "Limity existují jen v tvé mysli.",
        "Dělej to, co můžeš, tam, kde jsi, s tím, co máš.",
        "Úspěch není konečný, neúspěch není fatální. Důležitá je odvaha pokračovat.",
        "Malé kroky každý den vedou k velkým výsledkům.",
        "Nikdy není pozdě stát se tím, kým jsi mohl být.",
        "Překážky jsou to, co vidíš, když se přestaneš dívat na svůj cíl.",
        "Nečekej na příležitost. Vytvoř ji.",
        "Tajemství úspěchu je začít.",
        "Jediný způsob, jak dělat skvělou práci, je milovat to, co děláš.",
        "Buď změnou, kterou chceš vidět ve světě.",
        "Když prší, hledej duhu. Když je tma, hledej hvězdy.",
        "Tvůj čas je omezený, tak ho neplýtvej žitím života někoho jiného.",
        "Nejlepší čas zasadit strom byl před 20 lety. Druhý nejlepší čas je teď.",
        "Všechno se zdá nemožné, dokud to není hotové.",
        "Nenech se ovládnout strachem z prohry.",
        "Disciplína je mostem mezi cíli a úspěchem.",
        "Tvůj postoj, ne tvé vlohy, určí tvou výšku.",
        "Chyby jsou důkazem toho, že se snažíš.",
        "Soustřeď se na cíl, ne na překážky.",
        "Každý expert byl kdysi začátečník.",
        "Motivace tě nastartuje. Zvyk tě udrží v chodu.",
        "Nezastavuj se, když jsi unavený. Zastav se, až budeš hotový.",
        "Budoucnost patří těm, kdo věří v krásu svých snů.",
        "Jestli to dokážeš vysnít, dokážeš to i udělat.",
        "Nikdy se nevzdávej něčeho, na co myslíš každý den.",
        "Úspěch je součet malých snah opakovaných den co den.",
        "Dnešek je ten správný den začít."
    ];

    const modal = document.getElementById("motivationModal");
    const quoteText = document.getElementById("daily-quote");
    const dateText = document.getElementById("modal-date");
    const closeButtons = document.querySelectorAll(".close-btn, #closeModalBtn");

    const today = new Date();
    const dayOfMonth = today.getDate();
    const options = { day: 'numeric', month: 'long' };
    if (dateText) dateText.innerText = today.toLocaleDateString('cs-CZ', options);

    const quoteIndex = (dayOfMonth - 1) % quotes.length;
    if (quoteText) quoteText.innerText = quotes[quoteIndex];

    if (modal) modal.style.display = "block";

    let timeLeft = 5;

    let countdownDisplay = document.getElementById('quote-countdown');
    if (!countdownDisplay) {
        countdownDisplay = document.createElement('div');
        countdownDisplay.id = 'quote-countdown';
        countdownDisplay.style.cssText = "margin-top: 15px; font-weight: bold; color: var(--primary-color); font-size: 1.2rem; text-align: center;";
        if (quoteText && quoteText.parentNode) {
            quoteText.parentNode.insertBefore(countdownDisplay, quoteText.nextSibling);
        }
    }

    closeButtons.forEach(btn => btn.style.display = 'none');

    const updateCountdown = () => {
        countdownDisplay.innerText = `Přečti si citát... (${timeLeft})`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (modal) modal.style.display = "none";
            closeButtons.forEach(btn => btn.style.display = 'block');
            countdownDisplay.innerText = "";

            if (onCompleteCallback && typeof onCompleteCallback === 'function') {
                onCompleteCallback();
            }
        }
        timeLeft--;
    };

    updateCountdown();
    const timerInterval = setInterval(updateCountdown, 1000);

    window.onclick = function(event) {
        if (timeLeft <= 0 && event.target == modal) {
            modal.style.display = "none";
        }
    };
}


// --- Správa uživatelů ---
saveUsernameButton.addEventListener('click', () => processUserLogin(true));
changeAccountButton.addEventListener('click', () => {
    localStorage.clear();
    resetUIForLogout();
});

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
    }
    
    if (!currentUser.id) {
        welcomeSection.style.display = 'block';
        return;
    }
    
    try {
        const allUsersSnapshot = await db.ref('users').once('value');
        let isDuplicate = false;
        if (allUsersSnapshot.exists()) {
            allUsersSnapshot.forEach(childSnapshot => {
                const existingUser = childSnapshot.val();
                if (existingUser.name.toLowerCase() === currentUser.name.toLowerCase() && childSnapshot.key !== currentUser.id) {
                    isDuplicate = true;
                }
            });
        }

        if (isDuplicate) {
            alert('Uživatelské jméno již existuje. Zvolte prosím jiné.');
            localStorage.clear();
            currentUser = { name: null, pin: null, id: null };
            return;
        }

        localStorage.setItem('quizUsername', currentUser.name);
        localStorage.setItem('quizUserPin', currentUser.pin);
        localStorage.setItem('quizUserId', currentUser.id);

        const userRef = db.ref('users/' + currentUser.id);
        const snapshot = await userRef.once('value');
        if (snapshot.exists()) {
            const data = snapshot.val();
            currentUser.score = data.score || 0;
            currentUser.streak = data.streak || 0;
            currentUser.lastAnswerDate = data.lastAnswerDate ? new Date(data.lastAnswerDate) : null;
            currentUser.lastStreakDate = data.lastStreakDate ? new Date(data.lastStreakDate) : null;
            currentUser.lastAnswerCorrect = data.lastAnswerCorrect; // Načtení stavu poslední odpovědi
        } else {
             await userRef.set({ name: currentUser.name, score: 0, streak: 0, lastAnswerDate: null, lastStreakDate: null, lastAnswerCorrect: null });
        }

        welcomeSection.style.display = 'none';
        motivationSection.style.display = 'block';
        quizAreaDiv.style.display = 'block';
        leaderboardAreaDiv.style.display = 'block';
        hallOfFameArea.style.display = 'block';
        changeAccountButton.style.display = 'block';
        if (currentUser.name === 'Kuba') { adminControlsDiv.style.display = 'flex'; }

        listenForLeaderboardUpdates();
        loadHallOfFame();
        loadTodaysQuestion();
        updateStreakDisplay();
    } catch (error) {
        console.error("Chyba při zpracování uživatele: ", error);
        alert("Chyba při komunikaci s databází. Zkuste to prosím znovu.");
    }
}

async function updateUser(updates) {
    if (!currentUser.id) return;
    try {
        await db.ref('users/' + currentUser.id).update(updates);
    } catch (error) {
        console.error("Chyba při aktualizaci dat uživatele:", error);
    }
}


// --- Hlavní logika kvízu ---
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
        showDailyQuote(() => {
            startQuestionTimer();
        });
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
    explainAnswerContainer.style.display = 'none';
    nextQuestionTimerDiv.style.display = 'none';
}


// --- Logika časovače ---
function startQuestionTimer() {
    clearInterval(questionTimerInterval);
    timerProgressBar.style.transition = 'none';
    timerProgressBar.style.width = '100%';
    timerProgressBar.style.backgroundColor = 'var(--timer-start-color)';
    void timerProgressBar.offsetWidth;
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
    timerProgressBar.style.transition = 'none';
    timerProgressBar.style.width = computedStyle.getPropertyValue('width');
}


// --- Zpracování odpovědi ---
submitAnswerButton.addEventListener('click', handleSubmitAnswer);
explainAnswerBtn.addEventListener('click', handleExplainAnswer);

function handleExplainAnswer() {
    if (!currentQuestion) return;
    const prompt = `Vysvětli podrobně a pro laika, který je učástník kvízu, proč je odpověď '${currentQuestion.correctAnswer}' správná na otázku: '${currentQuestion.text}'. Použij emoji v souhrnu a hezky text strukturuj pro přehlednost. Nakonci napiš souhrn v bodech. Text vysvětlení pro uživatele nebude dlouhý, ale bude stručný. Nakonci napiš, jestli má uživatel otázku, tak ať se zeptá.`;
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://www.perplexity.ai/?q=${encodedPrompt}`;
    window.open(url, '_blank');
}

function handleSubmitAnswer() {
    stopTimer();
    const selectedOptionButton = optionsContainerEl.querySelector('button.selected');
    if (!selectedOptionButton) return;

    const userAnswer = selectedOptionButton.textContent;
    const isCorrect = userAnswer === currentQuestion.correctAnswer;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let updates = { 
        lastAnswerDate: today.toISOString()
    };

    if (isCorrect) {
        feedbackEl.innerHTML = `<i class="fas fa-check-circle"></i> Správně! Skvělá práce!`;
        feedbackEl.className = 'feedback-message correct';
        currentUser.score++;
        updates.score = currentUser.score;
        updates.lastAnswerCorrect = true; // Uložení stavu: Správně

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
        updates.lastAnswerCorrect = false; // Uložení stavu: Špatně
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
    explainAnswerContainer.style.display = 'block';
    showAnsweredStatus();
    showNextQuestionTimer();
    updateStreakDisplay();
}

function handleTimeUp() {
    feedbackEl.innerHTML = `<i class="fas fa-clock"></i> Čas vypršel! Správná odpověď byla: <strong>${currentQuestion.correctAnswer}</strong>`;
    feedbackEl.className = 'feedback-message incorrect';
    feedbackEl.style.display = 'block';
    explainAnswerContainer.style.display = 'block';
    
    const todayISO = new Date().toISOString();
    currentUser.lastAnswerDate = new Date(todayISO);
    currentUser.streak = 0;
    
    // Uložení stavu: Špatně (nestihl to)
    updateUser({ 
        lastAnswerDate: todayISO, 
        streak: 0,
        lastAnswerCorrect: false 
    });

    optionsContainerEl.querySelectorAll('button').forEach(btn => btn.disabled = true);
    submitAnswerButton.style.display = 'none';
    showAnsweredStatus();
    showNextQuestionTimer();
    updateStreakDisplay();
}


// --- Administrátorské funkce a Síň slávy ---
archiveWinnerBtn.addEventListener('click', openArchiveModal);
resetLeaderboardBtn.addEventListener('click', resetLeaderboard);

function getPreviousMonthYear() {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
}

async function openArchiveModal() {
    try {
        const snapshot = await db.ref('users').orderByChild('score').once('value');
        if (!snapshot.exists()) {
            alert("V tabulce nejsou žádní hráči k archivaci.");
            return;
        }
        let users = [];
        snapshot.forEach(child => {
            users.push({ id: child.key, ...child.val() });
        });
        users.reverse();
        winnerSelect.innerHTML = '<option value="">-- Vyber hráče --</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (${user.score} bodů)`;
            option.dataset.name = user.name;
            option.dataset.score = user.score;
            winnerSelect.appendChild(option);
        });
        archiveMonthInput.value = getPreviousMonthYear();
        archiveModal.style.display = 'flex';
    } catch (error) {
        console.error("Chyba při načítání hráčů pro archivaci:", error);
        alert("Nepodařilo se načíst hráče.");
    }
}

async function confirmArchive() {
    const selectedOption = winnerSelect.options[winnerSelect.selectedIndex];
    const winnerId = selectedOption.value;
    const monthYear = archiveMonthInput.value.trim();
    if (!winnerId || !monthYear) {
        alert("Prosím, vyplňte všechna pole.");
        return;
    }
    const winnerName = selectedOption.dataset.name;
    const winnerScore = selectedOption.dataset.score;
    const newEntry = { month: monthYear, name: winnerName, score: parseInt(winnerScore, 10), timestamp: firebase.database.ServerValue.TIMESTAMP };
    try {
        await db.ref('hallOfFame').push(newEntry);
        alert(`Vítěz ${winnerName} byl úspěšně archivován pro ${monthYear}.`);
        archiveModal.style.display = 'none';
    } catch (error) {
        console.error("Chyba při ukládání do Síně slávy:", error);
        alert("Archivace se nezdařila.");
    }
}

async function resetLeaderboard() {
    if (!confirm("Opravdu resetovat celou tabulku a série všech hráčů? Tato akce je nevratná.")) return;
    try {
        const snapshot = await db.ref('users').once('value');
        if (snapshot.exists()) {
            const updates = {};
            snapshot.forEach(child => {
                updates[`/${child.key}/score`] = 0;
                updates[`/${child.key}/streak`] = 0;
                updates[`/${child.key}/lastAnswerDate`] = null;
                updates[`/${child.key}/lastStreakDate`] = null;
                updates[`/${child.key}/lastAnswerCorrect`] = null;
            });
            await db.ref('users').update(updates);
            alert("Tabulka byla úspěšně resetována.");
            resetUIForLogout();
        }
    } catch (error) {
        console.error("Chyba při resetování tabulky:", error);
    }
}


// --- Správa modal (dialogových) oken ---
forgotPinLink.addEventListener('click', (e) => {
    e.preventDefault();
    pinResetModal.style.display = 'flex';
});
confirmPinResetBtn.addEventListener('click', handlePinReset);

document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modalId = e.target.dataset.modal;
        if(modalId) {
             document.getElementById(modalId).style.display = 'none';
        }
    });
});
document.querySelector('#archive-modal .close-btn').addEventListener('click', () => {
    archiveModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        if (event.target.id === 'motivationModal') { return; }
        event.target.style.display = 'none';
    }
});

async function handlePinReset() {
    const usernameToReset = resetUsernameInput.value.trim();
    const newPin = newPinInput.value.trim();
    if (!usernameToReset) { alert("Prosím, zadej své jméno."); return; }
    if (!/^\d{4}$/.test(newPin)) { alert("Prosím, zadej platný 4místný PIN."); return; }

    try {
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        if (!snapshot.exists()) { alert("V databázi nejsou žádní uživatelé."); return; }

        let foundUser = null;
        let oldUserId = null;
        snapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            if (userData.name.toLowerCase() === usernameToReset.toLowerCase()) {
                foundUser = userData;
                oldUserId = childSnapshot.key;
            }
        });

        if (!foundUser) { alert("Uživatel s tímto jménem nebyl nalezen."); return; }

        const newUserId = foundUser.name.replace(/[.#$[\]]/g, '_') + '_' + newPin;
        const updates = {};
        updates[`/users/${oldUserId}`] = null;
        updates[`/users/${newUserId}`] = foundUser;

        await db.ref().update(updates);
        alert(`PIN pro uživatele "${foundUser.name}" byl úspěšně změněn.`);
        pinResetModal.style.display = 'none';
        resetUsernameInput.value = '';
        newPinInput.value = '';
    } catch (error) {
        console.error("Chyba při změně PINu:", error);
        alert("Při změně PINu došlo k chybě.");
    }
}


// --- Pomocné a UI funkce ---
function resetUIForLogout() {
    currentUser = { name: null, pin: null, id: null, score: 0, streak: 0, lastAnswerDate: null, lastStreakDate: null, lastAnswerCorrect: null };
    quizAreaDiv.style.display = 'none'; leaderboardAreaDiv.style.display = 'none'; hallOfFameArea.style.display = 'none';
    motivationSection.style.display = 'none'; adminControlsDiv.style.display = 'none'; changeAccountButton.style.display = 'none';
    welcomeSection.style.display = 'block';
    usernameInput.value = ''; pinInput.value = '';
    showDailyQuote();
}

function showAnsweredStatus() {
    quizInfoBar.style.display = 'flex';
    timerProgressBar.style.transition = 'none';
    timerProgressBar.style.width = '100%';
    timerProgressBar.style.backgroundColor = 'var(--timer-answered-color)';
    questionTimerText.textContent = 'ZODPOVĚŽENO';
}

function updateStreakDisplay() {
    currentStreakEl.textContent = currentUser.streak;
    streakDisplay.classList.toggle('active', currentUser.streak > 0);
}

function displayAlreadyAnswered() {
    questionTextEl.innerHTML = `<i class="fas fa-check-circle"></i> Dnešní otázku jsi již zodpověděl/a. Uvidíme se zítra!`;
    optionsContainerEl.innerHTML = "";
    submitAnswerButton.style.display = 'none';
    showAnsweredStatus();
    showNextQuestionTimer();
}

function displayNoQuestion() {
     questionTextEl.innerHTML = `<i class="fas fa-ghost"></i> Pro dnešek bohužel nemáme otázku. Zkus to zítra!`;
     optionsContainerEl.innerHTML = "";
     submitAnswerButton.style.display = 'none';
     quizInfoBar.style.display = 'none';
     showNextQuestionTimer();
}

function hasUserAnsweredToday() {
    if (!currentUser.lastAnswerDate) return false;
    const lastAnswerDay = new Date(currentUser.lastAnswerDate);
    lastAnswerDay.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return lastAnswerDay.getTime() === today.getTime();
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
        if (diff <= 0) { clearInterval(interval); location.reload(); return; }
        const h = Math.floor(diff / (1000*60*60));
        const m = Math.floor((diff / 1000/60) % 60);
        const s = Math.floor((diff/1000) % 60);
        timerEl.textContent = `${h}h ${m}m ${s}s`;
    }, 1000);
}


// --- Načítání dat z Firebase a Tabulka ---
async function fetchQuestionsFromDB() {
    try {
        const snapshot = await db.ref('questions').once('value');
        if (snapshot.exists()) { allQuestionsFromDB = Object.values(snapshot.val()).filter(Boolean); }
    } catch (error) { console.error("Chyba při načítání otázek z Firebase:", error); }
}

function listenForLeaderboardUpdates() {
    db.ref('users').orderByChild('score').on('value', (snapshot) => {
        let users = [];
        snapshot.forEach(child => { 
            users.push({
                ...child.val(),
                id: child.key
            }); 
        });
        
        leaderboardBody.innerHTML = "";
        users.reverse().slice(0, 10).forEach((user, index) => {
            const rank = index + 1;
            const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
            
            let lastAnswerText = '❓ Ještě neodpověděl';
            let statusIcon = ''; // Ikona stavu odpovědi

            if (user.lastAnswerDate) {
                const lastAnswer = new Date(user.lastAnswerDate);
                const now = new Date();
                const lastAnswerDay = new Date(lastAnswer.getFullYear(), lastAnswer.getMonth(), lastAnswer.getDate());
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const diffTime = today - lastAnswerDay;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 0) { 
                    lastAnswerText = '⭐ Dnes'; 
                    // Zobrazíme ikonu jen pokud odpovídal DNES
                    if (user.lastAnswerCorrect === true) {
                        statusIcon = '<i class="fas fa-check-circle" style="color: #4caf50; margin-left: 8px;" title="Správná odpověď"></i>';
                    } else if (user.lastAnswerCorrect === false) {
                        statusIcon = '<i class="fas fa-times-circle" style="color: #f44336; margin-left: 8px;" title="Špatná odpověď"></i>';
                    }
                }
                else if (diffDays === 1) { lastAnswerText = '🌙 Včera'; }
                else { lastAnswerText = `⏳ Před ${diffDays} dny`; }
            }

            const row = leaderboardBody.insertRow();
            row.innerHTML = `
                <td>${rankIcon}</td>
                <td>
                    <div class="user-info">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                             <span class="user-name">${user.name}${statusIcon}</span>
                        </div>
                        <span class="last-answer-time">${lastAnswerText}</span>
                    </div>
                </td>
                <td>${user.score}</td>
            `;
        });
    });
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
