setInterval(updateTime, 500);
// --- ДОДАТКОВИЙ КОД: ІНТЕРНАЦІОНАЛІЗАЦІЯ (i18n) ---
let currentStrings = {};
let currentLang = 'en';
let dateLang = "en-US";
let localeFormat = JSON.parse(localStorage.getItem("localeFormat")) || { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
let currentKeyboardLayout = "mac";
let displayType = "oled";
let notificationAPI;
let apps = [];
const devices = [];
const screens = [];
window.systemWorkers = []; // Реєстр для resmon


const OriginalWorker = window.Worker;
window.Worker = function(scriptURL, options) {
    const worker = new OriginalWorker(scriptURL, options);
    const workerId = 'worker_' + Math.random().toString(36).substr(2, 9);
    
    // Додаємо в реєстр
    window.systemWorkers.push({ id: workerId, url: scriptURL, instance: worker });
    
    // Видаляємо з реєстру при завершенні (якщо викликано terminate)
    const originalTerminate = worker.terminate;
    worker.terminate = function() {
        window.systemWorkers = window.systemWorkers.filter(w => w.id !== workerId);
        originalTerminate.call(this);
    };
    
    return worker;
};

window.updateFonts = function(action, fontName) {
  try{
    if (action === 'add') {
        if (!fonts.installed.includes(fontName)) {
            fonts.installed.push(fontName);
        }
    } else if (action === 'delete') {
        fonts.installed = fonts.installed.filter(f => f !== fontName);
        if (fonts.active === fontName) fonts.active = "";
    } else if (action === 'set') {
        fonts.active = fontName;
    }

    // Sync to storage
    localStorage.setItem("fonts", JSON.stringify(fonts));
    
    // Optional: Trigger UI refresh
    console.log(`Fonts updated:`, fonts);
  }catch (e){
    console.error(e.message)
  }
    

    
    setupFonts(); 
};

// Usage in your OS boot sequence:
let wm = WinBox;


// --- ЛОГІКА КЕРУВАННЯ ПРОЦЕСАМИ ---

function fore(id,type) {
        const winboxElement = document.getElementById(id);
        const winboxInstance = winboxElement ? (winboxElement.winbox || winboxElement._winbox) : null;
        if (winboxInstance) winboxInstance.show(1);
}

function kill(id, type) {
    if (type == "winbox") {
        const winboxElement = document.getElementById(id);
        const winboxInstance = winboxElement ? (winboxElement.winbox || winboxElement._winbox) : null;
        if (winboxInstance) winboxInstance.close(1);
    } 
    
    if (type == "worker") {
        // Знаходимо воркер у масиві за його текстовим ID
        const workerEntry = window.systemWorkers.find(w => w.id === id);
        
        if (workerEntry && workerEntry.instance) {
            // Викликаємо оригінальний або перевизначений terminate
            workerEntry.instance.terminate();
            console.log(`[Infinity OS] Worker ${id} killed.`);
        } else {
            console.error(`[Infinity OS] Worker with ID ${id} not found.`);
        }
    }
}

function getScreenDiagonalInches() {
    // Фізичні пікселі екрану
    const widthPx = window.screen.width * window.devicePixelRatio;
    const heightPx = window.screen.height * window.devicePixelRatio;
    
    // Спробуємо взяти фізичну щільність пікселів (DPI)
    // Якщо devicePixelRatio = 1, тоді приблизно 96 dpi на більшості дисплеїв
    const dpi = 96 * window.devicePixelRatio;
    
    // Розмір в дюймах
    const widthInches = widthPx / dpi;
    const heightInches = heightPx / dpi;
    
    // Діагональ по теоремі Піфагора
    const diagonalInches = Math.sqrt(widthInches ** 2 + heightInches ** 2);
    
    return diagonalInches-3.3;
}


 
async function buildDevProps() {
  const devProps = {
    model: _("unknown"),
    inchRes :getScreenDiagonalInches().toFixed(1) + "-inch",
    relYear: _("unknown"),
    chip: navigator.platform || _("unknown"),
    memory: navigator.deviceMemory ? navigator.deviceMemory + " GB" : "Unknown",
    os: {
      name: "Infinity OS",
      version: "23052026"
    },
    deviceIcon: navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches ? "assets/laptop.svg" : "assets/pc.svg"
  };
const scr = screen;
scr.type = "screen";
devices.push(scr)

  // 📱 userAgentData (Chromium-based)
  if (navigator.userAgentData) {
    try {
      const ua = await navigator.userAgentData.getHighEntropyValues([
        "model",
        "platform",
        "platformVersion",
        "architecture",
        "bitness"
      ]);

      if (ua.model) devProps.model = ua.model || _("unknown");

      devProps.chip = `${ua.platform} ${ua.architecture || ""} ${ua.bitness || ""}`.trim();

      // приблизний рік релізу (по версії платформи)
      if (ua.platformVersion) {
        devProps.relYear = "Platform v" + ua.platformVersion;
      }

    } catch (e) {
      console.warn("UA entropy blocked:", e);
    }
  } else {
    // 🧓 fallback
    devProps.model = navigator.userAgent;
  }

  // 🖥 CPU cores
  devProps.cores = navigator.hardwareConcurrency || _("unknown");

  // 🎮 GPU (через WebGL)
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

    if (debugInfo) {
      devProps.gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).replaceAll("(", "").replaceAll(")", "").trim()
    } else {
      devProps.gpu = _("unknown");
    }
  } catch {
    devProps.gpu = _("unknown");
  }

  return devProps;
}

let devProps;
let maxLS;

window.icns = {
    // --- Іконки програм (динамічні) ---
    files: "icons/files.svg",
    toolpointer: "icons/tool-pointer.svg",
    clock: "icons/clock.svg",
    calc: "icons/calc.svg",
    settings: "icons/settings.svg",
    term: "icons/terminal.svg",
    web: "icons/web.svg",
    tasks: "icons/tasks.svg",
    store: "icons/store.svg",

    // --- Іконки типів файлів (додані з обробника) ---
    textPlain: "icons/application-text.svg",
	 textRich: "icons/application-rtf.svg",
    imageGeneric: "icons/application-image.svg",
    audioGeneric: "icons/application-audio.svg",
    videoMp4: "icons/application-video.svg",
    archive: "icons/application-archive.svg",
    cdImage: "icons/application-x-cd-image.svg",
    pdf: "icons/application-pdf.svg",
    ms_theme: "icons/theme.svg",
    textHtml: "icons/text-html.svg",
    textJavascript: "icons/text-x-javascript.svg",
    textCss: "icons/text-css.svg",
    textCsv: "icons/text-csv.svg",
    font: "icons/font.svg",
    empty: "icons/application-blank.svg",
    folder: "icons/folder.svg",
    
    // Small icons
    dialogInfo: 'icons/dialog-info.svg',
    dialogQues: 'icons/dialog-ques.svg',
    dialogErr: 'icons/dialog-err.svg',
    dialogWarn: 'icons/dialog-warn.svg',
    
    // Drives
    lsDrive: 'icons/drive-ls.svg',
    dbDrive: 'icons/drive-idb.svg',
    usbDrive: 'icons/drive-usb.svg',
};
let vol = 1;

window.sounds = {
  error: new Audio("sounds/dialog-error.mp3"),
  startup: new Audio(""),
  info: new Audio(""),
  question: new Audio("sounds/dialog-confirm.mp3"),
  warn: new Audio(""),
  driveIn: new Audio("sounds/device-in.mp3"),
  driveOut: new Audio("sounds/device-out.mp3"),
  notify: new Audio(""),
  logout: new Audio(""),
  
  async play(aud) { // Додано дефолтне значення гучності
 let audio;
    let objectUrl = null;

    if (typeof aud !== "string") {
      if (!(aud instanceof Blob)) return;

      objectUrl = URL.createObjectURL(aud);
      audio = new Audio(objectUrl);
    } else {
      if (!this[aud]) {
        console.error(`Sound "${aud}" not found.`);
        return;
      }

      audio = this[aud];
    }

    audio.volume = vol;

    return new Promise((resolve) => {
      let finished = false;

      const done = () => {
        if (finished) return;
        finished = true;

        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }

        resolve();
      };

      audio.onended = done;
      audio.onerror = done;

      audio.play().catch((err) => {
        console.warn("Playback blocked:", err.message);
        done();
      });
    });
  }
};

async function safeShutdown({ restart = false } = {}) {
    console.log("Infinity OS: safe shutdown started");
    
    // 1. Звуковий супровід
    // Використовуємо проміс, щоб почекати завершення звуку або хоча б його початку
    await sounds.play("logout");

    // 2. Закрити всі вікна WinBox
    const winboxes = document.querySelectorAll(".winbox");
    winboxes.forEach(w => {
        try {
            if (w.winbox && typeof w.winbox.close === "function") {
                w.winbox.close();
            } else if (w.close) {
                w.close();
            }
        } catch(e) { console.warn("WinBox close err:", e); }
    });

    // 3. Відмонтувати активний носій (IndexedDB / LocalStorage)
    try {
        if (typeof dbInstances !== 'undefined' && typeof DB_NAME !== 'undefined' && DB_NAME) {
            const driveName = DB_NAME;
            
            // Якщо dbInstances[driveName] має метод close (як у IndexedDB)
            if (dbInstances[driveName] && typeof dbInstances[driveName].close === "function") {
                await dbInstances[driveName].close();
            }

            console.log("UnMounted:" + driveName);
            delete dbInstances[driveName];
            
            // Глобальні змінні (якщо вони не константи)
            if (typeof DB_NAME !== 'undefined') DB_NAME = "";
            if (typeof LAST_DB !== 'undefined') LAST_DB = "";
        }
    } catch (e) {
        console.warn("Unmount error:", e);
    }

    // 4. Невелика затримка для завершення записів/звуку
    await new Promise(resolve => setTimeout(resolve, 500));

    // 5. Фінальна дія
    if (restart) {
        console.log("Restarting system...");
        location.reload();
    } else {
        console.log("Shutting down...");
        // window.close() працює тільки якщо вікно було відкрите через JS (window.open)
        window.close();
        
        // Резервний варіант: очищення екрана, якщо window.close заблоковано браузером
        document.body.innerHTML = "<div style='background:#000;color:#fff;height:100vh;display:flex;align-items:center;justify-content:center;font-family:monospace;'>It is now safe to close your browser.</div>";
    }
}





const updateDevices = (e, isConnecting) => {
    let dev;

    if (e.gamepad){
    const { gamepad } = e;
    dev = gamepad;
    if (isConnecting) {
        // Додаємо об'єкт геймпада (можна розширити власними властивостями для Infinity OS)
                dev.type = "gamepad";
        devices.push(dev);
sounds.play("driveIn")
    } else {
        // Видаляємо за індексом, щоб уникнути помилок з однаковими моделями
        const index = devices.findIndex(d => d.index === gamepad.index);
        if (index !== -1) {
            sounds.play("driveOut")
            devices.splice(index, 1);
        }
    }
    }else{
        //...
    }
    new Notification(isConnecting ? _("device_connected"):_("device_disconnected"), {body: dev.type || "" , silent: true})
};

window.addEventListener("gamepadconnected", (e) => updateDevices(e, true));
window.addEventListener("gamepaddisconnected", (e) => updateDevices(e, false));




// THEMING AND STYLING ---

class ThemeParser {
    constructor() {
        this.colors = {};
    }

    // Конвертація "R G B" (Windows) у "rgb(R, G, B)" або HEX
    winColorToCSS(winColor) {
        if (!winColor) return null;
        const parts = winColor.trim().split(/\s+/);
        if (parts.length === 3) {
            return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
        }
        return winColor;
    }

    parse(fileContent) {
    // Розбиваємо лише за символом нового рядка
    const lines = fileContent.split(/\r?\n/);
    let currentSection = "";
    const data = {};

    lines.forEach(line => {
        line = line.trim();
        
        // Пропускаємо порожні рядки та коментарі (INI-style)
        if (!line || line.startsWith(';') || line.startsWith('#')) return;

        // Визначаємо секцію: [Section Name]
        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.toLowerCase(); // Залишаємо дужки для сумісності з вашим mapToInfinityVariables
            data[currentSection] = {};
        } 
        // Визначаємо ключ=значення
        else if (line.includes('=') && currentSection) {
            const separatorIndex = line.indexOf('=');
            const key = line.substring(0, separatorIndex).trim();
            const value = line.substring(separatorIndex + 1).trim();
            
            if (key) {
                data[currentSection][key] = value;
            }
        }
    });

    return {
        styles: this.mapToInfinityVariables(data),
        name: this.getName(data),
		type: data['[visualstyles]'] && data['[visualstyles]']['ColorizationColor'] ? "win_aero" : "win_cla"
    };
}
parseColorization(hex) {
    // hex приходить як "0x45409efe"
    const raw = hex.replace('0x', '');
    
    const a = parseInt(raw.substring(0, 2), 16); // 45 -> 69
    const r = parseInt(raw.substring(2, 4), 16); // 40 -> 64
    const g = parseInt(raw.substring(4, 6), 16); // 9e -> 158
    const b = parseInt(raw.substring(6, 8), 16); // fe -> 254

    // Конвертуємо альфа-канал з 0-255 у 0-1
    const alpha = (a / 255).toFixed(2);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
mapToInfinityVariables(data) {
    const cpColors = data['[control panel\\colors]'] || {};
    const vs = data['[visualstyles]'] || {};
    
    // 1. Classic Colors & Gradients
    const activeTitle = this.winColorToCSS(cpColors['ActiveTitle']) || '#0054e3';
    const gradActiveTitle = this.winColorToCSS(cpColors['GradientActiveTitle']) || activeTitle;
    const inactiveTitle = this.winColorToCSS(cpColors['InactiveTitle']) || '#76a1e8';
    const gradInactiveTitle = this.winColorToCSS(cpColors['GradientInactiveTitle']) || inactiveTitle;

    // 2. Modern Colorization (Vista/7/8)
    const colorization = vs['ColorizationColor'] || "";
    let md = 10; // Default radius
    let winActive, winInactive;

    if (colorization) {
        // MODERN MODE: Use the single colorization hex for windows
        const cssAccent = this.parseColorization(colorization);
        winActive = cssAccent;
        
        // Generate a slightly faded version for inactive modern windows
        // You can also use a fixed transparency or a slightly desaturated color
        winInactive = cssAccent.replace(/[\d.]+\)$/g, '0.4)'); 
        
        md = 10; 
    } else {
        // CLASSIC MODE: Use the gradients from Control Panel
        winActive = `linear-gradient(90deg, ${activeTitle} 0%, ${gradActiveTitle} 100%)`;
        winInactive = `linear-gradient(90deg, ${inactiveTitle} 0%, ${gradInactiveTitle} 100%)`;
        md = 0; // Classic themes usually have sharp corners
    }

    // 3. system Basics
const infoWindow = this.winColorToCSS(cpColors['InfoWindow']);
const infoText = this.winColorToCSS(cpColors['InfoText']);

    const windowBg = this.winColorToCSS(cpColors['Window']) || '#ffffff';
    const windowText = this.winColorToCSS(cpColors['WindowText']) || '#000';

    const highlight = this.winColorToCSS(cpColors['Highlight']) || '#326ba8';
    const buttonFace = this.winColorToCSS(cpColors['ButtonFace']) || '#f0f0f0';


    document.body.style.backgroundColor = this.winColorToCSS(cpColors['Background']) || '#000';



    const colors =  {
        // The core variables your window manager uses
        '--color-win-act': winActive,
        '--color-win-ina': winInactive,
        
        // UI Accents
        '--accent-color': colorization ? this.parseColorization(colorization) : highlight,
        '--color-selection': highlight,
        
        // Surfaces
        '--bg-color': windowBg,
        '--bg-panel': colorization ? this.parseColorization(colorization) : windowBg,
        '--bg-body': windowBg,
        '--bg-menu': colorization ? this.parseColorization(colorization) : windowBg,
        
        // Buttons & Toolbars
        '--toolbar-bg': buttonFace,
'--button-bg': buttonFace,
    '--button-text': this.winColorToCSS(cpColors['ButtonText']) || '#000',
    '--button-light': this.winColorToCSS(cpColors['ButtonLight']) || '#c0c0c0',
    '--button-hilight': this.winColorToCSS(cpColors['ButtonHilight']) || '#fff',
    '--button-shadow': this.winColorToCSS(cpColors['ButtonShadow']) || '#808080',
    '--button-dk-shadow': this.winColorToCSS(cpColors['ButtonDkShadow']) || '#000',
    
    // Присвоєння існуючим змінним
    '--button-act-bg': this.winColorToCSS(cpColors['ButtonLight']) || '#c0c0c0',
    '--button-border': this.winColorToCSS(cpColors['ButtonShadow']) || '#808080',
    '--button-act-border': this.winColorToCSS(cpColors['ButtonDkShadow']) || '#000',
        
        // Typography
        '--color-text-primary': windowText,


        
        // Inputs
        '--input-bg': windowBg,
        '--color-input-bg': windowBg,
        
        // Effects
        '--blur': colorization ? 'blur(10px)' : 'none',
        '--radius-md': md + 'px',
        '--color-win-btn-close': 'rgba(220, 20, 60, 0.6)',

    };
    if (infoWindow) colors['--info-bg'] = infoWindow;
if (infoText) colors['--info-text'] = infoText;

if (windowText){
    const isDark = (cpColors['Window'] || "255 255 255").split(/\s+/).reduce((a, b) => +a + +b) < 380;
colors['--color-text-secondary'] = isDark ? "#fff" : "#000";

}
if (colorization){
colors['--color-text-tretiary'] = "#fff"
}else{
colors['--color-text-tretiary'] = "#000"
}

return colors;
}
// Додайте це всередину методу parse або як окрему логіку
getName(data) {
    // 1. Шукаємо в секції [VisualStyles]
    const vs = data['[visualstyles]'];
const thm = data["[Theme]"]
    if (thm && thm['DisplayName']) return thm['DisplayName'];
    return "Unknown Theme";
}
    applyTheme(variables) {
        const root = document.documentElement;
        for (const [key, value] of Object.entries(variables)) {
            root.style.setProperty(key, value);
        }

    }
}


const theme = localStorage.getItem("theme") || null // Link to file here
let wbtheme; // Class name

function loadTheme() {
    const tmp = fs.find(f => f.name == theme);
    if (theme && tmp) {
        const reader = new FileReader();
        
        // Додаємо перевірки всередині onload
reader.onload = function(e) {
        const text = reader.result;
 
        const parser = new ThemeParser();
        const result = parser.parse(text); 

        // Перевірка на null/undefined перед використанням
        if (result && result.styles) {
            
            parser.applyTheme(result.styles);
			if (result.name) console.log("THM N: "+result.name)
            
            wbtheme = result.type;
            applyThemeToUI(wbtheme)
        } else {
            console.warn("THM: No styles found in file");
            wbtheme = "glass-theme";
        }

        
};
        
        reader.onerror = () => { wbtheme = "glass-theme";
localStorage.removeItem("theme");
console.error("THM ERR!");
applyThemeToUI(wbtheme);
        }
        reader.readAsText(tmp);
    } else {
        wbtheme = "glass-theme";
        localStorage.removeItem("theme");
        
        applyThemeToUI(wbtheme);
    }
}

// Винесемо це в окрему функцію, щоб не дублювати код
function applyThemeToUI(name) {
    const safeName = name.replace(/[^\x20-\x7EА-яЁёІіЇїЄє]/g, "").trim();
    
    document.getElementById("taskbar").className = safeName;
    document.getElementById("sysmenu").className = safeName;
    
    Array.from(document.getElementsByClassName("menu")).forEach(e => {
        e.className = "menu " + safeName;
    });
}

/**
 * Finds and replaces a pattern in all visible text nodes within a target element.
 *
 * @param {RegExp|string} searchPattern The text or regex to search for.
 * @param {string} replacementString The string to replace the matches with.
 * @param {HTMLElement} [targetElement=document.body] The root element to search within.
 */
function replaceTextInElements(searchPattern, replacementString, targetElement = document.body) {
    // Select all elements that are likely to contain displayable text (excluding scripts, styles, etc.)
    // and process the target element itself.
    const allElements = [targetElement, ...targetElement.querySelectorAll("*:not(script):not(noscript):not(style)")];

    allElements.forEach(element => {
        // Iterate through all child nodes of the element
        // Use `childNodes` and filter for `TEXT_NODE` (nodeType 3)
        Array.from(element.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "")
            .forEach(textNode => {
                // Perform the replacement on the text content.
                // Using replaceAll() for string patterns or a global regex (/g flag) 
                // is recommended to replace all occurrences within a single text node.
                if (typeof searchPattern === 'string') {
                    // Use modern replaceAll for simple string replacement.
                    textNode.textContent = textNode.textContent.replaceAll(searchPattern, replacementString);
                } else if (searchPattern instanceof RegExp) {
                    // Ensure the regex has the global flag for full replacement.
                    const globalPattern = new RegExp(searchPattern, searchPattern.flags.includes('g') ? searchPattern.flags : searchPattern.flags + 'g');
                    textNode.textContent = textNode.textContent.replace(globalPattern, replacementString);
                }
            });
    });
}
let tbConfig;

function setTaskbarConfig(config) {
    const taskbar = document.getElementById('taskbar'); // або ваш селектор
    if (config.pos){
    if (config.pos === 'top') {
        taskbar.style.top = '0';
        taskbar.style.bottom = 'auto';
    } else {
        taskbar.style.bottom = '0';
        taskbar.style.top = 'auto';
    }
const isTop = config.pos === "top";
    
    // 1. Оновлюємо клас для body, щоб змінити top/bottom у CSS
    document.body.classList.toggle("taskbar-at-top", isTop);
}

if (config.size) document.documentElement.style.setProperty('--taskbar-height', config.size+"px");
    // Збереження в localStorage, щоб після рестарту не скидалося
    tbConfig = {...tbConfig, ...config};
    localStorage.setItem('taskbar-conf', JSON.stringify(tbConfig));
	if (localStorage.getItem("PanelApplets")){
	emptyPanel();
	const elems = JSON.parse(localStorage.getItem("PanelApplets"));
	elems.forEach(el=>{
		let rslt;
		if (el.tag){
	 rslt = document.createElement(el.tag);
	rslt.id = el.id;
		rslt.classList = el.class;
			if (rslt.innerText){
		rslt.innerText = el.inner;
			}else{
				rslt.src = el.src;
				
			}
		}else{
			rslt = document.createElement("span");
			rslt.outerHTML = el.outer;
		}
		
	addPanelItem(rslt)
	})
	}
	
}

// Функція для чистого об'єднання без дублікатів за ID
function syncApplets(static1, active2) {
    const combined = [...static1, ...active2];
    
    // Використовуємо Map, щоб залишити лише унікальні ID
    const uniqueMap = new Map(combined.map(item => [item.id, item]));
    
    return Array.from(uniqueMap.values());
}

const FILE_TYPES = {
    // Текстові
    'txt':  { mime: 'text/plain', icon: icns.textPlain },
    'css':  { mime: 'text/css', icon: icns.textCss },
    'html': { mime: 'text/html', icon: icns.textHtml },
    'htm':  { mime: 'text/html', icon: icns.textHtml },
    'xml':  { mime: 'text/xml', icon: icns.textHtml },
    'js':   { mime: 'text/javascript', icon: icns.textJavascript },
    'md':   { mime: 'text/markdown', icon: icns.textRich },
    'rtf':  { mime: 'application/rtf', icon: icns.textRich },
    'csv':  { mime: 'text/csv', icon: icns.textCsv },
    'docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', icon: icns.textRich },

    // Зображення
    'jpg':  { mime: 'image/jpeg', icon: icns.imageGeneric },
    'jpeg': { mime: 'image/jpeg', icon: icns.imageGeneric },
    'png':  { mime: 'image/png', icon: icns.imageGeneric },
    'gif':  { mime: 'image/gif', icon: icns.imageGeneric },
    'svg':  { mime: 'image/svg+xml', icon: icns.imageGeneric },
    'webp': { mime: 'image/webp', icon: icns.imageGeneric },

    // Медіа
    'mp3':  { mime: 'audio/mpeg', icon: icns.audioGeneric },
    'wav':  { mime: 'audio/wav', icon: icns.audioGeneric },
    'ogg':  { mime: 'audio/ogg', icon: icns.audioGeneric },
    'mp4':  { mime: 'video/mp4', icon: icns.videoMp4 },
    'webm': { mime: 'video/webm', icon: icns.videoMp4 },

    // Системні та архіви
    'pdf':  { mime: 'application/pdf', icon: icns.pdf },
    'ttf':  { mime: 'font/ttf', icon: icns.font },
    'zip':  { mime: 'application/zip', icon: icns.archive },
    'iso':  { mime: 'application/x-iso9660-image', icon: icns.cdImage },
    'img':  { mime: 'application/octet-stream', icon: icns.cdImage },
    'obj':  { mime: 'model/obj', icon: icns.empty },
    'theme':{ mime: 'application/x-theme', icon: icns.ms_theme }
};


