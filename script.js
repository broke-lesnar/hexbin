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
        targetBase: 'random',
        difficulty: 'medium'
    },
    session: {
        streak: 0,
        highestStreak: 0,
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
    bestStreakVal: document.getElementById('best-streak-val'),
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
    setWidth: document.getElementById('set-width'),
    setInput: document.getElementById('set-input'),
    setPrefix: document.getElementById('set-prefix'),
    setMode: document.getElementById('set-mode'),
    setDifficulty: document.getElementById('set-difficulty'),
    setSource: document.getElementById('set-source'),
    setTarget: document.getElementById('set-target'),
    groupMode1: document.getElementById('group-mode1-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnCancelSettings: document.getElementById('btn-cancel-settings'),
    btnCancelSettingsX: document.getElementById('btn-cancel-settings-x'),
    btnResetSettings: document.getElementById('btn-reset-settings'),
    btnClearProgress: document.getElementById('btn-clear-progress'),
    btnToggleTheme: document.getElementById('btn-toggle-theme'),
    
    modalReview: document.getElementById('modal-review'),
    reviewLog: document.getElementById('review-log'),
    btnCloseReview: document.getElementById('btn-close-review'),
    btnCloseReviewX: document.getElementById('btn-close-review-x'),

    btnToggleView: document.getElementById('btn-toggle-view'),
    drillCard: document.getElementById('drill-card'),
    converterCard: document.getElementById('converter-card'),
    convWidth: document.getElementById('conv-width'),
    convHex: document.getElementById('conv-hex'),
    convBin: document.getElementById('conv-bin'),
    convOct: document.getElementById('conv-oct'),
    convUdec: document.getElementById('conv-udec'),
    convSdec: document.getElementById('conv-sdec'),
    convAscii: document.getElementById('conv-ascii')
};

let settingsModal, reviewModal, confirmResetModal, confirmClearModal;
let isConverterView = false;

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
        
        let text = `Convert ${from.toUpperCase()} to ${to.toUpperCase()}:<br><br><code>${fromStr}</code>`;
        
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
            text = `Convert Signed Decimal (Two's Complement) to ${fromName}:<br><br><code>${signedDec}</code>`;
            answer = fromFormat;
            toGen = () => (fromFormat === hexStr) ? formatHex(generateRandom(bits), bits, state.settings.prefixFormatting) : formatBin(generateRandom(bits), bits, state.settings.prefixFormatting);
        } else {
            text = `Convert ${fromName} to Signed Decimal (Two's Complement):<br><br><code>${fromFormat}</code>`;
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
            ? `Convert Big-Endian Hex to Little-Endian Hex:<br><br><code>${pre}${hexStr}</code>`
            : `Convert Little-Endian Hex to Big-Endian Hex:<br><br><code>${pre}${leStr}</code>`;
            
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
            text = `Evaluate Bitwise NOT:<br><br><code>~ ${fmt(a)}</code>`;
        } else if (op === '<<' || op === '>>') {
            let shiftMax = bits - 1;
            let shift = BigInt(Math.floor(Math.random() * shiftMax) + 1); 
            if (op === '<<') {
                result = (a << shift) & getMask(bits);
            } else {
                result = (a >> shift) & getMask(bits); // Logical right shift equivalent since we operate on BigInt and mask it
            }
            text = `Evaluate Bitwise Shift:<br><br><code>${fmt(a)} ${op} ${shift}</code>`;
        } else {
            if (op === '&') result = (a & b) & getMask(bits);
            if (op === '|') result = (a | b) & getMask(bits);
            if (op === '^') result = (a ^ b) & getMask(bits);
            text = `Evaluate Expression:<br><br><code>${fmt(a)} ${op} ${fmt(b)}</code>`;
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
            
        let text = `ALU Operation (${bits}-bit):<br><br><code>${formatHex(a, bits, true)} ${isAdd?'+':'-'} ${formatHex(b, bits, true)}</code><br><br>Identify the resulting flags:`;
        
        let answer = { ZF: zf, SF: sf, CF: cf, OF: of };
        return { text, answer, isFlags: true };
    },

    // Mode 6: Boolean Algebra & Gates
    6: () => {
        let diff = state.settings.difficulty;
        let text, answer, wrong;
        
        const randBit = () => Math.random() > 0.5 ? 1 : 0;
        
        if (diff === 'easy') {
            let type = Math.floor(Math.random() * 3);
            if (type === 0) {
                let a = randBit(), b = randBit();
                let gates = ['AND', 'OR', 'XOR', 'NAND', 'NOR'];
                let gate = gates[Math.floor(Math.random() * gates.length)];
                let res;
                if (gate === 'AND') res = a & b;
                if (gate === 'OR') res = a | b;
                if (gate === 'XOR') res = a ^ b;
                if (gate === 'NAND') res = ~(a & b) & 1;
                if (gate === 'NOR') res = ~(a | b) & 1;
                text = `Evaluate:<br><br><code>A=${a}, B=${b}</code><br><code>A ${gate} B</code>`;
                answer = String(res);
                wrong = [String(res ^ 1)];
            } else if (type === 1) {
                let expr = Math.random() > 0.5 ? `A AND NOT A` : `A OR NOT A`;
                let ans = expr.includes('AND') ? '0' : '1';
                text = `Evaluate Basic Theorem:<br><br><code>${expr}</code>`;
                answer = ans;
                wrong = [ans === '0' ? '1' : '0'];
            } else {
                let qs = [
                    { q: "Outputs 1 if and only if all inputs are 1", a: "AND", w: ["OR", "XOR", "NAND"] },
                    { q: "Outputs 1 if any input is 1", a: "OR", w: ["AND", "XOR", "NOR"] },
                    { q: "Outputs 1 only when inputs are different", a: "XOR", w: ["AND", "OR", "XNOR"] },
                    { q: "Outputs 0 if and only if all inputs are 1", a: "NAND", w: ["AND", "NOR", "OR"] }
                ];
                let item = qs[Math.floor(Math.random() * qs.length)];
                text = `Identify the Logic Gate:<br><br><code>${item.q}</code>`;
                answer = item.a;
                wrong = item.w.sort(() => Math.random() - 0.5).slice(0, 3);
            }
        } else if (diff === 'medium') {
            let type = Math.floor(Math.random() * 2);
            if (type === 0) {
                let a = randBit(), b = randBit(), c = randBit();
                let ops = ['AND', 'OR', 'XOR'];
                let op1 = ops[Math.floor(Math.random() * ops.length)];
                let op2 = ops[Math.floor(Math.random() * ops.length)];
                let hasNot = Math.random() > 0.5;
                let expr, res;
                if (hasNot) {
                    expr = `(A ${op1} B) ${op2} (NOT C)`;
                    let r1 = op1 === 'AND' ? (a&b) : (op1 === 'OR' ? (a|b) : (a^b));
                    let nc = c ^ 1;
                    res = op2 === 'AND' ? (r1&nc) : (op2 === 'OR' ? (r1|nc) : (r1^nc));
                } else {
                    expr = `(A ${op1} B) ${op2} C`;
                    let r1 = op1 === 'AND' ? (a&b) : (op1 === 'OR' ? (a|b) : (a^b));
                    res = op2 === 'AND' ? (r1&c) : (op2 === 'OR' ? (r1|c) : (r1^c));
                }
                text = `Evaluate:<br><br><code>A=${a}, B=${b}, C=${c}</code><br><code>${expr}</code>`;
                answer = String(res);
                wrong = [String(res ^ 1)];
            } else {
                let qs = [
                    { q: "NOT (A OR B)", a: "NOT A AND NOT B", w: ["NOT A OR NOT B", "A AND B", "A OR B"] },
                    { q: "NOT (A AND B)", a: "NOT A OR NOT B", w: ["NOT A AND NOT B", "A OR B", "A AND B"] },
                    { q: "A OR (A AND B)", a: "A", w: ["B", "A OR B", "A AND B"] },
                    { q: "A AND (A OR B)", a: "A", w: ["B", "A AND B", "A OR B"] }
                ];
                let item = qs[Math.floor(Math.random() * qs.length)];
                text = `Simplify or apply De Morgan's:<br><br><code>${item.q}</code>`;
                answer = item.a;
                wrong = item.w;
            }
        } else {
            let type = Math.floor(Math.random() * 2);
            if (type === 0) {
                let a = randBit(), b = randBit(), c = randBit(), d = randBit();
                let expr = `(A XOR B) NAND (C NOR D)`;
                let r1 = a ^ b;
                let r2 = ~(c | d) & 1;
                let res = ~(r1 & r2) & 1;
                text = `Evaluate Complex Logic:<br><br><code>A=${a}, B=${b}, C=${c}, D=${d}</code><br><code>${expr}</code>`;
                answer = String(res);
                wrong = [String(res ^ 1)];
            } else {
                let qs = [
                    { q: "A XOR B", a: "(A AND NOT B) OR (NOT A AND B)", w: ["(A OR NOT B) AND (NOT A OR B)", "(A AND B) OR (NOT A AND NOT B)", "NOT A AND NOT B OR A AND B"] },
                    { q: "A XNOR B", a: "(A AND B) OR (NOT A AND NOT B)", w: ["(A AND NOT B) OR (NOT A AND B)", "(A OR B) AND (NOT A OR NOT B)", "NOT (A AND B) OR NOT (A OR B)"] },
                    { q: "Majority function (A,B,C)", a: "(A AND B) OR (B AND C) OR (A AND C)", w: ["(A OR B) AND (B OR C) AND (A OR C)", "A XOR B XOR C", "(A AND B AND C) OR NOT (A OR B OR C)"] }
                ];
                let item = qs[Math.floor(Math.random() * qs.length)];
                text = `Identify the Equivalent Expression:<br><br><code>${item.q}</code>`;
                answer = item.a;
                wrong = item.w;
            }
        }
        
        return { text, answer, wrong, forceMC: true };
    }
};

