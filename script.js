// TODO: Nahraďte nasledujúce konfiguračné údaje vašimi vlastnými z Firebase konzoly!
const firebaseConfig = {
    apiKey: "AIzaSyAbeLxHKyRmhqQDwm8shvoiTZGKT8IjwHM",
    authDomain: "kvizomat-288d0.firebaseapp.com",
    databaseURL: "https://kvizomat-288d0-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "kvizomat-288d0",
    storageBucket: "kvizomat-288d0.firebasestorage.app",
    messagingSenderId: "427745601590",
    appId: "1:427745601590:web:5a6882d3a7a55a9ee41097"
  };

// Inicializácia Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Globálne premenné
let currentQuestion = null;
let currentUser = {
    name: localStorage.getItem('quizUsername') || null,
    score: 0,
    id: localStorage.getItem('quizUserId') || null, // ID uživatele pro Realtime Database
    lastAnswerDate: null
};
const quizStartDate = new Date('2025-06-01T00:00:00'); // Datum začátku kvízu
let allQuestionsFromDB = []; // Zde budou uloženy otázky z DB

// Elementy DOM
const userSetupDiv = document.getElementById('user-setup');
const usernameInput = document.getElementById('username');
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
const startMessageEl = document.getElementById('start-message'); // Přidáno pro úpravu startovní zprávy