let fonts;
let applets = JSON.parse(localStorage.getItem("applets")) || [];
function getFileTypes(){return FILE_TYPES;}
function getMasterVolume(){return vol;}
function getShortcuts(){return currentKeyboardLayout;   }
function getNotification(){return notificationAPI;}
function getCurrLang(){return currentLang;}
function getCurrDLang(){return dateLang;}
function getDevProps(){return devProps;}
function getDB(){return DB_NAME;}
function getFs(){return fs;}
function getIcns(){return icns;}
function getFonts(){return fonts;}
function getApplets() {return applets;}

function removePanelItem(id) {
    const el = document.getElementById(id);
    if (el) {
        // 1. Видаляємо з DOM
        el.remove();
        console.log(`Елемент ${id} видалено з панелі.`);

        // 2. Оновлюємо внутрішні масиви
localStorage.setItem("PanelApplets",JSON.stringify(getPanelApplets()))
        
        return true;
    }
    console.error(`Елемент з ID ${id} не знайдено.`);
    return false;
}

function addPanelItem(el, pos){
	if (!pos) pos = el.pos;
	if (pos == 0){
document.getElementById("taskbar").appendChild(el);
	}else{
document.getElementById("taskbar-right").appendChild(el);
	}
localStorage.setItem("PanelApplets",JSON.stringify(getPanelApplets()))
}

function emptyPanel(){
	document.getElementById("taskbar").innerHTML = '<div id="taskbar-right" class="right"></div>';
	
}

function getPanelApplets() {
    let panelApplets = [];
    const taskbar = document.getElementById("taskbar");
    if (!taskbar) return [];

    // Перетворюємо в масив, щоб уникнути помилок ітерації
    const currPanelItems = Array.from(taskbar.children);

    currPanelItems.forEach((child, index) => {
        if (child.classList.contains("right")) {
            const indicators = Array.from(child.children);
            indicators.forEach((ind, indIndex) => {
                if (ind.id || ind.classList.length > 0) {
                    panelApplets.push({
                        // Використовуємо індекс для унікальності, якщо немає ID
						tag: ind.tagName,
                        id: ind.id || null,
						itter: ind.id || ind.classList[0],
                        name: ind.id || ind.classList[0] || "indicator",
                        class: ind.classList,
                        outer: ind.outerHTML, // fallback if nothing found
						inner: ind.innerText,
						src: ind.src,
						pos: 1
                    });
                }
            });
        } else {
            panelApplets.push({
                // Тут теж важливо не повертати null
				tag: child.tagName,
                id: child.id || null,
				itter: child.id || child.classList[0],
                name: child.id || `panel_item_${index}`,
                class: child.classList,
                outer: child.outerHTML, // fallback if nothing found	
				inner: child.innerText,
				src: child.src,
				pos: 0
            });
        }
    });

    applets = syncApplets(applets, panelApplets);
    return panelApplets;
}
function chShortcuts(layout){
    currentKeyboardLayout = layout;
    if (layout== "win"){
        replaceTextInElements("⌘", "CTRL");
        replaceTextInElements("⌥", "ALT");
    }else{
        replaceTextInElements("CTRL", "⌘");
        replaceTextInElements("ALT", "⌥");
    }
    
    localStorage.setItem("currentKeyboardLayout", currentKeyboardLayout);
}




function overrideInFrame(frame, funcName, newFunc) {
    try {
        frame.contentWindow[funcName] = newFunc;
        console.log(`Функцію "${funcName}" перевизначено у фреймі:`, frame.src);
    } catch(e) {
        console.warn(`Не вдалося перевизначити "${funcName}" у фреймі:`, e);
    }
}



/**
 * Функція-обгортка для отримання перекладу.
 * @param {string} key Ключ перекладу
 * @returns {string} Перекладений рядок або ключ, якщо переклад не знайдено.
 */
function _(key) {
    return langs[currentLang][key] || key;
}


// --- Модифікована функція addIcon ---

/**
 * Створює значок програми на робочому столі.
 * Додано підтримку Drag & Drop для перетягування на Dock.
 * @param {string} nameKey - Ключ перекладу для назви програми.
 * @param {string} iconUrl - URL значка.
 * @param {string} onclickLogic - Повний рядок JavaScript для onclick (для передачі в Dock).
 */
 let obj = null;
 
 
 
function addIcon(nameKey, iconUrl, onclickLogic) { 
    const desktopApps = document.getElementById("desktopApps") || document.body;

    // 1. Створення контейнера значка
    const appContainer = document.createElement('div');
    appContainer.style.cssText = "";
    
    // 2. Вміст значка (зображення та текст)
    appContainer.innerHTML = `
        <img src="${iconUrl}" style="width: 32px; height: 32px;" draggable="false">
        <p data-i18n="${nameKey}" style="margin: 0px; color: #fff; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);">${_(nameKey)}</p>
    `;
appContainer.addEventListener("contextmenu", (e)=>{
e.preventDefault();
e.stopPropagation();
obj = appContainer;

document.querySelectorAll(".menu").forEach(function(item){
item.style.display="none";
})

document.getElementById("itemM").querySelectorAll("li > p").forEach(function(item) {item.innerText = _(item.innerText);})
document.getElementById("itemM").style.display = "block";
document.getElementById("itemM").style.left = e.clientX+"px";
document.getElementById("itemM").style.top = e.clientY+"px";
})

document.getElementById("copy_name").addEventListener("click", (e) => {
    navigator.clipboard.writeText(obj.innerText);
})


document.getElementById("delete_item_btn").addEventListener("click", (e) => {
    try{
        obj.remove()
    }catch{
        
    }
    obj = null;
    
})

document.addEventListener("keypress", (e) => {
    try{
        if (e.key === "Delete"){
        obj.remove()
        }
    }catch{
        
    }
    obj = null;
    
})

    // 3. ПРИКРІПЛЕННЯ ДІЇ (WinBox) та Drag & Drop
    appContainer.setAttribute('draggable', 'true');
    appContainer.onclick = onclickLogic;
    //appContainer.ondrag =  handleDragStart(event);
    appContainer.setAttribute('data-icon-url', iconUrl); // Для ідентифікації програми

// Виконуємо onclickLogic і додаємо логіку відстеження
const logicStr = onclickLogic.toString();

if (logicStr.includes("url:")) {
    const urlMatch = logicStr.match(/url:\s*["']([^"']+)["']/);
    
    if (urlMatch && urlMatch[1]) {
        const appUrl = urlMatch[1];

        // Допоміжна функція для парсингу параметрів WinBox
        const getVal = (key) => {
            const m = logicStr.match(new RegExp(key + ':\\s*["\']([^"\']+)["\']'));
            return m ? m[1] : undefined;
        };

        // Витягуємо всі розміри та обмеження
        const appData = {
            name: nameKey,
            icon: iconUrl,
            url: appUrl,
            w:   getVal("width"),
            h:   getVal("height"),
            miw: getVal("minwidth"),
            mih: getVal("minheight"),
            maw: getVal("maxwidth"),
            mah: getVal("maxheight")
        };

        // Додаємо в реєстр (упевніться, що addApp не створює дублікатів)
        addApp(appData);
    }
}

        // 4. Додавання на робочий стіл
    desktopApps.appendChild(appContainer);
}


function addApp(app){
    if (!apps.find(a => a.url === app.url)) {
    apps.push(app);
    }
}

function folderExists(path) {
    // Додаємо слеш в кінець, щоб папка "app" не збігалася з файлом "apple.js"
    const folderPath = path.endsWith('/') ? path : path + '/';
    
    return fs.some(file => file.name.startsWith(folderPath));
}



function openMenu(event) {
    const menu0 = document.getElementById("appmenu");
    
        // 5. Показ меню
    document.querySelector("#sysmenu").style.display = document.querySelector("#sysmenu").style.display  === 'none' ? 'block' : 'none';

    
    
    // 1. Очищення меню (Критично! Без цього кнопки будуть дублюватися)
    menu0.innerHTML = "";
    
    // 2. Позиціонування відносно елемента, на який клікнули
    const rect = sysmenu.getBoundingClientRect();
    // Використовуємо rect.top - висота_меню (приблизно 250px для списку)
    
    
    // 3. Динамічне створення списку програм
    apps.forEach(app => {
        const btn = document.createElement("button");
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.width = "100%";
        btn.style.padding = "5px";
        btn.style.cursor = "pointer";

        const ico = document.createElement("img");
        ico.style.width = "24px"; // 24-32px оптимально для меню
        ico.style.marginRight = "10px";

        ico.src = app.icon;

        
        const title = document.createElement("p");
        title.style.margin = "0";
        title.innerText = _(app.name);
        
        // 4. Виправлена логіка запуску (відкриваємо лише локальні шляхи)
        // Умова: якщо шлях НЕ починається з http ТА НЕ починається з /
        
            
        
            btn.onclick = () => {
            openApp(app)
            }

        
        btn.appendChild(ico);
        btn.appendChild(title);
        menu0.appendChild(btn);
        
    });



    
}

function handleInspectScreen(targetSelector) {
    // Визначаємо корінь сканування (конкретне вікно або весь екран)
    const rootElement = targetSelector 
        ? document.querySelector(targetSelector) 
        : (document.querySelector('.workspace') || document.body);

    if (!rootElement) {
        return JSON.stringify({ error: `Selector '${targetSelector}' not found.` });
    }

    const screenDump = [];

    // Рекурсивна функція обходу дерева елементів
    function traverseDOM(element) {
        // Пропускаємо системні скрипти, стилі та сам фрейм чату ШІ, щоб він не дивився сам на себе
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) return;

        const style = window.getComputedStyle(element);
        
        // Якщо елемент повністю прихований, ШІ його не бачить
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return;
        }

        // Отримуємо чистий текст без тексту дочірніх елементів
        let directText = "";
        for (let node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                directText += node.nodeValue.trim();
            }
        }

        // Перевіряємо, чи елемент несе корисне візуальне навантаження
        const hasClass = element.className && typeof element.className === 'string' && element.className.trim() !== "";
        const hasId = element.id !== "";
        const isInteractive = ['BUTTON', 'INPUT', 'TEXTAREA', 'A', 'H1', 'H2', 'H3'].includes(element.tagName);

        if (directText || isInteractive || hasId || hasClass) {
            screenDump.push({
                tagName: element.tagName.toLowerCase(),
                id: element.id || undefined,
                class: element.className || undefined,
                styleDisplay: style.display,
                innerText: directText || undefined,
                // Для полів вводу (наприклад, у твоїй Agenda чи сторі) повертаємо їхній поточний вміст
                value: (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') ? element.value : undefined
            });
        }

        // Йдемо вглиб по дереву
        for (let i = 0; i < element.children.length; i++) {
            traverseDOM(element.children[i]);
        }
    }

    // Запускаємо сканування
    traverseDOM(rootElement);

   
    
       return JSON.stringify(screenDump);
}


async function openApp(targ) {
    const beforeDB = DB_NAME;
    
    // Оголошуємо через let локально, щоб не засмічувати window.app
    let app = typeof targ == "string" ? getApps().find(a => a.name == targ) : targ;

    // Якщо додатка немає — логуємо і ПЕРЕРИВАЄМО функцію через return
    if (!app) {
        console.error("App not found:", (typeof targ == "string" ? targ : targ.name));
        return; 
    }

    if (app.url.startsWith("apps/") && !folderExists("apps")) {
        // Категорія RAM-додатків: запускаються миттєво, диск не чіпаємо взагалі!
        new wm(_(app.name), {
            x: "center", y: "center",
            class: wbtheme + " no-full",
            url: app.url,
            icon: app.icon,
            minwidth: app.miw, minheight: app.mih,
            width: app.w, height: app.h,
            maxwidth: app.maw, maxheight: app.mah
        });
    } else {
        try {
        // Категорія дискових файлів: ось тут монтування дійсно необхідне
        if (DB_NAME != startupDisk) {
            DB_NAME = startupDisk;
            idbWrapper.db = null;
            await idbWrapper.openDB();
            await loadFsFromDB();
            console.log(beforeDB + " -> " + DB_NAME);
        }

        // Чекаємо повного зчитування файлу з диска
        await Openf(null, null, getMimeType(app.url), app.url, startupDisk);
}finally{
        // Повертаємо дата-драйв на місце користувачу
        if (DB_NAME == startupDisk && beforeDB != startupDisk) {
            console.log(beforeDB + " <- " + DB_NAME);
            DB_NAME = beforeDB;
            idbWrapper.db = null;
            await idbWrapper.openDB();
            await loadFsFromDB();
            
        }
    }
}
}

function getApps(){
    return apps;
    
}
// --- НОВА КОНФІГУРАЦІЯ IDB ---
let DB_NAME = 'Infinity_OS_FS';
if (localStorage.getItem("startup_disk")){
    DB_NAME = localStorage.getItem("startup_disk");
}else{
    localStorage.setItem("startup_disk", "Infinity_OS_FS")
}

const STORE_NAME = 'FileObjects';
let LAST_DB = "";
const startupDisk = localStorage.getItem("startup_disk");
//indexedDB.deleteDatabase(DB_NAME);

/**
 * Клас-обгортка для роботи з IndexedDB.
 * Всі операції є асинхронними.
 */
class IDBWrapper {
    constructor() {
        this.db = null;
    }

    /**
     * Відкриває з'єднання з базою даних та створює сховище об'єктів.
     * @returns {Promise<IDBDatabase>} З'єднання з базою даних.
     */
    async openDB() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }
            
            // Версія 1: Створює сховище FileObjects
            fs = [];
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Ключ - це шлях до файлу (name), що робить пошук швидким
                    db.createObjectStore(STORE_NAME, { keyPath: 'name' }); 
                }
            };

            request.onsuccess = (event) => {
                //console.log("Mounted:"+event.target.result.name + " "+ DB_NAME+ ":"+event.target.result.name)
                if (LAST_DB != event.target.result.name || DB_NAME == ""){
                    sounds.play("driveIn");
                }
                LAST_DB = event.target.result.name;
                this.db = event.target.result;
                console.log("Mount: " + event.target.result.name)
                resolve(this.db);
                dbInstances[DB_NAME] = event.target.result;
            };
            

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Зберігає або оновлює файл у IndexedDB.
     * @param {Object} fileObject Об'єкт файлу з обов'язковим полем 'name'.
     * @returns {Promise<void>}
     */
    async saveFile(fileObject) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            // Транзакція для запису
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // put() - вставляє або оновлює
            const request = store.put(fileObject);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }
    
    /**
     * Видаляє файл з IndexedDB за іменем.
     * @param {string} fileName Ім'я файлу (ключ).
     * @returns {Promise<void>}
     */
    async deleteFile(fileName) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.delete(fileName);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Завантажує всі файли з IndexedDB.
     * @returns {Promise<Array>} Масив об'єктів файлів.
     */
     
    async loadAllFiles() {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            // getAll() - повертає всі об'єкти
            const request = store.getAll(); 

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }
}



// Глобальний екземпляр обгортки IDB
const idbWrapper = new IDBWrapper();




// Глобальний масив файлів. Починаємо з порожнього масиву.
let fs = [];
let dbInstances = {}

/**
 * Перевіряє, чи закрита база даних IndexedDB за її ім'ям
 * @param {string} dbName - Назва бази даних (наприклад, твій DB_NAME)
 * @returns {boolean} true, якщо база закрита або не існує
 */
function isDbClosed(dbName) {
    const db = dbInstances[dbName];
    
    // Якщо її взагалі немає в реєстрі — вона точно закрита/не відкривалася
    if (!db) return true; 

    try {
        // Пробуємо створити порожню транзакцію над твоїм схожищем
        // Якщо база закрита, цей рядок викличе виключення (Exception)
        db.transaction([STORE_NAME], 'readonly');
        
        return false; // Транзакція успішна -> база ВІДКРИТА
    } catch (error) {
        // Якщо зловили InvalidStateError — базу було закрито через db.close()
        if (error.name === 'InvalidStateError' || error.message.includes('closed')) {
            return true; 
        }
        // Будь-яка інша помилка (наприклад, сховища не існує) означає, що база жива, але є проблема з конфігом
        return false; 
    }
}


// --- ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ FS (ЗАЛИШЕНІ) ---

/**
 * Допоміжна функція для перетворення Data URL (base64) на Blob.
 * Потрібна для коректного відтворення медіафайлів після завантаження з LS.
 * @param {string} dataurl Data URL рядок (наприклад, data:image/jpeg;base64,...)
 * @returns {Blob} Об'єкт Blob
 */
function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

function getExt(file) {
    if(!file) return;
    const name = typeof file === 'object' ? file.name : file;
    return name.includes('.') ? name.split('.').pop().toLowerCase() : "";
};

/**
 * Асинхронно перетворює File/Blob на об'єкт, придатний для JSON-серіалізації.
 * Для тексту зберігає текст, для медіа - Data URL.
 * @param {File} file Об'єкт File для серіалізації.
 * @returns {Promise<Object>} Об'єкт з ім'ям, типом та вмістом у вигляді Data URL або тексту.
 */
function serializeFile(file) {
    if (file instanceof Promise) return;
    return new Promise((resolve) => {
        const fileType = file.type || getMimeType(file.name);
        
        
        const reader = new FileReader();

        reader.onload = function(e) {
            resolve({
                name: file.name,
                type: file.type,
                lastModified: file.lastModified,
                // Content - Data URL або сирий текст (для IndexedDB)
                content: e.target.result
            });
        };

        if (fileType.startsWith("text/")) {
            // Читаємо як текст
            reader.readAsText(file);
        } else if (fileType.startsWith("image/") || fileType.startsWith("audio/") || fileType.startsWith("video/")) {
            // Читаємо як Data URL (base64)
            reader.readAsDataURL(file);
        } else {
            // Для інших (zip, exe, etc.) не зберігаємо вміст
            
            reader.readAsDataURL(file);
            
        }
    });
}

// --- НОВІ АСИНХРОННІ ФУНКЦІЇ ЗБЕРЕЖЕННЯ/ЗАВАНТАЖЕННЯ ---

/**
 * Зберігає або оновлює один файл у IndexedDB.
 * @param {File} file Об'єкт File, який потрібно зберегти.
 */
async function saveFileToDB(file) {
    
     if (!file instanceof Blob && !(file instanceof File)) return false;
    // 1. Серіалізуємо файл
    const fileObjectToSave = await serializeFile(file);

    try {
        // 2. Зберігаємо його в IndexedDB
        await idbWrapper.saveFile(fileObjectToSave);
        
        return true;
    } catch (error) {
       
       
       return false; 
    }
}

/**
 * Асинхронно завантажує файли з IndexedDB на початку роботи.
 */
async function loadFsFromDB() {
    //console.log("Loading file system from IndexedDB...");
    
    try {
        // 1. Завантажуємо всі файли-об'єкти з бази
        const savedFileObjects = await idbWrapper.loadAllFiles(); 
        
        if (savedFileObjects && savedFileObjects.length > 0) {
            //console.log(`Found ${savedFileObjects.length} items in IndexedDB.`);
            
            fs = savedFileObjects.map(item => {
                let blob;
                
                if (item.type.startsWith("text/")) {
                    // Текстовий вміст
                    blob = new Blob([item.content], { type: item.type});
                } else if (item.content.startsWith('data:')) {
                    // Вміст Data URL (base64)
                    blob = dataURLtoBlob(item.content); 
                } else {
                    // Інші бінарні файли (якщо вміст не було змінено)
                    blob = new Blob([], { type: item.type});
                }

                // Створення нового File об'єкта
                return new File([blob], item.name, { type: item.type, lastModified: item.lastModified });
            });
            
            
        } else {
            console.log("IndexedDB is empty or not yet created. Initializing empty FS.");
            // Перевірка на LocalStorage (МІГРАЦІЯ ОДНОРАЗОВА)
            const savedFs = localStorage.getItem('infinity_os_fs');
            if (savedFs) {
                 console.log("Found legacy FS in Local Storage. Attempting migration...");
                 const deserializedFs = JSON.parse(savedFs);
                 
                 // Конвертуємо старий формат у новий
                 fs = deserializedFs.map(item => {
                    if (item.content) {
                        let blob;
                        if (item.type.startsWith("text/")) {
                            blob = new Blob([item.content], { type: item.type });
                        } else if (item.content.startsWith('data:')) {
                            blob = dataURLtoBlob(item.content);
                        } else {
                            blob = new Blob([], { type: item.type });
                        }
                        return new File([blob], item.name, { type: item.type,lastModified: item.lastModified  });
                    }
                    return new File([], item.name, { type: item.type,lastModified: item.lastModified });
                 });
                 
                 // Зберігаємо кожен файл у нову базу (якщо fs не порожній)
                 if (fs.length > 0) {
                     console.log("Migrating files to IndexedDB...");
                     for (const file of fs) {
                         await saveFileToDB(file);
                     }
                     // Очищаємо LocalStorage після успішної міграції
                     localStorage.removeItem('infinity_os_fs');
                     console.log("Legacy LocalStorage FS successfully migrated and cleared.");
                 }
                 
            } else {
                 console.log("Local Storage is also empty. Initializing empty FS.");
                 fs = [];
            }
            
        }
    } catch (error) {
        console.error("Error loading FS from IndexedDB:"+ error);
        fs = [];
    }
}


/**
 * Оновлює заголовки активних вікон (WinBox) та, якщо потрібно, їхній вміст.
 */

/**
 * Застосовує переклади до статичних елементів DOM, позначених data-i18n.
 */
function applyTranslationsToDOM() {
    // 1. Оновлення статичних елементів
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = _(key);
    });
    
    // 2. Оновлення заголовків відкритих WinBox
    //updateOpenWindowsTitle(); 
}


// ----------------------------------------------------------------


function loadLanguage(lang = null, dlang = null) {
  try {
    // 1. Зчитуємо дані
    if (!lang) lang = localStorage.getItem("locale");
    if (!dlang) dlang = localStorage.getItem("dlocale");

    // 2. Первинний fallback, якщо в сховищі або аргументах порожньо
    if (!lang) lang = "en";
    if (!dlang) dlang = "en-US";

    // 3. Перевіряємо наявність мови в об'єкті
    if (!langs[lang]) {
      throw new Error(`Language "${lang}" not found in dictionary.`);
    }

    // 4. Якщо мова є — застосовуємо її
    currentStrings = langs[lang];
    currentLang = lang;
    dateLang = dlang;

  } catch (error) {
    console.error("Error loading language, rolling back to English:", error);

    // Аварійний fallback: якщо впала навіть англійська, захищаємо від крашу
    const fallbackLang = (lang !== "en" && langs["en"]) ? "en" : lang;
    
    currentStrings = langs[fallbackLang] || {};
    currentLang = fallbackLang;
    dateLang = (lang !== "en") ? "en-US" : dlang;
  }

  // 5. Гарантований DOM-апдейт та ОДНОРАЗОВЕ збереження чистих даних
  applyTranslationsToDOM();
  
  localStorage.setItem("locale", currentLang);
  localStorage.setItem("dlocale", dateLang);

  console.log(`Language set to: ${currentLang}`);
  console.log("SAVE:" + currentLang + " " + dateLang);
}


/**
 * Асинхронно завантажує фон з FS та ховає Splash Screen.
 * Ця функція обгорнута у Promise, щоб await у IIFE чекав на завершення 
 * асинхронної операції FileReader.
 * @returns {Promise<void>}
 */