/**
 * Controller Logic
 */
function init() {
    loadData();
    syncUIWithSettings();
    applyTheme();
    bindEvents();
    bindConverterEvents();
    updateScoreboard();
    startNewQuestion();
}

function loadData() {
    try {
        let savedSettings = localStorage.getItem('hexbin_settings');
        if (savedSettings) {
            state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
        }
        let savedProgress = localStorage.getItem('hexbin_progress');
        if (savedProgress) {
            let progress = JSON.parse(savedProgress);
            state.session.highestStreak = progress.highestStreak || 0;
            state.session.streak = progress.streak || 0;
            state.session.score = progress.score || { correct: 0, incorrect: 0 };
        }
    } catch (e) {
        console.error('Error loading data', e);
    }
}

function saveSettings() {
    try {
        localStorage.setItem('hexbin_settings', JSON.stringify(state.settings));
    } catch (e) {
        console.error('Error saving settings', e);
    }
}

function saveProgress() {
    try {
        localStorage.setItem('hexbin_progress', JSON.stringify({
            highestStreak: state.session.highestStreak,
            streak: state.session.streak,
            score: state.session.score
        }));
    } catch (e) {
        console.error('Error saving progress', e);
    }
}

function resetSettings() {
    localStorage.removeItem('hexbin_settings');
    state.settings = {
        theme: 'dark', bitWidth: 8, inputMethod: 'random',
        prefixFormatting: true, activeMode: 1, sourceBase: 'random', targetBase: 'random',
        difficulty: 'medium'
    };
    syncUIWithSettings();
    applyTheme();
    saveProgress();
    settingsModal.hide();
}

