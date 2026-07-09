/**
 * State Management
 */
const state = {
    settings: {
        theme: 'dark',
        bitWidth: 8,
        inputMethod: 'random',
        prefixFormatting: true,
        activeMode: 1,
        sourceBase: 'random',
        targetBase: 'random'
    },
    session: {
        streak: 0,
        score: { correct: 0, incorrect: 0 },
        history: []
    },
    currentQuestion: null
};

/**
 * DOM Elements mapping
 */
const el = {
    body: document.body,
    streakVal: document.getElementById('streak-val'),
    scoreVal: document.getElementById('score-val'),
    btnReview: document.getElementById('btn-review'),
    btnSettings: document.getElementById('btn-settings'),
    
    questionText: document.getElementById('question-text'),
    inputContainer: document.getElementById('input-container'),
    feedback: document.getElementById('feedback'),
    btnSubmit: document.getElementById('btn-submit'),
    btnSkip: document.getElementById('btn-skip'),
    btnNext: document.getElementById('btn-next'),
    
    modalSettings: document.getElementById('modal-settings'),
    setTheme: document.getElementById('set-theme'),
    setWidth: document.getElementById('set-width'),
    setInput: document.getElementById('set-input'),
    setPrefix: document.getElementById('set-prefix'),
    setMode: document.getElementById('set-mode'),
    setSource: document.getElementById('set-source'),
    setTarget: document.getElementById('set-target'),
    groupSource: document.getElementById('group-source-base'),
    groupTarget: document.getElementById('group-target-base'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnCancelSettings: document.getElementById('btn-cancel-settings'),
    
    modalReview: document.getElementById('modal-review'),
    reviewLog: document.getElementById('review-log'),
    btnCloseReview: document.getElementById('btn-close-review')
};

/**
 * Core Math & Masking (using BigInt to bypass 32-bit JS limitations)
 */
const getMask = (bits) => (1n << BigInt(bits)) - 1n;

const signExtend = (val, bits) => {
    let bVal = BigInt(val) & getMask(bits);
    let signBit = 1n << BigInt(bits - 1);
    if (bVal & signBit) return bVal - (1n << BigInt(bits));
    return bVal;
};

const generateRandom = (bits) => {
    // Generate up to 32 bits safely using double precision random
    let upper = Number(1n << BigInt(bits));
    return BigInt(Math.floor(Math.random() * upper));
};

const formatBin = (val, bits, prefix) => {
    let bVal = BigInt(val) & getMask(bits);
    let s = bVal.toString(2).padStart(bits, '0');
    s = s.match(/.{1,4}/g).join(' '); // Add spacing for readability
    return (prefix ? '0b' : '') + s;
};

const formatHex = (val, bits, prefix) => {
    let bVal = BigInt(val) & getMask(bits);
    let hexChars = bits / 4;
    let s = bVal.toString(16).padStart(hexChars, '0').toUpperCase();
    return (prefix ? '0x' : '') + s;
};

const formatAscii = (val, bits) => {
    let chars = bits / 8;
    let str = "";
    for(let i = 0; i < chars; i++) {
        let c = Number((BigInt(val) >> BigInt(8 * (chars - 1 - i))) & 0xFFn);
        str += String.fromCharCode(c);
    }
    return str;
};

const generateAscii = (bits) => {
    let chars = bits / 8;
    let str = "";
    let val = 0n;
    for (let i = 0; i < chars; i++) {
        let c = BigInt(Math.floor(Math.random() * (126 - 32 + 1)) + 32); 
        str += String.fromCharCode(Number(c));
        val = (val << 8n) | c; 
    }
    return { val, str };
};

const formatValue = (val, format, bits) => {
    if (format === 'bin') return formatBin(val, bits, state.settings.prefixFormatting);
    if (format === 'hex') return formatHex(val, bits, state.settings.prefixFormatting);
    if (format === 'dec') return val.toString();
    if (format === 'oct') {
        let digits = Math.ceil(bits / 3);
        return (BigInt(val) & getMask(bits)).toString(8).padStart(digits, '0');
    }
    return "";
};

/**
 * Quiz Mode Generators
 */
const modes = {
    // Mode 1: Base & Encoding
    1: () => {
        let bits = state.settings.bitWidth;
        let formats = ['bin', 'hex', 'dec', 'oct', 'ascii'];
        let validFormats = bits === 8 ? formats : ['bin', 'hex', 'dec', 'oct']; 
        
        let srcSet = state.settings.sourceBase;
        let tgtSet = state.settings.targetBase;
        
        if (srcSet === 'random' && bits !== 8) validFormats = ['bin', 'hex', 'dec', 'oct'];
        
        let from = srcSet !== 'random' ? srcSet : validFormats[Math.floor(Math.random() * validFormats.length)];
        let to;
        
        if (tgtSet !== 'random') {
            to = tgtSet;
        } else {
            let availableTo = validFormats.filter(f => f !== from);
            to = availableTo[Math.floor(Math.random() * availableTo.length)];
        }
        
        if (from === to) {
            let availableTo = formats.filter(f => f !== from);
            to = availableTo[Math.floor(Math.random() * availableTo.length)];
        }
        
        // Randomize conversion direction between the two chosen bases
        if (Math.random() > 0.5) {
            let temp = from;
            from = to;
            to = temp;
        }
        
        let val, fromStr, toStr;
        
        if (from === 'ascii' || to === 'ascii') {
            let asc = generateAscii(bits);
            val = asc.val;
            fromStr = (from === 'ascii') ? "'" + asc.str + "'" : formatValue(val, from, bits);
            toStr = (to === 'ascii') ? "'" + asc.str + "'" : formatValue(val, to, bits);
        } else {
            val = generateRandom(bits);
            fromStr = formatValue(val, from, bits);
            toStr = formatValue(val, to, bits);
        }
        
        let text = `Convert ${from.toUpperCase()} to ${to.toUpperCase()}:<br><br><strong>${fromStr}</strong>`;
        
        let wrong = [];
        while (wrong.length < 3) {
            let wVal = (from === 'ascii' || to === 'ascii') ? generateAscii(bits).val : generateRandom(bits);
            let wStr = (to === 'ascii') ? "'" + formatAscii(wVal, bits) + "'" : formatValue(wVal, to, bits);
            if (wStr !== toStr && !wrong.includes(wStr)) wrong.push(wStr);
        }
        return { text, answer: toStr, wrong };
    },

    // Mode 2: Two's Complement
    2: () => {
        let bits = state.settings.bitWidth;
        let isSignedToHex = Math.random() > 0.5;
        let val = generateRandom(bits);
        let signedDec = signExtend(val, bits).toString();
        let hexStr = formatHex(val, bits, state.settings.prefixFormatting);
        let binStr = formatBin(val, bits, state.settings.prefixFormatting);
        let fromFormat = Math.random() > 0.5 ? hexStr : binStr;
        let fromName = fromFormat === hexStr ? 'Hexadecimal' : 'Binary';
        
        let text, answer, toGen;
        if (isSignedToHex) {
            text = `Convert Signed Decimal (Two's Complement) to ${fromName}:<br><br><strong>${signedDec}</strong>`;
            answer = fromFormat;
            toGen = () => (fromFormat === hexStr) ? formatHex(generateRandom(bits), bits, state.settings.prefixFormatting) : formatBin(generateRandom(bits), bits, state.settings.prefixFormatting);
        } else {
            text = `Convert ${fromName} to Signed Decimal (Two's Complement):<br><br><strong>${fromFormat}</strong>`;
            answer = signedDec;
            toGen = () => signExtend(generateRandom(bits), bits).toString();
        }

        let wrong = [];
        while (wrong.length < 3) {
            let wStr = toGen();
            if (wStr !== answer && !wrong.includes(wStr)) wrong.push(wStr);
        }
        return { text, answer, wrong };
    },

    // Mode 3: Endianness
    3: () => {
        let bits = state.settings.bitWidth;
        if (bits === 8) {
            return { text: "Endianness reversal requires 16-bit or 32-bit. Please change your settings.", answer: "N/A", wrong: ["N/A", "N/A", "N/A"] };
        }
        
        let val = generateRandom(bits);
        let hexStr = formatHex(val, bits, false); // Generate without prefix for byte swapping
        let bytes = hexStr.match(/.{2}/g);
        let leStr = bytes.reverse().join('');
        
        let isToLe = Math.random() > 0.5;
        let pre = state.settings.prefixFormatting ? '0x' : '';
        
        let text = isToLe 
            ? `Convert Big-Endian Hex to Little-Endian Hex:<br><br><strong>${pre}${hexStr}</strong>`
            : `Convert Little-Endian Hex to Big-Endian Hex:<br><br><strong>${pre}${leStr}</strong>`;
            
        let answer = pre + (isToLe ? leStr : hexStr);
        
        let wrong = [];
        while (wrong.length < 3) {
            let wVal = generateRandom(bits);
            let wHex = formatHex(wVal, bits, false);
            let wBytes = wHex.match(/.{2}/g);
            let wAns = pre + (isToLe ? wBytes.reverse().join('') : wHex);
            if (wAns !== answer && !wrong.includes(wAns)) wrong.push(wAns);
        }
        return { text, answer, wrong };
    },

    // Mode 4: Bitwise Logic
    4: () => {
        let bits = state.settings.bitWidth;
        let a = generateRandom(bits);
        let b = generateRandom(bits);
        let ops = ['&', '|', '^', '~', '<<', '>>'];
        let op = ops[Math.floor(Math.random() * ops.length)];
        
        let result;
        let text;
        let fmt = (v) => formatHex(v, bits, state.settings.prefixFormatting);
        
        if (op === '~') {
            result = (~a) & getMask(bits);
            text = `Evaluate Bitwise NOT:<br><br><strong>~ ${fmt(a)}</strong>`;
        } else if (op === '<<' || op === '>>') {
            let shiftMax = bits - 1;
            let shift = BigInt(Math.floor(Math.random() * shiftMax) + 1); 
            if (op === '<<') {
                result = (a << shift) & getMask(bits);
            } else {
                result = (a >> shift) & getMask(bits); // Logical right shift equivalent since we operate on BigInt and mask it
            }
            text = `Evaluate Bitwise Shift:<br><br><strong>${fmt(a)} ${op} ${shift}</strong>`;
        } else {
            if (op === '&') result = (a & b) & getMask(bits);
            if (op === '|') result = (a | b) & getMask(bits);
            if (op === '^') result = (a ^ b) & getMask(bits);
            text = `Evaluate Expression:<br><br><strong>${fmt(a)} ${op} ${fmt(b)}</strong>`;
        }
        
        let answer = fmt(result);
        let wrong = [];
        while(wrong.length < 3) {
            let w = fmt(generateRandom(bits));
            if (w !== answer && !wrong.includes(w)) wrong.push(w);
        }
        return { text, answer, wrong };
    },

    // Mode 5: CPU Flags
    5: () => {
        let bits = state.settings.bitWidth;
        let a = generateRandom(bits);
        let b = generateRandom(bits);
        let isAdd = Math.random() > 0.5;
        
        let mask = getMask(bits);
        let resultUnmasked = isAdd ? (a + b) : (a - b);
        let result = resultUnmasked & mask;
        
        let zf = (result === 0n);
        let sf = ((result & (1n << BigInt(bits - 1))) !== 0n);
        let cf = isAdd ? (resultUnmasked > mask) : (resultUnmasked < 0n);
        
        let signA = (a & (1n << BigInt(bits - 1))) !== 0n;
        let signB = (b & (1n << BigInt(bits - 1))) !== 0n;
        let signR = sf;
        let of = isAdd 
            ? (signA === signB && signA !== signR)
            : (signA !== signB && signA !== signR);
            
        let text = `ALU Operation (${bits}-bit):<br><br><strong>${formatHex(a, bits, true)} ${isAdd?'+':'-'} ${formatHex(b, bits, true)}</strong><br><br>Identify the resulting flags:`;
        
        let answer = { ZF: zf, SF: sf, CF: cf, OF: of };
        return { text, answer, isFlags: true };
    }
};

/**
 * Controller Logic
 */
function init() {
    loadSettingsFromUI();
    bindEvents();
    startNewQuestion();
}

function bindEvents() {
    el.btnSettings.addEventListener('click', () => {
        updateBaseDropdowns(); // Ensure correct state on open
        el.modalSettings.classList.remove('hidden');
    });
    
    el.setMode.addEventListener('change', (e) => {
        let isMode1 = e.target.value === '1';
        el.groupSource.style.display = isMode1 ? 'flex' : 'none';
        el.groupTarget.style.display = isMode1 ? 'flex' : 'none';
    });
    
    el.setSource.addEventListener('change', updateBaseDropdowns);
    el.setTarget.addEventListener('change', updateBaseDropdowns);
    
    el.btnCancelSettings.addEventListener('click', () => {
        el.modalSettings.classList.add('hidden');
        syncUIWithSettings(); // Revert unsaved UI changes
    });
    
    el.btnSaveSettings.addEventListener('click', () => {
        if (el.setMode.value === '1' && el.setSource.value !== 'random' && el.setSource.value === el.setTarget.value) {
            alert("Base Option 1 and Base Option 2 cannot be the same!");
            return;
        }
        loadSettingsFromUI();
        el.modalSettings.classList.add('hidden');
        applyTheme();
        resetSession();
        startNewQuestion();
    });

    el.btnReview.addEventListener('click', () => {
        renderReviewLog();
        el.modalReview.classList.remove('hidden');
    });
    
    el.btnCloseReview.addEventListener('click', () => {
        el.modalReview.classList.add('hidden');
    });

    el.btnSkip.addEventListener('click', skipQuestion);
    el.btnNext.addEventListener('click', startNewQuestion);
    el.btnSubmit.addEventListener('click', submitTextOrFlags);
}

function loadSettingsFromUI() {
    state.settings.theme = el.setTheme.value;
    state.settings.bitWidth = parseInt(el.setWidth.value);
    state.settings.inputMethod = el.setInput.value;
    state.settings.prefixFormatting = el.setPrefix.value === 'true';
    state.settings.activeMode = parseInt(el.setMode.value);
    state.settings.sourceBase = el.setSource.value;
    state.settings.targetBase = el.setTarget.value;
}

function syncUIWithSettings() {
    el.setTheme.value = state.settings.theme;
    el.setWidth.value = state.settings.bitWidth;
    el.setInput.value = state.settings.inputMethod;
    el.setPrefix.value = state.settings.prefixFormatting ? 'true' : 'false';
    el.setMode.value = state.settings.activeMode;
    el.setSource.value = state.settings.sourceBase;
    el.setTarget.value = state.settings.targetBase;
    
    let isMode1 = state.settings.activeMode === 1;
    el.groupSource.style.display = isMode1 ? 'flex' : 'none';
    el.groupTarget.style.display = isMode1 ? 'flex' : 'none';
    updateBaseDropdowns();
}

function updateBaseDropdowns() {
    let src = el.setSource.value;
    let tgt = el.setTarget.value;
    
    Array.from(el.setTarget.options).forEach(opt => {
        opt.disabled = (opt.value !== 'random' && opt.value === src);
    });
    
    Array.from(el.setSource.options).forEach(opt => {
        opt.disabled = (opt.value !== 'random' && opt.value === tgt);
    });
}

function applyTheme() {
    if (state.settings.theme === 'light') {
        el.body.classList.add('theme-light');
        el.body.classList.remove('theme-dark');
    } else {
        el.body.classList.add('theme-dark');
        el.body.classList.remove('theme-light');
    }
}

function resetSession() {
    state.session.streak = 0;
    state.session.score = { correct: 0, incorrect: 0 };
    state.session.history = [];
    updateScoreboard();
}

function startNewQuestion() {
    el.feedback.className = 'feedback';
    el.feedback.textContent = '';
    el.btnNext.style.display = 'none';
    el.btnSkip.style.display = 'inline-block';
    
    let gen = modes[state.settings.activeMode]();
    state.currentQuestion = gen;
    
    el.questionText.innerHTML = gen.text;
    
    renderInputUI();
}

function renderInputUI() {
    el.inputContainer.innerHTML = '';
    el.btnSubmit.style.display = 'none';
    let q = state.currentQuestion;

    if (q.isFlags) {
        // Mode 5 (Flags) - Always check boxes
        let group = document.createElement('div');
        group.className = 'checkbox-group';
        ['ZF', 'SF', 'CF', 'OF'].forEach(flag => {
            let label = document.createElement('label');
            label.className = 'checkbox-item';
            let chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.id = `chk-${flag}`;
            label.appendChild(chk);
            label.appendChild(document.createTextNode(flag));
            group.appendChild(label);
        });
        el.inputContainer.appendChild(group);
        el.btnSubmit.style.display = 'inline-block';
    } else {
        // Modes 1-4
        let method = state.settings.inputMethod;
        if (method === 'random') method = Math.random() > 0.5 ? 'mc' : 'text';
        
        if (method === 'mc') {
            let grid = document.createElement('div');
            grid.className = 'mc-grid';
            let opts = [q.answer, ...q.wrong].sort(() => Math.random() - 0.5);
            opts.forEach(opt => {
                let btn = document.createElement('button');
                btn.className = 'mc-btn';
                btn.textContent = opt;
                btn.onclick = () => processAnswer(opt);
                grid.appendChild(btn);
            });
            el.inputContainer.appendChild(grid);
        } else {
            let inp = document.createElement('input');
            inp.type = 'text';
            inp.id = 'text-answer';
            inp.className = 'text-input';
            inp.placeholder = 'Enter value...';
            inp.autocomplete = 'off';
            inp.onkeypress = (e) => { if (e.key === 'Enter') submitTextOrFlags(); };
            el.inputContainer.appendChild(inp);
            el.btnSubmit.style.display = 'inline-block';
            setTimeout(() => inp.focus(), 10);
        }
    }
}

function submitTextOrFlags() {
    let q = state.currentQuestion;
    if (q.isFlags) {
        let userAns = {
            ZF: document.getElementById('chk-ZF').checked,
            SF: document.getElementById('chk-SF').checked,
            CF: document.getElementById('chk-CF').checked,
            OF: document.getElementById('chk-OF').checked
        };
        processAnswer(userAns);
    } else {
        let inp = document.getElementById('text-answer');
        if (inp) processAnswer(inp.value);
    }
}

const normalize = (str) => String(str).trim().toLowerCase().replace(/\s/g, '');

function processAnswer(userAnswer) {
    let q = state.currentQuestion;
    let isCorrect = false;
    let formattedUserAns = userAnswer;
    let formattedCorrectAns = q.answer;

    if (q.isFlags) {
        isCorrect = (userAnswer.ZF === q.answer.ZF && 
                     userAnswer.SF === q.answer.SF && 
                     userAnswer.CF === q.answer.CF &&
                     userAnswer.OF === q.answer.OF);
        formattedUserAns = `ZF:${userAnswer.ZF?1:0} SF:${userAnswer.SF?1:0} CF:${userAnswer.CF?1:0} OF:${userAnswer.OF?1:0}`;
        formattedCorrectAns = `ZF:${q.answer.ZF?1:0} SF:${q.answer.SF?1:0} CF:${q.answer.CF?1:0} OF:${q.answer.OF?1:0}`;
    } else {
        let uNorm = normalize(userAnswer);
        let cNorm = normalize(q.answer);
        isCorrect = uNorm === cNorm;
        
        // Soft check for missing prefixes if required
        if (!isCorrect && state.settings.prefixFormatting) {
            isCorrect = uNorm === cNorm.replace(/0x|0b/i, '');
        }
    }

    if (isCorrect) {
        el.feedback.textContent = '[ SUCCESS: Correct Match ]';
        el.feedback.className = 'feedback success';
        state.session.score.correct++;
        state.session.streak++;
    } else {
        el.feedback.textContent = `[ ERROR: Expected ${formattedCorrectAns} ]`;
        el.feedback.className = 'feedback error';
        state.session.score.incorrect++;
        state.session.streak = 0;
    }

    logHistory(q.text, formattedUserAns, formattedCorrectAns, isCorrect);
    updateScoreboard();
    endQuestionState();
}

function skipQuestion() {
    let q = state.currentQuestion;
    let formattedCorrectAns = q.answer;
    if (q.isFlags) {
        formattedCorrectAns = `ZF:${q.answer.ZF?1:0} SF:${q.answer.SF?1:0} CF:${q.answer.CF?1:0} OF:${q.answer.OF?1:0}`;
    }
    
    el.feedback.textContent = `[ ABORTED: Correct answer is ${formattedCorrectAns} ]`;
    el.feedback.className = 'feedback error';
    
    state.session.score.incorrect++;
    state.session.streak = 0;
    
    logHistory(q.text, 'SKIPPED', formattedCorrectAns, false);
    updateScoreboard();
    endQuestionState();
}

function endQuestionState() {
    let inputs = el.inputContainer.querySelectorAll('input, button');
    inputs.forEach(i => i.disabled = true);
    
    el.btnSubmit.style.display = 'none';
    el.btnSkip.style.display = 'none';
    el.btnNext.style.display = 'inline-block';
    el.btnNext.focus();
}

function updateScoreboard() {
    el.streakVal.textContent = state.session.streak;
    el.scoreVal.textContent = `${state.session.score.correct} / ${state.session.score.incorrect}`;
}

function logHistory(qText, userAns, correctAns, isCorrect) {
    state.session.history.unshift({ qText, userAns, correctAns, isCorrect });
}

function renderReviewLog() {
    el.reviewLog.innerHTML = '';
    if (state.session.history.length === 0) {
        el.reviewLog.innerHTML = '<p>No history for this session yet.</p>';
        return;
    }
    
    state.session.history.forEach(log => {
        let div = document.createElement('div');
        div.className = `log-entry ${log.isCorrect ? 'correct' : 'incorrect'}`;
        
        // Safely strip HTML tags for history view if needed
        let qStr = log.qText.replace(/<br>/g, ' ').replace(/<\/?strong>/g, '');
        
        div.innerHTML = `
            <p class="log-q">${qStr}</p>
            <p class="log-u">Your Answer: ${log.userAns}</p>
            ${!log.isCorrect ? `<p class="log-a">Correct Answer: ${log.correctAns}</p>` : ''}
        `;
        el.reviewLog.appendChild(div);
    });
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