function loadBackground() {
    return new Promise(resolve => {
        const backgroundFileName = localStorage.getItem('infinity_os_background_file');
        
        if (backgroundFileName) {
            // Знаходимо File об'єкт у глобальному масиві fs
            // Припускаємо, що масив fs доступний глобально
            const backgroundFile = typeof fs !== 'undefined' ? fs.find(item => item.name === backgroundFileName) : null;
            
            if (backgroundFile && backgroundFile instanceof File) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    const dataUrl = e.target.result;
                    // Встановлення фону: відбувається тут, коли дані готові
                    document.body.style.backgroundImage = `url(${dataUrl})`; // Виправлено синтаксис
                    console.log(`Background loaded from Local Storage: ${backgroundFileName}`);
                    
                    resolve(); // <--- КРИТИЧНО: Завершення Promise після успіху
                };
                
                reader.onerror = function() {
                    console.error("Error reading background file via FileReader.");
                    
                    resolve(); // <--- КРИТИЧНО: Завершення Promise навіть при помилці
                };

                // Читаємо File об'єкт, щоб отримати Base64 Data URL
                reader.readAsDataURL(backgroundFile);
            } else {
                // Файл не знайдено, очищаємо налаштування
                localStorage.removeItem('infinity_os_background_file');
                console.log("Saved background file not found, cleared setting.");
                
                resolve(); // <--- КРИТИЧНО: Завершення Promise, якщо файл не знайдено
            }
        } else {
            // Фон не встановлено
            console.log("No background configured.");
            
            resolve(); // <--- КРИТИЧНО: Завершення Promise, якщо фон не налаштовано
        }
    });
}





async function loadLayout(){
    let savedLayout = localStorage.getItem("currentKeyboardLayout");
if (savedLayout) {
    currentKeyboardLayout = savedLayout;
    chShortcuts(savedLayout);
    
}else{
    chShortcuts("mac");
    
}

}
const notify = document.getElementById('notify')

function finishStartup(){
// КРОК 0: Отримуємо всі додатки
const localApps = fs.filter(a =>
    a.name.endsWith(".js") ||
    a.name.endsWith(".html") ||
    a.name.endsWith(".htm")
);
if (localApps.length != 0){
localApps.forEach(app => {
    const reader = new FileReader();
    const fileType = app.type;

    reader.addEventListener("load", () => {
        const content = reader.result;

        if (fileType === "text/html") {
            const titleMatch = content.match(/<title>(.*?)<\/title>/i);

            const iconMatch = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
            
                addApp(
                {
                name: titleMatch ? titleMatch[1] : app.name.split("/").pop(),
                icon: iconMatch ? iconMatch[1] : "",
                url: app.name,
                hash: fs.find(f=> f.name == app.name).size
                }
                )
            
        }
    });

    reader.readAsText(app);
});

    }
    let autoload = [];
    
    // КРОК 1: Безпечно отримуємо та парсимо список автозавантаження з Local Storage
    try {
        const autoloadString = localStorage.getItem('infinity_os_autoload');
        // КРИТИЧНО: Використовуємо JSON.parse, щоб перетворити рядок на масив
        if (autoloadString) {
            autoload = JSON.parse(autoloadString);
        }
    } catch (e) {
        console.error("Помилка парсингу даних автозавантаження (infinity_os_autoload):", e);
        autoload = [];
    }

    // КРОК 2: Виконуємо код файлів зі списку
    if (Array.isArray(autoload)) {
        autoload.forEach(itemName => {
            // Припускаємо, що масив fs доступний глобально
            if (typeof fs === 'undefined') {
                console.error("Глобальний масив файлової системи 'fs' не знайдено.");
                return;
            }

            // Знаходимо File об'єкт за іменем (item.name == itemName)
            const autofile = fs.find(file => file.name === itemName);
            
            if (autofile) {
                const reader = new FileReader();
                // Виконання вмісту файлу
                try {

                    const cont = reader.readAsText(autofile)
                    reader.addEventListener("load", () =>{
                    // Використовуємо eval() для контенту файлу (autofile.content)
                    // Якщо ваша властивість називається 'cont', змініть на autofile.cont
                    eval(reader.result);        
                    })

                    
                } catch (e) {
                    console.error(`Помилка виконання коду у файлі ${itemName}:`, e);
                    
                }
            } else {
                console.warn(`Файл автозавантаження '${itemName}' не знайдено в fs або він порожній.`);
            }
        });
    }

    // КРОК 3: Завершення завантаження
    
    setTimeout(() => {
        // Ховаємо сплеш-екран
        document.getElementById('splash').classList.add("hidden"); 
    }, 500);
    // Attempt to play startup chime
    try{
    sounds.play("startup")
    }catch{
        // ...
    }
    updateBattery()
}
// --- ВИКЛИК ЗАВАНТАЖЕННЯ: ПОВИНЕН БУТИ НА ПОЧАТКУ СКРИПТУ ---


const prg = document.getElementById("loadprg");

function fail(msg) {
    notify.innerText = msg;
    throw new Error(msg); // жорстко зупиняємо запуск
}
function firstStart(){


    // This means that all user settings are currently absent.
    if (!localStorage.getItem("locale") || !localStorage.getItem("dlocale")){
// OOBE
const oobe_steps = [
    {
        id: 1,
        lay: `
            <h1 data-i18n="language">Language</h1>
            <select id="languageSelect">
                <option value="en|EN-US">English</option>
                <option value="ua|UK-UA">Українська</option>
                <option value="fr|FR-FR">Français</option>
                <option value="ru|RU-RU">Русский</option>
<option value="pl|pl-PL">Polski</option>
            </select>`,
        onLoad: () => {
            const select = document.getElementById("languageSelect");
            // Enable the "Next" button once a language is confirmed or changed
            const nextBtn = document.querySelector('.toolbar button');
            nextBtn.disabled = false; 

            select.onchange = () => {
                const [langCode, region] = select.value.split('|');
                loadLanguage(langCode, region); // Your existing function
                console.log(`Language set to: ${langCode}, Region: ${region}`);
            };
        }
    },
    {
        id: 2,
        lay: "<h1>Setup Complete</h1><p>Welcome to Infinity OS.</p>",
        onLoad: () => {
            console.log("Final step loaded.");
        }
    }
];
let curr_oobe_step = 1;

window.oobe_next = () => {
    if (curr_oobe_step > oobe_steps.length) {
        oobe.close();
        return;
    }

    // Update UI
    const currentStepData = oobe_steps[curr_oobe_step - 1];
    document.getElementById("oobe_step").innerText = curr_oobe_step + "/" + oobe_steps.length;
    document.getElementById("oobe_cont").innerHTML = currentStepData.lay;

    // RUN THE CODE FOR THIS STEP
    if (typeof currentStepData.onLoad === "function") {
        currentStepData.onLoad();
    }

    curr_oobe_step += 1;
};

        const oobe = new wm("Intro", {
            class: wbtheme + " no-header no-move no-resize",
            html: `<div class="toolbar"> <span id="oobe_step"></span> <button onclick='oobe_next()' disabled> > </button> </div><main style="justify-content:center; padding:15px;"id="oobe_cont"></main>`,
            x: "center",y: "center",
            modal: true
        }
        )



oobe_next()
    }else{
        return false;
    }
}




async function setupFonts() {
  fonts = JSON.parse(localStorage.getItem("fonts")) || {installed: [
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong"
], active: "sans-serif"};
  const active = fonts.active;
  
  // Find the file in your FS
  const f = getFs().find(f => f.name == active);
  if (!f) return document.body.style.fontFamily = `sans-serif`;

  // Get the data and register it
  const b = await f.arrayBuffer(); // Don't forget to await the buffer if it's a File/Blob
  const font = new FontFace(active, b);


  if (!fonts.installed.includes(active)) {
        fonts.installed.push(active);
        // Зберігаємо оновлений об'єкт у localStorage
        localStorage.setItem("fonts", JSON.stringify(fonts));
        console.log(`Infinity OS: "${active}" added to installed list.`);
    }
  
  try {
    const loadedFont = await font.load();
    document.fonts.add(loadedFont);
    
    // Apply to body
    document.body.style.fontFamily = `"${active}", sans-serif`;
    document.documentElement.style.setProperty("--font", document.body.style.fontFamily);
    
    console.log(`Infinity OS: Font "${active}" applied successfully.`);
  } catch (e) {
    console.error("Font loading failed:", e);
  }
}

function getMaxLS(pb, max = 5) {
    
    // Орієнтовна стеля localStorage для більшості браузерів (5120 KB)
    // Вона потрібна, щоб вирахувати поточний відсоток до моменту, поки не вилетить catch
    const APPROX_MAX_LS = 5120; 

    var data = "m";
    
    for (var i = 0; i < 40; i++) {
        try { 
            localStorage.setItem("DATA", data);
            data = data + data;
            
            // 1. Рахуємо поточний об'єм усіх даних у localStorage (в KB)
            let currentSize = Math.round(JSON.stringify(localStorage).length / 1024);
            console.log(currentSize);
            // 2. Рахуємо відсоток заповнення (від 0 до 1)
            let progressRatio = Math.min(currentSize / APPROX_MAX_LS, 0.99); 
            
            // 3. Масштабуємо цей відсоток під ваш системний "max"

            if (pb) pb.value = Math.round(progressRatio * max);

        } catch(e) {
            // Коли ліміт дійсно досягнуто, виставляємо прогрес-бар рівно на значення max
            if (pb) pb.value = max;
            
            let finalSize = (JSON.stringify(localStorage).length).toFixed(2);
            console.log("LIMIT REACHED: (" + i + ") " + finalSize);
            console.log(e);
            
            // Очищаємо за собою сміття перед виходом
            localStorage.removeItem("DATA");
            
            return finalSize;
        }
    }
    localStorage.removeItem("DATA");
}


(async () => {
    try {
        prg.value = 0;

        maxLS = await getMaxLS(prg, 5);
        prg.value = 5;
        
        devProps = await buildDevProps();
        prg.value = 10;
        
        await loadFsFromDB();
        prg.value = 15;
        
        await firstStart();
        prg.value = 20;

        await setupFonts();
        prg.value = 25;
        
        await loadLanguage();
        prg.value = 30;

        await setTaskbarConfig(JSON.parse(localStorage.getItem('taskbar-conf')) || {})
        prg.value = 35;
        
        await loadTheme();
        prg.value = 40;

        await loadBackground();
        prg.value = 50;
        
        await loadLayout();
        prg.value = 60;
        
        await npmUpdate();
        prg.value = 70;
        
        
        await redefineAdaptations()
        prg.value = 80;
        
        notificationAPI = await redefineNotifications()
        prg.value = 90;
        
        
        await finishStartup();
        prg.value = 100;
        
    } catch (e) {
        console.error("BOOT ERROR:"+ e);
        notify.innerText = "Infinity OS startup failed: " + e.message;
    }
})();


/**
 * Universal selection for contenteditable
 * @param {HTMLElement} container - The rtf-canvas element
 * @param {number} start - The character index to start selection
 * @param {number} length - How many characters to select
 */
function setContentEditableSelection(container, start, length) {
    const range = document.createRange();
    const selection = window.getSelection();
    const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    
    let charCount = 0;
    let startNode, endNode, startOffset, endOffset;
    let node;

    while (node = walk.nextNode()) {
        const nodeLength = node.textContent.length;
        
        // Find Start
        if (!startNode && charCount + nodeLength > start) {
            startNode = node;
            startOffset = start - charCount;
        }
        
        // Find End
        if (startNode && charCount + nodeLength >= start + length) {
            endNode = node;
            endOffset = (start + length) - charCount;
            break;
        }
        
        charCount += nodeLength;
    }

    if (startNode && endNode) {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
        container.focus();
    }
}

