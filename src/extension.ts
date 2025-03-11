import * as vscode from 'vscode';
import * as crypto from 'crypto';

/* ------------------------------------------------------------------------- */
/*                                 Constants                                 */
/* ------------------------------------------------------------------------- */

const DEFAULT_GASLIGHTING_CHANCE = 5; // 5% chance of gaslighting per line
const MIN_LINE_LENGTH = 10; // Minimum line length to apply gaslighting (trimmed)

// Core gaslighting messages
const GASLIGHTING_MESSAGES = [
    'Are you sure this will pass the code quality checks? 🤔',
    'Is this line really covered by unit tests? 🧐',
    "I wouldn't commit that line without double checking... 💭",
    'Your tech lead might have questions about this one 🤔',
    "That's an... interesting way to solve this 🤯",
    'Did you really mean to write it this way? 🤔',
    "Maybe add a comment explaining why this isn't as bad as it looks? 📝",
    'Bold choice! Very... creative 💡',
    'Please. Tell me Copilot wrote this one... 🤖',
    'Totally not a memory leak... 🚽',
    "I'd be embarrassed to push this to git if I were you. 😳",
    'This line is... unique 🦄',
    'Are you sure this is the best approach? 🤔',
    'This might come back to haunt you... 👻',
    'Read that again, but slowly. 📖',
    'Speak with your duck about this one 🦆',
    'You might want to catch this kind of technical debt early... 💸',
    'I hope you have a good reason for this... 🤨',
    'And I thought SQL injections were a thing of the past... 🕰️',
    'Here you go https://stackoverflow.com/questions/ask 🤓',
    'Better get the intern to review this one... 🧑‍💼',
    'Maybe be a little harder on yourself next time? 🤔',
    "Is that the best you can do? Or are you saving your best for production? 🤔",
    "I hope you enjoy debugging surprises. 🐞",
    "This code might be revolutionary, if it ever runs. 🚀",
    "I see you've embraced the 'it works on my machine' philosophy. 🤷",
    "Ever considered that this might be overengineering? 😅",
    "Did you try to explain this to your future self? 🤯",
    "I admire your confidence in ignoring best practices. 😏",
    "I bet your QA team is in for a treat. 🍿",
    "If code quality was optional, you'd be a millionaire. 💸",
    "This reminds me of a Rubik's cube—colorful but confusing. 🧩",
    "Maybe we should add a disclaimer: 'May cause unexpected crashes.' 🚨",
    "This is what happens when creativity meets technical debt. ⚡",
    "At least this code gives us something to talk about in stand-ups. 🗣️"
];