function clearProgress() {
    localStorage.removeItem('hexbin_progress');
    state.session = {
        streak: 0, highestStreak: 0, score: { correct: 0, incorrect: 0 }, history: []
    };
    updateScoreboard();
    startNewQuestion();
    settingsModal.hide();
}

function bindEvents() {
    settingsModal = new bootstrap.Modal(document.getElementById('modal-settings'));
    reviewModal = new bootstrap.Modal(document.getElementById('modal-review'));
    confirmResetModal = new bootstrap.Modal(document.getElementById('modal-confirm-reset'));
    confirmClearModal = new bootstrap.Modal(document.getElementById('modal-confirm-clear'));

    el.btnSettings.addEventListener('click', () => {
        updateBaseDropdowns(); // Ensure correct state on open
        settingsModal.show();
    });
    
    el.setMode.addEventListener('change', (e) => {
        let isMode1 = e.target.value === '1';
        el.groupMode1.style.display = isMode1 ? 'block' : 'none';
    });
    
    el.setSource.addEventListener('change', updateBaseDropdowns);
    el.setTarget.addEventListener('change', updateBaseDropdowns);
    
    el.btnCancelSettings.addEventListener('click', () => {
        settingsModal.hide();
        syncUIWithSettings(); // Revert unsaved UI changes
    });
    
    el.btnCancelSettingsX.addEventListener('click', () => {
        settingsModal.hide();
        syncUIWithSettings(); 
    });
    
    el.btnResetSettings.addEventListener('click', () => confirmResetModal.show());
    el.btnClearProgress.addEventListener('click', () => confirmClearModal.show());
    
    document.getElementById('btn-confirm-reset').addEventListener('click', () => {
        resetSettings();
        confirmResetModal.hide();
    });
    
    document.getElementById('btn-confirm-clear').addEventListener('click', () => {
        clearProgress();
        confirmClearModal.hide();
    });
    
    el.btnToggleView.addEventListener('click', () => {
        isConverterView = !isConverterView;
        if (isConverterView) {
            el.drillCard.style.display = 'none';
            el.converterCard.style.display = 'block';
            el.btnToggleView.textContent = 'Back to Drill';
            el.btnToggleView.classList.replace('btn-outline-warning', 'btn-outline-success');
            document.querySelector('.streak-board').style.visibility = 'hidden';
        } else {
            el.drillCard.style.display = 'block';
            el.converterCard.style.display = 'none';
            el.btnToggleView.textContent = 'Converter';
            el.btnToggleView.classList.replace('btn-outline-success', 'btn-outline-warning');
            document.querySelector('.streak-board').style.visibility = 'visible';
        }
    });
    
    el.btnSaveSettings.addEventListener('click', () => {
        if (el.setMode.value === '1' && el.setSource.value !== 'random' && el.setSource.value === el.setTarget.value) {
            alert("Base Option 1 and Base Option 2 cannot be the same!");
            return;
        }
        
        let settingsChanged = false;
        if (state.settings.activeMode !== parseInt(el.setMode.value) ||
            state.settings.bitWidth !== parseInt(el.setWidth.value) ||
            state.settings.inputMethod !== el.setInput.value ||
            state.settings.prefixFormatting !== (el.setPrefix.value === 'true') ||
            state.settings.difficulty !== el.setDifficulty.value ||
            state.settings.sourceBase !== el.setSource.value ||
            state.settings.targetBase !== el.setTarget.value) {
            settingsChanged = true;
        }

        loadSettingsFromUI();
        settingsModal.hide();
        saveSettings();
        
        if (settingsChanged) {
            let isSubmitted = el.btnNext.style.display === 'inline-block';
            if (!isSubmitted) {
                state.session.score.incorrect++;
                state.session.streak = 0;
                
                let q = state.currentQuestion;
                let formattedCorrectAns = q.answer;
                if (q.isFlags) {
                    formattedCorrectAns = `ZF:${q.answer.ZF?1:0} SF:${q.answer.SF?1:0} CF:${q.answer.CF?1:0} OF:${q.answer.OF?1:0}`;
                }
                logHistory(q.text, 'ABORTED (Settings Changed)', formattedCorrectAns, false);
                saveProgress();
                updateScoreboard();
            }
            startNewQuestion();
        }
    });

    el.btnToggleTheme.addEventListener('click', () => {
        state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
        applyTheme();
        saveSettings();
    });

    el.btnReview.addEventListener('click', () => {
        renderReviewLog();
        reviewModal.show();
    });
    
    el.btnCloseReview.addEventListener('click', () => {
        reviewModal.hide();
    });
    
    el.btnCloseReviewX.addEventListener('click', () => {
        reviewModal.hide();
    });

    el.btnSkip.addEventListener('click', skipQuestion);
    el.btnNext.addEventListener('click', startNewQuestion);
    el.btnSubmit.addEventListener('click', submitTextOrFlags);

    // Global keyboard listener for Escape key to Skip / Show Answer
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            let isModalOpen = document.querySelector('.modal.show') !== null;
            if (!isModalOpen && el.btnSkip && el.btnSkip.style.display !== 'none' && !isConverterView) {
                e.preventDefault();
                skipQuestion();
            }
        }
    });
}