function rtfToHtml(rtf) {
    if (!rtf) return "";

    // Обов'язково: прибираємо фізичні переноси рядків самого файлу
    let html = rtf.replace(/[\r\n]/g, "");

    // 1. Поля (залишаємо вашу логіку)
    const getMargin = (cmd) => {
        const match = html.match(new RegExp(`\\\\${cmd}(\\d+)`));
        return match ? Math.round(match[1] / 1440 * 96) + "px" : "20px";
    };

    // 2. Unicode
    html = html.replace(/\\u(\d+)\??/g, (_, code) => String.fromCharCode(code));
    
    // 3. Шрифти
    const fonts = {};
    const fontTableMatch = html.match(/\{\\fonttbl(.*?)\}/s);
    if (fontTableMatch) {
        const fontEntries = [...fontTableMatch[1].matchAll(/\{\\f(\d+)[^;]*?\s+([^;{}]+);/g)];
        fontEntries.forEach(match => fonts[match[1]] = match[2].trim());
    }

    // 4. Очищення метаданих (важливо видалити групи цілком)
    html = html.replace(/\{\\fonttbl.*?\}|\{\\colortbl.*?\}|\{\\stylesheet.*?\}|\{\\info.*?\}|\{\\\*\\generator.*?\}/gs, "");

    // 5. Форматування
    // Використовуємо один прохід для span, щоб не плодити порожні теги
    html = html.replace(/\\f(\d+)\s?/g, (_, id) => `</span><span style="font-family:${fonts[id] || 'Arial'}">`);
    html = html.replace(/\\fs(\d+)\s?/g, (_, size) => `</span><span style="font-size:${size / 2}pt">`);

    html = html
        .replace(/\\b\s+(.*?)\\b0/g, "<b>$1</b>").trim()
        .replace(/\\i\s+(.*?)\\i0/g, "<i>$1</i>").trim()
        .replace(/\\ul\s+(.*?)\\ul0/g, "<u>$1</u>").trim()
        .replace(/\\strike\s+(.*?)\\strike0/g, "<s>$1</s>").trim()
        .replace(/\\bullet\s+/g, "• ").trim()
        .replace(/\\par\s?/g, "<br>").trim(); // Додано опціональний пробіл після \par

    // Вирівнювання
    html = html.replace(/\\(qc|qr|qj)\s+(.*?)(?=\\par|\\ql|\\qc|\\qr|\\qj|$)/g, (match, cmd, text) => {
        const align = {qc:'center', qr:'right', qj:'justify'}[cmd];
        return `<div style="text-align:${align}">${text}</div>`;
    });

    // 6. ФІНАЛЬНЕ ОЧИЩЕННЯ (найважливіше)
    // Видаляємо всі команди, що залишилися, разом із пробілом після них
    html = html.replace(/\\[a-z0-9-]+(\s|(?=[\\{}]))/gi, "").trim();
    
    // Видаляємо групи {}
    html = html.replace(/[{}]/g, "").trim();

    // Прибираємо можливі подвійні пробіли, що виникли після видалення команд
    html = html.replace(/\s\s+/g, ' ').trim();

    return html.trim();
}

function htmlToRtf(html) {
    let content = html
        // 1. Спочатку замінюємо теги на RTF-коди
        .replace(/<(b|strong)>(.*?)<\/\1>/gi, "\\b $2\\b0 ")
        .replace(/<(i|em)>(.*?)<\/\1>/gi, "\\i $2\\i0 ")
        .replace(/<u>(.*?)<\/u>/gi, "\\ul $1\\ul0 ")
        .replace(/<(s|strike|del)>(.*?)<\/\1>/gi, "\\strike $2\\strike0 ")
          .replace(/<div[^>]+style="text-align:\s*center;?"[^>]*>(.*?)<\/div>/gi, "\\qc $1\\ql ")
      .replace(/<div[^>]+style="text-align:\s*right;?"[^>]*>(.*?)<\/div>/gi, "\\qr $1\\ql ")
      .replace(/<div[^>]+style="text-align:\s*justify;?"[^>]*>(.*?)<\/div>/gi, "\\qj $1\\ql ")
      
      // 2. Списки (Lists)
      .replace(/<li>(.*?)<\/li>/gi, "\\bullet  $1\\par ")

        // 2. Вирівнювання (якщо додасте кнопки)
        .replace(/<div style="text-align:\s*center;?">(.*?)<\/div>/gi, "\\qc $1\\ql ")
        .replace(/<div style="text-align:\s*right;?">(.*?)<\/div>/gi, "\\qr $1\\ql ")
        // 3. Переноси рядків
        .replace(/<br\s*\/?>/gi, "\\par ")
        .replace(/<p>(.*?)<\/p>/gi, "\\par $1 ")
        .replace(/<div>(.*?)<\/div>/gi, "\\par $1 ")
        // 4. ТІЛЬКИ ТЕПЕР видаляємо залишки HTML тегів
        .replace(/<[^>]+>/g, "");

    // 5. Формуємо файл з Unicode
    const header = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs24 ";
    const body = content.split('').map(char => {
        const code = char.charCodeAt(0);
        return code > 127 ? `\\u${code}?` : char;
    }).join('');

    return header + body + "}";
}


// --- ВИПРАВЛЕНА ФУНКЦІЯ Openf (ТЕПЕР ВОНА ПОВНА) ---
/**
 * Відкриває файл у новому вікні WinBox.
 * * @param {Event | File | string} source - Об'єкт події DOM, об'єкт File, або ім'я файлу (рядок).
 * @param {function} refr - Функція оновлення (наприклад, updateQuotaInfo).
 * @param {string} [type=null] - Примусовий MIME-тип (наприклад, "text/plain").
 * @param {File} [file=null] - Об'єкт файлу, якщо 'source' є подією, але викликано з контекстного меню.
 */
function Openf(source, refr, type, file = null, disk = "idb") {
    // --- ОГОЛОШЕННЯ ЗМІННИХ ---
    let fileWinBox;
    let fileType = "unknown";
    let exfile = null; // Знайдений об'єкт File
    let filestr = null; // Назва файлу
    let listItem = null; // DOM-елемент, якщо знайдено (для іконки)
    let isEditable = false;
    const uniqueFileId = "content-" + Date.now();
    
    // --- 1. БЛОК ВИЗНАЧЕННЯ ДЖЕРЕЛА ТА КОНТЕКСТУ ---
    
    if (source && (source instanceof Event || source.currentTarget)) {
        // --- СЦЕНАРІЙ А: ВИКЛИК З ПОДІЄЮ DOM (Стара логіка) ---
        const event = source;
        listItem = event.currentTarget;
        
        if (!type) {
            // Звичайний клік (подвійний)
            filestr = listItem.innerText.trim();
            
        } else {
            // Клік з контекстного меню "Як текст"
            
            filestr = listItem.getAttribute("data-file");
            
        }
        
        exfile = fs.find(item => item.name === filestr);
        
        if (!exfile) {
            console.error("Файл не знайдено (через Event):"+filestr);
            return;
        }
        fileType = type || exfile.type; // Встановлюємо тип
        
    } else {
        // --- СЦЕНАРІЙ Б: ВИКЛИК З ПРЯМИМ ОБ'ЄКТОМ/ІМ'ЯМ (Нова логіка) ---
        
        const fileOrName = source || file; // Використовуємо 'source' або 'file'
        
        if (typeof fileOrName === 'string') {
            // Передано назву файлу (рядок)
            exfile = fs.find(item => item.name.trim() === fileOrName.trim());

            filestr = fileOrName;
        } else if (fileOrName instanceof File) {
            // Передано об'єкт File
            exfile = fileOrName;
            filestr = fileOrName.name;
            // listItem залишається null, тому іконку треба буде обрати за типом
        }
        
        if (!exfile) {
            console.error("Файл не знайдено (прямий виклик):" +fileOrName);
            return;
        }
        fileType = type || exfile.type;
    }
    
    // Перевірка після всіх визначень
    if (!exfile) return;
    
    // --- 2. СТВОРЕННЯ WINBOX ---
    
    let ic;
    if (exfile) {
        ic = getIcon(exfile)
    }
    
    
    
    // Намагаємося отримати іконку з listItem, якщо він визначений (Сценарій А)
    if (listItem) {
        const img = listItem.querySelector('img');
        if (img) iconSrc = img.src;
    }
    // Якщо listItem немає (Сценарій Б), тут може бути ваша логіка визначення іконки за fileType,
    // яка вже є у функції renderFileList (потрібно дублювати або винести в окрему функцію).
let w = 255;
let h = 200;

let typeclass = fileType.split("/")[0] || fileType;
    fileWinBox = new wm(filestr, {
        icon: ic,x: "center",y: "center", // Використовуємо визначену іконку
        class: ["no-full", wbtheme, "media", typeclass],
        minheight: 200, minwidth: 255, width: w, height: h, x: "center",y: "center",
        html: `<div style="padding: 10px; color: black; height: 100%; text-align: center;overflow: hidden;">${_('loading_text')}</div>`
    });
    


    // --- 3. ЧИТАННЯ ВМІСТУ ФАЙЛУ ---
    // ... (Тут продовжується логіка читання exfile)
    // ...





    const reader = new FileReader();

    reader.onload = async function(e) {
        const content = e.target.result;
        let newContent = '';
        
        // --- БЛОК ОБРОБКИ ЗА ТИПОМ ФАЙЛУ ---
        
        if (fileType == "application/x-theme") {
isEditable = false;
localStorage.setItem("theme", exfile.name);
try{
        const parser = new ThemeParser();
        const thm = parser.parse(content); 
parser.applyTheme(thm.styles)
}catch{
loadTheme()
}
fileWinBox.close();
}else if (fileType == "font/ttf") {

const fontName = exfile.name;



newContent = `
<style>
    @font-face {
        font-family: '${uniqueFileId}';
        src: url(${e.target.result});
    }
    .preview-container-${uniqueFileId} { 
        font-family: '${uniqueFileId}', serif !important; 
        padding: 15px;
    }
</style>

<div class="toolbar">
       <button onclick="updateFonts('add', '${fontName}')">${_('add')}</button>
    <button onclick="updateFonts('delete', '${fontName}')">${_('delete_btn')}</button>
</div>

<div class="preview-container-${uniqueFileId}">
    <h2>Lorem Ipsum</h2>
    <p>"Neque porro quisquam est qui dolorem ipsum..."</p>
    <small>"There is no one who loves pain itself..."</small>
    <h2>1234567890</h2>
    <pre>@ # $ _ & - + () / * " ' : ; ! ?</pre>
</div>
`;
            
        }else if (fileType === "text/csv") {
  isEditable = true;
  
  // Розбиваємо контент на рядки та комірки
  const rows = content.split("\n").map(row => row.split(","));
  
  let tableHtml = `<div class="csv-editor-container" id="table-cont-${uniqueFileId}" style="overflow:auto; height:100%; ">
    <table id="${uniqueFileId}" style="width:100%; border-collapse:collapse;">`;
  
  rows.forEach((row, rowIndex) => {
    tableHtml += "<tr>";
    row.forEach((cell, cellIndex) => {
      tableHtml += `<td contenteditable="true" 
                        style="border:1px solid #ccc; padding:5px; min-width:50px;">
                        ${cell}</td>`;
    });
    tableHtml += "</tr>";
  });
  
  tableHtml += `</table></div>
    <style>
      #${uniqueFileId} td:focus { outline: 2px solid #0078d7; background: #f0f0f0; }
    </style>`;

  newContent = `
                <div class="toolbar">
                            <button id="saveBtn-${uniqueFileId}" >${_('save_btn')}</button>
                                <button id="printBtn-${uniqueFileId}" >${_('print_btn')}</button>
                                <button id="findBtn-${uniqueFileId}" >${_('find_btn')}</button>
                                
  <vr></vr> <button style='width:25px' id="+Btn-${uniqueFileId}" onclick='getElementById("${uniqueFileId}").style.fontSize = parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"))+5+"px";' >+</button>
                            <button style='width:25px' id="-Btn-${uniqueFileId}" onclick='getElementById("${uniqueFileId}").style.fontSize = (parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size")) > 5 ) ? parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"))-5+"px": parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"));' style="padding: 4px 8px; border: 1px solid #aaa; background-color: #ddd; ">-</button></div>
  `+tableHtml;
} else if (fileType === "application/rtf" || fileType === "text/markdown" || fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    isEditable = true;


if (fileType == "application/rtf") {
        initialHtml = rtfToHtml(content);
    } else if (fileType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const options = {
            styleMap: [
                "p[style-name='Center'] => p.text-center",
                "p[style-name='Right'] => p.text-right",
                "p[style-name='Left'] => p.text-left"
            ]
        };
        
        // FIX: Wait for the result before moving on
        const result = await mammoth.convertToHtml({arrayBuffer: content}, options);
        initialHtml = result.value;
        
    } else {
        initialHtml = marked.parse(content);
    }



    // Функція підрахунку символів
    window.input = (text) => {
try{
        const symLabel = fileWinBox.body.querySelector("#sym");
        if (symLabel) symLabel.innerText = text.length;
}catch{}
    }

    newContent = `
<div style="padding:0; margin:0; background: #e0e0e0; display: flex; flex-direction: column; height: 100%;">
    <div class="toolbar">
        <button id="saveBtn-${uniqueFileId}">${_('save_btn')}</button>
        <button id="printBtn-${uniqueFileId}">${_('print_btn')}</button>
        <button id="findBtn-${uniqueFileId}">${_('find_btn')}</button>
        
        <div style="width:1px; height:20px; background:#ccc; margin: 0 5px;"></div>
        
        <button onclick="document.execCommand('bold')"><b>B</b></button>
        <button onclick="document.execCommand('italic')"><i>I</i></button>
        <button onclick="document.execCommand('underline')"><u>U</u></button>
        <button onclick="document.execCommand('strikethrough')"><strike>S</strike></button>
        
        <button onclick="document.execCommand('insertUnorderedList')">UL</button>
        <button onclick="document.execCommand('insertOrderedList')">OL</button>

        <div style="width:1px; height:20px; background:#ccc; margin: 0 5px;"></div>

        <button onclick="document.execCommand('justifyLeft')">L</button>
        <button onclick="document.execCommand('justifyCenter')">C</button>
        <button onclick="document.execCommand('justifyRight')">R</button>


    </div>

    <div style="flex-grow: 1; overflow-y: auto; padding: 20px 0;">
        <div contenteditable="true" 
             oninput='input(this.innerText)' 
             id="${uniqueFileId}"
             style="margin: 0 auto; 
                    width: 500px; 
                    outline: none; 
                    background: white; 
                    color: black; 
                    white-space: pre-wrap; 
                    aspect-ratio: 210 / 297; 
                    box-sizing: border-box; 
                    
                    box-shadow: 0 0 15px rgba(0,0,0,0.2);
                    display: flow-root;">${initialHtml}</div>
    </div>

    <div class="footer" style="justify-content: space-between;background: #f5f5f5; padding: 5px; margin:0; border-top: 1px solid #ccc; font-size: 12px; color: #555;">
        <span id="sym"></span>
        <input type="range" 
               oninput='document.getElementById("${uniqueFileId}").style.width = this.value + "px"' 
               min="200" max="1200" value="500" step="50" 
               style="margin-right: 10px; cursor: pointer;" />
    </div>
</div>
    `;
    
    // Ініціалізуємо лічильник відразу після рендеру (якщо ви використовуєте setTimeout або callback)
    setTimeout(() => {
        const el = document.getElementById(uniqueFileId);
        if (el) window.input(el.innerText);
    }, 10);
} else if (fileType.startsWith("text/") || !exfile.name.includes(".")) {
            
            if (fileType == "text/html"){
                const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
if (titleMatch )fileWinBox.setTitle( titleMatch[1].trim())
                
                const iconMatch = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
    if (iconMatch) fileWinBox.setIcon(iconMatch[1])

                // HTML: iframe з sandbox
                isEditable = false; 
const redefiner = `
<script>
${notificationAPI}

window.addEventListener('contextmenu', (e) => {
    const isInput = ["TEXTAREA", "INPUT"].includes(e.target.tagName) || e.target.contenteditable == true;
    if (isInput) {
        e.preventDefault();
        parent.drawEditContextMenu(e, ${fileWinBox.left}+e.clientX,${fileWinBox.top}+e.clientY, document)
    }
})

window.alert = (...a)=>parent.alert(...a);
window.prompt = (...a)=>parent.prompt(...a);
window.confirm = (...a)=> parent.confirm(...a);
window.console = parent.console;
window.Worker = parent.Worker;
window.print = () => parent.print()
</script>
`;
// Список опційних ознак фонової роботи
const optionalCriteria = [
    "setInterval(",
    "setTimeout(",
    "requestAnimationFrame(",
    "addEventListener('message'", // для Web Workers
    "Worker("
];

// Рахуємо, скільки опційних пунктів знайдено в контенті
const foundOptionalCount = optionalCriteria.filter(criterion => content.includes(criterion)).length;

// Умова: Notifications обов'язково + мінімум 2 пункти загалом (Notification + 1 опційний)
// Оскільки Notification вже є одним із пунктів, нам треба знайти хоча б 1 з optionalCriteria
if (content.includes("new Notification(") ) {
    
    fileWinBox.onclose = (urgent) => {
        if (!urgent) {
            // Замість закриття — ховаємо вікно
            console.log(`[Infinity OS] Background mode activated for ${fileWinBox.title}`);
            fileWinBox.hide();
            return true; // Перехоплюємо закриття
        } else {
            console.log(`[Infinity OS] Force close! Terminating background processes.`);
            return false; // Дозволяємо системі знищити вікно
        }
    };
}


                newContent = `
                    <div style="height: 100%; width: 100%;">
                        <iframe 
                            srcdoc="${redefiner.replace(/"/g, '&quot;')}${content.replace(/"/g, '&quot;')}" 
                            style="width: 100%; height: 100%; border: none;">
                        </iframe>
                    </div>
                `;
                
            } 
            else if (fileType == "text/javascript"){
                isEditable = false;
                newContent = eval(content);
                fileWinBox.close();
            } else {
                // Текст: Редактор
                isEditable = true;
                const safeContent = content.replace(/&/g, '&amp;')
                                           .replace(/</g, '&lt;')
                                           .replace(/>/g, '&gt;')
                                           .replace(/"/g, '&quot;')
                                           .replace(/'/g, '&#039;'); 
                                           
                newContent = `
            <div style="height: 100%; display: flex;white-space: nowrap; flex-direction: column;">
                <div class="toolbar">
                            <button id="saveBtn-${uniqueFileId}" >${_('save_btn')}</button>
                                <button id="printBtn-${uniqueFileId}" >${_('print_btn')}</button>
                                <button id="findBtn-${uniqueFileId}" >${_('find_btn')}</button>
                                
  <vr></vr> <button style='width:25px' id="+Btn-${uniqueFileId}" onclick='getElementById("${uniqueFileId}").style.fontSize = parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"))+5+"px";' >+</button>
                            <button style='width:25px' id="-Btn-${uniqueFileId}" onclick='getElementById("${uniqueFileId}").style.fontSize = (parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size")) > 5 ) ? parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"))-5+"px": parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"));' style="padding: 4px 8px; border: 1px solid #aaa; background-color: #ddd; ">-</button></div>
                        <textarea id="${uniqueFileId}" style="flex-grow: 1; height:100%; resize: none; border:none; padding: 10px; font-size: 15px;">${safeContent}</textarea>
                    </div>
                `;
             

            }
            
        } else if (fileType.startsWith("image/")) {
            // Зображення
            newContent = `<div style="text-align: center; height: 100%; width: 100%; overflow-y:hidden;">
                              <img src="${content}" style="max-width: 100%; height:100%; max-height: 100%; object-fit: contain;padding:0; margin:0;">
                          </div>`;
                          
        } else if (fileType.startsWith("audio/")) {
    const fileName = exfile.name.split("/").pop(); // Отримуємо назву файлу
    
    newContent = `
<div style="display: flex; flex-direction: column; height: 100%; width: 100%; background: #222; overflow: hidden;">
    
    <div style="display: flex; height: 70px; border-bottom: 2px solid #333;">
        
        <div id="time-block-${uniqueFileId}" style="display: flex; flex-direction: column; width: 130px; border-right: 1px solid #444; background: #0a0a0a; color: #00ff00; font-family: monospace; font-weight: bold; display: flex; align-items: center; justify-content: center; position: relative;">

      <div style="display: flex; flex-direction: column; gap: 2px; width: 100%;">
            <meter id="meter-l-${uniqueFileId}" min="0" max="100" value="0" style="flex-grow: 1;  display: block; accent-color: lime;"></meter>
            <meter id="meter-r-${uniqueFileId}" min="0" max="100" value="0" style="flex-grow: 1; display: block; accent-color: lime;"></meter>
</div>
<div style="display: flex; flex-direction: row;">
            <sub id="play-status-${uniqueFileId}"  style="color:#aa0000;">\u25FC</sub>
            
            <b id="time-text-${uniqueFileId}" >0:00</b>
      </div>
            

        </div>

        <div style="flex-grow: 1;  background: black; overflow: hidden; display: flex; align-items: center;">
      
            <marquee scrollamount="1" style="font-size: 18px; font-weight: bold; color: white; display: block;  width: 100%;font-family: monospace;">${fileName}</marquee>
        </div>
    </div>

    <div style="padding: 10px; height: 35px; background: #333; border-bottom: 1px solid #444; display: flex; align-items: center;">
        <input type="range" id="seek-${uniqueFileId}" style="flex-grow: 1; height: 10px; accent-color: lime; background: #222 !important; cursor: pointer;" min="0" max="100" value="0">
    </div>

    <div style="padding: 5px; background: #222; display: flex; justify-content: space-evenly; align-items: center; font-family: 'Verdana';">
        
        <button id="ctrl-prev-${uniqueFileId}" title="Prev" >|⟨</button>
        <button id="ctrl-pause-${uniqueFileId}" title="Pause" >PAUSE</button>
        <button style="flex:1;" id="ctrl-play-${uniqueFileId}" title="Play">PLAY</button>
        <button id="ctrl-stop-${uniqueFileId}" title="Stop" >STOP</button>
        <button id="ctrl-next-${uniqueFileId}" title="Next" >⟩|</button>
    </div>

    <audio id="${uniqueFileId}" src="${content}" autoplay></audio>

</div>`;


    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "0:00";
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const stopProgressInterval = () => {
        if (fileWinBox._audioIntervalId) {
            clearInterval(fileWinBox._audioIntervalId);
            delete fileWinBox._audioIntervalId;
        }
    };

    // 3. JavaScript Logic: Function to update the entire custom UI
const updateUI = () => {
        const audioPlayer = document.getElementById(uniqueFileId);

        if (!audioPlayer) return;
        audioPlayer.volume  =vol;

        // --- NEW CUSTOM UI ELEMENTS ---
        const timeText = document.getElementById(`time-text-${uniqueFileId}`);
        const seekRange = document.getElementById(`seek-${uniqueFileId}`);
        const playStatus = document.getElementById(`play-status-${uniqueFileId}`);
        
        // --- Standard infinity file check (reuse logic) ---
        try {
            if (audioPlayer.canPlayType && !audioPlayer.canPlayType(fileType)) fileWinBox.close();
        } catch (e) {}
        
        if (isNaN(audioPlayer.duration)) return;
        
        // --- UPDATE NEW CUSTOM UI (Time & Seek) ---
        if (timeText) {
            timeText.innerText = formatTime(audioPlayer.currentTime);
        }
        if (seekRange) {
            seekRange.value = ((audioPlayer.currentTime / audioPlayer.duration) * 100);
        }
        
        // --- NEW: Play/Pause/Stop Indicator Blinking Logic ---
        if (playStatus) {
            if (audioPlayer.paused) {
                if (audioPlayer.currentTime == 0) {
                    playStatus.style.color = '#aa0000'; // Stopped (Red Square implied by image's context)
                    playStatus.innerText = '\u25FC';
                    playStatus.classList.remove("blinking");
                } else {
                    playStatus.style.color = 'yellow'; // Paused (Pause icon from image 0.png is static)
                    playStatus.innerText = '||';
                    playStatus.classList.remove("blinking");
                }
            } else {
                playStatus.style.color = '#00ff00'; // Playing (Green Triangle blinks, as requested)
                playStatus.innerText = '\u25B6';
                playStatus.classList.add("blinking");
            }}
        
        // 2. Оновлення градієнта фону вікна (якщо мінімізовано)
            
        const progress = ((audioPlayer.currentTime / audioPlayer.duration) * 100).toFixed(2);
        const gradient = `linear-gradient(to right, rgba(0, 128, 0, 0.5) 0%, rgba(0, 128, 0, 1.0) ${progress}%, transparent ${progress}%, transparent 100%)`;
        const combinedBackground = `${gradient}, var(--color-win-ina)`;
        if (fileWinBox.min){
        fileWinBox.setBackground(combinedBackground);}
    };

    // Оновлення в реальному часі під час відтворення (коли вікно відкрите)
        // --- LOGIC INTERFACE INTEGRATION (Attach buttons and seekbar) ---
    setTimeout(() => {
        const player = document.getElementById(uniqueFileId);
        if (!player) return;


        // Standard event (like your richText block uses callback)
        player.ontimeupdate = updateUI;
        
            
            // --- ЛОГІКА VU-МЕТРІВ НА <meter> ---
        const meterL = document.getElementById(`meter-l-${uniqueFileId}`);
        const meterR = document.getElementById(`meter-r-${uniqueFileId}`);
        
if (meterL && meterR) {
    if (!player._audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        player._audioCtx = new AudioContext();
        player._source = player._audioCtx.createMediaElementSource(player);
        
        player._splitter = player._audioCtx.createChannelSplitter(2);
        player._analyserL = player._audioCtx.createAnalyser();
        player._analyserR = player._audioCtx.createAnalyser();
        
player._analyserL.fftSize = 32;
player._analyserR.fftSize = 32;

// Стандартні значення: min = -100, max = -30. 
// Звужуючи цей діапазон, ми робимо метри супер-чутливими до тихих звуків:
player._analyserL.minDecibels = -70; // Поріг повної тиші (чим ближче до 0, тим менше чутливість)
player._analyserL.maxDecibels = -10; // Поріг максимального стрибка
player._analyserR.minDecibels = -70;
player._analyserR.maxDecibels = -10;

        player._source.connect(player._splitter);
        player._splitter.connect(player._analyserL, 0); // Лівий
        player._splitter.connect(player._analyserR, 1); // Правий
        
        player._source.connect(player._audioCtx.destination);
    }

    // Переходимо на справжні частотні дані (FrequencyData) - вони набагато ефектніші для VU-метрів
    const bufferLength = player._analyserL.frequencyBinCount;
    const dataArrayL = new Uint8Array(bufferLength);
    const dataArrayR = new Uint8Array(bufferLength);

    let animationFrameId;

    const updateMeters = () => {
        // Перевіряємо, чи плеєр і самі метри ще існують в DOM
        const currentPlayer = document.getElementById(uniqueFileId);
        const mL = document.getElementById(`meter-l-${uniqueFileId}`);
        const mR = document.getElementById(`meter-r-${uniqueFileId}`);
        
        if (!currentPlayer || !mL || !mR || currentPlayer.paused) {
            // Якщо на паузі або вікно закрили — скидаємо в 0 і зупиняємо цикл
            if (mL) mL.value = 0;
            if (mR) mR.value = 0;
            if (!currentPlayer || !mL) {
                cancelAnimationFrame(animationFrameId);
                return;
            }
        }

        animationFrameId = requestAnimationFrame(updateMeters);

        // Беремо частоти (значення від 0 до 255)
        player._analyserL.getByteFrequencyData(dataArrayL);
        player._analyserR.getByteFrequencyData(dataArrayR);

        const getVolumeFromFrequencies = (dataArray) => {
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            // Повертаємо середнє значення у відсотках (0-100)
            return (sum / dataArray.length) / 255 * 100;
        };

        const volL = getVolumeFromFrequencies(dataArrayL);
        const volR = getVolumeFromFrequencies(dataArrayR);

        // Метри будуть дуже чутливими і "живими"
        const sensitivity = 0.5; 
        mL.value = Math.min(volL * sensitivity, 100);
        mR.value = Math.min(volR * sensitivity, 100);
    };

    // Запускаємо тільки тоді, коли аудіо реально грає, щоб економити CPU
    player.onplay = () => {
        // Браузери блокують AudioContext до першого кліку. Розблоковуємо при старті:
        if (player._audioCtx.state === 'suspended') {
            player._audioCtx.resume();
        }
        updateMeters();
    };
    
    player.onpause = () => {
        meterL.value = 0;
        meterR.value = 0;
    };

    // Якщо трек вже запущено (через autoplay), стартуємо метри відразу
    if (!player.paused) {
        updateMeters();
    }
}


        // Seekbar logic (Clicking and dragging on the range input)
        const seekInput = document.getElementById(`seek-${uniqueFileId}`);
        seekInput.oninput = function() {
            player.currentTime = (this.value / 100) * player.duration;
            updateUI(); // Immediate update when seekbar moves
        };

        // Attach Button Controls
        document.getElementById(`ctrl-prev-${uniqueFileId}`).onclick = () => { player.currentTime -= 10; updateUI(); };
        document.getElementById(`ctrl-play-${uniqueFileId}`).onclick = () => { player.play(); updateUI(); };
        document.getElementById(`ctrl-pause-${uniqueFileId}`).onclick = () => { player.pause(); updateUI(); };
        document.getElementById(`ctrl-stop-${uniqueFileId}`).onclick = () => { player.pause(); player.currentTime = 0; updateUI(); };
        document.getElementById(`ctrl-next-${uniqueFileId}`).onclick = () => { player.currentTime += 10; updateUI(); };

    }, 50);
updateUI()

    // Логіка для мінімізації (ваша існуюча)
    fileWinBox.onminimize = function() {
        updateUI();
        stopProgressInterval();
        fileWinBox._audioIntervalId = setInterval(updateUI, 500);
    };

    fileWinBox.onrestore = function() {
        fileWinBox.setBackground('transparent');
        stopProgressInterval();
    };

    fileWinBox.onblur = function() {
        fileWinBox.setBackground('transparent');
        stopProgressInterval();
    };

    fileWinBox.onclose = function() {
        fileWinBox.setBackground('transparent');
        stopProgressInterval();
    };
} else if (fileType.startsWith("video/")) {
            // Відео
            newContent = `<div style="height: 100%; overflow-y:hidden;"> <video controls src="${content}" style="width: 100%; height: 100%;max-width: 100%; max-height: 100%; object-fit: contain;padding:0; margin:0;"></video> </div>`;
            
        } else if (fileType == "application/pdf" && navigator.pdfViewerEnabled) {
            newContent= `
             <div style="height: 100%; overflow-y:hidden;">
             <embed src="${content}" type="application/pdf" style="width: 100%; height: 100%;">
             </div> 
            `;
        } else {
            // Невідомий/Непідтримуваний тип
            newContent = `<div style="padding: 10px; color: black;">${_('unsupported_file_type')}</div>`;
        }
        
        try{
            fileWinBox.body.innerHTML = newContent;
        }catch{
            console.warn('Running non-window application. Exiting GPU draw.')
        }

        // --- 3. ЛОГІКА ОБРОБНИКІВ ДІЙ (ТІЛЬКИ ДЛЯ РЕДАГОВАНИХ ФАЙЛІВ) ---
        if (isEditable) {

            const printButton = fileWinBox.body.querySelector(`#printBtn-${uniqueFileId}`);
            const findButton = fileWinBox.body.querySelector(`#findBtn-${uniqueFileId}`);
            const saveButton = fileWinBox.body.querySelector(`#saveBtn-${uniqueFileId}`);
            const textArea = fileWinBox.body.querySelector(`#${uniqueFileId}`);
            const tableCont = fileWinBox.body.querySelector(`#table-cont-${uniqueFileId}`);


if (exfile.name.endsWith(".html") || exfile.name.endsWith(".htm")) printButton.disabled = true;
   

                // ЛОГІКА ЗБЕРЕЖЕННЯ ПРИ КОМБІНАЦІЇ КЛАВІШ
                fileWinBox.body.addEventListener('keydown', async function(event) { // ЗРОБЛЕНО ASYNC
                    // Перевірка, чи натиснуто 'S'


                    if (event.ctrlKey || event.metaKey) {	
                        
                        // Перевірка комбінації: CtrlKey (Windows/Linux) або metaKey (Mac / Command)
                        const isSave = event.key.toLowerCase() === 's';
						const isPrint = event.key.toLowerCase() === 'p';
						const isFind = event.key.toLowerCase() === 'f';
if (!isSave && !isPrint && !isFind) return;
						event.preventDefault()
                        
                        if (isSave) saveButton.click();
                        if (isPrint) printButton.click();
                        if (isFind) findButton.click();             


}
                });

findButton.onclick = async () => {
    const query = await prompt(_("find_btn"));
    if (!query) return;

    const isTextarea = textArea.tagName.toLowerCase() === "textarea";

    if (isTextarea) {
        // --- Логіка для Plain Text (.txt, .js, .css тощо) ---
        const text = textArea.value;
        const index = text.toLowerCase().indexOf(query.toLowerCase());

        if (index !== -1) {
            textArea.focus();
            textArea.setSelectionRange(index, index + query.length);
            
            // Прокрутка до виділення в textarea
            const lineHeight = parseFloat(window.getComputedStyle(textArea).lineHeight);
            const charsBefore = text.substring(0, index).split('\n');
            const currentRow = charsBefore.length;
            textArea.scrollTop = (currentRow * lineHeight) - (textArea.clientHeight / 2);
        } else {
            await alert(_("not_found"));
        }
    } else {
        // --- Логіка для Rich Text та CSV (HTML-контейнери) ---
        const container = tableCont || textArea;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let textNode;
        let found = false;

        while (textNode = walker.nextNode()) {
            const index = textNode.nodeValue.toLowerCase().indexOf(query.toLowerCase());
            
            if (index !== -1) {
                const range = document.createRange();
                const selection = window.getSelection();
                
                range.setStart(textNode, index);
                range.setEnd(textNode, index + query.length);
                
                selection.removeAllRanges();
                selection.addRange(range);
                
                textNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                found = true;
                break;
            }
        }

        if (!found) await alert(_("not_found"));
    }
};


printButton.onclick = async () => {
    const isTextarea = textArea.tagName.toLowerCase() === "textarea";
    let newTextContent;
    if (!tableCont) {
      newTextContent = isTextarea ? textArea.value : textArea.innerHTML;
  }else{
      newTextContent = tableCont.innerHTML;
  }
    
    const iframe0 = document.createElement('iframe');

    // Приховуємо фрейм

    document.body.appendChild(iframe0);

    const doc = iframe0.contentWindow.document;
iframe0.contentWindow.print = window.print;

    doc.open();
    // Додаємо базові стилі, щоб текст виглядав коректно при друці
    doc.write('<html><head><title>Print</title></head><body>' + newTextContent + '</body></html>');
    doc.close();

    // Чекаємо завантаження контенту перед друком
    iframe0.contentWindow.focus(); 
    iframe0.contentWindow.print();

    // Видаляємо фрейм після відкриття діалогу друку
    // (Деякі браузери потребують затримки для коректної роботи)
    setTimeout(() => {
        document.body.removeChild(iframe0);
    }, 1000);
}

function normalizeHTML(html) {
    return html
        .replace(/<div>/g, "<p>")
        .replace(/<\/div>/g, "</p>")
        .replace(/<br>/g, "<br/>")
        .replace(/&nbsp;/g, " ");
}

saveButton.onclick = async () => { // ЗРОБЛЕНО ASYNC
console.log("SAVE")
                const isTextarea = textArea.tagName.toLowerCase() === "textarea";
let newTextContent;
if (isTextarea) {
newTextContent = textArea.value;
}else{
if (fileType == "application/rtf"){
newTextContent = htmlToRtf(textArea.innerHTML);
}else if (fileType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"){

// 1. Parse padding into margins (e.g., "20px" -> 20)
    // Convert px to twips: (px / 96) * 1440
    const paddingPx = parseInt(window.getComputedStyle(textArea).paddingLeft) || 20;
    const marginTwips = Math.round((paddingPx / 96) * 1440);

    // 2. Generate the Blob first
const cleanHtml = normalizeHTML(`  <!DOCTYPE html>
  <html>
    <head><meta charset="utf-8"></head>
    <body>`+textArea.innerHTML+`    </body>
  </html>`);
console.log(cleanHtml)

const blob = htmlDocx.asBlob(cleanHtml, {
    orientation: 'portrait',
    margins: { top: marginTwips, right: marginTwips, bottom: marginTwips, left: marginTwips }
});

    // 3. Convert Blob to Uint8Array (Raw File Contents)
    newTextContent = blob;
// ... всередині else після DOCX ...
} else if (fileType === "text/csv" && tableCont) {
    const rows = Array.from(tableCont.querySelectorAll('tr'));
    newTextContent = rows.map(row => 
        Array.from(row.querySelectorAll('td'))
             .map(td => td.innerText.replace(/,/g, "")) // прибираємо коми в тексті
             .join(",")
    ).join("\n");
}else{
var turndownService = new TurndownService()
newTextContent = turndownService.turndown(textArea.innerHTML)
}
}


                // Створення нового File об'єкта з оновленим вмістом
                const newFile = new File([newTextContent], exfile.name, { type: exfile.type ,lastModified: Date.now() });
                
                const index = fs.findIndex(item => item.name === exfile.name);
                if (index !== -1) {
                    fs[index] = newFile;
                    
                    // !!! ОНОВЛЕНО: ЗБЕРІГАЄМО ОДИН ФАЙЛ В IDB !!!
                    if (disk.type != "localStorage"){   await saveFileToDB(newFile);
                            } else{
                    localStorage.setItem(exfile.name, newTextContent)
                            }
                    
                    await refr(); // Оновлення File Explorer
                }
            };
        }
    } 

    // --- 4. ЯК ЧИТАТИ ФАЙЛ ---
    if (fileType.startsWith("text/") || !exfile.name.includes(".") || fileType == "application/x-theme"  || fileType== "application/rtf") {
        console.log("readAsText");
        reader.readAsText(exfile);
    } else if (fileType.startsWith("image/") || fileType.startsWith("audio/") || fileType.startsWith("video/") || fileType.startsWith("font/") || fileType == "application/pdf") {
        console.log("readAsDataURL")
        reader.readAsDataURL(exfile);
    } else {
        console.log("readAsArrayBuffer")
        reader.readAsArrayBuffer(exfile);
        // Для бінарних/невідомих типів (архіви)
        // Зазвичай тут варто було б викликати reader.readAsArrayBuffer, але для простоти...
        
        
    }
} 
// --- КІНЕЦЬ Openf ---
// --- ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ FILE EXPLORER ---

/**
 * Асинхронно отримує інформацію про використання пам'яті (квоту)
 * для IndexedDB (і всього Origin) у байтах.
 * @returns {Promise<{used: number, total: number}>} Використаний та загальний обсяг у байтах.
 */
async function getStorageUsageInfo() {
    // 1. Перевіряємо підтримку API
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
            const estimate = await navigator.storage.estimate();
            
            const usedBytes = estimate.usage || 0;
            const totalBytes = estimate.quota || 0; 
            
            return {
                used: usedBytes,
                total: totalBytes 
            };
        } catch (error) {
            console.error("Error getting storage estimate:", error);
            return { used: 0, total: 0 };
        }
    } else {
        console.warn("StorageManager API is not supported. Cannot estimate usage.");
        // Повертаємо 0, щоб уникнути помилок, але функціонал працювати не буде
        return { used: 0, total: 0 }; 
    }
}

/**
 * Перетворює байти у читабельний рядок (KB, MB, GB).
 * @param {number} bytes Кількість байтів.
 * @returns {string} Форматований рядок.
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


async function zipFolder(folderPath, zipName = "archive.zip", compress = false) {
    const zip = new JSZip();
    
    // 1. Нормалізація шляху папки
    const cleanFolderPath = folderPath.replace(/\/+$/, "") + "/";
    const folderName = cleanFolderPath.split("/").filter(Boolean).pop();

    // 2. Виправляємо логіку формування імені архіву
    // Якщо ім'я стандартне, беремо назву папки. Додаємо parentPath.
    const pathParts = cleanFolderPath.split("/").filter(Boolean);
    pathParts.pop();
    const parentPath = pathParts.length > 0 ? pathParts.join("/") + "/" : "";

    const finalZipName = (zipName === "archive.zip") ? `${folderName}.zip` : zipName;
    const archivePath = parentPath + finalZipName;

    // 3. Збір файлів
    for (const f of fs) {
        // Пропускаємо сам архів та файли поза цільовою папкою
        if (f.name === archivePath) continue;

        if (f.name.startsWith(cleanFolderPath)) {
            const relativePath = f.name.slice(cleanFolderPath.length);
            
            if (!relativePath || relativePath === "/") continue;

            try {
                const arrayBuffer = await f.arrayBuffer();
                zip.file(relativePath, arrayBuffer);
            } catch (e) {
                console.error(`[Infinity OS] Failed to read ${f.name}:`, e);
            }
        }
    }

    // 4. Генерація та збереження
    const contentBlob = await zip.generateAsync({
        type: "blob",
        compression: compress ? "DEFLATE" : "STORE"
    });

    const resultFile = new File([contentBlob], archivePath, { type: "application/zip" });

    // 5. Оновлення FS (уникаємо дублікатів у масиві)
    const existingIdx = fs.findIndex(file => file.name === archivePath);
    if (existingIdx !== -1) {
        fs[existingIdx] = resultFile; // Замінюємо старий файл новим
    } else {
        fs.push(resultFile);
    }

    // Збереження в IndexedDB (через вашу системну функцію)
    await saveFileToDB(resultFile);

    console.log(`[Infinity OS] Archive created at: ${archivePath}`);
    return archivePath; // Корисно для UI, щоб підсвітити файл
}



async function unzipFile(filePath, cwd) {
let file;
if (typeof filePath == "string"){
file = fs.find(f => f.name === filePath);
}else{
    file = filePath
}
    if (!file) return;

    

    var zip = new JSZip();
// more files !
await zip.loadAsync(file)
try{
    zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
            console.log(`Extracting: ${relativePath}`);

            zipEntry.async("blob").then(content => {

                const type = getMimeType(zipEntry.name);

const parts = zipEntry.name.split("/");
const pureName = parts.pop(); // file.txt
const folderPath = parts.join("/"); // folder
let p;
if (cwd == ""){
    p = zipEntry.name;
}else{
    p = cwd+"/"+zipEntry.name;
}
                const extractedFile = new File(
                    [content],
                   p,
                    { type }
                );

                
                fs.push(extractedFile);
                saveFileToDB(extractedFile)
            });
        }
        
    });
}catch (e){
    console.error("&"+e.message)
}
}



// Отримати розширення (універсально для об'єкта File або рядка)


// Нова функція MIME-типів
function getMimeType(fileName) {
    const ext = getExt(fileName);
    return (ext && FILE_TYPES[ext]) ? FILE_TYPES[ext].mime : 'application/octet-stream';
}

// Нова функція іконок
function getIcon(file) {
    const ext = getExt(file);
    return (ext && FILE_TYPES[ext]) ? FILE_TYPES[ext].icon : icns.empty;
}



/**
 * Асинхронно видаляє файл з fs, IndexedDB та оновлює UI.
 * @param {string} fileName Ім'я файлу, який потрібно видалити.
 * @param {function} updateUICallback Функція для оновлення списку файлів (renderFileList).
 * @param {function} updateQuotaCallback Функція для оновлення індикатора квоти (updateQuotaInfo).
 * @returns {Promise<boolean>} Успішність операції.
 */
async function deleteFile(fileName, updateUICallback, updateQuotaCallback) {
    const initialLength = fs.length;
    
    // 1. Видаляємо файл з глобального масиву fs
    fs = fs.filter(item => item.name !== fileName);
    
    if (fs.length < initialLength) {
        try {
            // 2. Видаляємо файл з IndexedDB (АСИНХРОННО)
            await idbWrapper.deleteFile(fileName); 
            const foundApp = apps.find(app => app.url === fileName);
            if (foundApp){
                apps = apps.filter(app => app.url !== foundApp.name);
            }
            // 3. Оновлюємо UI
            updateUICallback();
            await updateQuotaCallback(); 
            
            
            return true;
        } catch (error) {
            console.error("Помилка видалення з IndexedDB:", error);
            // Якщо IndexedDB дала помилку, варто було б відкотити fs, але для простоти поки ігноруємо
            return false;
        }
    } 
    return false;
}

// -------------------------------------------------------------------

/**
 * Асинхронно перейменовує файл у fs, IndexedDB та оновлює UI.
 * @param {number} fileIndex Індекс файлу в масиві fs.
 * @param {string} newName Нове ім'я файлу.
 * @param {function} renderFileList Функція для оновлення списку файлів.
 * @param {function} updateQuotaInfo Функція для оновлення індикатора квоти.
 * @returns {Promise<boolean>} Успішність операції.
 */
async function performRename(fileIndex, newName, renderFileList, updateQuotaInfo) {
    if (fileIndex === -1 || !fs[fileIndex]) {
        console.error("Файл не знайдено для перейменування.");
        return false;
    }

    const oldFile = fs[fileIndex];
    const oldName = oldFile.name;
    
    // 1. Створюємо новий Blob/File об'єкт з новим ім'ям
    const newFile = new File([oldFile], newName, { type: getMimeType(newName) ,lastModified: Date.now()});

    // 2. Оновлюємо глобальний масив fs
    fs[fileIndex] = newFile;
    
    try {
        // 3. Видаляємо старий запис з IndexedDB (за старим іменем)
        await idbWrapper.deleteFile(oldName);
        
        // 4. Зберігаємо новий запис з новим іменем
        const success = await saveFileToDB(newFile);
        
        if (success) {
            
            
            // 5. Оновлюємо autoload, якщо перейменовується JS файл
            if (oldFile.type === 'text/javascript') {
                let autoload = JSON.parse(localStorage.getItem('infinity_os_autoload') || '[]');
                
                if (autoload.includes(oldName)) {
                    autoload = autoload.filter(name => name !== oldName);
                    autoload.push(newName);
                    localStorage.setItem('infinity_os_autoload', JSON.stringify(autoload));
                    
                }
            }
            
            // 6. Оновлюємо UI
			if (renderFileList) await renderFileList();
            if (updateQuotaInfo) await updateQuotaInfo(); 
            
            return true;
        }
    } catch (error) {
        console.error("Помилка перейменування/збереження:", error);
        return false;
    }
    return false;
}

// -------------------------------------------------------------------


async function createIDB() {
    const dbName = await prompt(_("prompt_new_idb_name")); // використовуємо глобальну змінну
    if (!dbName) return;
    if (dbName.includes("://")){

    }else{

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Створюємо об’єктне сховище за ім’ям STORE_NAME
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "name" });
                
            }
        };

        request.onerror = (event) => {
            console.error("Database error:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            console.log(`Database '${dbName}' opened successfully`);
            resolve(db); // дескриптор IDB для подальшого використання
        };
    });
  }
}