// --- Funkcie pre prácu s používateľom ---
saveUsernameButton.addEventListener('click', () => {
    const rawUsername = usernameInput.value.trim();
    // Nahradíme neplatné znaky pro RTDB klíče, ale zachováme původní pro zobrazení
    const safeUsernameId = rawUsername.replace(/[.#$[\]]/g, '_');
    if (rawUsername) {
        currentUser.name = rawUsername; // Původní jméno pro zobrazení
        currentUser.id = safeUsernameId; // Bezpečné ID pro databázi
        localStorage.setItem('quizUsername', currentUser.name);
        localStorage.setItem('quizUserId', currentUser.id);
        checkUserInRealtimeDB();
        userSetupDiv.style.display = 'none';
        quizAreaDiv.style.display = 'block';
        leaderboardAreaDiv.style.display = 'block';
        startMessageEl.style.display = 'none'; // Skryjeme úvodní zprávu po zadání jména
        listenForLeaderboardUpdates();
    } else {
        alert('Prosím, zadej své jméno.');
    }
});

async function checkUserInRealtimeDB() {
    if (!currentUser.id) {
        loadTodaysQuestion(); // Pokud není ID, načteme otázku (zobrazí se info o startu kvízu)
        return;
    }

    const userRef = db.ref('users/' + currentUser.id);
    userRef.once('value', (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            currentUser.score = userData.score || 0;
            currentUser.lastAnswerDate = userData.lastAnswerDate ? new Date(userData.lastAnswerDate) : null;
            // Uložíme datum poslední odpovědi i do localStorage pro rychlejší kontrolu v init
            if (currentUser.lastAnswerDate) { 
                localStorage.setItem('quizUserLastAnswerDate', currentUser.lastAnswerDate.toISOString());
            }
            console.log('Uživatel nalezen v RTDB:', currentUser);
        } else {
            userRef.set({
                name: currentUser.name,
                score: 0,
                lastAnswerDate: null
            }).then(() => {
                console.log('Nový uživatel vytvořen v RTDB:', currentUser);
            }).catch(error => console.error("Chyba při vytváření uživatele v RTDB: ", error));
        }
        loadTodaysQuestion(); // Načteme dnešní otázku po kontrole/vytvoření uživatele
    });
}

async function updateUserScore(points) {
    if (!currentUser.id) return;
    currentUser.score += points;
    const today = new Date();
    today.setHours(0,0,0,0); // Normalizujeme na začátek dne

    const userRef = db.ref('users/' + currentUser.id);
    await userRef.update({
        score: currentUser.score,
        lastAnswerDate: today.toISOString() // Uložíme ako ISO string
    });
    currentUser.lastAnswerDate = today;
    localStorage.setItem('quizUserLastAnswerDate', today.toISOString()); // Aktualizujeme i localStorage
}

// --- Funkcie pre prácu s otázkami ---

// Definujeme otázky priamo v kóde pre jednoduchosť
// V reálnej aplikácii by ste ich mohli načítať z databázy alebo iného zdroja
// const allQuestions = [ ... ]; // ODSTRANĚNO

function getDayNumber(startDate, currentDate) {
    const start = new Date(startDate);
    start.setHours(0,0,0,0);
    const current = new Date(currentDate);
    current.setHours(0,0,0,0);
    const diffTime = Math.abs(current - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // +1 protože chceme, aby 1. června byl den 1
}

function loadTodaysQuestion() {
    const today = new Date();
    const todayFormatted = today.toLocaleDateString('cs-CZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    currentDateEl.innerHTML = `<i class="far fa-calendar-alt"></i> ${todayFormatted}`;

    const dayNumber = getDayNumber(quizStartDate, today);
    dayNumberDisplayEl.textContent = `Den kvízu: ${dayNumber}`;

    if (today < quizStartDate) {
        questionTextEl.innerHTML = `<i class="fas fa-info-circle"></i> Kvíz ještě nezačal. První otázka bude dostupná ${quizStartDate.toLocaleDateString('cs-CZ', {day: 'numeric', month: 'long', year: 'numeric'})}.`;
        optionsContainerEl.innerHTML = "";
        submitAnswerButton.style.display = 'none';
        nextQuestionTimerDiv.style.display = 'none';
        startMessageEl.innerHTML = `Kvíz začíná ${quizStartDate.toLocaleDateString('cs-CZ', {day: 'numeric', month: 'long', year: 'numeric'})}! <i class="fas fa-rocket"></i>`;
        startMessageEl.style.display = 'block';
        return;
    }
    // Pokud je uživatel přihlášen (má ID), skryjeme startMessageEl, protože kvíz už běží
    if(currentUser.id) { 
        startMessageEl.style.display = 'none'; 
    }

    if (allQuestionsFromDB.length === 0 && today >= quizStartDate) {
        questionTextEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Aktuálně nejsou v databázi žádné otázky pro kvíz. Zkuste to prosím později.`;
        optionsContainerEl.innerHTML = "";
        submitAnswerButton.style.display = 'none';
        return;
    }
    
    // Kontrola, zda uživatel již dnes odpověděl (používáme currentUser.lastAnswerDate)
    if (currentUser.lastAnswerDate) {
        const lastAnswerDay = new Date(currentUser.lastAnswerDate);
        lastAnswerDay.setHours(0, 0, 0, 0);
        const todayDay = new Date();
        todayDay.setHours(0, 0, 0, 0);
        if (lastAnswerDay.getTime() === todayDay.getTime()) {
            displayAlreadyAnswered();
            return;
        }
    }

    currentQuestion = allQuestionsFromDB.find(q => q.day === dayNumber);

    if (currentQuestion) {
        questionTextEl.innerHTML = `<i class="fas fa-question-circle"></i> ${currentQuestion.text}`;
        optionsContainerEl.innerHTML = "";
        currentQuestion.options.forEach(option => {
            const button = document.createElement('button');
            button.innerHTML = option;
            button.addEventListener('click', () => selectOption(button));
            optionsContainerEl.appendChild(button);
        });
        submitAnswerButton.style.display = 'block';
        feedbackEl.style.display = 'none';
        feedbackEl.textContent = '';
        nextQuestionTimerDiv.style.display = 'none';
        optionsContainerEl.querySelectorAll('button').forEach(btn => btn.disabled = false);
        submitAnswerButton.disabled = true;
    } else {
        questionTextEl.innerHTML = `<i class="fas fa-ghost"></i> Pro dnešek bohužel nemáme otázku. Zkus to zítra!`;
        optionsContainerEl.innerHTML = "";
        submitAnswerButton.style.display = 'none';
        if (today >= quizStartDate) showNextQuestionTimer();
    }
}

function displayAlreadyAnswered() {
    questionTextEl.innerHTML = `<i class="fas fa-check-circle"></i> Dnešní otázku jsi již zodpověděl/a.`;
    optionsContainerEl.innerHTML = "";
    submitAnswerButton.style.display = 'none';
    feedbackEl.style.display = 'none';
    showNextQuestionTimer();
}

function selectOption(selectedButton) {
    optionsContainerEl.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
    selectedButton.classList.add('selected');
    submitAnswerButton.disabled = false;
}

submitAnswerButton.addEventListener('click', handleSubmitAnswer);

function handleSubmitAnswer() {
    const selectedOptionButton = optionsContainerEl.querySelector('button.selected');
    if (!selectedOptionButton || !currentQuestion) return;

    const userAnswer = selectedOptionButton.textContent;
    const isCorrect = userAnswer === currentQuestion.correctAnswer;

    feedbackEl.style.display = 'block';
    feedbackEl.className = 'feedback-message'; // Reset tříd

    optionsContainerEl.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === currentQuestion.correctAnswer) {
            btn.classList.add('correct');
        } else if (btn === selectedOptionButton && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });

    if (isCorrect) {
        feedbackEl.innerHTML = `<i class="fas fa-smile-beam"></i> Správně! Výborně!`;
        feedbackEl.classList.add('correct');
        updateUserScore(1);
    } else {
        feedbackEl.innerHTML = `<i class="fas fa-sad-tear"></i> Špatně. Správná odpověď byla: <strong>${currentQuestion.correctAnswer}</strong>`;
        feedbackEl.classList.add('incorrect');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        currentUser.lastAnswerDate = today;
        localStorage.setItem('quizUserLastAnswerDate', today.toISOString()); // Uložíme i při špatné odpovědi
        if(currentUser.id) { // Aktualizujeme DB jen pokud máme ID uživatele
            db.ref('users/' + currentUser.id).update({
                lastAnswerDate: today.toISOString()
            });
        }
    }

    submitAnswerButton.style.display = 'none';
    showNextQuestionTimer();
}

function showNextQuestionTimer() {
    nextQuestionTimerDiv.style.display = 'block';
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    let timerInterval = setInterval(() => { // Použijeme setInterval pro spolehlivější odpočet
        const currentTime = new Date().getTime();
        const timeLeft = tomorrow.getTime() - currentTime;

        if (timeLeft < 0) {
            clearInterval(timerInterval);
            timerEl.textContent = "Nová otázka je připravena!";
            nextQuestionTimerDiv.style.display = 'none';
            if (currentUser.id) loadTodaysQuestion(); // Načíst novou otázku, jen pokud je uživatel přihlášen
            return;
        }

        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        timerEl.textContent = `${hours}h ${minutes}m ${seconds}s`;
    }, 1000); 
    // requestAnimationFrame byl pro tento typ timeru méně vhodný, setInterval je přesnější pro vteřinový odpočet
}

// --- Funkcie pre tabuľku výsledkov (s Realtime Listenerom) ---
function listenForLeaderboardUpdates() {
    const usersRef = db.ref('users').orderByChild('score');

    usersRef.on('value', (snapshot) => {
        leaderboardBody.innerHTML = "";
        const users = [];
        snapshot.forEach(childSnapshot => {
            users.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });

        users.sort((a, b) => b.score - a.score);
        const top10Users = users.slice(0, 10);

        let rank = 1;
        top10Users.forEach(user => {
            const row = leaderboardBody.insertRow();
            const rankCell = row.insertCell();
            // rankCell.innerHTML = rank; // Původní jednoduché zobrazení čísla
            if (rank === 1) rankCell.innerHTML = '<i class="fas fa-crown" style="color: gold; margin-right: 5px;"></i> 1';
            else if (rank === 2) rankCell.innerHTML = '<i class="fas fa-medal" style="color: silver; margin-right: 5px;"></i> 2';
            else if (rank === 3) rankCell.innerHTML = '<i class="fas fa-medal" style="color: #cd7f32; margin-right: 5px;"></i> 3';
            else rankCell.textContent = rank; // Pro ostatní jen číslo
            rank++;
            row.insertCell().textContent = user.name;
            row.insertCell().textContent = user.score;
        });
        if (top10Users.length === 0) {
            const row = leaderboardBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 3;
            cell.innerHTML = '<i class="fas fa-users-slash"></i> Zatím žádní hráči v tabulce.';
            cell.style.textAlign = 'center';
        }
    });
}

// --- Inicializácia ---
async function init() {
    await fetchQuestionsFromDB(); // Nejprve načteme všechny otázky z DB
    const storedUsername = localStorage.getItem('quizUsername');
    const storedUserId = localStorage.getItem('quizUserId');
    const storedLastAnswerDate = localStorage.getItem('quizUserLastAnswerDate');

    if (storedUsername && storedUserId) {
        currentUser.name = storedUsername;
        currentUser.id = storedUserId;
        if (storedLastAnswerDate) { // Načtení data poslední odpovědi z localStorage
            currentUser.lastAnswerDate = new Date(storedLastAnswerDate);
        }
        usernameInput.value = currentUser.name;
        userSetupDiv.style.display = 'none';
        quizAreaDiv.style.display = 'block';
        leaderboardAreaDiv.style.display = 'block';
        startMessageEl.style.display = 'none';
        // Nyní zavoláme checkUserInRealtimeDB, která ověří/aktualizuje data v DB a poté zavolá loadTodaysQuestion
        checkUserInRealtimeDB(); 
        listenForLeaderboardUpdates();
    } else {
        userSetupDiv.style.display = 'block';
        quizAreaDiv.style.display = 'none';
        leaderboardAreaDiv.style.display = 'none';
        loadTodaysQuestion(); // Zavoláme pro zobrazení info, že kvíz ještě nezačal / nebo chybí otázky
    }

    // Zobrazenie informácie o štarte kvízu, ak ešte nezačal
    const today = new Date();
    if (today < quizStartDate && !currentUser.name) { // Zobrazí sa len ak užívateľ nie je prihlásený
         loadTodaysQuestion(); // Zobrazí zprávu, že kvíz ještě nezačal
    }
}

// Spustíme inicializáciu po načítaní stránky
document.addEventListener('DOMContentLoaded', init);

// --- Načítání otázek z Firebase --- 
async function fetchQuestionsFromDB() {
    console.log("Načítání otázek z databáze...");
    try {
        const snapshot = await db.ref('questions').once('value');
        const data = snapshot.val();
        if (data) {
            // Firebase vrací pole jako objekt s číselnými klíči.
            // Object.values převede tento objekt na skutečné pole.
            // Filtrujeme null hodnoty pro případ, že by pole v DB bylo řídké.
            allQuestionsFromDB = Object.values(data).filter(question => question !== null && typeof question === 'object');
            console.log(`Úspěšně načteno ${allQuestionsFromDB.length} otázek z DB.`);
        } else {
            allQuestionsFromDB = [];
            console.warn("V databázi nebyly nalezeny žádné otázky pod uzlem '/questions'.");
        }
    } catch (error) {
        console.error("Chyba při načítání otázek z Firebase:", error);
        allQuestionsFromDB = []; // Zajistíme prázdné pole v případě chyby
        questionTextEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Chyba při načítání otázek. Zkuste to prosím později.`;
        optionsContainerEl.innerHTML = "";
        submitAnswerButton.style.display = 'none';
    }
} 