function loadSettingsFromUI() {
    state.settings.bitWidth = parseInt(el.setWidth.value);
    state.settings.inputMethod = el.setInput.value;
    state.settings.prefixFormatting = el.setPrefix.value === 'true';
    state.settings.activeMode = parseInt(el.setMode.value);
    state.settings.difficulty = el.setDifficulty.value;
    state.settings.sourceBase = el.setSource.value;
    state.settings.targetBase = el.setTarget.value;
}

function syncUIWithSettings() {
    el.setWidth.value = state.settings.bitWidth;
    el.setInput.value = state.settings.inputMethod;
    el.setPrefix.value = state.settings.prefixFormatting ? 'true' : 'false';
    el.setMode.value = state.settings.activeMode;
    if (el.setDifficulty) el.setDifficulty.value = state.settings.difficulty || 'medium';
    el.setSource.value = state.settings.sourceBase;
    el.setTarget.value = state.settings.targetBase;
    
    let isMode1 = state.settings.activeMode === 1;
    el.groupMode1.style.display = isMode1 ? 'block' : 'none';
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
    document.documentElement.setAttribute('data-bs-theme', state.settings.theme);
}

function resetSession() {
    state.session.streak = 0;
    state.session.score = { correct: 0, incorrect: 0 };
    state.session.history = [];
    updateScoreboard();
}