async function unmountDrive(driveName){
      dbInstances[driveName].close();
    DB_NAME = "";
        delete dbInstances[driveName];
        console.log("UnMounted:"+driveName);
        LAST_DB = "";
        sounds.play("driveOut");
}

async function mountDrive(driveName){
    DB_NAME = driveName;
    console.log("Attempting to mount:"+driveName)
    await idbWrapper.openDB();
    await loadFsFromDB();
}

 /**
 * Асинхронно створює новий порожній текстовий файл, додає його в FS та оновлює UI.
 * @param {function} renderFileList Функція для оновлення списку файлів.
 * @param {function} updateQuotaInfo Функція для оновлення індикатора квоти.
 */
 
async function handleCreateFile(renderFileList, updateQuotaInfo, cwd = "", cdsk = "") {
    let fileName = await prompt(_('prompt_new_file_name'));
    
    if (!fileName) return; 

    // Додаємо .txt, якщо немає розширення

    // Перевірка на дублікат
    if (fs.some(file => file.name === fileName)) {

        return;
    }
    

    const path = cwd == "" ? fileName : cwd.trim() + "/" + fileName;
    const newFile = new File([""], path, { type: getMimeType(fileName) });
    
    // Додаємо в глобальний масив
    fs.push(newFile);
    
    // Зберігаємо в IndexedDB
    if (cdsk.type != "localStorage"){
    saveFileToDB(newFile);
    }else{
        localStorage.setItem(path, "");
        
    }
    await renderFileList();
        await updateQuotaInfo();
        
}
        
        

function getAllFileSizes(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    const req = store.getAll();
    req.onsuccess = () => {
      let total = 0;
      const sizes = [];

      for (const item of req.result) {
        if (item instanceof Blob) {
          sizes.push(item.size);
          total += item.size;
        }
        // or if wrapped:
        // if (item.file) total += item.file.size;
      }

      resolve({ sizes, total });
    };
    req.onerror = () => reject(req.error);
  });
}   
async function getIndexedDBUsage(dbName){
                
    const oldDB = DB_NAME;

return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);

    request.onsuccess = async (event) => {
      const db = event.target.result;
      let totalSize = 0;
      const storeNames = Array.from(db.objectStoreNames);

      for (const storeName of storeNames) {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const keys = await new Promise(res => {
            const req = store.getAllKeys();
            req.onsuccess = () => res(req.result);
        });

        for (const key of keys) {
            const data = await new Promise(res => {
                store.get(key).onsuccess = (e) => res(e.target.result);
            });
            // Approximate size for structured clone
            totalSize += new Blob([JSON.stringify(data)]).size;
        }
      }
      db.close();
      resolve(totalSize);
    };
    request.onerror = () => reject(request.error);
  });
            }
        
async function updateDiskQuotaUI (disk, meter, text){
    try {
        if (disk.type === "localStorage") {
            // приблизна оцінка: 2 байти на символ
            const usedBytes = JSON.stringify(localStorage).length * 2;
            const totalBytes = maxLS;
if (meter && text){
            meter.max = totalBytes;
            meter.value = usedBytes;
            text.innerText = formatBytes(usedBytes) + " / " + formatBytes(totalBytes);
}
        }

        if (disk.type === "indexedDB") {
            const usedBytes = await getIndexedDBUsage(disk.name);

            // беремо загальну квоту браузера як max
            const estimate = await navigator.storage.estimate();
            const totalBytes = estimate.quota || usedBytes;
            
            if (meter && text){
            meter.max = totalBytes;
            
            meter.value = usedBytes;
            text.innerText = formatBytes(usedBytes) + " / " + formatBytes(totalBytes);
            }
            return {usedBytes: usedBytes, totalBytes: totalBytes};
        }
    } catch (e) {
        console.warn("Quota error:"+ e.message);
        if (text) text.innerText = _("unknown");
        return {usedBytes: 0, totalBytes: 0};
    }
}
// --- Отримання всіх дисків ---
async function getDisks() {
    const disks = [];
    
    // LocalStorage
    const lsUsed = JSON.stringify(localStorage).length * 2; // байти приблизно
    disks.push({
        type: "localStorage",
        name: "Local Storage",
        icon: icns.lsDrive,
        used: lsUsed,
        total: maxLS, // 5 MB стандарт
    });

    // IndexedDB
    if (window.indexedDB && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
    const {usedBytes, totalBytes} = await updateDiskQuotaUI({type: "indexedDB", name: db.name});
    disks.push({
        type: "indexedDB",
        name: db.name,
        icon: icns.dbDrive,
        used: usedBytes,
        total: totalBytes,
        mounted: false,
        dbName: db.name
    });
}
    }

    return disks;
};

addIcon("files", icns.files, function(){ // ВИКОРИСТАННЯ КЛЮЧА
    const uniqueId = "file-explorer-" + Date.now(); 

    new wm(_("files"), { // ВИКОРИСТАННЯ _()
    x: "center",y: "center",
        id: uniqueId, 
        icon: icns.files,
        class: ["no-full", wbtheme],
        minwidth: 255,
        minheight:255,
        html: `
    <div style="height: 100%; width: 100%; display: flex; flex-direction: column; white-space: nowrap; overflow: hidden;">
        <!-- Тулбар -->
        <div id="file-toolbar-${uniqueId}" class="toolbar" style="flex-shrink: 0;">
            <button id="up-btn-${uniqueId}">..</button>
            <div id="toolbar-${uniqueId}" style="display: none;">
                <input type='text' id="pathlabel-${uniqueId}">
            </div>
            <input style="display:none;" type="file" id='file-input-${uniqueId}'>
        </div>

        <!-- Основна частина: Sidebar + Resizer + List -->
        <div style="display: flex; flex-direction: row; flex-grow: 1; height: 100%; overflow: hidden;">
            
            <!-- Sidebar -->
            <div style="width: fit-content; background: #ddd !important; overflow-y: auto; height: 100%;">
                <ul style="list-style-type: none; padding: 0; background:transparent;" id="sidebar-${uniqueId}"></ul>
            </div>

            <!-- Ресайзер -->
            <div id="resizer-${uniqueId}" style="width: 5px; cursor: col-resize; background: #ccc; flex-shrink: 0;"></div>


            <ul id="file-list-${uniqueId}" style="flex: 1; color: black; list-style-type: none; padding: 0; margin: 0; height: 100%; overflow-y: auto;">
            </ul>

        </div>
    </div>
`,
        minheight: 210,
        minwidth: 210,
        
        oncreate: async function() { 
            const fileListContainer = this.body.querySelector(`#file-list-${uniqueId}`);
            const sideListContainer = this.body.querySelector(`#sidebar-${uniqueId}`);

            let filesSettings = JSON.parse(localStorage.getItem("config/files")) || {"filesCols": [], "showHidden": true};
            let filesCols = filesSettings.filesCols || [];
            let filesShowHidden = filesSettings.showHidden || false;
            
            const fileInput = this.body.querySelector(`#file-input-${uniqueId}`);
            
    const resizer = this.body.querySelector(`#resizer-${uniqueId}`);
    
    // Встановлюємо мінімальну ширину при старті
    let minSidebarWidth;

    const resize = (e) => {
        // Отримуємо координати лівої межі вікна
        const rect = sideListContainer.getBoundingClientRect();
        // Обчислюємо ширину як різницю між мишею та початком сайдбара
        const newWidth = e.clientX - rect.left;
        
        if (newWidth > 50 && newWidth < 600) { // Обмежуємо розумними межами
             sideListContainer.style.width = newWidth + 'px';
        }
    };

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Запобігаємо виділенню тексту при русі
        document.addEventListener('mousemove', resize);
        
        // Використовуємо { once: true } для автоматичного видалення обробника
        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', resize);
        }, { once: true });
    });

    // Drag & Drop обробка
    fileListContainer.addEventListener("dragover", (e) => e.preventDefault());
           
            // --- ПРАВИЛЬНА ФУНКЦІЯ ОНОВЛЕННЯ ІНДИКАТОРА ---
            const updateQuotaInfo = async () => {
                // 1. Отримання чистого обсягу у байтах
                const info = await getStorageUsageInfo();
                const usedBytes = info.used;
                const totalBytes = info.total;

                // 2. Форматування для тексту (MB, GB тощо)
                const usedTextFormatted = formatBytes(usedBytes);
                const totalTextFormatted = formatBytes(totalBytes);
                
                // 3. Розрахунок відсотка
                const percentage = totalBytes > 0 ? ((usedBytes / totalBytes) * 100).toFixed(2) : 0;
                
                
            };

            // --- ФУНКЦІЯ ВІДОБРАЖЕННЯ ФАЙЛІВ (ДОДАНО КНОПКУ ВИДАЛЕННЯ) ---.
            let currentDir = "";
            
            const getFoldersInDir = (dir) => {
    const folders = new Set();

    fs.forEach(f => {
        const p = f.path || f.name;

        if (!dir) {
            if (p.includes("/")) {
                folders.add(p.split("/")[0]);
            }
        } else {
            if (p.startsWith(dir + "/")) {
                const rest = p.slice(dir.length + 1);
                if (rest.includes("/")) {
                    folders.add(rest.split("/")[0]);
                }
            }
        }
    });

    return [...folders];
};



const getFilesInDir = (dir) => {
    return fs.filter(f => {
        const p = f.path || f.name;

        if (!dir) {
            return !p.includes("/");
        }

        if (!p.startsWith(dir + "/")) return false;

        const rest = p.slice(dir.length + 1);
        return !rest.includes("/");
    });
};

// ПКМ

const menu = document.getElementById("fileM");

menu.addEventListener("click", (e) => {
  e.stopPropagation();

  const li = e.target.closest("li");
  if (!li) return;

  const action = li.id;
  const file = li.dataset.file;

  console.log("ACTION:", action, file);

  // ⚠️ окрема логіка для checkbox
  if (e.target.tagName === "INPUT") {
    console.log("Checkbox changed:", e.target.checked);
    return;
  }

  // тут твої дії
});
const showContextFldrMenu = (e, currFolder) => {
    e.preventDefault(); // Завжди корисно для контекстного меню
    
    // Перевірка цілі
    if (e.target.closest("ul") !== e.target) return;
    
    // 1. Ховаємо ВСІ меню
    document.querySelectorAll(".menu").forEach(item => item.style.display = "none");
    
    const menu = document.getElementById("folderM");
    const cleanFolder = currFolder.trim();
    
    // 2. Визначаємо, які кнопки мають бути видимими
    // Починаємо з базових кнопок (наприклад, Створити файл)
    const visibleButtons = ["create_item_btn"]; 

    if (cleanFolder !== "/" && cleanFolder !== "") {
        visibleButtons.push("getinfo1_btn");
    }

    // 3. Скидаємо відображення ВСІХ пунктів меню перед показом потрібних
    menu.querySelectorAll("li").forEach(li => {
        li.style.display = "none";
    });

    // 4. Активуємо та налаштовуємо лише потрібні кнопки
    visibleButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.display = "block";
            btn.setAttribute("data-file", currFolder);
        }
    });

    // 5. Переклад (i18n)
    menu.querySelectorAll("li > p, label, b").forEach(item => {
        // Використовуємо оригінальний текст як ключ, якщо ще не перекладено
        if (!item.dataset.key) item.dataset.key = item.innerText;
        item.innerText = _(item.dataset.key);
    });

    // 6. Позиціонування та показ
    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";
    menu.style.display = "block";
}


