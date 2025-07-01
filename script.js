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
    pin: localStorage.getItem('quizUserPin') || null, // Přidáno pro PIN
    score: 0,
    id: localStorage.getItem('quizUserId') || null, // ID uživatele pro Realtime Database
    lastAnswerDate: null
};
const quizStartDate = new Date('2025-06-01T00:00:00'); // Kvízzačíná 1. června, toto zajistí, že 1.6. je Den 1.
let allQuestionsFromDB = []; // Zde budou uloženy otázky z DB

// Elementy DOM
const userSetupDiv = document.getElementById('user-setup');
const usernameInput = document.getElementById('username');
const pinInput = document.getElementById('pin'); // Přidáno pro PIN
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
const changeAccountButton = document.getElementById('change-account-btn'); // Přidáno
const motivationSection = document.getElementById('motivation-section'); // Přidáno

// --- Funkcie pre prácu s používateľom ---
saveUsernameButton.addEventListener('click', async () => {
    const rawUsername = usernameInput.value.trim();
    const pin = pinInput.value.trim();

    if (!rawUsername) {
        alert('Prosím, zadej své jméno.');
        return;
    }
    if (!pin || !/^\d{4}$/.test(pin)) {
        alert('Prosím, zadej platný čtyřmístný PIN.');
        return;
    }

    // Nahradíme neplatné znaky pro RTDB klíče, ale zachováme původní pro zobrazení
    const safeUsernameId = rawUsername.replace(/[.#$[\]]/g, '_') + '_' + pin; // Přidání PINu k ID pro jednoduchou unikátnost/ověření

    currentUser.name = rawUsername; // Původní jméno pro zobrazení
    currentUser.pin = pin; // Uložení PINu
    currentUser.id = safeUsernameId; // Bezpečné ID pro databázi (kombinace jména a PINu)

    localStorage.setItem('quizUsername', currentUser.name);
    localStorage.setItem('quizUserPin', currentUser.pin); // Uložení PINu do localStorage
    localStorage.setItem('quizUserId', currentUser.id);

    await processUserLogin(); // Zavolá novou funkci, která řeší logiku i UI
});

changeAccountButton.addEventListener('click', () => {
    // Vymazání dat z localStorage
    localStorage.removeItem('quizUsername');
    localStorage.removeItem('quizUserPin');
    localStorage.removeItem('quizUserId');
    localStorage.removeItem('quizUserLastAnswerDate');

    // Reset currentUser objektu
    currentUser = {
        name: null,
        pin: null,
        score: 0,
        id: null,
        lastAnswerDate: null
    };

    // Reset UI
    usernameInput.value = '';
    pinInput.value = '';
    userSetupDiv.style.display = 'block';
    quizAreaDiv.style.display = 'none';
    leaderboardAreaDiv.style.display = 'none';
    motivationSection.style.display = 'none'; // Skryjeme motivační sekci
    changeAccountButton.style.display = 'none';
    feedbackEl.style.display = 'none';
    nextQuestionTimerDiv.style.display = 'none';
    startMessageEl.innerHTML = 'Kvíz začíná 1. června 2025!'; // Reset startovní zprávy
    startMessageEl.style.display = 'block';
    
    // Zastavení poslouchání změn v tabulce (pokud je aktivní)
    if (currentUser.id && db) { // Kontrola, zda db existuje
        db.ref('users').off('value', listenForLeaderboardUpdates);
    }
     // Možná bude potřeba znovu inicializovat některé části, pokud uživatel ihned zadá nové jméno
    // Například, pokud by se leaderboard nenačítal automaticky po přihlášení.
    // V našem případě checkUserInRealtimeDB a loadTodaysQuestion by měly být volány po novém přihlášení.
    console.log("Účet změněn, uživatel odhlášen.");
});

async function processUserLogin() {
    if (!currentUser.id || !currentUser.name) {
        // Tento případ by měl být pokryt hlavně v init, kdy se nezobrazí kvíz rovnou.
        // Pokud se sem dostaneme po kliku na save, jméno a ID by měly být nastaveny.
        // Přesto pro jistotu zobrazíme setup, pokud chybí kritická data.
        userSetupDiv.style.display = 'block';
        quizAreaDiv.style.display = 'none';
        leaderboardAreaDiv.style.display = 'none';
        motivationSection.style.display = 'none';
        changeAccountButton.style.display = 'none';
        startMessageEl.innerHTML = `Kvíz začíná ${quizStartDate.toLocaleDateString('cs-CZ', {day: 'numeric', month: 'long', year: 'numeric'})}! <i class="fas fa-rocket"></i>`;
        startMessageEl.style.display = 'block';
        loadTodaysQuestion(); // Zobrazí info o startu, pokud kvíz ještě nezačal
        return;
    }

    const normalizedNewUsername = currentUser.name.toLowerCase();
    const usersRef = db.ref('users');

    try {
        const snapshot = await usersRef.orderByChild('name').once('value');
        let nameExists = false;
        snapshot.forEach(childSnapshot => {
            const existingUser = childSnapshot.val();
            if (existingUser && existingUser.name && existingUser.name.toLowerCase() === normalizedNewUsername) {
                if (childSnapshot.key !== currentUser.id) {
                    nameExists = true;
                    return true; // Přeruší forEach
                }
            }
        });

        if (nameExists) {
            alert('Uživatelské jméno již existuje. Zvolte prosím jiné.');
            localStorage.removeItem('quizUsername');
            localStorage.removeItem('quizUserPin');
            localStorage.removeItem('quizUserId');
            currentUser.name = null;
            currentUser.pin = null;
            currentUser.id = null;

            usernameInput.value = ''; 
            pinInput.value = '';    
            userSetupDiv.style.display = 'block';
            quizAreaDiv.style.display = 'none';
            leaderboardAreaDiv.style.display = 'none';
            motivationSection.style.display = 'none';
            changeAccountButton.style.display = 'none';
            startMessageEl.innerHTML = `Kvíz začíná ${quizStartDate.toLocaleDateString('cs-CZ', {day: 'numeric', month: 'long', year: 'numeric'})}! <i class="fas fa-rocket"></i>`;
            startMessageEl.style.display = 'block';
            // Nezapomeňte znovu načíst otázky, pokud by byly potřeba pro zobrazení (i když zde to není nutné, protože zůstáváme na setupu)
            // loadTodaysQuestion(); // Toto zde není nutné, protože zůstáváme na setupu
            return; 
        }

        // Jméno neexistuje, nebo patří aktuálnímu ID, pokračujeme
        const userRef = db.ref('users/' + currentUser.id);
        const userSnapshot = await userRef.once('value');
        const userData = userSnapshot.val();

        if (userData) {
            if (userData.name !== currentUser.name) {
                await userRef.update({ name: currentUser.name });
                console.warn("Jméno v DB se lišilo, bylo aktualizováno.");
            }
            currentUser.score = userData.score || 0;
            currentUser.lastAnswerDate = userData.lastAnswerDate ? new Date(userData.lastAnswerDate) : null;
            if (currentUser.lastAnswerDate) {
                localStorage.setItem('quizUserLastAnswerDate', currentUser.lastAnswerDate.toISOString());
            }
            console.log('Uživatel nalezen v RTDB:', currentUser);
        } else {
            await userRef.set({
                name: currentUser.name,
                score: 0,
                lastAnswerDate: null
            });
            console.log('Nový uživatel vytvořen v RTDB:', currentUser);
        }

        // Úspěšné přihlášení/registrace, aktualizujeme UI
        userSetupDiv.style.display = 'none';
        motivationSection.style.display = 'block';
        quizAreaDiv.style.display = 'block';
        leaderboardAreaDiv.style.display = 'block';
        changeAccountButton.style.display = 'block';
        startMessageEl.style.display = 'none';
        
        listenForLeaderboardUpdates();
        loadTodaysQuestion();

    } catch (error) {
        console.error("Chyba při zpracování uživatele v RTDB: ", error);
        alert("Došlo k chybě při komunikaci s databází. Zkuste to prosím znovu.");
        // V případě chyby je dobré uživatele nechat na setup stránce
        userSetupDiv.style.display = 'block';
        quizAreaDiv.style.display = 'none';
        leaderboardAreaDiv.style.display = 'none';
        motivationSection.style.display = 'none';
        changeAccountButton.style.display = 'none';
        startMessageEl.innerHTML = `Kvíz začíná ${quizStartDate.toLocaleDateString('cs-CZ', {day: 'numeric', month: 'long', year: 'numeric'})}! <i class="fas fa-rocket"></i>`;
        startMessageEl.style.display = 'block';
    }
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
    return diffDays; // Změna: první den kvízu je nyní den 0
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
        changeAccountButton.style.display = currentUser.id ? 'block' : 'none'; // Zobrazit/skrýt dle stavu přihlášení
        motivationSection.style.display = 'none'; // Skrýt, pokud kvíz nezačal
        return;
    }
    // Pokud je uživatel přihlášen (má ID), skryjeme startMessageEl a zobrazíme motivaci
    if(currentUser.id) {
        startMessageEl.style.display = 'none';
        motivationSection.style.display = 'block'; // Zobrazit motivaci
        changeAccountButton.style.display = 'block';
    } else {
        motivationSection.style.display = 'none'; // Skrýt, pokud není přihlášen
        changeAccountButton.style.display = 'none';
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
    console.log("Inicializace aplikace...");
    // Načtení jména, ID a PINu z localStorage, pokud existují
    currentUser.name = localStorage.getItem('quizUsername');
    currentUser.pin = localStorage.getItem('quizUserPin');
    currentUser.id = localStorage.getItem('quizUserId');
    const storedLastAnswerDate = localStorage.getItem('quizUserLastAnswerDate');
    if (storedLastAnswerDate) {
        currentUser.lastAnswerDate = new Date(storedLastAnswerDate);
    }

    if (currentUser.id && currentUser.pin) { // Pokud máme ID a PIN, zkusíme uživatele rovnou "přihlásit"
        console.log("Nalezen uložený uživatel:", currentUser.name, "s ID:", currentUser.id);
        usernameInput.value = currentUser.name || ''; // Předvyplníme jméno, pokud existuje
        pinInput.value = currentUser.pin; // Předvyplníme PIN

        // UI a další logika se nyní řeší v processUserLogin
        await fetchQuestionsFromDB(); // Počkáme na načtení otázek
        await processUserLogin(); 
    } else {
        // Žádný uložený uživatel nebo chybí PIN, zobrazíme setup
        console.log("Žádný uložený uživatel nebo chybí PIN, zobrazeno nastavení.");
        userSetupDiv.style.display = 'block';
        quizAreaDiv.style.display = 'none';
        leaderboardAreaDiv.style.display = 'none';
        motivationSection.style.display = 'none';
        changeAccountButton.style.display = 'none';
        startMessageEl.innerHTML = `Kvíz začíná ${quizStartDate.toLocaleDateString('cs-CZ', {day: 'numeric', month: 'long', year: 'numeric'})}! <i class="fas fa-rocket"></i>`;
        startMessageEl.style.display = 'block';
        await fetchQuestionsFromDB(); // I tak načteme otázky, aby byly připravené
        loadTodaysQuestion(); // Zobrazí info o startu kvízu, pokud ještě nezačal
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