function startNewQuestion() {
    el.feedback.className = 'feedback fw-bold fs-5 mt-4 mb-3';
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
        group.className = 'btn-group d-flex w-100 mb-3 shadow-sm';
        group.setAttribute('role', 'group');
        
        ['ZF', 'SF', 'CF', 'OF'].forEach(flag => {
            let chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'btn-check';
            chk.id = `chk-${flag}`;
            chk.autocomplete = 'off';
            
            let label = document.createElement('label');
            label.className = 'btn btn-outline-primary fw-bold fs-5';
            label.setAttribute('for', `chk-${flag}`);
            label.textContent = flag;
            
            group.appendChild(chk);
            group.appendChild(label);
        });
        el.inputContainer.appendChild(group);
        el.btnSubmit.style.display = 'inline-block';
    } else {
        // Modes 1-4, 6
        let method = state.settings.inputMethod;
        if (q.forceMC) method = 'mc';
        if (method === 'random') method = Math.random() > 0.5 ? 'mc' : 'text';
        
        if (method === 'mc') {
            let grid = document.createElement('div');
            grid.className = 'd-grid gap-2 d-md-flex justify-content-md-center flex-wrap w-100';
            let opts = [q.answer, ...q.wrong].sort(() => Math.random() - 0.5);
            opts.forEach(opt => {
                let btn = document.createElement('button');
                btn.className = 'btn btn-outline-primary btn-lg flex-fill font-monospace';
                btn.textContent = opt;
                btn.onclick = () => processAnswer(opt);
                grid.appendChild(btn);
            });
            el.inputContainer.appendChild(grid);
        } else {
            let inp = document.createElement('input');
            inp.type = 'text';
            inp.id = 'text-answer';
            inp.className = 'form-control form-control-lg text-center font-monospace';
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
        el.feedback.className = 'feedback fw-bold fs-5 mt-4 mb-3 text-success';
        state.session.score.correct++;
        state.session.streak++;
        if (state.session.streak > state.session.highestStreak) {
            state.session.highestStreak = state.session.streak;
        }
    } else {
        el.feedback.textContent = `[ ERROR: Expected ${formattedCorrectAns} ]`;
        el.feedback.className = 'feedback fw-bold fs-5 mt-4 mb-3 text-danger';
        state.session.score.incorrect++;
        state.session.streak = 0;
    }

    logHistory(q.text, formattedUserAns, formattedCorrectAns, isCorrect);
    updateScoreboard();
    saveProgress();
    endQuestionState();
}