const showContextMenu = (e, itemType, fileName) => {
    e.preventDefault();

    // Сховати інші меню
    document.querySelectorAll(".menu").forEach(item => item.style.display = "none");

    // Встановити data-file на всі кнопки
    const buttons = [
  "open_btn",
  "open_as_text_btn",
  "unzip_btn",
  "rename_btn",
  "delete_file_btn",
  "set_bg_btn",
  "toggle_autoload",
  "getinfo_btn",
  "mount_btn",
  "unmount_btn",
  "format_btn",
  "default_btn",
  "zip_btn",
  "toggle_startup",
  "print_btn"
];

// 1. Перевірка файлу
console.log(fileName+" "+itemType)

// 2. RESET: показати всі кнопки
buttons.forEach(id => {
  const btn = document.getElementById(id);
  btn.style.display = "block";
});

// 3. Переклад
document.getElementById("fileM")
  .querySelectorAll("li > p, label, b")
  .forEach(item => item.innerText = _(item.innerText));

// ===== ЛОГІКА ПО ТИПУ =====

if (itemType === "localStorage") {
  buttons.forEach(id => document.getElementById(id).style.display = "none");
  document.getElementById("format_btn").style.display = "block";
  document.getElementById("getinfo_btn").style.display = "block";
}

else if (itemType === "indexedDB") {
  buttons.forEach(id => document.getElementById(id).style.display = "none");
  document.getElementById("mount_btn").style.display = "block";
  document.getElementById("unmount_btn").style.display = "block";
  document.getElementById("format_btn").style.display = "block";
  document.getElementById("toggle_startup").style.display = "block";
  document.getElementById("getinfo_btn").style.display = "block";
  document.getElementById("delete_file_btn").style.display = "block";
}

else if (itemType === "file") {
    document.getElementById("toggle_startup").style.display = "none";
    document.getElementById("mount_btn").style.display = "none";
  document.getElementById("unmount_btn").style.display = "none";
  document.getElementById("format_btn").style.display = "none";
document.getElementById("print_btn").style.display = "none";
  
  
    
  const file = fs.find(f => f.name === fileName || f.path === fileName);
  document.getElementById("print_btn").style.display = 
    ((file.type.startsWith("text/") && file.type !==  "text/html" ) || file.name.endsWith(".md") || file.name.endsWith(".rtf") || file.name.endsWith(".doc") ) ? "block" : "none";

  document.getElementById("open_as_text_btn").style.display =
    (file.type.startsWith("text/") && file.type !== "text/plain") || file.type == "image/svg+xml" || file.type == "application/x-theme" ? "block" : "none";

  document.getElementById("toggle_autoload").style.display =
    file.type === "text/javascript" ? "block" : "none";

  document.getElementById("set_bg_btn").style.display =
    file.type.startsWith("image/") ? "block" : "none";

  document.getElementById("unzip_btn").style.display =
    file.name.endsWith(".zip") ? "block" : "none";

    document.getElementById("default_btn").style.display =
    file.type.startsWith("font/") ? "block" : "none";

  document.getElementById("zip_btn").style.display = "none";
}

else {
document.getElementById("zip_btn").style.display = "block";
document.getElementById("toggle_startup").style.display = "none";
document.getElementById("open_as_text_btn").style.display = "none";
document.getElementById("toggle_autoload").style.display = "none";
document.getElementById("set_bg_btn").style.display = "none";
document.getElementById("unzip_btn").style.display = "none";
document.getElementById("mount_btn").style.display = "none";
document.getElementById("unmount_btn").style.display = "none";
document.getElementById("format_btn").style.display = "none";
document.getElementById("print_btn").style.display = "none";
document.getElementById("default_btn").style.display = "none";
}

// 4. Показ меню
const menu = document.getElementById("fileM");
menu.style.left = e.clientX + "px";
menu.style.top = e.clientY + "px";
menu.style.display = "block";

buttons.forEach(id => {
  const btn = document.getElementById(id);
  btn.setAttribute("data-file", fileName);
  //console.log(fileName)
});
};

            let currentDisk = null; // null до вибору
            let open = 0;
            
            
            
            const renderFileList = async () => {
fileListContainer.innerHTML = '';
fileListContainer.oncontextmenu = (e) => {
            e.preventDefault();
    const li = e.target.closest("li");
    
    
    
    showContextFldrMenu(e, open ? currentDir.trim()+"/" : "");
};

                

                
                

                
                
                
if (open) {
    document.getElementById("toolbar-" + uniqueId).style.display = "block";
} else {
    document.getElementById("toolbar-" + uniqueId).style.display = "none";
}

const disks = await getDisks();

    // --- ДИСКИ ---

        sideListContainer.innerHTML = '';
    disks.forEach(disk => {
        const li = document.createElement("li");
        
        li.classList = "disk";
        li.innerHTML = `
            <span style="display:flex;align-items:center;">
                <img src="${disk.icon}" width="20" style="margin-right:10px;">
                ${disk.name} <meter optimum="0.25" high="4" class="quota-progress" style="flex-grow:1;"></meter>
                    <div class="quota-text" style="font-size: 12px; color: #555;">${_('loading_text')}</div>
            </span>
        `;
        const meter = li.querySelector(".quota-progress");
const text = li.querySelector(".quota-text");

// тут потім викличеш свою getStorageUsage(disk)
updateDiskQuotaUI(disk, meter, text);

        // Клік по диску
        li.onclick = async () => {
            open = 1;
            currentDisk = disk;
            currentDir = "";
            fileListContainer.innerHTML = '';

            if (disk.type === "localStorage") {
                // Файли з LS - просто ключі як файли
                const keys = Object.keys(localStorage);
                fs = keys.map(k => new File([localStorage.getItem(k)], k, { type: getMimeType(k)}));
            } else if (disk.type === "indexedDB") {
                //fs = [];
                if (!disk.mounted) {
                    new Error()
                }
                currentDir = "";
                //idbWrapper.db?.close();
                idbWrapper.db = null;
                if (DB_NAME != disk.name){
                DB_NAME = disk.name;   
                await idbWrapper.openDB();
            } 
            
        await loadFsFromDB();
            }
            await renderFileList(); // оновлюємо список
            
            
        };

        // ПКМ для диску
        li.oncontextmenu = (e) => {
            e.preventDefault();
            const li = e.target.closest("li");
    const diskLi = li.textContent.trim().split(" ");
const diskName = diskLi
  .splice(0, diskLi.length - 5)
  .join(" ")
  .trim();
    
    const startupCheckbox = document.getElementById("isStartup");


startupCheckbox.checked = (diskName === startupDisk);

// onchange через замикання
startupCheckbox.onchange = (ev) => {
    console.log(startupDisk)
    if (ev.target.checked) {
        //console.log(fileName+" u")
        
        localStorage.setItem("startup_disk", diskName);
    } else {
        localStorage.removeItem("startup_disk");
    }
}

showContextMenu(e, disk.type, diskName);
        };

        sideListContainer.appendChild(li);
    });
minSidebarWidth = parseInt(window.getComputedStyle(sideListContainer).width) || 100;


if (!currentDisk) return;

        // 📁 ПАПКИ
    const folders = getFoldersInDir(currentDir);
    folders.forEach(folderName => {
        let li = document.createElement("li");
        



const safeId = folderName.replace(/\s+/g, "_").replace(/\//g, "_");

    // innerHTML with badge on top of icon
    li.innerHTML = `
        <span style="position:relative; display:inline-block; width:20px; height:20px; margin-right:10px;">
            <img src="${icns.folder}" width="20" height="20">
            <span id="${safeId}" style="
                position:absolute;
                top:3px;
                left:0px;
                
                color: rgba(0,0,0,0.5);
                
                font-size:8px;
                width:20px;
                height:20px;
                
                display:flex;
                align-items:center;
                justify-content:center;
            ">0</span>
        </span>
        ${folderName}
    `;




        li.onclick = () => {
            currentDir = currentDir ? currentDir + "/" + folderName : folderName;
             renderFileList();
        };
        
        li.oncontextmenu = (e) => {
            e.preventDefault();
    const li = e.target.closest("li");
    const folderName1 = currentDir == "" ? folderName.trim()+"/" :currentDir+ "/" + folderName.trim()+"/";
    
    
    showContextMenu(e, "folder", folderName1);
};
const isHidden = folderName.startsWith(".");

// 2. Визначаємо, чи взагалі показувати цей елемент
if (!isHidden || filesShowHidden) {
    // Додаємо елемент у список
    fileListContainer.appendChild(li);

    // 3. Якщо він прихований (і ми його показуємо), робимо його напівпрозорим
    if (isHidden) {
        li.style.opacity = "0.5"; 
    }
}
    // update the badge count
    const folderName2 = currentDir == "" ? folderName.trim()+"/" :currentDir+ "/" + folderName.trim()+"/";
    const count = fs.filter(f => f.name.startsWith(folderName2) && f.name.trim() != folderName2).length;
    
    document.getElementById(safeId).textContent = count;
    });

        // 📄   (твій старий код майже без змін)
    const files = getFilesInDir(currentDir);
    files.forEach(file => {
        let li = document.createElement("li");
        li.setAttribute("data-path", file.name);
        let ic = getIcon(file)
        

        const fullPath = file.name;

        const fileDisplay = document.createElement("span");
        fileDisplay.style.cssText = "flex-grow:1;display:flex;align-items:center;";
        fileDisplay.innerHTML = `
            <img src="${ic}" width="20" style="margin-right:10px;">
            <p>${file.name.split("/").pop()}</p>
        `;
        filesCols.forEach(col => {
        if (col === 'lastModified') {
            // Форматування дати
            const formattedDate = new Intl.DateTimeFormat(dateLang, localeFormat)
                .format(new Date(file.lastModified));
            
            fileDisplay.innerHTML += `<p class="col-date">${formattedDate}</p>`;
        } 
        else if (col === 'type') {
            fileDisplay.innerHTML += `<p class="col-type">${file.type}</p>`;
        }
        else if (col === 'size') {
    fileDisplay.innerHTML += `<p class="col-size">${file.size}</p>`;
}
        // Додавайте інші умови (size, type тощо) тут
    });

        fileDisplay.onclick = (e) => {
    e.stopPropagation();

    // Беремо шлях файлу з атрибута data-path li
    const li = e.target.closest("li");
    const filePath = li.getAttribute("data-path");

    // Знаходимо файл у fs по path
    const file = fs.find(f => f.name === filePath);

    if (!file) {
        console.error("Файл не знайдено:", filePath);
        return;
    }

    // Викликаємо Openf без Event
    console.log(currentDisk.name)
    Openf(null, updateQuotaInfo, getMimeType(file.name), file, currentDisk);
};

                if (document.getElementById("pathlabel-"+uniqueId)){
                document.getElementById("pathlabel-"+uniqueId).value = currentDir;
                }
                document.getElementById("pathlabel-"+uniqueId).onchange = (e) => {
                    currentDir = document.getElementById("pathlabel-"+uniqueId).value;
                     renderFileList();
                }


const openBtn = document.getElementById("open_btn");
const openTxtBtn = document.getElementById("open_as_text_btn");
const renBtn = document.getElementById("rename_btn");
const deleteBtn = document.getElementById("delete_file_btn");
const setbgBtn = document.getElementById("set_bg_btn");
const autoloadBtn = document.getElementById("toggle_autoload");
const startupBtn = document.getElementById("toggle_startup");
const unzipBtn = document.getElementById("unzip_btn");
const zipBtn = document.getElementById("zip_btn");
const getinfoBtn = document.getElementById("getinfo_btn");
const getinfo1Btn = document.getElementById("getinfo1_btn");
const mountBtn = document.getElementById("mount_btn");
const unmountBtn = document.getElementById("unmount_btn");
const formatBtn = document.getElementById("format_btn");
const printBtn = document.getElementById("print_btn");
const defaultBtn = document.getElementById("default_btn");
const upBtn = document.getElementById(`up-btn-${uniqueId}`)

upBtn.onclick = (e) => {
if (open){
if (currentDir != ""){
    currentDir = currentDir.split("/").slice(0, -1).join("/");
}else{
    open = 0;
    currentDir = "";
    currentDisk = null
}
setTimeout(renderFileList, 10);
}
}

li.oncontextmenu = (e) => {
    e.preventDefault();
    const li = e.target.closest("li");
    const fileName = file.name;
    // isAutoload для JS
    if (fileName.endsWith(".js")) {
        const autoloadString = localStorage.getItem('infinity_os_autoload');  
        if (autoloadString) {
            const autoload = JSON.parse(autoloadString);
            const autoloadCheckbox = document.getElementById("isAutoload");
            if (autoloadCheckbox) {
                autoloadCheckbox.checked = autoload.includes(file.name);
            }
        }
    }
    
    showContextMenu(e, "file", fileName);
}

defaultBtn.onclick = async (e) => {

    e.stopPropagation();
    const li = e.target.closest("li");
    
    const font = li.getAttribute("data-file");
    console.log("active font:" + fonts.active);
    await updateFonts("set", font);
}

formatBtn.onclick = async (e) => {
    
    e.stopPropagation();
    const li = e.target.closest("li");
    
    const driveName = li.getAttribute("data-file");
    console.log(driveName + " will be formatted")
    
    if (driveName == "Local Storage"){
        await localStorage.clear();
    }else{
        const transaction = dbInstances[driveName].transaction([driveName], "readwrite");
// Get the object store and clear it
const objectStore = transaction.objectStore(driveName);
const request = objectStore.clear();
    }
    await renderFileList();
}

mountBtn.onclick = async (e) => {
    e.stopPropagation();
    const li = e.target.closest("li");
    
    const driveName = li.getAttribute("data-file");
mountDrive(driveName)
}

unmountBtn.onclick = async (e) => {
    e.stopPropagation();
    const li = e.target.closest("li");
    
    const driveName = li.getAttribute("data-file");

    await unmountDrive(driveName);
    currentDisk = "";
    renderFileList();
    
}

getinfoBtn.onclick = async (e) => {
    getInfo(e,getinfoBtn)
};

getinfo1Btn.onclick = async (e) => {
    getInfo(e, getinfo1Btn)
};

getInfo = async (e, btn) => {
    //e.stopPropagation();
    
    //const li = e.target.closest("li");
    
    const filePath = btn.getAttribute("data-file");
    
    let typeofpath = "";

    let file;
    const disks = await getDisks()
    if (!filePath.endsWith("/")) {
        file = fs.find(f => f.name === filePath);
        typeofpath = "file"
        if (!file){
            file = disks.find(d => d.name === filePath)
            typeofpath = "drive"
        }
    }else{
        typeofpath = "dir"
    }

    
    let fileName;
    if (filePath.endsWith("/")){
    fileName = filePath.slice(0, -1).split('/').pop();
    }else if (file && file.type == "Storage"){
        fileName = file.name
    }else{
        fileName = filePath.split('/').pop();
    }
    
    // Форматування розміру
    let fileSize;
    if (typeofpath == "file") {
        fileSize = file.size > 1024 * 1024 ?
            (file.size / (1024 * 1024)).toFixed(2) + " MB" :
            (file.size / 1024).toFixed(2) + " KB";
    }else if (typeofpath == "drive"){
        fileSize = file.total > 1024 * 1024 ?
            (file.total / (1024 * 1024)).toFixed(2) + " MB" :
            (file.total / 1024).toFixed(2) + " KB";
    } else {
        let sum = 0;
        fs.forEach(f => { if (f.name.startsWith(filePath)) sum += f.size; });
        fileSize = sum > 1024 * 1024 ?
            (sum / (1024 * 1024)).toFixed(2) + " MB" :
            (sum / 1024).toFixed(2) + " KB";
            
    }

    // Локалізація дати
    const dateOptions = localeFormat;
    let modifiedDate,formattedDate;
    if (typeofpath == "file") {
     modifiedDate = file.lastModified
    }else if (typeofpath == "dir"){
        modifiedDate = Math.max(...fs.filter(f=> f.name.startsWith(filePath) ).map(f=> f.lastModified));
    }else{
        modifiedDate = Date.now()
    }
  

formattedDate = new Intl.DateTimeFormat(dateLang, dateOptions).format(new Date(modifiedDate));
    // Тип файлу для відображення
    let type;
    type = filePath.endsWith("/") ? _("folder") : file.type;
    // Іконка
    let ic;
    
        if (typeofpath == "file"){
        ic = getIcon(file)
        }else if (typeofpath == "drive"){
            if (file.type == "indexedDB"){
                ic = icns.dbDrive;
            }else{
                ic = icns.lsDrive;
            }
        }else{
            ic = icns.folder;
        }
        
    
    

    // Відкриття вікна
    const win = new wm(_("info"), {x: "center",y: "center",
        class: ["no-full", wbtheme, "no-max"],
        icon: icns.dialogInfo,
        height: 320,
        width: 250,
        minheight: 320,
        minwidth: 250,
        html: `
            <div style="padding: 15px;  font-size: 15px; color: black; line-height: 1.5;text-align: center; margin-bottom: 15px;">
                <img src="${ic}" style="width: 64px; height: 64px; object-fit: contain;">
                <p style="font-weight: bold; margin-top: 8px; word-break: break-all; font-size: 15px;">${fileName}</p>
            </div>
            <div style='user-select:auto;padding-left:5px;line-height: 1.25;'>
                <hr style="margin: 3px 0; border-color: #ffffff33;">
                <b>${_("type")}: </b>${type}<br>
                <b>${_("size")}: </b>${fileSize}<br>
                <b>${_("path")}: </b>${filePath}<br>
                <b>${_("modified")}: </b>${formattedDate}
            </div>
            
        `
    });
    
    const metaDiv = document.createElement("div");

metaDiv.style = 'user-select:text;padding-left:5px;line-height: 1.25;'

if (!filePath.endsWith("/")) {
    if (file.type.startsWith("image/")) {
        const imgMeta = new Image();
        imgMeta.src = URL.createObjectURL(file);
        imgMeta.onload = () => {
            const width = imgMeta.naturalWidth;
            const height = imgMeta.naturalHeight;
            
            metaDiv.innerHTML += `
                <hr style="margin: 3px 0; border-color: #ffffff33;">
                <b>${_("dimensions")}:</b> ${width} × ${height} px
            `;
            
            URL.revokeObjectURL(imgMeta.src);
        };
    } else if (file.type.startsWith("audio/")) {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
            const duration = audio.duration; // секунди
            const mins = Math.floor(duration / 60);
            const secs = Math.floor(duration % 60);
            
            metaDiv.innerHTML += `
                <hr style="margin: 3px 0; border-color: #ffffff33;">
                <b>${_("duration")}:</b> ${mins}:${secs.toString().padStart(2,'0')}
            `;
            
            URL.revokeObjectURL(audio.src);
        };
    } else if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.onloadedmetadata = () => {
            const width = video.videoWidth;
            const height = video.videoHeight;
            const duration = video.duration;
            const mins = Math.floor(duration / 60);
            const secs = Math.floor(duration % 60);
            
            metaDiv.innerHTML += `
                <hr style="margin: 3px 0; border-color: #ffffff33;">
                <b>${_("dimensions")}:</b> ${width} × ${height} px<br>
                <b>${_("duration")}:</b> ${mins}:${secs.toString().padStart(2,'0')}
            `;
            
            URL.revokeObjectURL(video.src);
        };
    }
}

// Додаємо до тіла WinBox
win.body.appendChild(metaDiv);
};



unzipBtn.onclick = async (e) => {
    e.stopPropagation();
    const filePath = e.target
    .closest("li").getAttribute("data-file");
    await unzipFile(filePath, currentDir);
    await renderFileList();
    
};
zipBtn.onclick = async (e) => {
    e.stopPropagation();
    const filePath = e.target
    .closest("li").getAttribute("data-file");
    console.log(0+filePath)
    await zipFolder(filePath);
    await renderFileList();
    
};


document.getElementById("isAutoload").onchange = (e) => {
    // 1. Ініціалізація та отримання даних
    let autoload = [];
    const autoloadString = localStorage.getItem('infinity_os_autoload');
    if (autoloadString) {
        try {
            // Перетворюємо JSON-рядок на масив
            autoload = JSON.parse(autoloadString);
        } catch (error) {
            console.error("Помилка парсингу autoload JSON:"+ error);
            // Якщо парсинг невдалий, починаємо з порожнього масиву
            autoload = []; 
        }
    }

    // 2. Логіка додавання/видалення на основі стану чекбокса
    const fileName = e.target.parentNode.getAttribute("data-file");

    // e.target.checked є коректним станом (true, якщо увімкнено)
    
    if (e.target.checked) {
        // Якщо чекбокс увімкнено, і файлу ще немає, додаємо його
        if (!autoload.includes(fileName)) {
            autoload.push(fileName);
        }
    } else {
        // Якщо чекбокс вимкнено, видаляємо файл зі списку
        // Використовуємо filter для безпечного видалення
        autoload = autoload.filter(name => name !== fileName);
    }
    
    // 3. Збереження оновленого масиву
    // Перетворюємо масив назад у JSON-рядок
    localStorage.setItem('infinity_os_autoload', JSON.stringify(autoload));
    
    
};

                  // Обробники
    setbgBtn.onclick = (e) => {
                        e.stopPropagation(); // Важливо: запобігає виклику Openf при натисканні X
                        const fileName = e.target.closest("li").getAttribute("data-file");
                        const file = fs.find(f => f.name === fileName);
                                const reader = new FileReader();
        
        reader.onload = async function(e) {
            
            const dataUrl = e.target.result;
            // Установка фону на <body>
            document.body.style.backgroundImage = `url(${dataUrl})`;
            
            // --- НОВА ЛОГІКА ЗБЕРЕЖЕННЯ ІМЕНІ ФАЙЛУ ФОНУ ---
            localStorage.setItem('infinity_os_background_file', file.name);
            
            // --- КІНЕЦЬ НОВОЇ ЛОГІКИ ---
            }
            reader.readAsDataURL(file);
                    };
        
        deleteBtn.onclick = async  (e) => {
    e.stopPropagation();
    
    
    const fileName = e.target.closest("li").getAttribute("data-file");
    const isFolder = fileName.endsWith("/");
    const disks = await getDisks();
    const isDisk = disks.some(disk => disk.name === fileName); // true, якщо диск знайдено
    
    if ( await confirm(_('prompt_delete').replace('{file}', fileName))) {
        
        if (isDisk && fileName != "Local Storage"){
            (async () => {
                
const deleteRequest = indexedDB.deleteDatabase(fileName);
        deleteRequest.onsuccess = () => console.log(`База ${fileName} видалена`);
        
        //disks = getDisks()
        await renderFileList();
        deleteRequest.onerror = (e) => console.warn(`Помилка при видаленні ${fileName}:`, e);

})();
return 1;
        }
        
        if (currentDisk.type === "localStorage") {
            
            // ==== Робота з Local Storage ====
            if (isFolder) {
                // Видалення всіх ключів у localStorage, що починаються з шляху папки
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith(fileName)) {
                        localStorage.removeItem(key);
                    }
                });
            } else {
                localStorage.removeItem(fileName);
                
                
            }
            setTimeout(()=>{ renderFileList(); updateQuotaInfo()},100)
            return;
        }
        
        // ==== Робота зі звичайною файловою системою (fs) ====
        const file = fs.find(f => f.name === fileName);
        
        if (isFolder) {
            purgeDir(fileName);
            await renderFileList();
            return;
        }
        
        let autoload = [];
        const autoloadString = localStorage.getItem('infinity_os_autoload');
        if (autoloadString) autoload = JSON.parse(autoloadString);
        
        if (file && file.type === "text/javascript") {
            if (autoload.includes(fileName)) {
                autoload = autoload.filter(name => name !== fileName);
                localStorage.setItem('infinity_os_autoload', JSON.stringify(autoload));
            }
        }

        if (file && file.type.startsWith("font/")){
          await updateFonts("delete", fileName)
        }
        
        deleteFile(file.name, renderFileList, updateQuotaInfo);
    }
};

renBtn.onclick = async (e) => {
    e.stopPropagation();
    
    const li = e.target.closest("li");
    const oldPath = li.getAttribute("data-file");
    const isFolder = oldPath.endsWith("/");
    
    
    let oldName;
    oldName = oldPath;
    if (!isFolder) {
        
        if (currentDisk.type === "localStorage") {
            oldName = oldPath;
        } else {
            const file = fs.find(f => f.name === oldPath);
            if (!file) return;
            oldName = file.name;
        }
    }
    
    const newName = await prompt(
        _('prompt_rename').replace('{old_name}', oldName),
        oldName
    );
    
    if (!newName || newName === oldName) return;
    
    if (currentDisk.type === "localStorage") {
        // ==== Перейменування Local Storage ====
        
        
        
            const value = localStorage.getItem(oldPath);
            
            localStorage.removeItem(oldPath);
            localStorage.setItem(newName, value);
        
        
        await renderFileList();
        updateQuotaInfo();
        return;
    }
    
    // ==== Перейменування через fs ====
    if (isFolder) {
        
            
        
        fs.forEach(f => {
            if (f.name.startsWith(oldPath)) {
            const fileIndex = fs.findIndex(item => item.name.startsWith( oldPath));
            newName0 = f.name.replace(oldPath, newName)
                performRename(fileIndex, newName0, renderFileList, updateQuotaInfo);                
            }
        });

    } else {
        const fileIndex = fs.findIndex(item => item.name === oldPath);
        performRename(fileIndex, newName, renderFileList, updateQuotaInfo);
    }
};
openBtn.onclick = (e) =>{
e.stopPropagation();
const fileName = e.target.closest("li").getAttribute("data-file");
if (fileName.endsWith("/")){
            currentDir = fileName.slice(0,-1);
             renderFileList();
}else{
                        const file = fs.find(f => f.path === fileName);
                        Openf(e, updateQuotaInfo, getMimeType(fileName), file);
}



}
        
        openTxtBtn.onclick = (e) => {
                        e.stopPropagation();
                        const fileName = e.target.closest("li").getAttribute("data-file");
                        const file = fs.find(f => f.path === fileName);
                        Openf(e, updateQuotaInfo, "text/plain", file);
                    }
        
                    
                    li.appendChild(fileDisplay);
                    const isHidden = file.name.split("/").pop().startsWith(".");

// 2. Визначаємо, чи взагалі показувати цей елемент
if (!isHidden || filesShowHidden) {
    // Додаємо елемент у список
    fileListContainer.appendChild(li);

    // 3. Якщо він прихований (і ми його показуємо), робимо його напівпрозорим
    if (isHidden) {
        li.style.opacity = "0.5"; 
    }
}

                    
                });
            };
            document.getElementById("create_item_btn").onclick = () => {
    // Припускаємо, що ви передаєте ваші функції рендерингу та оновлення квоти
    if (open){
    handleCreateFile(renderFileList, updateQuotaInfo, currentDir, currentDisk);
    } else{
        createIDB()
    }
};

            

            fileListContainer.ondrop = async (e) => { // Додаємо async
    e.preventDefault();
    const fls = e.dataTransfer.files;

    for (const file of fls) {
        // 1. Читаємо вміст файлу як ArrayBuffer (універсально для будь-яких типів)
        const content = await file.arrayBuffer(); 
        
        const path = currentDir == "" ? file.name : currentDir.trim() + "/" + file.name;

        // 2. Створюємо новий об'єкт File. 
        // Важливо: передаємо content як масив [content]
        const a = new File([content], path, {
            type: getMimeType(path),
            lastModified: file.lastModified
        });

        // 3. Зберігаємо у вашу віртуальну ФС та БД
        fs.push(a);
        await saveFileToDB(a); 
    }

    renderFileList();
}
            // --- Обробник завантаження (ASYNC) ---
            fileInput.onchange = async (event) => { 
                if (fileInput.files.length > 0) {
                    let filesAdded = 0;
                    for (const file of Array.from(fileInput.files)) {
                        const path = currentDir == "" ? file.name : currentDir.trim() + "/" + file.name;
                        let conv_file = file;
                        conv_file.name = path;
                        conv_file.type = getMimeType(path.split("/").pop());
                        
                        
                        fs.push(conv_file); 
                        if (currentDisk.type != "localStorage"){
                        const success = await saveFileToDB(conv_file); 
                        }else{
 const reader = new FileReader();

    reader.onload = function(e) {
      // The result is a Base64 data URL string
      const fileDataURL = e.target.result;

      // Store the string in localStorage using a key-value pair
      // The key is "savedFile", and the value is the data URL string
      localStorage.setItem(file.name, fileDataURL);
      console.log("File saved to localStorage:", localStorage.getItem("savedFile"));
    };

    // Read the file as a DataURL (Base64 string)
    reader.readAsDataURL(file);
                            localStorage.setItem(file.name, serializeFile(file))
                        }

                   await updateQuotaInfo(); // Автоматичне оновлення після завантаження
                    await renderFileList();
                    fileInput.value = '';

                        
                            filesAdded++;
                    
                    }
                    
                    if (filesAdded > 0) {
                        
        
                    }
 
                }
            };

            // Перше відображення та оновлення при створенні вікна
            await renderFileList();
            await updateQuotaInfo(); 
        }
    });
});