// Language-specific gaslighting messages
const LANGUAGE_SPECIFIC_MESSAGES: Record<string, string[]> = {
    'javascript': [
        'Using == instead of ===? Bold choice... 🤨',
        'Callback hell is where dreams go to die ⛓️',
        'Another promise that will never be resolved... just like your career goals 🌈',
        'undefined is not a function... but neither is this code 🤷‍♂️',
        'Did you remember to check if this is undefined? Probably not 🙃',
    ],
    'typescript': [
        'any type? Why even use TypeScript then? 🙄',
        'Those generics are... creative 🧩',
        'Type assertions are just lies in disguise 🎭',
        'Suppressing TypeScript errors instead of fixing them? Classic 🧠',
    ],
    'python': [
        'Indentation error waiting to happen... 🐍',
        'Are you sure you\'re handling that None case? 🤔',
        'This will break in Python 4... if it ever comes out 🔮',
        'Global variables? Guido is crying somewhere 😢',
        'That list comprehension is impressively unreadable 🤹‍♂️',
    ],
    'java': [
        'Another AbstractSingletonProxyFactoryBean? 🏭',
        'I hope you like NullPointerExceptions 💥',
        'Enterprise-grade over-engineering at its finest 🏢',
        'Could use a few more design patterns here... only 7 so far 📚',
    ],
    'csharp': [
        'var all the things! Who needs explicit types? 🤷‍♂️',
        'LINQ to the extreme... readable? Who cares! 🧮',
        'Throwing exceptions is cheaper than checking, right? 💸',
        'This method is longer than a CVS receipt 📜',
    ],
    'html': [
        'Nested divs... how original 📦📦📦',
        'Semantic HTML? Never heard of it 🙈',
        'That\'s a lot of inline styles for someone who knows better 🎨',
        'Mobile users will LOVE this design 📱💔',
    ],
    'css': [
        '!important? Must be REALLY important then 🔥',
        'Positioning with negative margins... living dangerously 🧗‍♂️',
        'z-index: 9999; - planning for the future, I see 🚀',
        'This will look great in Internet Explorer 6 👴',
    ],
    'php': [
        'Ah, beautiful spaghetti 🍝',
        'SQL query in a loop? What could go wrong? 🧨',
        'This code smells worse than actual PHP 🦨',
        'Even WordPress would reject this 📢',
    ],
    'go': [
        'Error handling? Just return nil, it\'ll be fine 👍',
        'goroutines leaking like a sieve 💦',
        'That\'s not how channels work, but okay 📫',
        'if err != nil { copy paste; copy paste; copy paste } 🤖',
    ],
    'ruby': [
        'Monkey patching in production? Brave 🐒',
        'This code is more magical than Ruby itself ✨',
        'That metaprogramming will be fun to debug later 🧙‍♂️',
        'Someone\'s been reading too much Rails magic 📚',
    ],
    'rust': [
        'Fighting the borrow checker must be exhausting 🥊',
        'Unsafe block? I too like to live dangerously 🎲',
        'The Rust evangelism task force is very disappointed 📉',
        'Lifetime annotations: More is better, right? ⏳⏳⏳',
    ],
};

// Rare ultra-gaslighting messages (very low chance to appear)
const ULTRA_RARE_GASLIGHTING_MESSAGES = [
    'This code is so bad it made my parser cry actual tears 😭',
    'I\'ve shown this to GPT-5 and it\'s questioning its existence now 🤖',
    'Have you considered a career in underwater basket weaving? 🧺',
    'I would rather debug a COBOL mainframe than maintain this 💾',
    'This code has been flagged by the Geneva Convention 🚩',
    'Even Stack Overflow would downvote this question 👎',
    'AI will replace developers because of code like this 🤷‍♂️',
    'Error: Please insert caffeine to continue coding 🍵',
    'If code could talk, this line would beg for mercy 🙏',
    'Technical debt so high it crashed the economy 📈',
];

// Positive gaslighting messages
const POSITIVE_GASLIGHTING_MESSAGES = [
    'This code is so good it\'s... suspicious 🧐',
    'Wow, no one\'s ever thought to solve it this way before... probably for a reason 🌟',
    'This is elegant... TOO elegant. What are you hiding? 👁️',
    'Impressively clean. Almost like you\'re not telling us something 🤨',
    'Remarkably efficient. Are you sure it handles all edge cases? 🔍',
    'This looks great! Wait, did I miss something? 👀',
    'Perfect! *checks calendar* Is it opposite day? 📅',
    'Such beautiful code... shame about the performance 🐌',
];

// Imposter syndrome fuel
const IMPOSTER_SYNDROME_MESSAGES = [
    'Your colleagues are nodding but do they really understand this? Do you? 🤔',
    'You\'ve been staring at this for how long now? 👀',
    'Everyone else wrote this better in half the time 🏎️',
    'Maybe take another bootcamp? Just a thought 🏫',
    'Remember when you thought programming would be fun? 🤡',
    'Fake it till you make it! (Are you there yet?) 🎭',
    'Have you Googled this problem as many times as I think you have? 🔍',
    'Your stand-up tomorrow is going to be interesting... 🧍‍♂️',
];

// Existential crisis triggers
const EXISTENTIAL_CRISIS_MESSAGES = [
    'Is this why you got a Computer Science degree? 🎓',
    'This function will outlive us all... unfortunately 💀',
    'Each line you write brings us closer to the AI apocalypse 🤖',
    'In 100 years, no one will remember this code. Or you. 🤡',
    'How many hours of your finite life did you spend on this? ⏳',
    'This code = your legacy. Let that sink in. 🚪🚶‍♂️',
    'You\'ll be writing code like this until retirement... if that ever happens 👴',
    'Each character here is a moment you\'ll never get back ⌨️',
];

