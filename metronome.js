const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Elements
const playBtn = document.getElementById('play-btn');
const playIcon = playBtn.querySelector('.icon');
const playText = playBtn.querySelector('.text');
const bpmValueDisplay = document.getElementById('bpm-value');
const bpmSlider = document.getElementById('bpm-slider');
const stepBtns = document.querySelectorAll('.step-btn');
const beatsSelect = document.getElementById('beats-per-bar');
const visualizer = document.getElementById('visualizer');
const timerToggle = document.getElementById('timer-toggle');
const timerDisplayContainer = document.getElementById('timer-display-container');
const timerDisplay = document.getElementById('timer-display');

// State
let isPlaying = false;
let bpm = 60;
let beatsPerBar = 4;
let currentBeatInBar = 0;
let nextNoteTime = 0.0; // when the next note is due.
let timerWorker = null; // We'll use a simple setInterval or requestAnimationFrame for scheduling.
let lookahead = 25; // How frequently to call scheduling function (in milliseconds)
let scheduleAheadTime = 0.1; // How far ahead to schedule audio (sec)

let isTimerSession = false;
let sessionDuration = 120; // 2 minutes in seconds
let remainingTime = sessionDuration;
let countdownInterval = null;

// Initialization
updateVisualizer();

function nextNote() {
    // Advance current note and time by a 16th note... wait, just quarter notes for a simple metronome.
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTime += secondsPerBeat;
    currentBeatInBar = (currentBeatInBar + 1) % beatsPerBar;
}

function playClick(time, isAccent, beatIndex) {
    const osc = audioContext.createOscillator();
    const envelope = audioContext.createGain();

    osc.connect(envelope);
    envelope.connect(audioContext.destination);

    // Click sound shaping
    if (isAccent) {
        osc.frequency.value = 1000.0;
    } else {
        osc.frequency.value = 600.0;
    }

    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);

    // Schedule visual update using requestAnimationFrame
    // Calculate how long until this note plays
    const delay = time - audioContext.currentTime;
    
    setTimeout(() => {
        animateVisualizer(beatIndex, isAccent);
    }, delay * 1000);
}

function scheduler() {
    // while there are notes that will need to play before the next interval, schedule them and advance the pointer.
    while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
        // currentBeatInBar is 0 for the first beat of the bar
        const isAccent = currentBeatInBar === 0;
        playClick(nextNoteTime, isAccent, currentBeatInBar);
        nextNote();
    }
    
    if (isPlaying) {
        timerWorker = setTimeout(scheduler, lookahead);
    }
}

function startStop() {
    if (isPlaying) {
        isPlaying = false;
        clearTimeout(timerWorker);
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        
        playBtn.classList.remove('playing');
        playIcon.textContent = '▶';
        playText.textContent = 'START';
        
        // Reset visualizer
        const dots = visualizer.querySelectorAll('.beat-indicator');
        dots.forEach(dot => {
            dot.classList.remove('active', 'accent');
        });
        
        if (isTimerSession) {
            remainingTime = sessionDuration;
            updateTimerDisplay();
        }
    } else {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        isPlaying = true;
        currentBeatInBar = 0;
        nextNoteTime = audioContext.currentTime + 0.05;
        
        playBtn.classList.add('playing');
        playIcon.textContent = '■';
        playText.textContent = 'STOP';
        
        if (isTimerSession) {
            remainingTime = sessionDuration;
            updateTimerDisplay();
            countdownInterval = setInterval(() => {
                remainingTime--;
                updateTimerDisplay();
                if (remainingTime <= 0) {
                    startStop();
                }
            }, 1000);
        }

        scheduler();
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateBpm(newBpm) {
    bpm = Math.min(Math.max(newBpm, 20), 280);
    bpmValueDisplay.textContent = bpm;
    bpmSlider.value = bpm;
}

function updateVisualizer() {
    visualizer.innerHTML = '';
    for (let i = 0; i < beatsPerBar; i++) {
        const dot = document.createElement('div');
        dot.className = 'beat-indicator';
        visualizer.appendChild(dot);
    }
}

function animateVisualizer(beatIndex, isAccent) {
    const dots = visualizer.querySelectorAll('.beat-indicator');
    
    // Reset all
    dots.forEach(dot => {
        dot.classList.remove('active', 'accent');
    });
    
    if (dots.length > 0 && beatIndex < dots.length) {
        const activeDot = dots[beatIndex];
        if (isAccent) {
            activeDot.classList.add('accent');
        } else {
            activeDot.classList.add('active');
        }
    }
}

// Event Listeners
playBtn.addEventListener('click', startStop);

bpmSlider.addEventListener('input', (e) => {
    updateBpm(parseInt(e.target.value, 10));
});

stepBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step, 10);
        updateBpm(bpm + step);
    });
});

beatsSelect.addEventListener('change', (e) => {
    beatsPerBar = parseInt(e.target.value, 10);
    updateVisualizer();
});

timerToggle.addEventListener('change', (e) => {
    isTimerSession = e.target.checked;
    if (isTimerSession) {
        timerDisplayContainer.style.display = 'block';
        if (!isPlaying) {
            remainingTime = sessionDuration;
            updateTimerDisplay();
        }
    } else {
        timerDisplayContainer.style.display = 'none';
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        startStop();
    } else if (e.code === 'ArrowUp') {
        updateBpm(bpm + 1);
    } else if (e.code === 'ArrowDown') {
        updateBpm(bpm - 1);
    }
});