// --- ІНШІ ФУНКЦІЇ БЕЗ ЗМІН ---
/* addIcon, Openf (повністю оновлена вище), Clock, Calculator, Internet, updateTime, setInterval(updateTime, 1000); 
*/





addIcon(("about"),icns.dialogInfo, function(){ // ВИКОРИСТАННЯ КЛЮЧА
    new wm(_("about"),{ // ВИКОРИСТАННЯ _()
    icon: icns.dialogInfo,x: "center",y: "center",
    class: ["no-full", "no-max", "no-min", "no-resize", "tra", wbtheme],
    html: `
    <link rel="stylesheet" href="global.css">
            <div style="padding: 5px;  font-size: 15px;text-align: center;">
                <img src="${devProps.deviceIcon}" style="width: 160px; height: 110px; object-fit: contain;">
                <p style="font-weight: bold;  margin: 0px; word-break: break-all; font-size: 25px;">${devProps.model}</p>
                <small style='padding-top: 0;color:gray;'>${devProps.inchRes}, ${devProps.relYear}</small>
            </div>
            <div style='user-select:auto;text-align: center;'>
                <b>${_("CPU")}: </b>${devProps.chip}<br>

                                <b>GPU: </b>${devProps.gpu}
                                                <br>    
                <b>${_("memory")}: </b>${devProps.memory}<br>
                <b>${_("startup_disk")}: </b>${startupDisk}<br>
                <b>Infinity OS: </b>${devProps.os.version}



            </div>
            
            
        `,
          height: 365,
        width: 260,
        minheight: 320,
        minwidth: 250,
    oncreate: () => {
        const theme = localStorage.getItem("theme");
if (theme == "dark"){
    document.body.classList.add("dark");   // темна
    }else{
        document.body.classList.remove("dark"); // світла
    }
    },
  });
});
addIcon("Infinity Store",icns.store, function(){
    new wm("Infinity Store",{
    icon: icns.store,x: "center",y: "center",
    class: ["no-full", wbtheme],
    url: "apps/store.html",
          height:300,width:400,minheight: 200,minwidth:400
    
  });
});


addIcon(("clock_title"), icns.clock, function(){
    new wm(_('clock_title'), { 
        icon: icns.clock, x: "center",y: "center",
        class: ['no-full', 'no-max', wbtheme,'no-resize', 'tra'], 
        html: `<div style=\'padding-left:5px;\'><h2 class=\'clock-time\' style=\'font-size: 2em; margin: 0;\'>--:--:--</h2><p class=\'clock-date\' style=\'margin: 0;\'>--.--.----</p></div>`, 
        height:150, width:160 
    });
})

addIcon(("calculator_title"), icns.calc, function(){
    new wm(_('calculator_title'),{x: "center",y: "center", icon: icns.calc, class: ['no-full', 'no-max', wbtheme,'no-resize'], url: 'apps/calc.html', height:235, width:205 });
})

addIcon(("settings_title"), icns.settings, function(){
    new wm(_('settings_title'),{x: "center",y: "center",
     icon: icns.settings, class: ['no-full', wbtheme], 
     html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />

<style>

body,html{
    margin: 0;
    padding: 0;
}

/* ===== GRID ЛЕЙАУТ ===== */
main {
    margin: 0;
    padding: 0;
    height: 100vh;

    display: grid;
    grid-template-columns: 240px 1fr;
    grid-template-areas: "sidebar content";
}

/* ===== SIDEBAR ===== */
.settings-toolbar {
    grid-area: sidebar;
    border-right: 1px solid #ccc;
    background: #f0f0f0;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: 0.3s;
    overflow: hidden;
}

/* Хендлер */
.sidebar-handle {
    display: none;
}

/* Вкладки */
.sidebar-tab:before{
    content: "» ";
}

.sidebar-tab:hover{
    text-decoration: underline;
}

.sidebar-separator {
    border-top: 1px solid #aaa;
    margin: 6px 0;
}

/* ===== CONTENT ===== */
.content-container {
    grid-area: content;
    overflow-y: auto;
    padding: 15px;
}

#sett_app {
    container-type: inline-size;
    padding:0;
    margin:0;
}



/* ===== MOBILE ===== */
@container (width < 700px) {

     main.sidebar-collapsed {
        grid-template-columns: 40px 1fr;
    }

    main.sidebar-collapsed .settings-toolbar .sidebar-tab,
    main.sidebar-collapsed .settings-toolbar .sidebar-separator {
        display: none;
    }

    .sidebar-handle {
        display: block;
        width: 100%;
        cursor: pointer;
        background: #ccc;
        border: 1px solid #aaa;
    }
}

/* ===== ТВОЇ СТИЛІ (НЕ ЧІПАЛИСЬ) ===== */




.setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
}

.setting-label {
    flex-grow: 1;
    font-size: 14px;
}


@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

#kbrd {
    display: block;
    width: 100%;
    height: auto;
    margin: 0;
    border-bottom-left-radius: 5px;
    transition: opacity 0.5s ease-in-out;
    opacity: 1;
}

#dispImg{
    width: 160px;
    height:90px;
    text-align: center;
    justify-content: center;
    background: #000;
    color: white;
    border: darkgrey 2.5px solid;
    padding: 5px;
    border-radius: 5px;
}


.crt{
    position: relative; /* важливо для ::before/::after */
    animation: textShadow 1.6s infinite;
}

.crt::before {
  content: " ";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
  z-index: 2;
  background-size: 100% 2px, 3px 100%;
  pointer-events: none;
}

@keyframes flicker {
  0% {
  opacity: 0.27861;
  }
  5% {
  opacity: 0.34769;
  }
  10% {
  opacity: 0.23604;
  }
  15% {
  opacity: 0.90626;
  }
  20% {
  opacity: 0.18128;
  }
  25% {
  opacity: 0.83891;
  }
  30% {
  opacity: 0.65583;
  }
  35% {
  opacity: 0.67807;
  }
  40% {
  opacity: 0.26559;
  }
  45% {
  opacity: 0.84693;
  }
  50% {
  opacity: 0.96019;
  }
  55% {
  opacity: 0.08594;
  }
  60% {
  opacity: 0.20313;
  }
  65% {
  opacity: 0.71988;
  }
  70% {
  opacity: 0.53455;
  }
  75% {
  opacity: 0.37288;
  }
  80% {
  opacity: 0.71428;
  }
  85% {
  opacity: 0.70419;
  }
  90% {
  opacity: 0.7003;
  }
  95% {
  opacity: 0.36108;
  }
  100% {
  opacity: 0.24387;
  }
}

.crt::after {
  content: " ";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: rgba(18, 16, 16, 0.1);
  opacity: 0;
  z-index: 2;
  pointer-events: none;
  animation: flicker 0.15s infinite;
}