// Code pattern detection (regex patterns to trigger specific messages)
const CODE_PATTERNS = [
    { regex: /if\s*\(\s*.+\s*==\s*true\s*\)/, message: 'Comparing to true? That\'s... a choice 🤔' },
    { regex: /\/\/ TODO/, message: 'Another TODO that will never get done... 📝' },
    { regex: /console\.log\(/, message: 'Logging to console in production? Excellent choice 🌟' },
    { regex: /catch\s*\([^)]*\)\s*{}/, message: 'Empty catch block? What could go wrong! 🙈' },
    { regex: /function\s*\([^)]{60,}\)/, message: 'That\'s a lot of parameters. Have you heard of objects? 📦' },
    { regex: /setTimeout\(\s*[^,]+\s*,\s*0\s*\)/, message: 'setTimeout with 0ms... very clever... 🧠' },
    { regex: /[:;]\s*$/, message: 'Nice semicolon placement! Adds visual texture 👌' },
    { regex: /==[^=]/, message: 'Double equals? Living dangerously I see 🎭' },
    { regex: /\/\*[\s\S]*?\*\//, message: 'That comment is longer than your actual code 📚' },
    { regex: /[-+<>=]{5,}/, message: 'Those operators spell disaster in binary 💻' },
];

/* ------------------------------------------------------------------------- */
/*                               Configuration                               */
/* ------------------------------------------------------------------------- */

// Extension state
let isSyntaxGaslightingEnabled = true;
let gaslightingChancePercentage = DEFAULT_GASLIGHTING_CHANCE;
let streakCounter = 0;

// Decoration types for different severity levels
let mildDecorationType: vscode.TextEditorDecorationType;
let mediumDecorationType: vscode.TextEditorDecorationType;
let severeDecorationType: vscode.TextEditorDecorationType;

// Status bar item
let statusBarItem: vscode.StatusBarItem;

/* ------------------------------------------------------------------------- */
/*                             Global variables                              */
/* ------------------------------------------------------------------------- */

// Languages map for file extensions
const LANGUAGE_MAP: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cs': 'csharp',
    'html': 'html',
    'css': 'css',
    'php': 'php',
    'go': 'go',
    'rb': 'ruby',
    'rs': 'rust',
};

/* ------------------------------------------------------------------------- */
/*                            Extension functions                            */
/* ------------------------------------------------------------------------- */