function skipQuestion() {
    let q = state.currentQuestion;
    let formattedCorrectAns = q.answer;
    if (q.isFlags) {
        formattedCorrectAns = `ZF:${q.answer.ZF?1:0} SF:${q.answer.SF?1:0} CF:${q.answer.CF?1:0} OF:${q.answer.OF?1:0}`;
    }
    
    el.feedback.textContent = `[ ABORTED: Correct answer is ${formattedCorrectAns} ]`;
    el.feedback.className = 'feedback fw-bold fs-5 mt-4 mb-3 text-danger';
    
    state.session.score.incorrect++;
    state.session.streak = 0;
    
    logHistory(q.text, 'SKIPPED', formattedCorrectAns, false);
    updateScoreboard();
    saveProgress();
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
    el.bestStreakVal.textContent = state.session.highestStreak;
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

function bindConverterEvents() {
    const inputs = [el.convHex, el.convBin, el.convOct, el.convUdec, el.convSdec, el.convAscii];
    
    const updateConverter = (sourceId, value) => {
        let bits = parseInt(el.convWidth.value);
        let mask = getMask(bits);
        let val = null;
        
        inputs.forEach(inp => inp.classList.remove('is-invalid'));
        if (!value.trim()) {
            inputs.forEach(inp => { if (inp.id !== sourceId) inp.value = ''; });
            return;
        }

        try {
            if (sourceId === 'conv-hex') {
                let clean = value.replace(/0x/i, '').replace(/\s/g, '');
                if (!/^[0-9a-fA-F]+$/.test(clean)) throw new Error();
                val = BigInt('0x' + clean);
            } else if (sourceId === 'conv-bin') {
                let clean = value.replace(/0b/i, '').replace(/\s/g, '');
                if (!/^[01]+$/.test(clean)) throw new Error();
                val = BigInt('0b' + clean);
            } else if (sourceId === 'conv-oct') {
                let clean = value.replace(/\s/g, '');
                if (!/^[0-7]+$/.test(clean)) throw new Error();
                val = BigInt('0o' + clean);
            } else if (sourceId === 'conv-udec') {
                let clean = value.replace(/\s/g, '');
                if (!/^[0-9]+$/.test(clean)) throw new Error();
                val = BigInt(clean);
            } else if (sourceId === 'conv-sdec') {
                let clean = value.replace(/\s/g, '');
                if (!/^-?[0-9]+$/.test(clean)) throw new Error();
                let sVal = BigInt(clean);
                if (sVal < 0n) {
                    val = sVal + (1n << BigInt(bits));
                } else {
                    val = sVal;
                }
            } else if (sourceId === 'conv-ascii') {
                val = 0n;
                for (let i = 0; i < value.length; i++) {
                    val = (val << 8n) | BigInt(value.charCodeAt(i));
                }
            }

            if (val === null) throw new Error();
            val = val & mask;

            if (sourceId !== 'conv-hex') el.convHex.value = formatHex(val, bits, false);
            if (sourceId !== 'conv-bin') el.convBin.value = formatBin(val, bits, false);
            if (sourceId !== 'conv-oct') el.convOct.value = formatValue(val, 'oct', bits);
            if (sourceId !== 'conv-udec') el.convUdec.value = val.toString();
            if (sourceId !== 'conv-sdec') el.convSdec.value = signExtend(val, bits).toString();
            if (sourceId !== 'conv-ascii') {
                let asciiStr = formatAscii(val, bits).replace(/\0/g, '');
                el.convAscii.value = asciiStr;
            }
        } catch (e) {
            document.getElementById(sourceId).classList.add('is-invalid');
            inputs.forEach(inp => { if (inp.id !== sourceId) inp.value = ''; });
        }
    };

    inputs.forEach(inp => {
        inp.addEventListener('input', (e) => updateConverter(e.target.id, e.target.value));
    });
    
    el.convWidth.addEventListener('change', () => {
        let activeInput = inputs.find(inp => inp.value !== '' && !inp.classList.contains('is-invalid'));
        if (activeInput) {
            updateConverter(activeInput.id, activeInput.value);
        }
    });
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