@keyframes textShadow {
  0% {
    text-shadow: 0.4389924193300864px 0 1px rgba(0,30,255,0.5), -0.4389924193300864px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  5% {
    text-shadow: 2.7928974010788217px 0 1px rgba(0,30,255,0.5), -2.7928974010788217px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  10% {
    text-shadow: 0.02956275843481219px 0 1px rgba(0,30,255,0.5), -0.02956275843481219px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  15% {
    text-shadow: 0.40218538552878136px 0 1px rgba(0,30,255,0.5), -0.40218538552878136px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  20% {
    text-shadow: 3.4794037899852017px 0 1px rgba(0,30,255,0.5), -3.4794037899852017px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  25% {
    text-shadow: 1.6125630401149584px 0 1px rgba(0,30,255,0.5), -1.6125630401149584px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  30% {
    text-shadow: 0.7015590085143956px 0 1px rgba(0,30,255,0.5), -0.7015590085143956px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  35% {
    text-shadow: 3.896914047650351px 0 1px rgba(0,30,255,0.5), -3.896914047650351px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  40% {
    text-shadow: 3.870905614848819px 0 1px rgba(0,30,255,0.5), -3.870905614848819px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  45% {
    text-shadow: 2.231056963361899px 0 1px rgba(0,30,255,0.5), -2.231056963361899px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  50% {
    text-shadow: 0.08084290417898504px 0 1px rgba(0,30,255,0.5), -0.08084290417898504px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  55% {
    text-shadow: 2.3758461067427543px 0 1px rgba(0,30,255,0.5), -2.3758461067427543px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  60% {
    text-shadow: 2.202193051050636px 0 1px rgba(0,30,255,0.5), -2.202193051050636px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  65% {
    text-shadow: 2.8638780614874975px 0 1px rgba(0,30,255,0.5), -2.8638780614874975px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  70% {
    text-shadow: 0.48874025155497314px 0 1px rgba(0,30,255,0.5), -0.48874025155497314px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  75% {
    text-shadow: 1.8948491305757957px 0 1px rgba(0,30,255,0.5), -1.8948491305757957px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  80% {
    text-shadow: 0.0833037308038857px 0 1px rgba(0,30,255,0.5), -0.0833037308038857px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  85% {
    text-shadow: 0.09769827255241735px 0 1px rgba(0,30,255,0.5), -0.09769827255241735px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  90% {
    text-shadow: 3.443339761481782px 0 1px rgba(0,30,255,0.5), -3.443339761481782px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  95% {
    text-shadow: 2.1841838852799786px 0 1px rgba(0,30,255,0.5), -2.1841838852799786px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  100% {
    text-shadow: 2.6208764473832513px 0 1px rgba(0,30,255,0.5), -2.6208764473832513px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
}

</style>
</head>
<body>
<div id="sett_app">
<main class="sidebar-collapsed">

<!-- SIDEBAR -->
<div class="settings-toolbar">
    <button class="sidebar-handle" id="sidebarToggle">≡</button>

    <a class="sidebar-tab" data-page="general" data-i18n="general"></a>
    <a class="sidebar-tab" data-page="drivers" data-i18n="drivers"></a>
    <div class="sidebar-separator"></div>
    
    <a class="sidebar-tab" data-page="display" data-i18n="display"></a>
    <a class="sidebar-tab" data-page="keyboard" data-i18n="keyboard"></a>

    <div class="sidebar-separator"></div>

    <a class="sidebar-tab" data-page="files" data-i18n="files"></a>
    <a class="sidebar-tab" data-page="themes" data-i18n="themes"></a>
    <a class="sidebar-tab" data-page="taskbar" data-i18n="taskbar"></a>
</div>


<div class="content-container" id="settings-content" style='padding-top:0;padding-right:0;'>

    <!-- GENERAL -->
    <div class="page" data-page="general">
        <h2 data-i18n="general"></h2>

        <div class="setting-row">
            <span class="setting-label" data-i18n="language"></span>

            <select id="languageSelect">
                <option value="en|EN-US">English</option>
                <option value="ua|UK-UA">Українська</option>
                <option value="fr|FR-FR">Français</option>
                <option value="ru|RU-RU">Русский</option>
                
                <option value="pl|pl-PL">Polski</option>
            </select>

        </div>

      <div class="setting-row">

  </div>
      
    </div>
    
    <div class="page" data-page="drivers" hidden>

        <h2 data-i18n="drivers"></h2>
        <ul id='navigator_list' style="list-style-type: none;" ></ul>

        <h2 data-i18n="devices"></h2>
        <ul id='dev_list' style="list-style-type: none;"></ul>

    </div>

<!-- DISPLAY -->
<div class="page" data-page="display" hidden>
    <div style="display: flex; align-items: flex-start; gap: 20px;">

        <!-- Лівий блок: заголовок та опис -->
        <div style="flex:1;">
            <h2 data-i18n="display"></h2>
        </div>

        <!-- Правий блок: зображення та select -->
        <div style="flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-start; width:200px;">

            <div id="dispImg">Sample Text</div>

            <div class="setting-row" style="margin-top:8px; padding:0; width:100%;">
                <span class="setting-label" data-i18n="display_type"></span>
                <select id="screenTypeSelect" style="width:100%;">
                    <option value="oled">OLED/AMOLED</option>
                    <option value="lcd">LCD</option>
                    <option value="crt">CRT</option>
                </select>
            </div>

        </div>
    </div>
</div>

<!-- KEYBOARD -->
<div class="page" data-page="keyboard" style='padding:0;' hidden>
    <div style="display: flex; align-items: flex-start; gap: 20px;">

        <!-- Лівий блок: заголовок та опис -->
        <div style="flex:1;">
            <h2 data-i18n="keyboard"></h2>
        </div>

        <!-- Правий блок: зображення та select -->
        <div style="flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-start; width:200px;">
            <img src="../assets/mac_kbrd.jpg" alt="Keyboard layout" id='kbrd' style="width:100%; height:auto; transition: opacity 0.5s ease-in-out; opacity:1;">

            <div class="setting-row" style="margin-top:8px; padding:0; width:100%;">
                <span class="setting-label" data-i18n="keyboard_set"></span>
                <select id="keyboardLayoutSelect" style="width:100%;">
                    <option value="mac">Apple Mac OS</option>
                    <option value="win">Windows</option>
                </select>
            </div>
        </div>
    </div>
</div> 

    


    <!-- ICONS -->
    <div class="page" data-page="files" hidden>
        <h2 data-i18n="files"></h2>
        <div id="icns_cont" style="width:100%;background-color: gray;"></div>
    </div>

    <!-- THEMES -->
    <div class="page" data-page="themes" hidden>
        <h2 data-i18n="themes"></h2>
        <div class="setting-row">
                <span class="setting-label" data-i18n="theme"></span>
                <select id="themeSelect"></select>
                </div>
            
                
    </div>
    <!-- TASKBAR -->
    <div class="page" data-page="taskbar" hidden>
        <h2 data-i18n="taskbar"></h2>
        <div class="setting-row">
                <span class="setting-label"  data-i18n="taskbar_position">:l</span>
                <select id="taskbarPosSelect">
                    <option data-i18n="bottom" value="bt">Bottom</option>
                    <option data-i18n="top" value="top">Top</option>
</select>
                </div>
            
            
                    <div class="setting-row">
                <span class="setting-label"  data-i18n="size"></span>
<input type="range" min="30" value="35" max="35" step="5" id="taskbarSize">
                </div>

      <!--
 <h3 data-i18n="taskbar_items"></h3>
<div class="setting-row">
       
<select id="taskbarItems">

</select>
<div>
<select id="addItems">

</select>
<button id="addItemL"><</button>
<button id="addItemR">></button>
</div>
</div>
       -->         
    </div>

</div>
</main>
</div>
</body>
</html>
     `
     ,
oncreate: function() {

// Знаходимо всі чекбокси в контейнері налаштувань
  const checkboxes = document.querySelectorAll('.format-group input[type="checkbox"]');

  checkboxes.forEach(cb => {
    const unit = cb.dataset.unit;
    
    // Перевіряємо, чи є такий ключ у нашому об'єкті
    // Використовуємо hasOwnProperty, щоб не пропустити булеві значення (як hour12: false)
    if (localeFormat.hasOwnProperty(unit)) {
      cb.checked = true;
      
      // Додаткова перевірка: якщо значення в об'єкті відрізняється від value чекбокса
      // (наприклад, в об'єкті "numeric", а в чекбоксі "2-digit"), 
      // ви можете оновити cb.value, але зазвичай достатньо просто активувати чекбокс.
    } else {
      cb.checked = false;
    }
  });
  

function getLocaleFormat() {
  const options = {};
  const checkboxes = document.querySelectorAll('.format-group input[type="checkbox"]');
  
  checkboxes.forEach(cb => {
    if (cb.checked) {
      const unit = cb.dataset.unit;
      let value = cb.value;

      // Перетворюємо рядки "true"/"false" у булеві значення
      if (value === "true") value = true;
      if (value === "false") value = false;

      options[unit] = value;
    }
  });
  localeFormat = options;
  localStorage.setItem("localeFormat", JSON.stringify(options))
  return options;
}


  /*
const addItems = document.getElementById("addItems");
const addItemL = document.getElementById("addItemL");
const addItemR = document.getElementById("addItemR");
const taskbarItems = document.getElementById("taskbarItems");

	renderAval = (t) => {
if (addItems) addItems.innerHTML = '';
if (taskbarItems) taskbarItems.innerHTML = '';
setTimeout(() => {
	const activePanelItems = parent.getPanelApplets();
if (Array.isArray(activePanelItems)) {
    activePanelItems.forEach(ap => {
        const el = document.createElement("option");
        el.innerText = ap.name;
        el.value = ap.itter;
        taskbarItems.appendChild(el);
    });
	taskbarItems.size = taskbarItems.children.length;	
}
	
	
        const aval = parent.getApplets();
        console.log("Довжина після затримки:", aval.length);
        
        if (Array.isArray(aval) && aval.length > 0) {
            aval.forEach(ap => {
    // Шукаємо, чи є вже такий ID серед активних
    const isAlreadyOnPanel = activePanelItems.find(active => active.id === ap.id && ap.id != null);

    if (!isAlreadyOnPanel) {
        const el = document.createElement("option");
        el.innerText = ap.name;
        el.value = ap.itter;
        addItems.appendChild(el);
    }else{
	console.warn(ap.id)
	}
});
        }
    }, t);
	}
	
	renderAval(100);

	taskbarItems.addEventListener('change', (event) => {
    // Access the newly selected value
    const selectedValue = event.target.value;
	const el = parent.getPanelApplets().find(el=> el.itter==selectedValue);
		if (!el) return;
		removePanelItem(el.id)
		renderAval(100);
		
});
	const addItemWrapper = function(lr) {
	const toAdd = addItems.value;
	const el = parent.getApplets().find(el=> el.itter==toAdd);
		console.log(el)
		let rslt;
		if (el.tag){
	 rslt = document.createElement(el.tag);
	rslt.id = el.id;
		rslt.classList = el.class;
			if (rslt.innerText){
		rslt.innerText = el.inner;
			}else{
				rslt.src = el.src;
			}
		}else{
			rslt = document.createElement("span");
			rslt.outerHTML = el.outer;
		}
		addPanelItem(rslt, lr);
		renderAval(100);
	}
	
// Правильно:
addItemL.onclick = () => addItemWrapper(0);
addItemR.onclick = () => addItemWrapper(1);
*/
const thmSelect = document.getElementById("themeSelect");
const allFiles = parent.getFs();
const themeFiles = allFiles.filter(f => f.name.toLowerCase().endsWith(".theme"));

const parser = new ThemeParser(); 

// 1. Очищуємо список ОДИН РАЗ перед циклом
thmSelect.innerHTML = `<option value="none">Glass (Default)</option>`;

// 2. Додаємо файли
themeFiles.forEach(f => {
    const el = document.createElement("option");
    el.value = f.name;
    el.innerText = f.name.replace(".theme", ""); // Прибираємо розширення для краси
    
    if (localStorage.getItem("theme") === f.name) {
        el.selected = true;
    }
    thmSelect.appendChild(el);
});

// 3. Обробник onchange залишається майже без змін
thmSelect.onchange = async () => {
    const selectedName = thmSelect.value;
    
    if (selectedName === "none") {
        localStorage.removeItem("theme");
        // Логіка скидання до Glass...
        const reboot = await confirm(_("confirm_set_theme"));
        if (reboot) safeShutdown({ restart: true });
        return;
    }

    const file = themeFiles.find(f => f.name === selectedName);
    if (file) {
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const text = reader.result;
                const thm = parser.parse(text);
                
                if (thm && thm.styles) {
                    localStorage.setItem("theme", file.name);
                    parser.applyTheme(thm.styles);
                    
                    const wbtheme = thm.name || "user-theme";
                    applyThemeToUI(wbtheme);
                    
                    const reboot = await confirm(_("confirm_set_theme"));
                    if (reboot) safeShutdown({ restart: true });
                }
            } catch (err) {
                console.error("Помилка при зміні теми:", err);
            }
        };
        reader.readAsText(file);
    }
};


    const toggleBtn = document.getElementById("sidebarToggle");
const tabs = document.querySelectorAll(".sidebar-tab");
const pages = document.querySelectorAll(".page");
const langSelect = document.getElementById("languageSelect");
const tbPosSelect = document.getElementById("taskbarPosSelect");
const tbSizeSelect = document.getElementById("taskbarSize");

toggleBtn.onclick = () => {
    document.querySelector("main").classList.toggle("sidebar-collapsed");
};

/* ===== I18N ===== */
function updateTexts() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.dataset.i18n;
        const text = _(key);
        if (text !== undefined) el.textContent = text;
    });
}

/* ===== INIT LANGUAGE ===== */
function initLanguageSelect() {
    const cl = currentLang;
    const dl = dateLang;
    if (!cl || !dl) return;
    langSelect.value = cl + "|" + dl;
}

taskbarPosSelect.value = (JSON.parse(localStorage.getItem('taskbar-conf')) || {}).pos;

tbSizeSelect.value = (JSON.parse(localStorage.getItem('taskbar-conf')) || {}).size;

tbSizeSelect.oninput = () => {
    const v = tbSizeSelect.value; // "bt" or "top"
setTaskbarConfig({ size: tbSizeSelect.value });
}

taskbarPosSelect.onchange = () => {
const v = taskbarPosSelect.value; // "bt" or "top"
setTaskbarConfig({pos: taskbarPosSelect.value});
}

/* ===== CHANGE LANGUAGE ===== */
langSelect.onchange = () => {
    const [lang, date] = langSelect.value.split("|");

    currentLang = lang;
    dateLang = date;
    loadLanguage(lang, date);

    // Затримка не обов’язкова, якщо loadLanguage синхронний
    // Але якщо переклад завантажується асинхронно, можна використати setTimeout
    setTimeout(() => {
        updateTexts();      // оновлюємо тексти
        initLanguageSelect(); // щоб select відобразив актуальне значення
    }, 50);
};


const kbrdImg = document.getElementById('kbrd');
const screenTypeSelect = document.getElementById("screenTypeSelect");
const dispImg = document.getElementById('dispImg');


/* ===== TAB SWITCHING ===== */
async function showPage(name) {
    pages.forEach(p => {
        p.hidden = p.dataset.page !== name;
    });

    tabs.forEach(t => {
        t.classList.toggle("active", t.dataset.page === name);
    });

    updateTexts(); // на випадок якщо вкладка нова
    if (name == "drivers"){

const container = document.getElementById("navigator_list");
container.innerHTML = "";

const availableDrivers = Object.keys(devProps)
  .filter(name => (devProps[name] != null) && name != "os" && name != "deviceIcon" && name != "relYear" && name != "inchRes" && name != "model");

availableDrivers.forEach(name => {
  const li = document.createElement("li");
  li.innerText = name;
  container.appendChild(li);
});





const container1 = document.getElementById("dev_list");
container1.innerHTML = "";

devices.forEach(dev => {
  const li = document.createElement("li");
  if (dev.type == "screen") {
    li.innerHTML = `<b>${_("display")}</b>${dev.width}*${dev.height}`;
  } else {
li.innerHTML = `<b>${dev.id}</b>`;
  }
  container1.appendChild(li);
});

const d = await getDisks();
d.forEach(dsk => {
  if (dsk.type != "localStorage") {
    const li = document.createElement("li");
    // Замість <b> використовуємо <span style="font-weight:bold;">
    li.innerHTML = `<b>${dsk.name}</b>${dsk.type}`;
    container1.appendChild(li);
  }
});


    }

    if (name == "keyboard"){
        
    setTimeout(() => {
        // змінюємо картинку
        kbrdImg.src = "assets/" + keyboardLayoutSelect.value + "_kbrd.jpg";
        // fade in
        kbrdImg.style.opacity = 1;
    }, 250); // половина часу transition
    }else if (name == "display"){
        dispImg.classList = [];
// змінюємо картинку
if (screenTypeSelect.value == "lcd") {
    /*
            box-shadow: 
    inset 6px 6px 10px 0 rgba(0, 0, 0, 0.2),  
    inset -6px -6px 10px 0 rgba(255, 255, 255, 0.5);
  padding: 20px;
  background-color: #e0e0e0; 
  border-radius: 10px;
            */
    dispImg.style.boxShadow = 'inset 6px 6px 10px 0 rgba(0, 0, 0, 0.2),inset -6px -6px 10px 0 rgba(255, 255, 255, 0.5)';
} else if (screenTypeSelect.value == "crt") {
    dispImg.style.boxShadow = 'none';
    dispImg.classList = ["crt"];
} else {
    dispImg.style.boxShadow = 'none';
}
    }
}

tabs.forEach(tab => {
    tab.onclick = () => {
        showPage(tab.dataset.page);
    };
});

const keyboardLayoutSelect = document.getElementById("keyboardLayoutSelect");

// Ініціалізація: можна взяти з  якщо є
if(currentKeyboardLayout) {
    keyboardLayoutSelect.value = currentKeyboardLayout;
}


// Зміна набору клавіш
keyboardLayoutSelect.onchange = () => {
    

    currentKeyboardLayout = keyboardLayoutSelect.value;
    chShortcuts(keyboardLayoutSelect.value);
    localStorage.setItem("currentKeyboardLayout",keyboardLayoutSelect.value );

    // fade out
    kbrdImg.style.opacity = 0;
    setTimeout(() => {
        // змінюємо картинку
        kbrdImg.src = "assets/" + keyboardLayoutSelect.value + "_kbrd.jpg";
        // fade in
        kbrdImg.style.opacity = 1;
    }, 250); // половина часу transition
};





screenTypeSelect.onchange = () => {

    displayType = screenTypeSelect.value;
    

    // fade out
    setTimeout(() => {
        dispImg.classList = [];
        // змінюємо картинку
        if (screenTypeSelect.value == "lcd"){
            /*
            box-shadow: 
    inset 6px 6px 10px 0 rgba(0, 0, 0, 0.2),  
    inset -6px -6px 10px 0 rgba(255, 255, 255, 0.5);
  padding: 20px;
  background-color: #e0e0e0; 
  border-radius: 10px;
            */
            dispImg.style.boxShadow = 'inset 6px 6px 10px 0 rgba(0, 0, 0, 0.2),inset -6px -6px 10px 0 rgba(255, 255, 255, 0.5)';
        }else if (screenTypeSelect.value == "crt"){
            dispImg.style.boxShadow = 'none';
            dispImg.classList = ["crt"];
        }else{
            dispImg.style.boxShadow = 'none';
        }
        
    }, 250); // половина часу transition
}



/* ===== INIT ===== */
initLanguageSelect();
showPage("general");
updateTexts();
}
      ,height:215, width:200, minheight:200, minwidth:200 });
})

addIcon(("terminal_title"), icns.term, function(){
    new wm(_('terminal_title'),{x: "center",y: "center",
    icon: icns.term,
    class: ['no-full', wbtheme],
    html: `

<div style="width:100%; height:100%;  background:#000; color:#fff; display:flex; flex-direction:column; user-select:text !important;">
  <div id="tout" class="output" style="flex-grow:1; overflow-y:auto; padding:10px; white-space:pre-wrap; font-family:monospace !important;"></div>



  
  <input 
    style="font-family:monospace; background:#000; color:#fff; border:none; border-top:1px solid #999; padding:8px; width:100%; box-sizing:border-box; outline:none;" 
    type="text" 
    onchange="
      const out=document.getElementById('tout');
      const cmd=document.createElement('div');
      cmd.textContent='$> ' + this.value;
      out.appendChild(cmd);
      try {
        const r=eval(this.value);
        if (r !== undefined) {
          const res=document.createElement('div');
          res.textContent=(typeof r==='object' ? JSON.stringify(r, null, 2) : r);
          out.appendChild(res);
        }
      } catch(e) {
        const err=document.createElement('div');
        err.style.color='#f00';
        err.textContent='Error: ' + e.message;
        out.appendChild(err);
      }
      this.value='';
      out.scrollTop=out.scrollHeight;
      
      
    " 
    id="input"
    autofocus 
  />
</div>
    `,
    oncreate: function () {
        const out=document.getElementById('tout');
const nativeDir = console.dir;
window.console = {
    dir: (obj) => {
        const keys = Object.getOwnPropertyNames(obj);

    for (const key of keys) {
        const value = obj[key];
        const type = typeof value;

        console.log(`${key} : ${type}`);
    }
    },
    log: (str,msg) => {
        const msg1=document.createElement('div');
        msg1.style.color='#fff';
        msg1.textContent = ansiToHtml(str + (msg ? " " + msg : ""))
        out.appendChild(msg1);
       msg1.scrollIntoView({ behavior: 'smooth' });
    },
    
warn: (str, msg) => {
    const warnMsg = document.createElement('div');
    warnMsg.style.color = '#f90';
    // Виправлено: дужки навколо тернарного оператора
    warnMsg.textContent = str + (msg ? " " + msg : "");
    out.appendChild(warnMsg); 
    warnMsg.scrollIntoView({ behavior: 'smooth' });
},

error: (e, msg) => {
    const err = document.createElement('div');
    err.style.color = '#f00';
    // Виправлено: дужки навколо тернарного оператора
    err.textContent = e + (msg ? " " + msg : "");
    out.appendChild(err);
    err.scrollIntoView({ behavior: 'smooth' });
},
table: (data) => {
    if (!data || typeof data !== 'object') {
        window.console.log(data);
        return;
    }

    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.margin = '10px 0';
    table.style.color = '#fff';
    table.style.border = '1px solid #444';
    table.style.fontFamily = 'monospace';

    // Отримуємо заголовки (ключі об'єктів)
    const isArray = Array.isArray(data);
    const sample = isArray ? data[0] : data[Object.keys(data)[0]];
    const headers = ['(index)', ...Object.keys(sample || {})];

    // Створюємо заголовок таблиці (thead)
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    headers.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.style.border = '1px solid #444';
        th.style.padding = '8px';
        th.style.backgroundColor = '#222';
        headerRow.appendChild(th);
    });

    // Створюємо тіло таблиці (tbody)
    const tbody = table.createTBody();
    const rows = isArray ? data : Object.entries(data);

    for (const [key, val] of Object.entries(data)) {
        const row = tbody.insertRow();
        const indexCell = row.insertCell();
        indexCell.textContent = key;
        indexCell.style.border = '1px solid #444';
        indexCell.style.padding = '4px 8px';
        indexCell.style.fontWeight = 'bold';

        // Додаємо значення для кожного стовпця
        headers.slice(1).forEach(header => {
            const cell = row.insertCell();
            const cellValue = (val && typeof val === 'object') ? val[header] : val;
            cell.textContent = cellValue !== undefined ? cellValue : '';
            cell.style.border = '1px solid #444';
            cell.style.padding = '4px 8px';
        });
    }

    out.appendChild(table);
    table.scrollIntoView({ behavior: 'smooth' });
}
}
function ansiToHtml(str){
  const colors = {
    30:"#000",
    31:"#f55",
    32:"#5f5",
    33:"#ff5",
    34:"#59f",
    35:"#f5f",
    36:"#5ff",
    37:"#fff"
  };

  let result="";
  let color=null;
  let parts;
try{
   parts=str.split(/\x1b\[(\d+)m/);


  for(let i=0;i<parts.length;i++){
    if(i%2===1){
      const code=parts[i];
      if(code==="0") color=null;
      else color=colors[code] || color;
    } else {
      if(color){
        result+=`<span style="color:${color}">${parts[i]}</span>`;
      } else {
        result+=parts[i];
      }
    }
  }
} catch {}

  return result;
}


let history = [];
let historyIndex = -1;
const input=document.getElementById('input')
input.onkeydown = (e) => {
    if (e.key === "ArrowUp") {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            input.value = history[history.length - 1 - historyIndex];
        }
    } else if (e.key === "ArrowDown") {
        if (historyIndex > 0) {
            historyIndex--;
            input.value = history[history.length - 1 - historyIndex];
        } else {
            historyIndex = -1;
            input.value = "";
        }
    }
};

    },
    onclose: function (){
        redefineAdaptations()
        
    },
    minheight: 200,
    minwidth: 250,
    width: 250,
    height: 300,
});
})

addIcon(("web_browser_title"), icns.web, function(){
    new wm(_('web_browser_title'),{x: "center",y: "center",icon: icns.web,class: ['no-full', wbtheme],url: 'apps/web.html',height:400,width:600,minheight: 200,minwidth:400});
})

addIcon(("task_mgr_title"), icns.tasks, function(){
    new wm(_('task_mgr_title'),{x: "center",y: "center",icon: icns.tasks,class: ['no-full', wbtheme],url: 'apps/resmon.html',height:600,width:800,minheight: 200,minwidth:400});
})

async function node(fileName) {
    let file;
    if (typeof fileName == "string"){
     file = fs.find(f => f.name === fileName);
    if (!file) console.error( `node: can't open file '${fileName}'`);
}else if (typeof fileName == "File"){file = fileName}
    // 1. Отримуємо текст коду (важливо для об'єктів File)
    let rawCode = "";
    if (file.content) {
        rawCode = file.content;
    } else if (typeof file.text === 'function') {
        rawCode = await file.text(); // Зчитуємо текст з об'єкта File
    }
    // Додайте це всередину вашого node()
const wsModule = {
  Server: class {
    constructor() {
      this.onconnection = null;
      window.addEventListener("node-ws", e => {
        // Імітуємо об'єкт клієнта
        const client = {
          send: (data) => window.dispatchEvent(new CustomEvent("ui-ws", { detail: data })),
          on: (event, cb) => { if(event === 'message') this.onmessage = cb; }
        };
        this.onconnection?.(client);
        this.onmessage?.(e.detail);
      });
    }
    on(event, cb) { if (event === "connection") this.onconnection = cb; }
  }
};

const pathModule = {
    join: (...args) => args.join('/').replace(/\/+/g, '/'),
    basename: (path) => path.split('/').pop(),
    extname: (path) => path.includes('.') ? '.' + path.split('.').pop() : ''
};
class EventEmitter {
    constructor() { this.events = {}; }
    on(event, cb) { (this.events[event] = this.events[event] || []).push(cb); }
    emit(event, data) { (this.events[event] || []).forEach(cb => cb(data)); }
}

    const virtualFS = {
    readFileSync: (path) => {
        const file = fs.find(f => f.fullPath === path || f.name === path);
        if (!file) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
        return file.content;
    },
    writeFileSync: (path, data) => {
        const existingFile = fs.find(f => f.name === path);
        if (existingFile) {
            existingFile.content = data;
            saveFileToDB(existingFile); // Ваша функція збереження в IndexedDB
        } else {
            // Логіка створення нового файлу, якщо шлях не знайдено
            const newFile = new File([data], path,{type: "text/plain"} )
                
                  fs.push(newFile);
            saveFileToDB(newFile);
            
          
        }
        return true;
    },
    readdirSync: (path) => {
        // Повертає список файлів у папці
        return fs.filter(f => f.name.startsWith(path))
                 .map(f => f.name);
    },
    existsSync: (path) => {
        return !!fs.find(f => f.name === path);
    }
};

    
    const require = (name) => {
    // 1. Мапінг системних модулів
    if (name === "fs") return virtualFS;
    if (name === "path") return pathModule;
    if (name === "events") return { EventEmitter };
    if (name === "ws") return wsModule;

    // 2. Нормалізація шляху (для ./tl -> tl)
    const cleanName = name.replace('./', '').split('/').pop().replace('.js', '');
    const modulePath = `system/node_modules/${cleanName}.js`;
    
    const moduleFile = fs.find(f => f.name === modulePath);
    if (!moduleFile) throw new Error(`Cannot find module '${name}' at ${modulePath}`);

    const mContent = moduleFile.content || "";
    
    // Створюємо контекст
    const module = { exports: {} };
    
    try {
        // Виконуємо код модуля. 
        // Оскільки ми зберігаємо його як "return (function...)", 
        // результат виконання цієї Function буде самою функцією модуля.
        const exported = new Function('require', 'module', 'exports', mContent)(require, module, module.exports);
        
        // Якщо функція повернула значення (як у нашому випадку з return) — використовуємо його.
        // Якщо ні — використовуємо module.exports.
        return exported || module.exports;
    } catch (e) {
        console.error(`Require error in ${name}:`, e);
        return {};
    }}


    try {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        // Передаємо підготовлений rawCode
        try {
    new Function(rawCode); // Спроба просто скомпілювати код
} catch (e) {
    console.error( `node: Syntax Error: ${e.message}`);
}

        const script = new AsyncFunction('require', 'process', 'console', rawCode);
        
        const process = {
            env: { NODE_ENV: 'production' },
            version: devProps.os.version
        };

        await script(require, process, console);
        return `Process '${fileName}' finished.`;
    } catch (err) {
        console.error( `node: runtime error: \n${err.stack}`);
    }
}

async function gitClone(url, branch = "main") {
  // 1. Формуємо URL для завантаження
  let downloadUrl = url.includes("zipball") ? url : `${url}/zipball/${branch}`;
  const repoName = url.split("/").pop();

  try {
    console.log(`Cloning into ${repoName} (branch: ${branch})...`);
    let response = await fetch(downloadUrl);
    
    // 2. Якщо отримали 404 і ми намагалися завантажити "main", пробуємо "master"
    if (!response.ok && branch === "main") {
      console.warn(`Branch "${branch}" not found (404). Retrying with "master"...`);
      return await gitClone(url, "master"); // Рекурсивний виклик з іншою гілкою
    }

    // Якщо помилка якась інша або "master" теж видав 404 — викидаємо виключення
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    // 3. Отримуємо Blob та відправляємо на розпаковку
    const blob = await response.blob();
    const repoFile = new File([blob], repoName);

    await unzipFile(repoFile, repoName);
    return true; 
    
  } catch (error) {
    console.error('Clone failed:', error);
    // Прокидаємо помилку назовні для ШІ-клієнта
    throw error; 
  }
}



const installedpkg = new Set();

// зчитуємо вже встановлені пакети з fs
function npmUpdate() {
    installedpkg.clear();
    fs.forEach(f => {
        if (f.name.startsWith("system/node_modules/")) {
            const name = f.name.split("/").pop().replace(/\.js$/, "");
            console.log("Updated pkg: "+name);
            installedpkg.add(name);
        }
    });
}

// викликати один раз при старті системи або перед першим npmInstall


async function npmInstall(packageName) {
    if (installedpkg.has(packageName)) {
        console.log("Already installed: "+ packageName);
        return; // захист від рекурсії
    }

    installedpkg.add(packageName);

    try {
        const metaRes = await fetch(`https://unpkg.com/${packageName}/package.json?module`);
        const meta = await metaRes.json();

        const mainFile = meta.main || "index.js";
        let response, code;
        try{
         response = await fetch(`https://unpkg.com/${packageName}/${mainFile}`);
         code = await response.text();
        }catch{
        const url = `https://unpkg.com/${packageName}/${mainFile}`
        const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
            response = await fetch(proxyUrl);
code = await response.text();
        }

        if (code.includes('export default') || code.includes('export {')) {
            code = `
                const exports = {};
                const module = { exports };
                (function() {
                    ${code.replace(/export default /g, 'module.exports = ')
                          .replace(/export \{/g, '/* export ignored */ {')}
                })();
                return module.exports;
            `;
        }

        const path = "system/node_modules/"+packageName+".js";
        const fl = new File([code], path, { type: "text/javascript" });
        fl.content = code;

        const existingIdx = fs.findIndex(f => f.name === path);
        if (existingIdx > -1) fs[existingIdx] = fl; else fs.push(fl);

        saveFileToDB(fl);

        console.log("Installed: "+ packageName);

        // Залежності
        if (meta.dependencies) {
            const depNames = Object.keys(meta.dependencies);
            for (const dep of depNames) {
                await npmInstall(dep); // рекурсія, але з перевіркою
            }
        }
    } catch (err) {
        console.error(err.message);
    }

    console.log("Completed: "+ packageName);
}

function purgeDir(dir){
    const p = dir.endsWith("/") ? dir : dir + "/";
    const rem = fs.filter(file => file.name.startsWith(p))
console.log("To be removed:" + rem.length)

    rem.forEach(f => {
		console.log("Deleting: "+f.name)
        const i = fs.indexOf(f);
        if (i > -1){
            fs.splice(i,1)
            deleteFile(f.name, null, null);
             idbWrapper.deleteFile(f.name); 
			console.log("Deleted: "+f.name)
        }
    })
    
}


function updateTime() {
    const timeElementsCollection = document.getElementsByClassName("clock-time");
    const dateElementsCollection = document.getElementsByClassName("clock-date");
    
    if (timeElementsCollection.length === 0 && dateElementsCollection.length === 0) {
        return;
    }
    
    // Форматуємо час і дату, щоб вони були уніфікованими
    const now = new Date();
    const currentTime = now.toLocaleTimeString(dateLang, { hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const currentDate = now.toLocaleDateString(dateLang, { weekday: "short",
    month: "long",
    day: "numeric"});
    
    Array.from(timeElementsCollection).forEach((t) => {
        t.textContent = currentTime;
        t.title = currentDate;
    });

    Array.from(dateElementsCollection).forEach((d) => {
        d.textContent = currentDate;
    });
}





window.onerror = function(message, source, lineno, colno) {
console.error(message, source, lineno, colno)
}


document.addEventListener("click", () =>{
document.querySelectorAll(".menu").forEach(function(item){
item.style.display="none";
})
if (event.target.id != "menubtn" && document.querySelector("#sysmenu")){
    
document.querySelector("#sysmenu").style.display = "none";}
})
document.querySelectorAll("li").forEach(listItem => {
    
    // 2. Додаємо новий обробник події 'click'
    listItem.addEventListener("click", (e) => {
        
        // 3. Логіка закриття всіх меню
        document.querySelectorAll(".menu").forEach(function(menuItem) {
            menuItem.style.display = "none";
        });
    });
});

document.getElementById("desktopApps").addEventListener("contextmenu", (e)=>{
e.preventDefault();

document.querySelectorAll(".menu").forEach(function(item){
item.style.display="none";
})

document.getElementById("deskM").querySelectorAll("li > p").forEach(function(item) {item.innerText = _(item.innerText);})
document.getElementById("deskM").style.display = "block";
document.getElementById("deskM").style.left = e.clientX+"px";
document.getElementById("deskM").style.top = e.clientY+"px";
});


function drawEditContextMenu(e, l = 0, t = 0, doc = document) {
    const editableTarget = e.target.closest('[contenteditable="true"]') || 
                           (['TEXTAREA', 'INPUT'].includes(e.target.tagName) ? e.target : null);
    
    // Перевірка на user-select: none
    const selectableTarget = window.getComputedStyle(e.target).userSelect !== 'none' ? e.target : null;

    if (l == 0) l = e.clientX;
    if (t == 0) t = e.clientY;

    if (editableTarget || selectableTarget) {
        e.preventDefault();

        document.querySelectorAll(".menu").forEach(item => item.style.display = "none");
        const menu = document.getElementById("textM");
        menu.style.display = "block";
        menu.style.left = l + "px";
        menu.style.top = t + "px";

        // Визначаємо набір команд правильно (пріоритет редагуванню)
        let commands = {};
        if (editableTarget) {
            commands = {
                't_undo': 'undo', 't_redo': 'redo', 't_cut': 'cut',
                't_copy': 'copy', 't_paste': 'paste', 't_del': 'delete', 't_all': 'selectAll'
            };
            document.getElementById("t_").style.display = "block";
        } else {
            commands = {
                't_copy': 'copy',
                't_all': 'selectAll'
            };
            document.getElementById("t_").style.display = "none";
        }

        menu.querySelectorAll('li').forEach(li => {
            const command = commands[li.id];
            // Скидаємо попередні налаштування (важливо для повторного використання меню)
            li.style.display = command ? "block" : "none"; 
            li.onmousedown = null;
            li.onclick = null;

            if (command) {
                li.onmousedown = (event) => event.preventDefault(); 

                li.onclick = (event) => {
                    event.stopPropagation();
                    
                    // БЕЗПЕЧНИЙ ФОКУС
                    if (editableTarget && typeof editableTarget.focus === 'function') {
                        editableTarget.focus();
                    }
                    
                    try {
                        // Для терміналів іноді краще використовувати Clipboard API, 
                        // але execCommand має працювати, якщо є виділення.
                        doc.execCommand(command, false, null);
                    } catch (err) {
                        console.warn("ExecCommand error:", err);
                    }

                    menu.style.display = 'none';
                };
            }
        });
    }
}


document.body.addEventListener('contextmenu', (e) => {
drawEditContextMenu(e);
    });
    
function stackCascade() {
  const windows = document.querySelectorAll('.winbox');
  const offset = 30; // Зсув кожного наступного вікна
// TODO: Stacks of WinBox`es
}

// Запускаємо оновлення кожну секунду

setInterval(updateTime, 500);
window.addEventListener('message', function(event) {
    // 1. Фільтруємо джерело (забезпечення безпеки)
    if (event.data && event.data.source === 'IR_Scanner') {
        const command = event.data.command;
        const key = event.data.key;
        
        
        
        if (command === 'KeyPress') {
            // Тут ви можете виконати ЛОГІКУ ОС, пов'язану з ключем
            // Наприклад, запуск програми, якщо ключ - це F1
            if (key === 'F1') {
                // ... виконати функцію запуску програми 1
                 
            } else if (key === 'Enter') {
                // ... виконати дію Enter
                 console.log("OS: Виконано дію Enter (OK)");
            }
            // ... інша логіка обробки
        }
    }
});


// Виклик після user gesture або при ініціалізації

async function updateBattery() {
    try {
        const battery = await navigator.getBattery();
        const batContainer = document.getElementById("batt");
        
        const updateInfo = () => {
            // Переводимо рівень у відсотки
            const level = Math.round(battery.level * 100);
            
            if (batContainer) {
if (level <= 20){
batContainer.innerText = "🪫";
if (!battery.charging){
new Notification(_("low_batt_title"), {body:_("low_batt_body")})
}
}else{
batContainer.innerText = "🔋";
}

                batContainer.title = `${level}%`;
            }
        };

        // Оновлюємо відразу
        updateInfo();

        // Додаємо слухачі подій, щоб не використовувати setInterval
        battery.addEventListener('levelchange', updateInfo);
        battery.addEventListener('chargingchange', updateInfo);
    } catch (e) {
        
    }
}


setInterval(async () => {
    const vol1 = getMasterVolume() * 100;
    const volContainer = document.getElementById("vol");
    if (volContainer) {
        volContainer.title = Math.round(vol1) + "%";
        if (vol1 == 0) volContainer.innerText = "🔈";
        else if (vol1 > 50) volContainer.innerText = "🔊";
        else volContainer.innerText = "🔉"; // Оптимізовано checks
    }
}, 500);

document.body.addEventListener('keydown', async function(event) {
let volDN = "AudioVolumeDown"
let volUP = "AudioVolumeUp"
    // Регулювання гучності для Mac-розкладки
    if (currentKeyboardLayout == "mac") {
    volDN = 'F11';
    volUP = 'F10';
    }
        let volPercent = Math.round(getMasterVolume() * 100); 

if (event.key === volUP) {
  event.preventDefault()
    volPercent = Math.min(volPercent + 5, 100); // 90 + 5 = 95 (точно!)
} else if (event.key === volDN) {
  event.preventDefault()
    volPercent = Math.max(volPercent - 5, 0);
}

vol = volPercent / 100; // Перетворюємо в 0.95 тільки для аудіо-контексту
    

    // Закриття активного вікна Infinity OS через Alt + F4
    if (event.altKey && event.key === 'F4') {
        event.preventDefault();
        const activeWindow = document.querySelector('.winbox.focus');
        if (activeWindow && activeWindow.winbox) {
            activeWindow.winbox.close();
        }
    }

    // Блокування шкідливих для браузерної ОС дефолтних комбінацій (Схоронність, Друк тощо)
    if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        const isAllowed = ['s', 'p', 'f'].includes(key);

        if (isAllowed) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
});



//indexedDB.deleteDatabase(DB_NAME);
//localStorage.clear();