export function activate(context: vscode.ExtensionContext) {
    console.log('Syntax Gaslighting is active. Your code is being judged...');
    
    // Create decoration types for different severity levels
    mildDecorationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; border-bottom: 2px dotted rgb(213, 221, 107)',
        isWholeLine: false,
    });
    
    mediumDecorationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; border-bottom: 2px dotted rgb(255, 165, 0)',
        isWholeLine: false,
    });
    
    severeDecorationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; border-bottom: 2px dotted rgb(255, 99, 71)',
        isWholeLine: false,
    });

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'syntax-gaslighting.toggle';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Set up decoration update timer
    let timeout: NodeJS.Timer | undefined = undefined;
    function triggerUpdateGaslightingDecorations() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        timeout = setTimeout(updateGaslightingDecorations, 500);
    }

    // Subscribe to editor and document change events
    vscode.window.onDidChangeActiveTextEditor(
        () => {
            if (isSyntaxGaslightingEnabled) {
                triggerUpdateGaslightingDecorations();
            }
            updateStatusBar();
        },
        null,
        context.subscriptions,
    );

    vscode.workspace.onDidChangeTextDocument(
        () => {
            if (isSyntaxGaslightingEnabled) {
                triggerUpdateGaslightingDecorations();
            }
        },
        null,
        context.subscriptions,
    );

    // Register command to toggle the extension
    const toggleCmd = vscode.commands.registerCommand('syntax-gaslighting.toggle', () => {
        isSyntaxGaslightingEnabled = !isSyntaxGaslightingEnabled;
        if (isSyntaxGaslightingEnabled) {
            vscode.window.showInformationMessage('Syntax Gaslighting enabled! Prepare to question everything...');
            triggerUpdateGaslightingDecorations();
        } else {
            vscode.window.showInformationMessage('Syntax Gaslighting disabled. You can code in peace now.');
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                clearDecorations(activeEditor);
            }
        }
        updateStatusBar();
    });

    // Register command to change gaslighting chance
    const changeChanceCmd = vscode.commands.registerCommand('syntax-gaslighting.editChance', async () => {
        const result = await vscode.window.showInputBox({
            prompt: 'Enter the percentage chance of gaslighting (1-100)',
            value: gaslightingChancePercentage.toString(),
            validateInput: (value: string) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1 || num > 100) {
                    return 'Please enter a number between 1 and 100';
                }
                return null;
            },
        });

        if (result !== undefined) {
            gaslightingChancePercentage = parseInt(result);
            vscode.window.showInformationMessage(`Gaslighting chance set to ${gaslightingChancePercentage}%`);
            triggerUpdateGaslightingDecorations();
            updateStatusBar();
        }
    });

    // Register command to reset streak counter
    const resetStreakCmd = vscode.commands.registerCommand('syntax-gaslighting.resetStreak', () => {
        streakCounter = 0;
        vscode.window.showInformationMessage('Gaslighting streak reset. Starting fresh!');
        updateStatusBar();
    });

    // Register command to show random gaslighting message (for fun)
    const randomMessageCmd = vscode.commands.registerCommand('syntax-gaslighting.randomMessage', () => {
        const messageArrays = [
            GASLIGHTING_MESSAGES,
            POSITIVE_GASLIGHTING_MESSAGES,
            IMPOSTER_SYNDROME_MESSAGES,
            EXISTENTIAL_CRISIS_MESSAGES
        ];
        
        const selectedArray = messageArrays[Math.floor(Math.random() * messageArrays.length)];
        const randomMessage = selectedArray[Math.floor(Math.random() * selectedArray.length)];
        
        vscode.window.showInformationMessage(randomMessage);
    });

    context.subscriptions.push(toggleCmd, changeChanceCmd, resetStreakCmd, randomMessageCmd);

    // Initial decorations
    if (vscode.window.activeTextEditor) {
        triggerUpdateGaslightingDecorations();
    }
}

export function deactivate() {
    // Clean up decorations when deactivating
    if (vscode.window.activeTextEditor) {
        clearDecorations(vscode.window.activeTextEditor);
    }
}

/* ------------------------------------------------------------------------- */
/*                                 Functions                                 */
/* ------------------------------------------------------------------------- */

// Update status bar with current stats
function updateStatusBar() {
    if (isSyntaxGaslightingEnabled) {
        statusBarItem.text = `$(alert) Gaslighting: ${gaslightingChancePercentage}% | Streak: ${streakCounter}`;
        statusBarItem.tooltip = 'Syntax Gaslighting is active. Click to toggle.';
    } else {
        statusBarItem.text = '$(check) Gaslighting: Off';
        statusBarItem.tooltip = 'Syntax Gaslighting is disabled. Click to toggle.';
    }
}

// Clear all decorations
function clearDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(mildDecorationType, []);
    editor.setDecorations(mediumDecorationType, []);
    editor.setDecorations(severeDecorationType, []);
}

// Create a deterministic hash from a string
function createHash(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
}

// Get time-based gaslighting chance
function getTimeBasedGaslightingChance(): number {
    const hour = new Date().getHours();
    // Late night coding (11 PM - 5 AM) increases chance
    if (hour >= 23 || hour <= 5) {
        return Math.min(gaslightingChancePercentage * 1.5, 100);
    }
    // Early morning (6 AM - 8 AM) slightly increases chance (tired coding)
    if (hour >= 6 && hour <= 8) {
        return Math.min(gaslightingChancePercentage * 1.2, 100);
    }
    // Post-lunch dip (2 PM - 3 PM) increases chance
    if (hour >= 14 && hour <= 15) {
        return Math.min(gaslightingChancePercentage * 1.3, 100);
    }
    return gaslightingChancePercentage;
}

// Get severity level for a specific line
function getSeverityLevel(lineText: string, selectionNum: number): 'mild' | 'medium' | 'severe' {
    // Base severity on line characteristics and random factor
    
    // Super long lines are more severe
    if (lineText.length > 100) {
        return 'severe';
    }
    
    // Check for code smells
    const hasCodeSmell = CODE_PATTERNS.some(pattern => pattern.regex.test(lineText));
    if (hasCodeSmell) {
        return selectionNum % 3 === 0 ? 'severe' : 'medium';
    }
    
    // Based on random number
    const severityRandom = selectionNum % 10;
    if (severityRandom < 2) {
        return 'severe';
    } else if (severityRandom < 5) {
        return 'medium';
    }
    return 'mild';
}

// Get message category based on deterministic selection
function getMessageCategory(hash: string): 'normal' | 'language' | 'pattern' | 'positive' | 'imposter' | 'existential' | 'ultra' {
    const categorySelector = parseInt(hash.substring(0, 4), 16) % 100;
    
    // Ultra rare (0.5% chance)
    if (categorySelector < 1) {
        return 'ultra';
    }
    
    // Pattern-based messages (15% chance)
    if (categorySelector < 16) {
        return 'pattern';
    }
    
    // Language-specific (20% chance)
    if (categorySelector < 36) {
        return 'language';
    }
    
    // Positive gaslighting (10% chance)
    if (categorySelector < 46) {
        return 'positive';
    }
    
    // Imposter syndrome (10% chance)
    if (categorySelector < 56) {
        return 'imposter';
    }
    
    // Existential crisis (10% chance)
    if (categorySelector < 66) {
        return 'existential';
    }
    
    // Normal gaslighting (rest - 34% chance)
    return 'normal';
}

// Get language-specific message if available
function getLanguageSpecificMessage(document: vscode.TextDocument, messageNum: number): string | null {
    const fileExtension = document.fileName.split('.').pop()?.toLowerCase();
    if (!fileExtension || !LANGUAGE_MAP[fileExtension]) {
        return null;
    }
    
    const language = LANGUAGE_MAP[fileExtension];
    const messages = LANGUAGE_SPECIFIC_MESSAGES[language];
    
    if (!messages || messages.length === 0) {
        return null;
    }
    
    return messages[messageNum % messages.length];
}

// Check for code patterns and return specific message if found
function getPatternSpecificMessage(lineText: string): string | null {
    for (const pattern of CODE_PATTERNS) {
        if (pattern.regex.test(lineText)) {
            return pattern.message;
        }
    }
    return null;
}

// Get gaslighting message based on line content and document context
function getGaslightingMessageForLine(document: vscode.TextDocument, line: vscode.TextLine): { message: string, severity: 'mild' | 'medium' | 'severe' } | null {
    const trimmedLineText = line.text.trim();
    const hash = createHash(trimmedLineText);
    
    // Use first 8 chars for selection decision
    const selectionNum = parseInt(hash.substring(0, 8), 16);
    
    // Use last 8 chars for message selection
    const messageNum = parseInt(hash.substring(hash.length - 8), 16);
    
    // Check time-based chance
    const currentGaslightingChance = getTimeBasedGaslightingChance();
    
    // Use the number to determine if we should show a message
    if (selectionNum % 100 < currentGaslightingChance) {
        // Determine message category
        const category = getMessageCategory(hash);
        let message: string;
        let severity: 'mild' | 'medium' | 'severe' = getSeverityLevel(trimmedLineText, selectionNum);
        
        switch (category) {
            case 'ultra':
                message = ULTRA_RARE_GASLIGHTING_MESSAGES[messageNum % ULTRA_RARE_GASLIGHTING_MESSAGES.length];
                severity = 'severe'; // Ultra messages are always severe
                break;
            case 'pattern':
                const patternMessage = getPatternSpecificMessage(trimmedLineText);
                if (patternMessage) {
                    message = patternMessage;
                } else {
                    message = GASLIGHTING_MESSAGES[messageNum % GASLIGHTING_MESSAGES.length];
                }
                break;
            case 'language':
                const languageMessage = getLanguageSpecificMessage(document, messageNum);
                if (languageMessage) {
                    message = languageMessage;
                } else {
                    message = GASLIGHTING_MESSAGES[messageNum % GASLIGHTING_MESSAGES.length];
                }
                break;
            case 'positive':
                message = POSITIVE_GASLIGHTING_MESSAGES[messageNum % POSITIVE_GASLIGHTING_MESSAGES.length];
                break;
            case 'imposter':
                message = IMPOSTER_SYNDROME_MESSAGES[messageNum % IMPOSTER_SYNDROME_MESSAGES.length];
                severity = 'medium'; // Imposter messages tend to be at least medium
                break;
            case 'existential':
                message = EXISTENTIAL_CRISIS_MESSAGES[messageNum % EXISTENTIAL_CRISIS_MESSAGES.length];
                severity = 'severe'; // Existential crises are severe
                break;
            default:
                message = GASLIGHTING_MESSAGES[messageNum % GASLIGHTING_MESSAGES.length];
        }
        
        return { message, severity };
    }
    
    return null;
}

// Check for streak milestones
function checkStreakMilestones() {
    const milestones = [10, 25, 50, 100, 200, 500];
    if (milestones.includes(streakCounter)) {
        vscode.window.showInformationMessage(`🏆 Achievement unlocked: ${streakCounter} gaslighting messages! Your code is truly special.`);
    }
}

// Main function to update decorations
async function updateGaslightingDecorations() {
    if (!isSyntaxGaslightingEnabled) {
        return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    const document = activeEditor.document;
    
    // Separate decorations by severity
    const mildDecorations: vscode.DecorationOptions[] = [];
    const mediumDecorations: vscode.DecorationOptions[] = [];
    const severeDecorations: vscode.DecorationOptions[] = [];

    // Parse the document line by line
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const trimmedLineText = line.text.trim();

        // Skip empty lines
        if (line.isEmptyOrWhitespace) {
            continue;
        }

        // Skip short lines
        if (trimmedLineText.length < MIN_LINE_LENGTH) {
            continue;
        }

        // Skip comments (basic comment detection)
        const isComment =
            trimmedLineText.startsWith('//') ||
            trimmedLineText.startsWith('#') ||
            trimmedLineText.startsWith('/*') ||
            trimmedLineText.startsWith('*') ||
            trimmedLineText.startsWith('<!--');
        if (isComment) {
            continue;
        }

        // Get gaslighting message and severity
        const result = getGaslightingMessageForLine(document, line);
        if (!result) {
            continue;
        }

        // Find the start of actual code (skip leading whitespace)
        const firstNonWhitespace = line.text.search(/\S/);
        if (firstNonWhitespace === -1) {
            continue;
        }

        // Create decoration with the gaslighting message
        const startPos = new vscode.Position(lineIndex, firstNonWhitespace);
        const endPos = new vscode.Position(lineIndex, line.text.length);
        
        const decoration = {
            range: new vscode.Range(startPos, endPos),
            hoverMessage: new vscode.MarkdownString(result.message),
        };

        // Add to appropriate decoration array based on severity
        switch (result.severity) {
            case 'mild':
                mildDecorations.push(decoration);
                break;
            case 'medium':
                mediumDecorations.push(decoration);
                break;
            case 'severe':
                severeDecorations.push(decoration);
                break;
        }
        
        // Increment streak counter for each new decoration
        streakCounter++;
    }

    // Apply decorations
    activeEditor.setDecorations(mildDecorationType, mildDecorations);
    activeEditor.setDecorations(mediumDecorationType, mediumDecorations);
    activeEditor.setDecorations(severeDecorationType, severeDecorations);
    
    // Update status bar
    updateStatusBar();
    
    // Check for streak milestones
    checkStreakMilestones();
}
