setInterval(updateTime, 500);

let currentStrings = {};
let currentLang = 'en';
let dateLang = "en-US";
let localeFormat = JSON.parse(localStorage.getItem("localeFormat")) || { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
let currentKeyboardLayout = "mac";
let displayType = "oled";
let notificationAPI;
let apps = [];
let icons = [];
let hiddenApps = [];
let allowTelemetry = JSON.parse(localStorage.getItem("allowTelemetry") )|| false;
let bgClock = JSON.parse(localStorage.getItem('backgroundClock')) ?? true;
let styles;
let wbtheme; // Class name
const devices = [];
const screens = [];
window.systemWorkers = []; // Реєстр для resmon

let filesSettings = JSON.parse(localStorage.getItem("config/files")) || { "filesCols": [], "showHidden": true };
let filesCols = filesSettings.filesCols || [];
let filesShowHidden = filesSettings.showHidden || false;

const OriginalWorker = window.Worker;
window.Worker = function(scriptURL, options) {
    const worker = new OriginalWorker(scriptURL, options);
    const workerId = 'worker_' + Math.random().toString(36).substr(2, 9);

    window.systemWorkers.push({ id: workerId, url: scriptURL, instance: worker });

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

    localStorage.setItem("fonts", JSON.stringify(fonts));

    console.log(`Fonts updated:`, fonts);
  }catch (e){
    console.error(e.message)
  }
    

    
    setupFonts(); 
};

function applySystemConfig(iframeElement0) {
  const windowContainer = document.getElementById(iframeElement0);
  if (!windowContainer) return console.warn(`Елемент з ID ${iframeElement0} не знадено.`);
const themeColors = styles; 

  const iframeElement = windowContainer.querySelector("iframe");
  if (!iframeElement) return console.warn("Всередині контейнера немає тегу <iframe>.");

  const generateCssContent = () => {
    const activeFont = localStorage.getItem("fonts") 
      ? JSON.parse(localStorage.getItem("fonts")).active 
      : "sans-serif";


    let cssVariables = '';
    if (themeColors){
    for (const [key, value] of Object.entries(themeColors)) {
      if (value !== undefined && value !== null) {
        cssVariables += `  ${key}: ${value};\n`;
      }
    }
  }

    let stylesText = `
      :root {
        --font: "${activeFont}", sans-serif;
      ${cssVariables}
      }
      *:not([class^="preview-container-"]):not([class^="preview-container-"] *):not([class^="output"]):not([class^="output"] *):not([contenteditable="true"]):not([contenteditable="true"] *) {
          font-family: var(--font);
      }
    `;
    

    if (window.currentFontBlobUrl) {
      stylesText = `
        @font-face {
          font-family: "${activeFont}";
          src: url("${window.currentFontBlobUrl}") format("truetype");
        }
      ` + stylesText;
    }
    return stylesText;
  };

  try {
    try {
      const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow.document;
      if (iframeDoc) {
        let styleTag = iframeDoc.getElementById("infinity-os-injector");
        if (!styleTag) {
          styleTag = iframeDoc.createElement("style");
          styleTag.id = "infinity-os-injector";
          iframeDoc.head.appendChild(styleTag);
        }
        styleTag.textContent = generateCssContent();
      }
    } catch (e) {
      console.error("Не вдалося достукатися до iframe додатка через CORS або ізоляцію:", e);
    }
  } catch {}

  iframeElement.addEventListener("load", () => {
    try {
      const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow.document;
      if (iframeDoc) {
        let styleTag = iframeDoc.getElementById("infinity-os-font-injector");
        if (!styleTag) {
          styleTag = iframeDoc.createElement("style");
          styleTag.id = "infinity-os-font-injector";
          iframeDoc.head.appendChild(styleTag);
        }
        styleTag.textContent = generateCssContent();
      }
    } catch (e) {
      console.error("Не вдалося достукатися до iframe додатка через CORS або ізоляцію:", e.message);
    }
  });
}

let wm = WinBox;


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

        const workerEntry = window.systemWorkers.find(w => w.id === id);
        
        if (workerEntry && workerEntry.instance) {

            workerEntry.instance.terminate();
            console.log(`[Infinity OS] Worker ${id} killed.`);
        } else {
            console.error(`[Infinity OS] Worker with ID ${id} not found.`);
        }
    }
}

function getScreenDiagonalInches() {

    const widthPx = window.screen.width * window.devicePixelRatio;
    const heightPx = window.screen.height * window.devicePixelRatio;


    const dpi = 96 * window.devicePixelRatio;

    const widthInches = widthPx / dpi;
    const heightInches = heightPx / dpi;

    const diagonalInches = Math.sqrt(widthInches ** 2 + heightInches ** 2);
    
    return diagonalInches-3.3;
}



 
async function buildDevProps() {

  const baseArch = navigator.platform.includes("64") || navigator.userAgent.includes("x86_64") || navigator.userAgent.includes("Win64") ? "x64" : "x86";
  const defaultChipStr = `${baseArch} (${navigator.hardwareConcurrency || 0} Cores)`;

  const devProps = {
    model: _("unknown"),
    inchRes: getScreenDiagonalInches().toFixed(1) + "-inch",
    relYear: _("unknown"),
    chip: defaultChipStr, // Clean placeholder format
    memory: navigator.deviceMemory ? navigator.deviceMemory + " GB" : "Unknown",
    os: {
      name: "Infinity OS",
      version: "10062026" // Hot release!
    },
    deviceIcon: navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches ? "assets/laptop.svg" : "assets/pc.svg"
  };

  const scr = screen;
  scr.type = "screen";
  devices.push(scr);

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


      const arch = ua.architecture ? ua.architecture : "x86";
      const bitness = ua.bitness ? `${ua.bitness}-bit` : "";
      const cores = navigator.hardwareConcurrency ? `(${navigator.hardwareConcurrency} Cores)` : "";
      
      devProps.chip = `${arch} ${bitness} ${cores}`.replace(/\s+/g, ' ').trim() || defaultChipStr;

      if (ua.platformVersion) {
        devProps.relYear = "Platform v" + ua.platformVersion;
      }

    } catch (e) {
      console.warn("UA entropy blocked:", e);
    }
  } else {

    devProps.model = navigator.userAgent;
  }

  devProps.cores = navigator.hardwareConcurrency || _("unknown");

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

    if (debugInfo) {
      devProps.gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).replaceAll("(", "").replaceAll(")", "").trim();
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

    files: "icons/files.svg",
    toolpointer: "icons/tool-pointer.svg",
    clock: "icons/clock.svg",
    calc: "icons/calc.svg",
    settings: "icons/settings.svg",
    term: "icons/terminal.svg",
    web: "icons/web.svg",
    tasks: "icons/tasks.svg",
    store: "icons/store.svg",

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

    dialogInfo: 'icons/dialog-info.svg',
    dialogQues: 'icons/dialog-ques.svg',
    dialogErr: 'icons/dialog-err.svg',
    dialogWarn: 'icons/dialog-warn.svg',

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
  driveIn: new Audio("sounds/in.ogg"),
  driveOut: new Audio("sounds/out.ogg"),
  notify: new Audio(""),
  logout: new Audio(""),
  
  async play(aud) {
    let audio;
    let objectUrl = null;

    if (aud instanceof Blob) {
      objectUrl = URL.createObjectURL(aud);
      audio = new Audio(objectUrl);
    } 

    else if (typeof aud === "string" && aud.startsWith("data:audio")) {
      audio = new Audio(aud); // Браузер чудово вміє грати "data:audio/wav;base64,..." напряму!
    } 

    else if (typeof aud === "string") {
      if (!this[aud]) {
        console.error(`Sound "${aud}" not found.`);
        return;
      }
      audio = this[aud];
    } else {
      return; // Якщо передано щось невідоме
    }

    audio.volume = typeof vol !== "undefined" ? vol : 1;

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

    try {
        if (typeof dbInstances !== 'undefined' && typeof DB_NAME !== 'undefined' && DB_NAME) {
            const driveName = DB_NAME;

            if (dbInstances[driveName] && typeof dbInstances[driveName].close === "function") {
                await dbInstances[driveName].close();
            }

            console.log("UnMounted:" + driveName);
            delete dbInstances[driveName];

            if (typeof DB_NAME !== 'undefined') DB_NAME = "";
            if (typeof LAST_DB !== 'undefined') LAST_DB = "";
        }
    } catch (e) {
        console.warn("Unmount error:", e);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    if (restart) {
        console.log("Restarting system...");
        location.reload();
    } else {
        console.log("Shutting down...");

        window.close();

        document.body.innerHTML = "<div style='background:#000;color:#fff;height:100vh;display:flex;align-items:center;justify-content:center;font-family:monospace;'>It is now safe to close your browser.</div>";
    }
}





const updateDevices = (e, isConnecting) => {
    let dev;

    if (e.gamepad){
    const { gamepad } = e;
    dev = gamepad;
    if (isConnecting) {

                dev.type = "gamepad";
        devices.push(dev);
sounds.play("driveIn")
    } else {

        const index = devices.findIndex(d => d.index === gamepad.index);
        if (index !== -1) {
            sounds.play("driveOut")
            devices.splice(index, 1);
        }
    }
    }else{

    }
    new Notification(isConnecting ? _("device_connected"):_("device_disconnected"), {body: dev.type || "" , silent: true})
};

window.addEventListener("gamepadconnected", (e) => updateDevices(e, true));
window.addEventListener("gamepaddisconnected", (e) => updateDevices(e, false));


class ThemeParser {
    constructor() {
        this.colors = {};
    }

    winColorToCSS(winColor) {
        if (!winColor) return null;
        const parts = winColor.trim().split(/\s+/);
        if (parts.length === 3) {
            return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
        }
        return winColor;
    }

    parse(fileContent) {

    const lines = fileContent.split(/\r?\n/);
    let currentSection = "";
    const data = {};

    lines.forEach(line => {
        line = line.trim();

        if (!line || line.startsWith(';') || line.startsWith('#')) return;

        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.toLowerCase(); // Залишаємо дужки для сумісності з вашим mapToInfinityVariables
            data[currentSection] = {};
        } 

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

    const raw = hex.replace('0x', '');
    
    const a = parseInt(raw.substring(0, 2), 16); // 45 -> 69
    const r = parseInt(raw.substring(2, 4), 16); // 40 -> 64
    const g = parseInt(raw.substring(4, 6), 16); // 9e -> 158
    const b = parseInt(raw.substring(6, 8), 16); // fe -> 254

    const alpha = (a / 255).toFixed(2);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
mapToInfinityVariables(data) {
    const cpColors = data['[control panel\\colors]'] || {};
    const vs = data['[visualstyles]'] || {};

    const activeTitle = this.winColorToCSS(cpColors['ActiveTitle']) || '#0054e3';
    const gradActiveTitle = this.winColorToCSS(cpColors['GradientActiveTitle']) || activeTitle;
    const inactiveTitle = this.winColorToCSS(cpColors['InactiveTitle']) || '#76a1e8';
    const gradInactiveTitle = this.winColorToCSS(cpColors['GradientInactiveTitle']) || inactiveTitle;

    const colorization = vs['ColorizationColor'] || "";
    let md = 10; // Default radius
    let winActive, winInactive;

    if (colorization) {

        const cssAccent = this.parseColorization(colorization);
        winActive = cssAccent;


        winInactive = cssAccent.replace(/[\d.]+\)$/g, '0.4)'); 
        
        md = 10; 
    } else {

        winActive = `linear-gradient(90deg, ${activeTitle} 0%, ${gradActiveTitle} 100%)`;
        winInactive = `linear-gradient(90deg, ${inactiveTitle} 0%, ${gradInactiveTitle} 100%)`;
        md = 0; // Classic themes usually have sharp corners
    }

const infoWindow = this.winColorToCSS(cpColors['InfoWindow']);
const infoText = this.winColorToCSS(cpColors['InfoText']);

    const windowBg = this.winColorToCSS(cpColors['Window']) || '#ffffff';
    const windowText = this.winColorToCSS(cpColors['WindowText']) || '#000';

    const highlight = this.winColorToCSS(cpColors['Highlight']) || '#326ba8';
    const buttonFace = this.winColorToCSS(cpColors['ButtonFace']) || '#f0f0f0';


    document.body.style.backgroundColor = this.winColorToCSS(cpColors['Background']) || '#000';



    const colors =  {

        '--color-win-act': winActive,
        '--color-win-ina': winInactive,

        '--accent-color': colorization ? this.parseColorization(colorization) : highlight,
        '--color-selection': highlight,

        '--bg-color': windowBg,
        '--bg-panel': colorization ? this.parseColorization(colorization) : windowBg,
        '--bg-body': windowBg,
        '--bg-menu': colorization ? this.parseColorization(colorization) : windowBg,

        '--toolbar-bg': buttonFace,
'--button-bg': buttonFace,
    '--button-text': this.winColorToCSS(cpColors['ButtonText']) || '#000',
    '--button-light': this.winColorToCSS(cpColors['ButtonLight']) || '#c0c0c0',
    '--button-hilight': this.winColorToCSS(cpColors['ButtonHilight']) || '#fff',
    '--button-shadow': this.winColorToCSS(cpColors['ButtonShadow']) || '#808080',
    '--button-dk-shadow': this.winColorToCSS(cpColors['ButtonDkShadow']) || '#000',

    '--button-act-bg': this.winColorToCSS(cpColors['ButtonLight']) || '#c0c0c0',
    '--button-border': this.winColorToCSS(cpColors['ButtonShadow']) || '#808080',
    '--button-act-border': this.winColorToCSS(cpColors['ButtonDkShadow']) || '#000',

        '--color-text-primary': windowText,

        '--input-bg': windowBg,
        '--color-input-bg': windowBg,

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

getName(data) {

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


function loadTheme() {
    const tmp = fs.find(f => f.name == theme);
    if (theme && tmp) {
        const reader = new FileReader();

reader.onload = function(e) {
        const text = reader.result;
 
        const parser = new ThemeParser();
        const result = parser.parse(text); 

        if (result && result.styles) {
            
            parser.applyTheme(result.styles);
            styles = result.styles;
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


    const allElements = [targetElement, ...targetElement.querySelectorAll("*:not(script):not(noscript):not(style)")];

    allElements.forEach(element => {


        Array.from(element.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "")
            .forEach(textNode => {



                if (typeof searchPattern === 'string') {

                    textNode.textContent = textNode.textContent.replaceAll(searchPattern, replacementString);
                } else if (searchPattern instanceof RegExp) {

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

    document.body.classList.toggle("taskbar-at-top", isTop);
}

if (config.size) document.documentElement.style.setProperty('--taskbar-height', config.size+"px");

    tbConfig = {...tbConfig, ...config};
    localStorage.setItem('taskbar-conf', JSON.stringify(tbConfig));	
}



const FILE_TYPES = {

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

    'jpg':  { mime: 'image/jpeg', icon: icns.imageGeneric },
    'jpeg': { mime: 'image/jpeg', icon: icns.imageGeneric },
    'png':  { mime: 'image/png', icon: icns.imageGeneric },
    'gif':  { mime: 'image/gif', icon: icns.imageGeneric },
    'svg':  { mime: 'image/svg+xml', icon: icns.imageGeneric },
    'webp': { mime: 'image/webp', icon: icns.imageGeneric },

    'mp3':  { mime: 'audio/mpeg', icon: icns.audioGeneric },
    'wav':  { mime: 'audio/wav', icon: icns.audioGeneric },
    'ogg':  { mime: 'audio/ogg', icon: icns.audioGeneric },
    'mp4':  { mime: 'video/mp4', icon: icns.videoMp4 },
    'webm': { mime: 'video/webm', icon: icns.videoMp4 },

    'pdf':  { mime: 'application/pdf', icon: icns.pdf },
    'ttf':  { mime: 'font/ttf', icon: icns.font },
    'zip':  { mime: 'application/zip', icon: icns.archive },
    'iso':  { mime: 'application/x-iso9660-image', icon: icns.cdImage },
    'img':  { mime: 'application/octet-stream', icon: icns.cdImage },
    'obj':  { mime: 'model/obj', icon: icns.empty },
    'theme':{ mime: 'application/x-theme', icon: icns.ms_theme }
};


let fonts;
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
function getWM(){return wm;}
function getWBtheme(){return wbtheme;}


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

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("delete_item_btn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (obj && obj.parentNode) {
            obj.style.transition = "all 0.2s ease-out";
            obj.style.opacity = "0";
            obj.style.transform = "scale(0.8)";
            setTimeout(() => {
                obj.remove();
                obj = null; // Очищаємо посилання
            }, 200);
        }
        document.getElementById("itemM").style.display = "none";
    });

    document.getElementById("copy_name").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (obj) {
            const nameElement = obj.querySelector('p');
            if (nameElement) {
                const textToCopy = nameElement.innerText.trim();
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    
                } catch (err) {
                    if (typeof prompt !== 'undefined') await prompt("Copy text manually:", textToCopy);
                }
            }
        }
        document.getElementById("itemM").style.display = "none";
    });
});


/**
 * Створює значок програми на робочому столі.
 * Додано підтримку Drag & Drop для перетягування на Dock.
 * @param {string} nameKey - Ключ перекладу для назви програми.
 * @param {string} iconUrl - URL значка.
 * @param {string} onclickLogic - Повний рядок JavaScript для onclick (для передачі в Dock).
 */
 let obj = null;
function addIcon(nameKey, iconUrl, onclickLogic, showApp = true) {  
    const desktopApps = document.getElementById("desktopApps") || document.body;

    const appContainer = document.createElement('div');
    appContainer.className = 'appIcon';

    appContainer.innerHTML = `
        <img src="${iconUrl}" style="width: 32px; height: 32px;" draggable="false">
        <p data-i18n="${nameKey}" style="margin: 0px; color: #fff; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);">${_(nameKey)}</p>
    `;

    appContainer.addEventListener("contextmenu", (e)=>{
        e.preventDefault(); e.stopPropagation(); obj = appContainer;
        document.querySelectorAll(".menu").forEach(i => i.style.display="none");
        document.getElementById("itemM").querySelectorAll("li > p").forEach(i => i.innerText = _(i.innerText));
        document.getElementById("itemM").style.display = "block";
        document.getElementById("itemM").style.left = e.clientX+"px";
        document.getElementById("itemM").style.top = e.clientY+"px";
    });

    appContainer.setAttribute('draggable', 'true');
    appContainer.setAttribute('title', _(nameKey)); // Надійно пишемо в атрибут DOM

    appContainer.onclick = onclickLogic;

    const logicStr = onclickLogic.toString();

    if (logicStr.match(/url:\s*["']([^"']+)["']/)) {
        const urlMatch = logicStr.match(/url:\s*["']([^"']+)["']/);
        
        if (urlMatch && urlMatch[1]) {
            const appUrl = urlMatch[1];

            const getVal = (key) => {
                const arrayMatch = logicStr.match(new RegExp(key + ':\\s*\\[([^\\]]+)\\]'));
                if (arrayMatch && arrayMatch[1]) {
                    return arrayMatch[1].split(',').map(s => s.replace(/["']/g, '').trim());
                }
                const m = logicStr.match(new RegExp(key + ':\\s*["\']?([^"\'\\s,}]+)["\']?'));
                return m ? m[1] : undefined;
            };

            const appData = {
                name: nameKey,
                icon: iconUrl,
                url: appUrl,
                w:    getVal("width"),
                h:    getVal("height"),
                miw: getVal("minwidth"),
                mih: getVal("minheight"),
                maw: getVal("maxwidth"),
                mah: getVal("maxheight"),
                class: getVal("class")
            };

            if (showApp) addApp(appData);
        }
    } else {
        const appData = { name: nameKey, icon: iconUrl };


    // Видаляємо "function() {", "() => {" або "async () => {" з початку рядка, а також зайві пробіли й переноси
    const bodyStart = logicStr
        .replace(/^(async\s+)?(function\s*\w*\s*\([^)]*\)\s*\{|\([^)]*\)\s*=>\s*\{?)/, '')
        .trim();

    if (showApp && (bodyStart.startsWith("new wm(") || bodyStart.startsWith("if (document.querySelector("))) {
        addApp(appData);
    }
    }
    icons.push({name:nameKey, icon:iconUrl, onclick: onclickLogic})

    desktopApps.appendChild(appContainer);
}

async function openApp(targ) {

    if (typeof targ === "string" || !targ.url) {
        
        if (icons) {
            const expectedName = typeof targ === "string" ? targ : _(targ.name);

            const physicalIcon = Array.from(icons).find(icon => 
                icon.name === expectedName
            );

           

            if (physicalIcon && physicalIcon.onclick) {
                const logicStr = physicalIcon.onclick.toString();

                const braceIndex = logicStr.indexOf('{');
                const arrowIndex = logicStr.indexOf('=>');
                const cutIndex = braceIndex !== -1 ? braceIndex + 1 : (arrowIndex !== -1 ? arrowIndex + 2 : 0);
                
                const bodyStart = logicStr.substring(cutIndex).trim();

                if (bodyStart.startsWith("new wm(") || 
                    bodyStart.startsWith("if (document.querySelector(") || 
                    bodyStart.includes("onclickLogic(event)")) { 
                    
                    
                    physicalIcon.onclick(); 
                    return true; 
                }
            }
        }
    }

    const beforeDB = DB_NAME;
    let app = typeof targ == "string" ? getApps().find(a => a.name == targ) : targ;

    if (!app) {
        console.error("App not found:", (typeof targ == "string" ? targ : targ.name));
        return; 
    }

    if (app.url.startsWith("apps/") && !folderExists("apps")) {
        new wm(_(app.name), {
            x: "center", y: "center",
            class: app.class.map(c => c === "wbtheme" ? wbtheme : c).join(" ") || wbtheme + " no-full",
            url: app.url,
            icon: app.icon,
            minwidth: app.miw, minheight: app.mih,
            width: app.w, height: app.h,
            maxwidth: app.maw, maxheight: app.mah,
            oncreate: function() {
                applySystemConfig(this.id);
            }
        });
    } else {
        try {
            if (DB_NAME != startupDisk) {
                DB_NAME = startupDisk;
                idbWrapper.db = null;
                await idbWrapper.openDB();
                await loadFsFromDB();
                console.log(beforeDB + " -> " + DB_NAME);
            }

            await Openf(null, null, getMimeType(app.url), app.url, startupDisk);
        } finally {
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



function addApp(app){
    if (!apps.find(a => a.url === app.url)) {
    apps.push(app);
    }
}

function folderExists(path) {

    const folderPath = path.endsWith('/') ? path : path + '/';
    
    return fs.some(file => file.name.startsWith(folderPath));
}



function openMenu(event) {
    const menu0 = document.getElementById("appmenu");

    document.querySelector("#sysmenu").style.display = document.querySelector("#sysmenu").style.display  === 'none' ? 'block' : 'none';

    menu0.innerHTML = "";

    const rect = sysmenu.getBoundingClientRect();


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

        ico.src = app.icon || "";

        
        const title = document.createElement("p");
        title.style.margin = "0";
        title.innerText = _(app.name);

            btn.onclick = () => {
            openApp(app)
            }

        
        btn.appendChild(ico);
        btn.appendChild(title);
        menu0.appendChild(btn);
        
    });  
}

function handleInspectScreen(targetSelector) {

    const rootElement = targetSelector 
        ? document.querySelector(targetSelector) 
        : (document.querySelector('.workspace') || document.body);

    if (!rootElement) {
        return JSON.stringify({ error: `Selector '${targetSelector}' not found.` });
    }

    const screenDump = [];

    function traverseDOM(element) {

        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) return;

        const style = window.getComputedStyle(element);

        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return;
        }

        let directText = "";
        for (let node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                directText += node.nodeValue.trim();
            }
        }

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

                value: (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') ? element.value : undefined
            });
        }

        for (let i = 0; i < element.children.length; i++) {
            traverseDOM(element.children[i]);
        }
    }

    traverseDOM(rootElement);

   
    
       return JSON.stringify(screenDump);
}




function getApps(){
    return apps;
    
}

let DB_NAME = 'Infinity_OS_FS';
if (localStorage.getItem("startup_disk")){
    DB_NAME = localStorage.getItem("startup_disk");
}else{
    localStorage.setItem("startup_disk", "Infinity_OS_FS")
}

const STORE_NAME = 'FileObjects';
let LAST_DB = "";
const startupDisk = localStorage.getItem("startup_disk");


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

            fs = [];
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {

                    db.createObjectStore(STORE_NAME, { keyPath: 'name' }); 
                }
            };

            request.onsuccess = (event) => {
console.log("LAST_DB - "+LAST_DB)
console.log("DB_NAME - "+DB_NAME)
                if (LAST_DB != event.target.result.name || DB_NAME == ""){
                    sounds.play("driveIn");
                }else{
                  console.warn("Ignore play")
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

            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

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

            const request = store.getAll(); 

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }
}

const idbWrapper = new IDBWrapper();

let fs = [];
let dbInstances = {}

/**
 * Перевіряє, чи закрита база даних IndexedDB за її ім'ям
 * @param {string} dbName - Назва бази даних (наприклад, твій DB_NAME)
 * @returns {boolean} true, якщо база закрита або не існує
 */
function isDbClosed(dbName) {
    const db = dbInstances[dbName];

    if (!db) return true; 

    try {


        db.transaction([STORE_NAME], 'readonly');
        
        return false; // Транзакція успішна -> база ВІДКРИТА
    } catch (error) {

        if (error.name === 'InvalidStateError' || error.message.includes('closed')) {
            return true; 
        }

        return false; 
    }
}


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

                content: e.target.result
            });
        };

        if (fileType.startsWith("text/")) {

            reader.readAsText(file);
        } else if (fileType.startsWith("image/") || fileType.startsWith("audio/") || fileType.startsWith("video/")) {

            reader.readAsDataURL(file);
        } else {

            
            reader.readAsDataURL(file);
            
        }
    });
}


/**
 * Зберігає або оновлює один файл у IndexedDB.
 * @param {File} file Об'єкт File, який потрібно зберегти.
 */
async function saveFileToDB(file) {
    
     if (!file instanceof Blob && !(file instanceof File)) return false;

    const fileObjectToSave = await serializeFile(file);

    try {

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

    
    try {

        const savedFileObjects = await idbWrapper.loadAllFiles(); 
        
        if (savedFileObjects && savedFileObjects.length > 0) {

            
            fs = savedFileObjects.map(item => {
                let blob;
                
                if (item.type.startsWith("text/")) {

                    blob = new Blob([item.content], { type: item.type});
                } else if (item.content.startsWith('data:')) {

                    blob = dataURLtoBlob(item.content); 
                } else {

                    blob = new Blob([], { type: item.type});
                }

                return new File([blob], item.name, { type: item.type, lastModified: item.lastModified });
            });
            
            
        } else {
            console.log("IndexedDB is empty or not yet created. Initializing empty FS.");

            const savedFs = localStorage.getItem('infinity_os_fs');
            if (savedFs) {
                 console.log("Found legacy FS in Local Storage. Attempting migration...");
                 const deserializedFs = JSON.parse(savedFs);

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

                 if (fs.length > 0) {
                     console.log("Migrating files to IndexedDB...");
                     for (const file of fs) {
                         await saveFileToDB(file);
                     }

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

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = _(key);
    });


}



function loadLanguage(lang = null, dlang = null) {
  try {

    if (!lang) lang = localStorage.getItem("locale");
    if (!dlang) dlang = localStorage.getItem("dlocale");

    if (!lang) lang = "en";
    if (!dlang) dlang = "en-US";

    if (!langs[lang]) {
      throw new Error(`Language "${lang}" not found in dictionary.`);
    }

    currentStrings = langs[lang];
    currentLang = lang;
    dateLang = dlang;

  } catch (error) {
    console.error("Error loading language, rolling back to English:", error);

    const fallbackLang = (lang !== "en" && langs["en"]) ? "en" : lang;
    
    currentStrings = langs[fallbackLang] || {};
    currentLang = fallbackLang;
    dateLang = (lang !== "en") ? "en-US" : dlang;
  }

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
      
      if (bgClock == true){
        document.getElementById("desktop-fore").style.display = "flex"
      }else{
        document.getElementById("desktop-fore").style.display = "none"
      }
        const backgroundFileName = localStorage.getItem('infinity_os_background_file');
        
        if (backgroundFileName) {


            const backgroundFile = typeof fs !== 'undefined' ? fs.find(item => item.name === backgroundFileName) : null;
            
            if (backgroundFile && backgroundFile instanceof File) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    const dataUrl = e.target.result;

                    document.body.style.backgroundImage = `url(${dataUrl})`; // Виправлено синтаксис
                    console.log(`Background loaded from Local Storage: ${backgroundFileName}`);
                    
                    resolve(); // <--- КРИТИЧНО: Завершення Promise після успіху
                };
                
                reader.onerror = function() {
                    console.error("Error reading background file via FileReader.");
                    
                    resolve(); // <--- КРИТИЧНО: Завершення Promise навіть при помилці
                };

                reader.readAsDataURL(backgroundFile);
            } else {

                localStorage.removeItem('infinity_os_background_file');
                console.log("Saved background file not found, cleared setting.");
                
                resolve(); // <--- КРИТИЧНО: Завершення Promise, якщо файл не знайдено
            }
        } else {

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

    try {
        const autoloadString = localStorage.getItem('infinity_os_autoload');

        if (autoloadString) {
            autoload = JSON.parse(autoloadString);
        }
    } catch (e) {
        console.error("Помилка парсингу даних автозавантаження (infinity_os_autoload):", e);
        autoload = [];
    }

    if (Array.isArray(autoload)) {
        autoload.forEach(itemName => {

            if (typeof fs === 'undefined') {
                console.error("Глобальний масив файлової системи 'fs' не знайдено.");
                return;
            }

            const autofile = fs.find(file => file.name === itemName);
            
            if (autofile) {
                const reader = new FileReader();

                try {

                    const cont = reader.readAsText(autofile)
                    reader.addEventListener("load", () =>{


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

    
    setTimeout(() => {

        document.getElementById('splash').classList.add("hidden"); 
    }, 500);

    try{
    sounds.play("startup")
    }catch{

    }
    updateBattery()
}



const prg = document.getElementById("loadprg");

function fail(msg) {
    notify.innerText = msg;
    throw new Error(msg); // жорстко зупиняємо запуск
}
function firstStart(){

    if (!localStorage.getItem("locale") || !localStorage.getItem("dlocale")){

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

    const currentStepData = oobe_steps[curr_oobe_step - 1];
    document.getElementById("oobe_step").innerText = curr_oobe_step + "/" + oobe_steps.length;
    document.getElementById("oobe_cont").innerHTML = currentStepData.lay;

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

  const f = getFs().find(f => f.name == active);
  if (!f) return document.body.style.fontFamily = `sans-serif`;

  const b = await f.arrayBuffer(); // Don't forget to await the buffer if it's a File/Blob
  const font = new FontFace(active, b);

const blob = new Blob([b], { type: "font/ttf" }); // або woff/otf
window.currentFontBlobUrl = URL.createObjectURL(blob);


  if (!fonts.installed.includes(active)) {
        fonts.installed.push(active);

        localStorage.setItem("fonts", JSON.stringify(fonts));
        console.log(`Infinity OS: "${active}" added to installed list.`);
    }
  
  try {
    const loadedFont = await font.load();
    document.fonts.add(loadedFont);

    document.body.style.fontFamily = `"${active}", sans-serif`;
    document.documentElement.style.setProperty("--font", document.body.style.fontFamily);
    
    console.log(`Infinity OS: Font "${active}" applied successfully.`);
  } catch (e) {
    console.error("Font loading failed:", e);
  }
}

function getMaxLS(pb, max = 5) {


    const APPROX_MAX_LS = 5120; 

    var data = "m";
    
    for (var i = 0; i < 40; i++) {
        try { 
            localStorage.setItem("DATA", data);
            data = data + data;

            let currentSize = Math.round(JSON.stringify(localStorage).length / 1024);
            console.log(currentSize);

            let progressRatio = Math.min(currentSize / APPROX_MAX_LS, 0.99); 


            if (pb) pb.value = Math.round(progressRatio * max);

        } catch(e) {

            if (pb) pb.value = max;
            
            let finalSize = (JSON.stringify(localStorage).length).toFixed(2);
            console.log("LIMIT REACHED: (" + i + ") " + finalSize);
            console.log(e);

            localStorage.removeItem("DATA");
            
            return finalSize;
        }
    }
    localStorage.removeItem("DATA");
}

const InfinityUsageTracker = (function() {

    const getTodayKey = () => new Date().toISOString().split('T')[0];

    let stats = JSON.parse(localStorage.getItem('.usageData') || '{}');

    const tick = () => {
      if (allowTelemetry !== true) return;

        const activeWindow = document.querySelector('.winbox.focus, .winbox.wb-focus');
        
        if (activeWindow) {

            const titleEl = activeWindow.querySelector('.wb-title');
            if (titleEl) {
                const winTitle = titleEl.textContent.trim();
                const today = getTodayKey();

                if (!stats[today]) stats[today] = {};
                if (!stats[today][winTitle]) stats[today][winTitle] = 0;

                stats[today][winTitle] += 1;
            }
        }else {
           const today = getTodayKey();

                if (!stats[today]) stats[today] = {};
                if (!stats[today][_("desktop")]) stats[today][_("desktop")] = 0;

                stats[today][_("desktop")] += 1;
        }
    };

    const save = () => {
        if (allowTelemetry == true) localStorage.setItem('.usageData', JSON.stringify(stats));
    };

    return {
        start: function() {

            setInterval(tick, 1000);

            setInterval(save, 10000);

            window.addEventListener('beforeunload', save);
        },

        getDailyStats: function(dateStr) {
            const date = dateStr || getTodayKey();
            return stats[date] || {};
        }
    };
})();

(async () => {
    try {
        prg.value = 0;

        maxLS = await getMaxLS(prg, 5);
        prg.value = 5;
        
        await loadFsFromDB();
        prg.value = 10;
        
        await firstStart();
        prg.value = 20;

        await setupFonts();
        prg.value = 25;
        
        await loadLanguage();
        prg.value = 30;

        devProps = await buildDevProps();
        prg.value = 35;

        await setTaskbarConfig(JSON.parse(localStorage.getItem('taskbar-conf')) || {})
        prg.value = 40;
        
        await loadTheme();
        prg.value = 45;

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

        if (allowTelemetry == true) await InfinityUsageTracker.start();
        prg.value = 95;
        
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

        if (!startNode && charCount + nodeLength > start) {
            startNode = node;
            startOffset = start - charCount;
        }

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

    let html = rtf.replace(/[\r\n]/g, "");

    const getMargin = (cmd) => {
        const match = html.match(new RegExp(`\\\\${cmd}(\\d+)`));
        return match ? Math.round(match[1] / 1440 * 96) + "px" : "20px";
    };

    html = html.replace(/\\u(\d+)\??/g, (_, code) => String.fromCharCode(code));

    const fonts = {};
    const fontTableMatch = html.match(/\{\\fonttbl(.*?)\}/s);
    if (fontTableMatch) {
        const fontEntries = [...fontTableMatch[1].matchAll(/\{\\f(\d+)[^;]*?\s+([^;{}]+);/g)];
        fontEntries.forEach(match => fonts[match[1]] = match[2].trim());
    }

    html = html.replace(/\{\\fonttbl.*?\}|\{\\colortbl.*?\}|\{\\stylesheet.*?\}|\{\\info.*?\}|\{\\\*\\generator.*?\}/gs, "");


    html = html.replace(/\\f(\d+)\s?/g, (_, id) => `</span><span style="font-family:${fonts[id] || 'Arial'}">`);
    html = html.replace(/\\fs(\d+)\s?/g, (_, size) => `</span><span style="font-size:${size / 2}pt">`);

    html = html
        .replace(/\\b\s+(.*?)\\b0/g, "<b>$1</b>").trim()
        .replace(/\\i\s+(.*?)\\i0/g, "<i>$1</i>").trim()
        .replace(/\\ul\s+(.*?)\\ul0/g, "<u>$1</u>").trim()
        .replace(/\\strike\s+(.*?)\\strike0/g, "<s>$1</s>").trim()
        .replace(/\\bullet\s+/g, "• ").trim()
        .replace(/\\par\s?/g, "<br>").trim(); // Додано опціональний пробіл після \par

    html = html.replace(/\\(qc|qr|qj)\s+(.*?)(?=\\par|\\ql|\\qc|\\qr|\\qj|$)/g, (match, cmd, text) => {
        const align = {qc:'center', qr:'right', qj:'justify'}[cmd];
        return `<div style="text-align:${align}">${text}</div>`;
    });


    html = html.replace(/\\[a-z0-9-]+(\s|(?=[\\{}]))/gi, "").trim();

    html = html.replace(/[{}]/g, "").trim();

    html = html.replace(/\s\s+/g, ' ').trim();

    return html.trim();
}

function htmlToRtf(html) {
    let content = html

        .replace(/<(b|strong)>(.*?)<\/\1>/gi, "\\b $2\\b0 ")
        .replace(/<(i|em)>(.*?)<\/\1>/gi, "\\i $2\\i0 ")
        .replace(/<u>(.*?)<\/u>/gi, "\\ul $1\\ul0 ")
        .replace(/<(s|strike|del)>(.*?)<\/\1>/gi, "\\strike $2\\strike0 ")
          .replace(/<div[^>]+style="text-align:\s*center;?"[^>]*>(.*?)<\/div>/gi, "\\qc $1\\ql ")
      .replace(/<div[^>]+style="text-align:\s*right;?"[^>]*>(.*?)<\/div>/gi, "\\qr $1\\ql ")
      .replace(/<div[^>]+style="text-align:\s*justify;?"[^>]*>(.*?)<\/div>/gi, "\\qj $1\\ql ")

      .replace(/<li>(.*?)<\/li>/gi, "\\bullet  $1\\par ")

        .replace(/<div style="text-align:\s*center;?">(.*?)<\/div>/gi, "\\qc $1\\ql ")
        .replace(/<div style="text-align:\s*right;?">(.*?)<\/div>/gi, "\\qr $1\\ql ")

        .replace(/<br\s*\/?>/gi, "\\par ")
        .replace(/<p>(.*?)<\/p>/gi, "\\par $1 ")
        .replace(/<div>(.*?)<\/div>/gi, "\\par $1 ")

        .replace(/<[^>]+>/g, "");

    const header = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs24 ";
    const body = content.split('').map(char => {
        const code = char.charCodeAt(0);
        return code > 127 ? `\\u${code}?` : char;
    }).join('');

    return header + body + "}";
}

/**
 * Відкриває файл у новому вікні WinBox.
 * * @param {Event | File | string} source - Об'єкт події DOM, об'єкт File, або ім'я файлу (рядок).
 * @param {function} refr - Функція оновлення (наприклад, updateQuotaInfo).
 * @param {string} [type=null] - Примусовий MIME-тип (наприклад, "text/plain").
 * @param {File} [file=null] - Об'єкт файлу, якщо 'source' є подією, але викликано з контекстного меню.
 */
function Openf(source, refr, type, file = null, disk = "idb") {

    let fileWinBox;
    let fileType = "unknown";
    let exfile = null; // Знайдений об'єкт File
    let filestr = null; // Назва файлу
    let listItem = null; // DOM-елемент, якщо знайдено (для іконки)
    let isEditable = false;
    const uniqueFileId = "content-" + Date.now();

    
    if (source && (source instanceof Event || source.currentTarget)) {

        const event = source;
        listItem = event.currentTarget;
        
        if (!type) {

            filestr = listItem.innerText.trim();
            
        } else {

            
            filestr = listItem.getAttribute("data-file");
            
        }
        
        exfile = fs.find(item => item.name === filestr);
        
        if (!exfile) {
            console.error("Файл не знайдено (через Event):"+filestr);
            return;
        }
        fileType = type || exfile.type; // Встановлюємо тип
        
    } else {

        
        const fileOrName = source || file; // Використовуємо 'source' або 'file'
        
        if (typeof fileOrName === 'string') {

            exfile = fs.find(item => item.name.trim() === fileOrName.trim());

            filestr = fileOrName;
        } else if (fileOrName instanceof File) {

            exfile = fileOrName;
            filestr = fileOrName.name;

        }
        
        if (!exfile) {
            console.error("Файл не знайдено (прямий виклик):" +fileOrName);
            return;
        }
        fileType = type || exfile.type;
    }

    if (!exfile) return;

    
    let ic;
    if (exfile) {
        ic = getIcon(exfile)
    }

    if (listItem) {
        const img = listItem.querySelector('img');
        if (img) iconSrc = img.src;
    }


let w = 255;
let h = 200;

let typeclass = fileType.split("/")[0] || fileType;
    fileWinBox = new wm(filestr, {
        icon: ic,x: "center",y: "center", // Використовуємо визначену іконку
        class: ["no-full", wbtheme, typeclass],
        minheight: 200, minwidth: 255, width: w, height: h, x: "center",y: "center",
        html: `<div style="padding: 10px; color: black; height: 100%; text-align: center;overflow: hidden;">${_('loading_text')}</div>`
    });








    const reader = new FileReader();

    reader.onload = async function(e) {
        const content = e.target.result;
        let newContent = '';

        
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

  const rows = content.split("\n").map(row => row.split(","));
  
  let tableHtml = `
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
  
  tableHtml += `</table>
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

        const result = await mammoth.convertToHtml({arrayBuffer: content}, options);
        initialHtml = result.value;
        
    } else {
        initialHtml = marked.parse(content);
    }

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

    setTimeout(() => {
        const el = document.getElementById(uniqueFileId);
        if (el) window.input(el.innerText);
    }, 10);
} else if (fileType.startsWith("text/") || !exfile.name.split("/").pop().substring(1).includes(".")) {
            
            if (fileType == "text/html"){
                const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
if (titleMatch )fileWinBox.setTitle( titleMatch[1].trim())
                
                const iconMatch = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
    if (iconMatch) fileWinBox.setIcon(iconMatch[1])

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


if (content.includes("new Notification(") ) {
    
    fileWinBox.onclose = (urgent) => {
        if (!urgent) {

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
            id="frame-${fileWinBox.id}"
            srcdoc="${redefiner.replace(/"/g, '&quot;')}${content.replace(/"/g, '&quot;')}" 
            style="width: 100%; height: 100%; border: none;"
            onload="parent.applySystemConfig('${fileWinBox.id}')">
        </iframe>
    </div>
`;


            } 
            else if (fileType == "text/javascript"){
                isEditable = false;
                newContent = eval(content);
                fileWinBox.close();
            } else {
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

const updateUI = () => {
        const audioPlayer = document.getElementById(uniqueFileId);

        if (!audioPlayer) return;
        audioPlayer.volume  =vol;

        const timeText = document.getElementById(`time-text-${uniqueFileId}`);
        const seekRange = document.getElementById(`seek-${uniqueFileId}`);
        const playStatus = document.getElementById(`play-status-${uniqueFileId}`);

        try {
            if (audioPlayer.canPlayType && !audioPlayer.canPlayType(fileType)) fileWinBox.close();
        } catch (e) {}
        
        if (isNaN(audioPlayer.duration)) return;

        if (timeText) {
            timeText.innerText = formatTime(audioPlayer.currentTime);
        }
        if (seekRange) {
            seekRange.value = ((audioPlayer.currentTime / audioPlayer.duration) * 100);
        }

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

            
        const progress = ((audioPlayer.currentTime / audioPlayer.duration) * 100).toFixed(2);
        const gradient = `linear-gradient(to right, rgba(0, 128, 0, 0.5) 0%, rgba(0, 128, 0, 1.0) ${progress}%, transparent ${progress}%, transparent 100%)`;
        const combinedBackground = `${gradient}, var(--color-win-ina)`;
        if (fileWinBox.min){
        fileWinBox.setBackground(combinedBackground);}
    };


    setTimeout(() => {
        const player = document.getElementById(uniqueFileId);
        if (!player) return;

        player.ontimeupdate = updateUI;

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


player._analyserL.minDecibels = -70; // Поріг повної тиші (чим ближче до 0, тим менше чутливість)
player._analyserL.maxDecibels = -10; // Поріг максимального стрибка
player._analyserR.minDecibels = -70;
player._analyserR.maxDecibels = -10;

        player._source.connect(player._splitter);
        player._splitter.connect(player._analyserL, 0); // Лівий
        player._splitter.connect(player._analyserR, 1); // Правий
        
        player._source.connect(player._audioCtx.destination);
    }

    const bufferLength = player._analyserL.frequencyBinCount;
    const dataArrayL = new Uint8Array(bufferLength);
    const dataArrayR = new Uint8Array(bufferLength);

    let animationFrameId;

    const updateMeters = () => {

        const currentPlayer = document.getElementById(uniqueFileId);
        const mL = document.getElementById(`meter-l-${uniqueFileId}`);
        const mR = document.getElementById(`meter-r-${uniqueFileId}`);
        
        if (!currentPlayer || !mL || !mR || currentPlayer.paused) {

            if (mL) mL.value = 0;
            if (mR) mR.value = 0;
            if (!currentPlayer || !mL) {
                cancelAnimationFrame(animationFrameId);
                return;
            }
        }

        animationFrameId = requestAnimationFrame(updateMeters);

        player._analyserL.getByteFrequencyData(dataArrayL);
        player._analyserR.getByteFrequencyData(dataArrayR);

        const getVolumeFromFrequencies = (dataArray) => {
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }

            return (sum / dataArray.length) / 255 * 100;
        };

        const volL = getVolumeFromFrequencies(dataArrayL);
        const volR = getVolumeFromFrequencies(dataArrayR);

        const sensitivity = 0.5; 
        mL.value = Math.min(volL * sensitivity, 100);
        mR.value = Math.min(volR * sensitivity, 100);
    };

    player.onplay = () => {

        if (player._audioCtx.state === 'suspended') {
            player._audioCtx.resume();
        }
        updateMeters();
    };
    
    player.onpause = () => {
        meterL.value = 0;
        meterR.value = 0;
    };

    if (!player.paused) {
        updateMeters();
    }
}

        const seekInput = document.getElementById(`seek-${uniqueFileId}`);
        seekInput.oninput = function() {
            player.currentTime = (this.value / 100) * player.duration;
            updateUI(); // Immediate update when seekbar moves
        };

        document.getElementById(`ctrl-prev-${uniqueFileId}`).onclick = () => { player.currentTime -= 10; updateUI(); };
        document.getElementById(`ctrl-play-${uniqueFileId}`).onclick = () => { player.play(); updateUI(); };
        document.getElementById(`ctrl-pause-${uniqueFileId}`).onclick = () => { player.pause(); updateUI(); };
        document.getElementById(`ctrl-stop-${uniqueFileId}`).onclick = () => { player.pause(); player.currentTime = 0; updateUI(); };
        document.getElementById(`ctrl-next-${uniqueFileId}`).onclick = () => { player.currentTime += 10; updateUI(); };

    }, 50);
updateUI()

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

            newContent = `<div style="height: 100%; overflow-y:hidden;"> <video controls src="${content}" style="width: 100%; height: 100%;max-width: 100%; max-height: 100%; object-fit: contain;padding:0; margin:0;"></video> </div>`;
            
        } else if (fileType == "application/pdf" && navigator.pdfViewerEnabled) {
            newContent= `
             <div style="height: 100%; overflow-y:hidden;">
             <embed src="${content}" type="application/pdf" style="width: 100%; height: 100%;">
             </div> 
            `;
        } else {

            newContent = `<div style="padding: 10px; color: black;">${_('unsupported_file_type')}</div>`;
        }
        
        try{
            fileWinBox.body.innerHTML = newContent;
        }catch{
            console.warn('Running non-window application. Exiting GPU draw.')
        }

        if (isEditable) {

            const printButton = fileWinBox.body.querySelector(`#printBtn-${uniqueFileId}`);
            const findButton = fileWinBox.body.querySelector(`#findBtn-${uniqueFileId}`);
            const saveButton = fileWinBox.body.querySelector(`#saveBtn-${uniqueFileId}`);
            const textArea = fileWinBox.body.querySelector(`#${uniqueFileId}`);
            const tableCont = fileWinBox.body.querySelector(`#table-cont-${uniqueFileId}`);


if (exfile.name.endsWith(".html") || exfile.name.endsWith(".htm")) printButton.disabled = true;

                fileWinBox.body.addEventListener('keydown', async function(event) { // ЗРОБЛЕНО ASYNC



                    if (event.ctrlKey || event.metaKey) {	

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

        const text = textArea.value;
        const index = text.toLowerCase().indexOf(query.toLowerCase());

        if (index !== -1) {
            textArea.focus();
            textArea.setSelectionRange(index, index + query.length);

            const lineHeight = parseFloat(window.getComputedStyle(textArea).lineHeight);
            const charsBefore = text.substring(0, index).split('\n');
            const currentRow = charsBefore.length;
            textArea.scrollTop = (currentRow * lineHeight) - (textArea.clientHeight / 2);
        } else {
            await alert(_("not_found"));
        }
    } else {

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


    document.body.appendChild(iframe0);

    const doc = iframe0.contentWindow.document;
iframe0.contentWindow.print = window.print;

    doc.open();

    doc.write('<html><head><title>Print</title></head><body>' + newTextContent + '</body></html>');
    doc.close();

    iframe0.contentWindow.focus(); 
    iframe0.contentWindow.print();


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


    const paddingPx = parseInt(window.getComputedStyle(textArea).paddingLeft) || 20;
    const marginTwips = Math.round((paddingPx / 96) * 1440);

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

    newTextContent = blob;

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

                const newFile = new File([newTextContent], exfile.name, { type: exfile.type ,lastModified: Date.now() });
                
                const index = fs.findIndex(item => item.name === exfile.name);
                if (index !== -1) {
                    fs[index] = newFile;

                    if (disk.type != "localStorage"){   await saveFileToDB(newFile);
                            } else{
                    localStorage.setItem(exfile.name, newTextContent)
                            }
                    
                    await refr(); // Оновлення File Explorer
                }
            };
        }
    } 

    if (fileType.startsWith("text/") ||!exfile.name.split("/").pop().substring(1).includes(".")  || fileType == "application/x-theme"  || fileType== "application/rtf") {
        console.log("readAsText");
        reader.readAsText(exfile);
    } else if (fileType.startsWith("image/") || fileType.startsWith("audio/") || fileType.startsWith("video/") || fileType.startsWith("font/") || fileType == "application/pdf") {
        console.log("readAsDataURL")
        reader.readAsDataURL(exfile);
    } else {
        console.log("readAsArrayBuffer")
        reader.readAsArrayBuffer(exfile);
    }


} 



/**
 * Асинхронно отримує інформацію про використання пам'яті (квоту)
 * для IndexedDB (і всього Origin) у байтах.
 * @returns {Promise<{used: number, total: number}>} Використаний та загальний обсяг у байтах.
 */
async function getStorageUsageInfo() {

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

        return { used: 0, total: 0 }; 
    }
}

/**
 * Перетворює байти у читабельний рядок (KB, MB, GB).
 * @param {number} bytes Кількість байтів.
 * @returns {string} Форматований рядок.
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


async function zipFolder(folderPath, zipName = null, compress = false) {
    const zip = new JSZip();

    const cleanFolderPath = folderPath.replace(/\/+$/, "") + "/";
    const folderName = cleanFolderPath.split("/").filter(Boolean).pop();


    const pathParts = cleanFolderPath.split("/").filter(Boolean);
    pathParts.pop();
    const parentPath = pathParts.length > 0 ? pathParts.join("/") + "/" : "";

    const finalZipName = (zipName === null) ? `${folderName}.zip` : zipName;
    const archivePath = parentPath + finalZipName;

    for (const f of fs) {

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

    const contentBlob = await zip.generateAsync({
        type: "blob",
        compression: compress ? "DEFLATE" : "STORE"
    });

    const resultFile = new File([contentBlob], archivePath, { type: "application/zip" });

    const existingIdx = fs.findIndex(file => file.name === archivePath);
    if (existingIdx !== -1) {
        fs[existingIdx] = resultFile; // Замінюємо старий файл новим
    } else {
        fs.push(resultFile);
    }

    await saveFileToDB(resultFile);

    console.log(`[Infinity OS] Archive created at: ${archivePath}`);
    return archivePath; // Корисно для UI, щоб підсвітити файл
}



async function unzipFile(filePath, cwd) {
    let file;
    if (typeof filePath == "string"){
        file = fs.find(f => f.name === filePath);
    } else {
        file = filePath;
    }
    if (!file) return;

    var zip = new JSZip();
    await zip.loadAsync(file);

    const unzipPromises = [];

    try {
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                console.log(`Extracting: ${relativePath}`);

                const promise = zipEntry.async("blob").then(async (content) => {
                    const type = getMimeType(zipEntry.name);
                    const parts = zipEntry.name.split("/");
                    const pureName = parts.pop(); 
                    const folderPath = parts.join("/"); 
                    
                    let p;
                    if (cwd == ""){
                        p = zipEntry.name;
                    } else {
                        p = cwd + "/" + zipEntry.name;
                    }

                    const extractedFile = new File(
                        [content],
                        p,
                        { type }
                    );

                    fs.push(extractedFile);

                    await saveFileToDB(extractedFile); 
                });

                unzipPromises.push(promise);
            }
        });

        await Promise.all(unzipPromises);
        console.log("[JSZip Pipeline] Усі файли успішно вилучено в пам'ять та ФС!");

    } catch (e) {
        console.error("&" + e.message);
    }
}


function getMimeType(fileName) {
    const ext = getExt(fileName);
    return (ext && FILE_TYPES[ext]) ? FILE_TYPES[ext].mime : 'application/octet-stream';
}

function getIcon(file) {
    const ext = getExt(file);
    return (ext && FILE_TYPES[ext]) ? FILE_TYPES[ext].icon : icns.empty;
}


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

    const newFile = new File([oldFile], newName, { type: getMimeType(newName) ,lastModified: Date.now()});

    fs[fileIndex] = newFile;
    
    try {

        await idbWrapper.deleteFile(oldName);

        const success = await saveFileToDB(newFile);
        
        if (success) {

            if (oldFile.type === 'text/javascript') {
                let autoload = JSON.parse(localStorage.getItem('infinity_os_autoload') || '[]');
                
                if (autoload.includes(oldName)) {
                    autoload = autoload.filter(name => name !== oldName);
                    autoload.push(newName);
                    localStorage.setItem('infinity_os_autoload', JSON.stringify(autoload));
                    
                }
            }

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



async function createIDB() {
    const dbName = await prompt(_("prompt_new_idb_name")); // використовуємо глобальну змінну
    if (!dbName) return;
    if (dbName.includes("://")){

    }else{

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

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
    idbWrapper.db = null;
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


    if (fs.some(file => file.name === fileName)) {

        return;
    }
    

    const path = cwd == "" ? fileName : cwd.trim() + "/" + fileName;
    const newFile = new File([""], path, { type: getMimeType(fileName) });

    fs.push(newFile);

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

async function getDisks() {
    const disks = [];

    const lsUsed = JSON.stringify(localStorage).length * 2; // байти приблизно
    disks.push({
        type: "localStorage",
        name: "Local Storage",
        icon: icns.lsDrive,
        used: lsUsed,
        total: maxLS, // 5 MB стандарт
    });

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

            
            
            const fileInput = this.body.querySelector(`#file-input-${uniqueId}`);
            
    const resizer = this.body.querySelector(`#resizer-${uniqueId}`);

    let minSidebarWidth;

    const resize = (e) => {

        const rect = sideListContainer.getBoundingClientRect();

        const newWidth = e.clientX - rect.left;
        
        if (newWidth > 50 && newWidth < 600) { // Обмежуємо розумними межами
             sideListContainer.style.width = newWidth + 'px';
        }
    };

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Запобігаємо виділенню тексту при русі
        document.addEventListener('mousemove', resize);

        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', resize);
        }, { once: true });
    });

    fileListContainer.addEventListener("dragover", (e) => e.preventDefault());

            const updateQuotaInfo = async () => {

                const info = await getStorageUsageInfo();
                const usedBytes = info.used;
                const totalBytes = info.total;

                const usedTextFormatted = formatBytes(usedBytes);
                const totalTextFormatted = formatBytes(totalBytes);

                const percentage = totalBytes > 0 ? ((usedBytes / totalBytes) * 100).toFixed(2) : 0;
                
                
            };

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


const menu = document.getElementById("fileM");

menu.addEventListener("click", (e) => {
  e.stopPropagation();

  const li = e.target.closest("li");
  if (!li) return;

  const action = li.id;
  const file = li.dataset.file;

  console.log("ACTION:", action, file);

  if (e.target.tagName === "INPUT") {
    console.log("Checkbox changed:", e.target.checked);
    return;
  }

});
const showContextFldrMenu = (e, currFolder) => {
    e.preventDefault(); // Завжди корисно для контекстного меню

    if (e.target.closest("ul") !== e.target) return;

    document.querySelectorAll(".menu").forEach(item => item.style.display = "none");
    
    const menu = document.getElementById("folderM");
    const cleanFolder = currFolder.trim();


    const visibleButtons = ["create_item_btn"]; 

    if (cleanFolder !== "/" && cleanFolder !== "") {
        visibleButtons.push("getinfo1_btn");
    }

    menu.querySelectorAll("li").forEach(li => {
        li.style.display = "none";
    });

    visibleButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.display = "block";
            btn.setAttribute("data-file", currFolder);
        }
    });

    menu.querySelectorAll("li > p, label, b").forEach(item => {

        if (!item.dataset.key) item.dataset.key = item.innerText;
        item.innerText = _(item.dataset.key);
    });

    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";
    menu.style.display = "block";
}


const showContextMenu = (e, itemType, fileName) => {
    e.preventDefault();

    document.querySelectorAll(".menu").forEach(item => item.style.display = "none");

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

console.log(fileName+" "+itemType)

buttons.forEach(id => {
  const btn = document.getElementById(id);
  btn.style.display = "block";
});

document.getElementById("fileM")
  .querySelectorAll("li > p, label, b")
  .forEach(item => item.innerText = _(item.innerText));


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

const menu = document.getElementById("fileM");
menu.style.left = e.clientX + "px";
menu.style.top = e.clientY + "px";
menu.style.display = "block";

buttons.forEach(id => {
  const btn = document.getElementById(id);
  btn.setAttribute("data-file", fileName);

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

updateDiskQuotaUI(disk, meter, text);

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

            startupCheckbox.onchange = (ev) => {
                console.log(startupDisk)
                if (ev.target.checked) {

                    
                    localStorage.setItem("startup_disk", diskName);
                } else {
                    localStorage.removeItem("startup_disk");
                }
            }
            
            showContextMenu(e, disk.type, diskName);
        };

        li.onclick = async () => {
            open = 1;
            currentDisk = disk;
            currentDir = "";
            fileListContainer.innerHTML = '';

            if (disk.type === "localStorage") {

                const keys = Object.keys(localStorage);
                fs = keys.map(k => new File([localStorage.getItem(k)], k, { type: getMimeType(k)}));
            } else if (disk.type === "indexedDB") {

                if (!disk.mounted) {
                    new Error()
                }
                currentDir = "";
                document.getElementById("pathlabel-"+uniqueId).value = currentDir;

                idbWrapper.db = null;
                if (DB_NAME != disk.name){
                DB_NAME = disk.name;   
                await idbWrapper.openDB();
            } 
            
        await loadFsFromDB();
            }
            await renderFileList(); // оновлюємо список

            
            
        };



        sideListContainer.appendChild(li);
    });
minSidebarWidth = parseInt(window.getComputedStyle(sideListContainer).width) || 100;


if (!currentDisk) return;

    const folders = getFoldersInDir(currentDir);
    folders.forEach(folderName => {
        let li = document.createElement("li");
const safeId = folderName.replace(/\s+/g, "_").replace(/\//g, "_");

const folderDisplay = document.createElement("span");
folderDisplay.style.cssText = "flex-grow:1; display:flex; align-items:center;";

folderDisplay.innerHTML = `
    <span style="position:relative; display:inline-block; width:20px; height:20px; margin-right:10px; flex-shrink:0;">
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
    <p class="folder-name-text" style="flex-grow:1; margin:0;">${folderName}</p>
`;

const insideFiles = fs.filter(f => f.name.startsWith(currentDir ? currentDir + "/" + folderName + "/" : folderName + "/"));

filesCols.forEach(col => {
    if (col === 'lastModified') {

        const timestamps = insideFiles.map(f => {

            return typeof f.lastModified === 'number' ? f.lastModified : new Date(f.lastModified).getTime();
        }).filter(t => !isNaN(t));

        let formattedDate = "N/A";
        if (timestamps.length > 0) {
            const modifiedDate = Math.max(...timestamps);
            formattedDate = new Intl.DateTimeFormat(dateLang, localeFormat).format(new Date(modifiedDate));
        }
        
        folderDisplay.innerHTML += `<p class="col-date">${formattedDate}</p>`;
    } 
    else if (col === 'type') {
        folderDisplay.innerHTML += `<p class="col-type">${_("folder")}</p>`;
    } 
    else if (col === 'size') {
        let sum = 0;
        insideFiles.forEach(f => {

            if (typeof f.size === 'number') {
                sum += f.size;
            } else if (typeof f.size === 'string') {
                const num = parseFloat(f.size);
                if (!isNaN(num)) {
                sum += num;
                }
            }
        });

        
        

        folderDisplay.innerHTML += `<p class="col-size">${formatBytes(sum)}</p>`;
    }
});

li.appendChild(folderDisplay);


li.oncontextmenu = (e) => {
    e.preventDefault();
    const li = e.target.closest("li");
    const folderName1 = currentDir == "" ? folderName.trim() + "/" : currentDir + "/" + folderName.trim() + "/";
    
    
    showContextMenu(e, "folder", folderName1);
};

        li.onclick = () => {
            currentDir = currentDir ? currentDir + "/" + folderName : folderName;
             renderFileList();
             document.getElementById("pathlabel-"+uniqueId).value = currentDir;
        };
        
        
const isHidden = folderName.startsWith(".");

if (!isHidden || filesShowHidden) {

    fileListContainer.appendChild(li);

    if (isHidden) {
        li.style.opacity = "0.5"; 
    }
}

    const folderName2 = currentDir == "" ? folderName.trim()+"/" :currentDir+ "/" + folderName.trim()+"/";
    const count = fs.filter(f => f.name.startsWith(folderName2) && f.name.trim() != folderName2).length;
    
    document.getElementById(safeId).textContent = count;
    });

    const files = getFilesInDir(currentDir);
    files.forEach(file => {
        let li = document.createElement("li");
        li.setAttribute("data-path", file.name);
        let ic = getIcon(file)

li.oncontextmenu = (e) => {
    e.preventDefault();
    const li = e.target.closest("li");
    const fileName = file.name;

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

        const fullPath = file.name;

        const fileDisplay = document.createElement("span");
        fileDisplay.style.cssText = "flex-grow:1;display:flex;align-items:center;";
        fileDisplay.innerHTML = `
            <img src="${ic}" width="20" style="margin-right:10px;">
            <p>${file.name.split("/").pop()}</p>
        `;
        filesCols.forEach(col => {
        if (col === 'lastModified') {

            const formattedDate = new Intl.DateTimeFormat(dateLang, localeFormat)
                .format(new Date(file.lastModified));
            
            fileDisplay.innerHTML += `<p class="col-date">${formattedDate}</p>`;
        } 
        else if (col === 'type') {
            fileDisplay.innerHTML += `<p class="col-type">${file.type}</p>`;
        }
        else if (col === 'size') {
            fileSize = formatBytes(file.size)
    fileDisplay.innerHTML += `<p class="col-size">${fileSize}</p>`;
}

    });

        fileDisplay.onclick = (e) => {
    e.stopPropagation();

    const li = e.target.closest("li");
    const filePath = li.getAttribute("data-path");

    const file = fs.find(f => f.name === filePath);

    if (!file) {
        console.error("Файл не знайдено:", filePath);
        return;
    }

    console.log(currentDisk.name)
    Openf(null, updateQuotaInfo, getMimeType(file.name), file, currentDisk);
};

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
document.getElementById("pathlabel-"+uniqueId).value = currentDir;
}
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

    let fileSize;
    if (typeofpath == "file") {
        fileSize = formatBytes(file.size)
    }else if (typeofpath == "drive"){
        fileSize = formatBytes(drive.total);
    } else {
        let sum = 0;
        fs.forEach(f => { if (f.name.startsWith(filePath)) sum += f.size; });
        fileSize = formatBytes(sum)
            
    }

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

    let type;
    type = filePath.endsWith("/") ? _("folder") : file.type;

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

    let autoload = [];
    const autoloadString = localStorage.getItem('infinity_os_autoload');
    if (autoloadString) {
        try {

            autoload = JSON.parse(autoloadString);
        } catch (error) {
            console.error("Помилка парсингу autoload JSON:"+ error);

            autoload = []; 
        }
    }

    const fileName = e.target.parentNode.getAttribute("data-file");

    
    if (e.target.checked) {

        if (!autoload.includes(fileName)) {
            autoload.push(fileName);
        }
    } else {


        autoload = autoload.filter(name => name !== fileName);
    }


    localStorage.setItem('infinity_os_autoload', JSON.stringify(autoload));
    
    
};

    setbgBtn.onclick = (e) => {
                        e.stopPropagation(); // Важливо: запобігає виклику Openf при натисканні X
                        const fileName = e.target.closest("li").getAttribute("data-file");
                        const file = fs.find(f => f.name === fileName);
                                const reader = new FileReader();
        
        reader.onload = async function(e) {
            
            const dataUrl = e.target.result;

            document.body.style.backgroundImage = `url(${dataUrl})`;

            localStorage.setItem('infinity_os_background_file', file.name);

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

        await renderFileList();
        deleteRequest.onerror = (e) => console.warn(`Помилка при видаленні ${fileName}:`, e);

})();
return 1;
        }
        
        if (currentDisk.type === "localStorage") {

            if (isFolder) {

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

        const file = fs.find(f => f.name === fileName);
        
        if (isFolder) {
            await purgeDir(fileName);
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
        
        await deleteFile(file.name);
        await renderFileList()
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

        
        
        
            const value = localStorage.getItem(oldPath);
            
            localStorage.removeItem(oldPath);
            localStorage.setItem(newName, value);
        
        
        await renderFileList();
        updateQuotaInfo();
        return;
    }

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

if (!isHidden || filesShowHidden) {

    fileListContainer.appendChild(li);

    if (isHidden) {
        li.style.opacity = "0.5"; 
    }
}

                    
                });
            };
            document.getElementById("create_item_btn").onclick = () => {

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

        const content = await file.arrayBuffer(); 
        
        const path = currentDir == "" ? file.name : currentDir.trim() + "/" + file.name;


        const a = new File([content], path, {
            type: getMimeType(path),
            lastModified: file.lastModified
        });

        fs.push(a);
        await saveFileToDB(a); 
    }

    renderFileList();
}

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

      const fileDataURL = e.target.result;


      localStorage.setItem(file.name, fileDataURL);
      console.log("File saved to localStorage:", localStorage.getItem("savedFile"));
    };

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

            await renderFileList();
            await updateQuotaInfo(); 
        }
    });
});

/* addIcon, Openf (повністю оновлена вище), Clock, Calculator, Internet, updateTime, setInterval(updateTime, 1000); 
*/





addIcon(("about"),icns.dialogInfo, function(){
    new wm(_("about"),{ // ВИКОРИСТАННЯ _()
    icon: icns.dialogInfo,x: "center",y: "center",
    class: ["no-full", "no-max", "no-min", "no-resize", 'tra', wbtheme],
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
          height:300,width:400,minheight: 200,minwidth:400,oncreate: function() {
            applySystemConfig(this.id)
          }
    
  });
});


addIcon(("clock"), icns.clock, function(){
    new wm(_('clock'), { 
        icon: icns.clock, x: "center",y: "center",
        class: ['no-full', 'no-max', wbtheme,'no-resize', 'tra'], 
        html: `<div style=\'padding-left:5px;\'><h2 class=\'clock-time\' style=\'font-size: 2em; margin: 0;\'>--:--:--</h2><p class=\'clock-date\' style=\'margin: 0;\'>--.--.----</p></div>`, 
        height:150, width:160 
    });
})

addIcon(("calculator"), icns.calc, function(){

    const calcId = Math.floor(Math.random() * 1000000);
    const instanceName = `InfinityCalc_${calcId}`;

    new wm(_('calculator'),{
        x: "center",
        y: "center", 
        icon: icns.calc, 
        class: ['no-full', 'no-max', wbtheme, 'no-resize', 'tra'], 
        html: `
            <style> 
                .calc-container {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr); /* 4 абсолютно рівні колонки */
                    gap: 6px; /* Гарні рівномірні відступи */
                    padding: 6px;
                    box-sizing: border-box;
                    width: 100%;
                    height: 100%;
                }
                .calc-btn {
                    width: 100%;
                    height: 42px;
                    font-size: 20px;
                    color: black !important;
                    cursor: pointer;
                    box-sizing: border-box;
                    border-radius: 6px; /* Трохи заокруглення в стиль ОС */
                }
                .calc-display {
                    grid-column: span 2; /* Дисплей займає рівно дві колонки */
                    width: 100%;
                    height: 42px;
                    font-size: 22px;
                    text-align: right;
                    padding-right: 8px;
                    box-sizing: border-box;
                    border-radius: 6px;
                }
            </style> 

            <div class="calc-container"> 
                <input inputmode="decimal" type="text" id="calc-result-${calcId}" class="calc-display" readonly />
                
                <input type="button" value="C" class="calc-btn" onclick="window.${instanceName}.clr()"/> 
                <input type="button" value="π" class="calc-btn" onclick="window.${instanceName}.ent(Math.PI.toFixed(5))"/> 

                <input type="button" value="1" class="calc-btn" onclick="window.${instanceName}.dis('1')"/> 
                <input type="button" value="2" class="calc-btn" onclick="window.${instanceName}.dis('2')"/> 
                <input type="button" value="3" class="calc-btn" onclick="window.${instanceName}.dis('3')"/> 
                <input type="button" value="/" class="calc-btn" onclick="window.${instanceName}.dis('/')"/> 

                <input type="button" value="4" class="calc-btn" onclick="window.${instanceName}.dis('4')"/> 
                <input type="button" value="5" class="calc-btn" onclick="window.${instanceName}.dis('5')"/> 
                <input type="button" value="6" class="calc-btn" onclick="window.${instanceName}.dis('6')"/> 
                <input type="button" value="-" class="calc-btn" onclick="window.${instanceName}.dis('-')"/> 

                <input type="button" value="7" class="calc-btn" onclick="window.${instanceName}.dis('7')"/> 
                <input type="button" value="8" class="calc-btn" onclick="window.${instanceName}.dis('8')"/> 
                <input type="button" value="9" class="calc-btn" onclick="window.${instanceName}.dis('9')"/> 
                <input type="button" value="+" class="calc-btn" onclick="window.${instanceName}.dis('+')"/> 

                <input type="button" value="." class="calc-btn" onclick="window.${instanceName}.dis('.')"/> 
                <input type="button" value="0" class="calc-btn" onclick="window.${instanceName}.dis('0')"/> 
                <input type="button" value="=" class="calc-btn" onclick="window.${instanceName}.solve()"/> 
                <input type="button" value="*" class="calc-btn" onclick="window.${instanceName}.dis('*')"/> 
            </div> 
        `,
        height: 280, 
        width: 235,
        oncreate: function() {

            window[instanceName] = {
                dis: function(val) { 
                    const res = document.getElementById(`calc-result-${calcId}`);
                    if(res) res.value += val;
                }, 
                solve: function() { 
                    const res = document.getElementById(`calc-result-${calcId}`);
                    if(!res || res.value.trim() === "") return;
                    try { 

                        let y = eval(res.value); 
                        res.value = Number(y).toString(); 
                    } catch (e) { 
                        res.value = "Error"; 
                    } 
                }, 
                ent: function(i) {
                    const res = document.getElementById(`calc-result-${calcId}`);
                    if(res) res.value += i;
                },
                clr: function() { 
                    const res = document.getElementById(`calc-result-${calcId}`);
                    if(res) res.value = ""; 
                }
            };

            applySystemConfig(this.id);
        },

        onclose: function() {
            if (window[instanceName]) {
                delete window[instanceName];
            }
        }
    });
});


addIcon(("settings"), icns.settings, function(){
if (document.querySelector(".winbox.settings")) return;
    new wm(_('settings'),{x: "center",y: "center",
     icon: icns.settings, class: ['no-full', wbtheme, "settings"], 
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
    <a class="sidebar-tab" data-page="usage" data-i18n="usage"></a>

    <div class="sidebar-separator"></div>

    <a class="sidebar-tab" data-page="drivers" data-i18n="drivers"></a>
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

          <div class="page" data-page="usage" hidden>

        <h2 data-i18n="usage"></h2>
        <label for='allowUsage' data-i18n="allow_usage"></label>
        <input id="allowUsage" type="checkbox"> 

          <div style="padding-top:15px;" id="usage-list" class="usage-list"></div>

    </div>


<!-- DISPLAY -->
<div class="page" data-page="display" hidden>
    <div style="display: flex; align-items: flex-start; gap: 20px;">

        <!-- Лівий блок: заголовок та опис -->
        <div style="flex:1;">
            <h2 data-i18n="display"></h2>
     <div class="setting-row" style="margin-top: 15px; display: flex; justify-content: flex-start; gap: 10px; width: max-content;">
    <label for="bgClockShow" data-i18n="show_bg_clock"></label>
      <input id="bgClockShow" type="checkbox">
</div>

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

    


    <!-- FILES -->
    <div class="page" data-page="files" hidden>
        <h2 data-i18n="files"></h2>
        <label for='showHidden' data-i18n="show_hidden"></label>
        <input id="showHidden" type="checkbox"> 

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
                <span class="setting-label"  data-i18n="taskbar_position"></span>
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

  const checkboxes = document.querySelectorAll('.format-group input[type="checkbox"]');

  checkboxes.forEach(cb => {
    const unit = cb.dataset.unit;


    if (localeFormat.hasOwnProperty(unit)) {
      cb.checked = true;



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

      if (value === "true") value = true;
      if (value === "false") value = false;

      options[unit] = value;
    }
  });
  localeFormat = options;
  localStorage.setItem("localeFormat", JSON.stringify(options))
  return options;
}

const thmSelect = document.getElementById("themeSelect");
const allFiles = parent.getFs();
const themeFiles = allFiles.filter(f => f.name.toLowerCase().endsWith(".theme"));

const parser = new ThemeParser(); 

thmSelect.innerHTML = `<option value="none">Glass (Default)</option>`;

themeFiles.forEach(f => {
    const el = document.createElement("option");
    el.value = f.name;
    el.innerText = f.name.replace(".theme", ""); // Прибираємо розширення для краси
    
    if (localStorage.getItem("theme") === f.name) {
        el.selected = true;
    }
    thmSelect.appendChild(el);
});

thmSelect.onchange = async () => {
    const selectedName = thmSelect.value;
    
    if (selectedName === "none") {
        localStorage.removeItem("theme");

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
if (name == "usage") {
  const usageH2 = document.querySelector('h2[data-i18n="usage"]');
    allowUsage = document.getElementById("allowUsage");
    allowUsage.checked = allowTelemetry;
    
    allowUsage.onchange = () => {
        allowTelemetry = allowUsage.checked;
        localStorage.setItem("allowTelemetry", allowUsage.checked);


        if (!allowTelemetry) {
            if (window.usageIntervalId) {
                clearInterval(window.usageIntervalId);
                window.usageIntervalId = null;
            }
            document.getElementById('usage-list').innerHTML = '';
            
            if (usageH2) usageH2.textContent = _("usage");
        } else {

            updateUsageTab();
            if (!window.usageIntervalId) {
                window.usageIntervalId = setInterval(updateUsageTab, 2000);
            }
        }
    };


    const formatTime = (seconds) => {
        const fmtSec = new Intl.NumberFormat(dateLang, { style: "unit", unit: "second", unitDisplay: "short" });
        const fmtMin = new Intl.NumberFormat(dateLang, { style: "unit", unit: "minute", unitDisplay: "short" });
        const fmtHr  = new Intl.NumberFormat(dateLang, { style: "unit", unit: "hour",   unitDisplay: "short" });

        if (seconds < 60) return fmtSec.format(seconds);
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return fmtMin.format(minutes);
        
        const hours = Math.floor(minutes / 60);
        const remMinutes = minutes % 60;
        
        if (remMinutes === 0) return fmtHr.format(hours);
        return `${fmtHr.format(hours)} ${fmtMin.format(remMinutes)}`;
    };

    const updateUsageTab = () => {

        if (allowTelemetry != true) return;

        const rawData = localStorage.getItem('.usageData');
        const usageList = document.getElementById('usage-list');

        if (!usageList) return; // Захист на випадок, якщо DOM уже знищено

        if (!rawData) {
            usageList.innerHTML = ``;
            usageH2.innerText = _("usage");
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const stats = JSON.parse(rawData);
        const todayStats = stats[today] || {};
        const appEntries = Object.entries(todayStats);

        if (appEntries.length === 0) {
            usageList.innerHTML = ``;
            usageH2.textContent = _("usage");
            return;
        }

        let totalSeconds = 0;
        let maxSeconds = 0;

        appEntries.forEach(([_, seconds]) => {
            totalSeconds += seconds;
            if (seconds > maxSeconds) maxSeconds = seconds;
        });

        usageH2.innerText = `${_("usage")} - ${formatTime(totalSeconds)}`;
        usageList.innerHTML = '';

        appEntries.sort((a, b) => b[1] - a[1]);

        appEntries.forEach(([appName, seconds]) => {
            const item = document.createElement('div');
            item.className = 'usage-item';

            const info = document.createElement('div');
            info.className = 'usage-info';
            info.style.display = 'flex';
            info.textContent = _(appName) + " - " + formatTime(seconds);

            const progress = document.createElement('progress');
            progress.className = 'usage-bar';
            progress.max = maxSeconds;
            progress.value = seconds;

            item.appendChild(info);
            item.appendChild(progress);
            usageList.appendChild(item);
        });
    };

    updateUsageTab();

    if (window.usageIntervalId) clearInterval(window.usageIntervalId);

    if (allowTelemetry === true) {
        window.usageIntervalId = setInterval(updateUsageTab, 2000);
    }


    if (this && typeof this.onclose === 'function') {
        const originalOnClose = this.onclose;
        this.onclose = function() {
            if (window.usageIntervalId) {
                clearInterval(window.usageIntervalId);
                window.usageIntervalId = null;
            }
            originalOnClose.apply(this, arguments);
        };
    } else if (this) {

        this.onclose = function() {
            if (window.usageIntervalId) {
                clearInterval(window.usageIntervalId);
                window.usageIntervalId = null;
            }
        };
    }
}
    if (name == "files"){
        showHiddenCheck = document.getElementById("showHidden");
showHiddenCheck.checked = filesShowHidden;
showHiddenCheck.onchange = () => {
    
    filesShowHidden = showHiddenCheck.checked;
        localStorage.setItem("config/files", JSON.stringify(filesSettings))
    
}
    }
    else if (name == "drivers"){

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

    li.innerHTML = `<b>${dsk.name}</b>${dsk.type}`;
    container1.appendChild(li);
  }
});


    }

    if (name == "keyboard"){
        
    setTimeout(() => {

        kbrdImg.src = "assets/" + keyboardLayoutSelect.value + "_kbrd.jpg";

        kbrdImg.style.opacity = 1;
    }, 250); // половина часу transition

    }

    if (name == "display"){
      bgClockShow = document.getElementById("bgClockShow");
bgClockShow.checked = bgClock;
bgClockShow.onchange = () => {
    
    bgClock = bgClockShow.checked;
        localStorage.setItem("backgroundClock", JSON.stringify(bgClock));

        const desktopFore = document.getElementById("desktop-fore");
        if (desktopFore) {
            desktopFore.style.display = bgClock ? "flex" : "none";
        }
    
}
        dispImg.classList = [];

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

if(currentKeyboardLayout) {
    keyboardLayoutSelect.value = currentKeyboardLayout;
}

keyboardLayoutSelect.onchange = () => {
    

    currentKeyboardLayout = keyboardLayoutSelect.value;
    chShortcuts(keyboardLayoutSelect.value);
    localStorage.setItem("currentKeyboardLayout",keyboardLayoutSelect.value );

    kbrdImg.style.opacity = 0;
    setTimeout(() => {

        kbrdImg.src = "assets/" + keyboardLayoutSelect.value + "_kbrd.jpg";

        kbrdImg.style.opacity = 1;
    }, 250); // половина часу transition
};





screenTypeSelect.onchange = () => {

    displayType = screenTypeSelect.value;

    setTimeout(() => {
        dispImg.classList = [];

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

let history = [];

window.ActiveTerminals = {
    currentActiveId: null,
    instances: {},

    initHook: function(originalConsole) {
        const methods = ['log', 'warn', 'error', 'dir', 'table'];
        methods.forEach(method => {
            window.console[method] = (...args) => {

                if (this.currentActiveId && this.instances[this.currentActiveId]) {
                    this.instances[this.currentActiveId][method](...args);
                }

                originalConsole[method](...args);
            };
        });
    }
};

if (!window.console._hooked) {
    const originalConsole = { ...window.console };
    window.ActiveTerminals.initHook(originalConsole);
    window.console._hooked = true;
}

addIcon(("terminal"), icns.term, function(){
  const termId = Date.now();
new wm(_('terminal'), {
        x: "center", y: "center",
        icon: icns.term,
        class: ['no-full', wbtheme, 'winbox-terminal', 'tra'],
        html: `
<div class="output-container" style="width:100%; height:100%; background:rgba(0,0,0,0.5); color:#fff; display:flex; flex-direction:column; user-select:text !important;">
  <div id="tout-${termId}" style="flex-grow:1; overflow-y:auto; padding:10px; white-space:pre-wrap; font-family:monospace !important;"></div>
  <input  
    id="term-input-${termId}"
    style="font-family:monospace !important; background:rgba(0,0,0,0.5); color:#fff; border:none; border-top:1px solid #999; padding:8px; width:100%; box-sizing:border-box; outline:none;" 
    type="text" 
    autofocus 
  />
</div>
        `,
        oncreate: function () {
            const out = document.getElementById(`tout-${termId}`);
            const input = document.getElementById(`term-input-${termId}`);
            
            let historyIndex = -1;

            function appendAnsiText(targetElement, rawStr, defaultColor = '#fff') {
                const colors = {
                    30:"#000", 31:"#f55", 32:"#5f5", 33:"#ff5",
                    34:"#59f", 35:"#f5f", 36:"#5ff", 37:"#fff"
                };
                const wrapper = document.createElement('div');
                wrapper.style.color = defaultColor;
                const parts = String(rawStr).split(/\x1b\[(\d+)m/);
                let currentColor = null;

                for (let i = 0; i < parts.length; i++) {
                    if (i % 2 === 1) {
                        const code = parts[i];
                        if (code === "0") currentColor = null;
                        else currentColor = colors[code] || currentColor;
                    } else {
                        if (parts[i]) {
                            const span = document.createElement('span');
                            if (currentColor) span.style.color = currentColor;
                            span.textContent = parts[i];
                            wrapper.appendChild(span);
                        }
                    }
                }
                targetElement.appendChild(wrapper);
                wrapper.scrollIntoView({ behavior: 'smooth' });
            }

            const terminalConsole = {
            clear: () => {
                out.innerHTML = "";
            },
                dir: (obj) => {
                    if (!obj) return;
                    try {
                        const keys = Object.getOwnPropertyNames(obj);
                        for (const key of keys) {
                            terminalConsole.log(`${key} : ${typeof obj[key]}`);
                        }
                    } catch(e) { terminalConsole.error(e.message); }
                },
                log: (...args) => {
                    const processed = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(" ");
                    appendAnsiText(out, processed, '#fff');
                },
                warn: (...args) => {
                    const processed = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(" ");
                    appendAnsiText(out, processed, '#f90');
                },
                error: (...args) => {
                    const processed = args.map(arg => arg instanceof Error ? arg.message : (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(" ");
                    appendAnsiText(out, processed, '#f00');
                },
                table: (data) => {
                    if (!data || typeof data !== 'object') {
                        terminalConsole.log(data);
                        return;
                    }
                    const table = document.createElement('table');
                    table.style.borderCollapse = 'collapse';
                    table.style.width = '100%';
                    table.style.margin = '10px 0';
                    table.style.color = '#fff';
                    table.style.border = '1px solid #444';
                    table.style.fontFamily = 'monospace';

                    const isArray = Array.isArray(data);
                    const sample = isArray ? data[0] : data[Object.keys(data)[0]];
                    const headers = ['(index)', ...Object.keys(sample || {})];

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

                    const tbody = table.createTBody();
                    for (const [key, val] of Object.entries(data)) {
                        const row = tbody.insertRow();
                        const indexCell = row.insertCell();
                        indexCell.textContent = key;
                        indexCell.style.border = '1px solid #444';
                        indexCell.style.padding = '4px 8px';
                        indexCell.style.fontWeight = 'bold';

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
            };

            window.ActiveTerminals.instances[termId] = terminalConsole;

            input.onfocus = () => {
                window.ActiveTerminals.currentActiveId = termId;
            };

            const executeCommand = async () => {
                const val = input.value.trim();
                if (!val) return;

                history.push(val);
                historyIndex = -1;

                const cmd = document.createElement('div');
                cmd.style.color = '#aaa';
                cmd.textContent = '$> ' + val;
                out.appendChild(cmd);
input.value = '';

                window.ActiveTerminals.currentActiveId = termId;

                try {

                    const runner = new Function('console', 'code', 'return (async () => { return eval(code); })()');
                    const r = await runner(terminalConsole, val);

                    if (r !== undefined) {
                        const res = document.createElement('div');
                        res.style.color = '#fff';
                        
                        if (r instanceof File || r instanceof Blob) {
                            const fileMeta = {
                                "[Class]": r.constructor.name,
                                name: r.name || "Blob_Data",
                                size: (r.size / 1024).toFixed(2) + " KB",
                                type: r.type || "application/octet-stream",
                                lastModified: r.lastModified ? r.lastModified : "N/A"
                            };
                            res.textContent = JSON.stringify(fileMeta, null, 2);
                        } else if (Array.isArray(r) && (r[0] instanceof File || r[0] instanceof Blob)) {
                            const arrayMeta = r.map((f, idx) => ({
                                index: idx,
                                name: f.name,
                                size: f.size,
                                type: f.type,
                                lastModified: f.lastModified ? f.lastModified : "N/A"
                            }));
                            res.textContent = "Can't display JS file objects directly. Displaying adapted:\nStorage: " + (typeof DB_NAME !== 'undefined' ? DB_NAME : 'N/A') + "\nLast Storage: " + (typeof LAST_DB !== 'undefined' ? LAST_DB : 'N/A') + "\n" + JSON.stringify(arrayMeta, null, 2);
                        } else if (typeof apps !== 'undefined' && r === apps) {
                            const cleanedAppsForLog = apps.map(app => {
                                if (app.icon && app.icon.startsWith("data:")) {
                                    return { ...app, icon: "BASE64 image omitted" };
                                }
                                return app; 
                            });
                            res.textContent = JSON.stringify(cleanedAppsForLog, null, 2);
                        } else {
                            res.textContent = typeof r === 'object'
                                ? JSON.stringify(r, null, 2)
                                : (typeof r === 'string' && r.includes(' ') ? _(r) : String(r));
                        }
                        out.appendChild(res);
                    }
                } catch(e) {
                    const err = document.createElement('div');
                    err.style.color = '#f55';
                    err.textContent = 'Error: ' + e.message;
                    out.appendChild(err);
                }

                
                out.scrollTop = out.scrollHeight;
            };

            input.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    executeCommand();
                } else if (e.key === "ArrowUp") {
                    if (historyIndex < history.length - 1) {
                        historyIndex++;
                        input.value = history[history.length - 1 - historyIndex];
                    }
                    e.preventDefault();
                } else if (e.key === "ArrowDown") {
                    if (historyIndex > 0) {
                        historyIndex--;
                        input.value = history[history.length - 1 - historyIndex];
                    } else {
                        historyIndex = -1;
                        input.value = "";
                    }
                    e.preventDefault();
                }
            };
            
            setTimeout(() => { if(input) input.focus(); }, 50);
        },
        onclose: function () {

            delete window.ActiveTerminals.instances[termId];
            if (window.ActiveTerminals.currentActiveId === termId) {
                window.ActiveTerminals.currentActiveId = null;
            }
        },
        minheight: 200, minwidth: 250,
        width: 320, height: 350,
    });
});


addIcon(("web_browser"), icns.web, function(){
    new wm(_('web_browser'),{x: "center",y: "center",icon: icns.web,class: ['no-full', wbtheme],url: 'apps/web.html',height:400,width:600,minheight: 200,minwidth:400,oncreate: function() {
            applySystemConfig(this.id)
          }});
})

addIcon(("task_mgr"), icns.tasks, function(){
    new wm(_('task_mgr'),{x: "center",y: "center",icon: icns.tasks,class: ['no-full', wbtheme],url: 'apps/resmon.html',height:600,width:800,minheight: 200,minwidth:400, oncreate: function() {
            applySystemConfig(this.id)
          }});
})

async function node(fileName) {
    let file;
    if (typeof fileName == "string"){
     file = fs.find(f => f.name === fileName);
    if (!file) console.error( `node: can't open file '${fileName}'`);
}else if (typeof fileName == "File"){file = fileName}

    let rawCode = "";
    if (file.content) {
        rawCode = file.content;
    } else if (typeof file.text === 'function') {
        rawCode = await file.text(); // Зчитуємо текст з об'єкта File
    }

const wsModule = {
  Server: class {
    constructor() {
      this.onconnection = null;
      window.addEventListener("node-ws", e => {

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

            const newFile = new File([data], path,{type: "text/plain"} )
                
                  fs.push(newFile);
            saveFileToDB(newFile);
            
          
        }
        return true;
    },
    readdirSync: (path) => {

        return fs.filter(f => f.name.startsWith(path))
                 .map(f => f.name);
    },
    existsSync: (path) => {
        return !!fs.find(f => f.name === path);
    }
};

    
    const require = (name) => {

    if (name === "fs") return virtualFS;
    if (name === "path") return pathModule;
    if (name === "events") return { EventEmitter };
    if (name === "ws") return wsModule;

    const cleanName = name.replace('./', '').split('/').pop().replace('.js', '');
    const modulePath = `system/node_modules/${cleanName}.js`;
    
    const moduleFile = fs.find(f => f.name === modulePath);
    if (!moduleFile) throw new Error(`Cannot find module '${name}' at ${modulePath}`);

    const mContent = moduleFile.content || "";

    const module = { exports: {} };
    
    try {
    const exported = new Function('require', 'module', 'exports', mContent)(require, module, module.exports);

    const result = exported || module.exports;

    // Якщо модуль повернув об'єкт з дефолтним експортом, 
    // і більше нічого немає — повертаємо саму функцію/клас
    if (result && result.default && Object.keys(result).length === 1) {
        return result.default;
    }

    return result;
} catch (e) {
    console.error(`Require error in ${name}:`, e);
    return {};
}}


    try {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

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

  let downloadUrl = url.includes("zipball") ? url : `${url}/zipball/${branch}`;
  const repoName = url.split("/").pop();

  try {
    console.log(`Cloning into ${repoName} (branch: ${branch})...`);
    let response = await fetch(downloadUrl);

    if (!response.ok && branch === "main") {
      console.warn(`Branch "${branch}" not found (404). Retrying with "master"...`);
      return await gitClone(url, "master"); // Рекурсивний виклик з іншою гілкою
    }

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const blob = await response.blob();
    const repoFile = new File([blob], repoName);

    await unzipFile(repoFile, repoName);
    return true; 
    
  } catch (error) {
    console.error('Clone failed:', error);

    throw error; 
  }
}



const installedpkg = new Set();

function npmUpdate() {
    installedpkg.clear();

    const coreModules = ["fs", "path", "events", "ws"];
    coreModules.forEach(pkg => installedpkg.add(pkg));

    fs.forEach(f => {
        if (f.name.startsWith("system/node_modules/")) {
            const name = f.name.split("/").pop().replace(/\.js$/, "");
            console.log("Updated pkg: "+name);
            installedpkg.add(name);
        }
    });
}

function npmList(){
console.log(JSON.stringify([...installedpkg], null, 2));
}


async function npmInstall(packageName) {
    if (installedpkg.has(packageName)) {
        console.log("Already installed: "+ packageName);
        return; // захист від рекурсії
    }

    installedpkg.add(packageName);

    try {
        const metaRes = await fetch(`https://unpkg.com/${packageName}/package.json`);
        const meta = await metaRes.json();

        const mainFile = meta.main || "index.js";
        const url = `https://unpkg.com/${packageName}/${mainFile}`
        let response, code;
        try{
         response = await fetch(url);
         code = await response.text();
        }catch{
        
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

  async function purgeDir(dir) {
      if (dir.trim() == "") return console.log("Cannot purge root directory.");

      const folderPathWithSlash = dir.endsWith("/") ? dir : dir + "/";
      const folderPathWithoutSlash = dir.endsWith("/") ? dir.slice(0, -1) : dir;

      const rem = fs.filter(file => 
          file.name.startsWith(folderPathWithSlash) || file.name === folderPathWithoutSlash
      );
      
      console.log("To be removed: " + rem.length);

      for (const f of rem) {
          console.log("Deleting: " + f.name);

          await deleteFile(f.name);
          
          console.log("Deleted: " + f.name);
      }
      
      return true; 
  }

async function deleteFile(fileName) {
    const initialLength = fs.length;

    fs = fs.filter(item => item.name !== fileName);
    
    if (fs.length < initialLength) {
        try {

            await idbWrapper.deleteFile(fileName); 

            const foundApp = apps.find(app => app.url === fileName);
            if (foundApp){


                apps = apps.filter(app => app.url !== fileName);
            }
            
            return true;
        } catch (error) {
            console.error("Помилка видалення з IndexedDB:", error);
            return false;
        }
    } 
    return false;
}


function updateTime() {
    const timeElementsCollection = document.getElementsByClassName("clock-time");
    const dateElementsCollection = document.getElementsByClassName("clock-date");
    
    if (timeElementsCollection.length === 0 && dateElementsCollection.length === 0) {
        return;
    }

    const now = new Date();
    const currentTime = now.toLocaleTimeString(dateLang, { hour: '2-digit', minute: '2-digit', second: '2-digit'});

const formatterWeekday = new Intl.DateTimeFormat(dateLang, { weekday: "short" });
const formatterDay = new Intl.DateTimeFormat(dateLang, { day: "numeric" });
const formatterMonth = new Intl.DateTimeFormat(dateLang, { month: "long" });

const rawDate = new Intl.DateTimeFormat(dateLang, {
    weekday: "short",
    day: "numeric",
    month: "long"
}).format(now);

const currentDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
    
    Array.from(timeElementsCollection).forEach((t) => {
        t.textContent = currentTime;
        t.title = currentDate;
    });

    Array.from(dateElementsCollection).forEach((d) => {
        d.textContent = currentDate;
    });
}




document.addEventListener("click", () =>{
document.querySelectorAll(".menu").forEach(function(item){
item.style.display="none";
})
if (event.target.id != "menubtn" && document.querySelector("#sysmenu")){
    
document.querySelector("#sysmenu").style.display = "none";}
})
document.querySelectorAll("li").forEach(listItem => {

    listItem.addEventListener("click", (e) => {

        document.querySelectorAll(".menu").forEach(function(menuItem) {
            menuItem.style.display = "none";
        });
    });
});

document.getElementById("desktop-fore").addEventListener("contextmenu", (e)=>{
e.preventDefault();

document.querySelectorAll(".menu").forEach(function(item){
item.style.display="none";
})

document.getElementById("deskM").querySelectorAll("li > p").forEach(function(item) {item.innerText = _(item.innerText);})
document.getElementById("deskM").style.display = "block";
document.getElementById("deskM").style.left = e.clientX+"px";
document.getElementById("deskM").style.top = e.clientY+"px";
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

    const selectableTarget = window.getComputedStyle(e.target).userSelect !== 'none' ? e.target : null;

    if (l == 0) l = e.screenX;
    if (t == 0) t = e.screenY;

    if (editableTarget || selectableTarget) {
        e.preventDefault();

        document.querySelectorAll(".menu").forEach(item => item.style.display = "none");
        const menu = document.getElementById("textM");
        menu.style.display = "block";
        menu.style.left = l + "px";
        menu.style.top = t + "px";

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

            li.style.display = command ? "block" : "none"; 
            li.onmousedown = null;
            li.onclick = null;

            if (command) {
                li.onmousedown = (event) => event.preventDefault(); 

li.onclick = async (event) => {
    event.stopPropagation();

    if (editableTarget && typeof editableTarget.focus === 'function') {
        editableTarget.focus();
    }
    
    try {
        if (command === 'paste') {
            // Використовуємо сучасний асинхронний Clipboard API
            const text = await navigator.clipboard.readText();
            
            // Перевіряємо, чи це INPUT/TEXTAREA, чи contenteditable
            if (editableTarget.tagName === 'INPUT' || editableTarget.tagName === 'TEXTAREA') {
                const start = editableTarget.selectionStart;
                const end = editableTarget.selectionEnd;
                const val = editableTarget.value;
                
                // Вставляємо текст у позицію курсора (замінюючи виділений текст, якщо він є)
                editableTarget.value = val.substring(0, start) + text + val.substring(end);
                
                // Повертаємо курсор на місце після вставленого тексту
                editableTarget.selectionStart = editableTarget.selectionEnd = start + text.length;
            } else {
                // Для contenteditable використовуємо стандартний фолбек або Range API
                // Але execCommand('insertText') зазвичай працює безпечно, на відміну від 'paste'
                doc.execCommand('insertText', false, text);
            }
        } else if (command === 'copy' || command === 'cut') {
            // Для копіювання/вирізання теж можна зробити надійний міграційний шлях
            let selectedText = "";
            if (editableTarget && (editableTarget.tagName === 'INPUT' || editableTarget.tagName === 'TEXTAREA')) {
                selectedText = editableTarget.value.substring(editableTarget.selectionStart, editableTarget.selectionEnd);
            } else {
                selectedText = doc.getSelection().toString();
            }

            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
                if (command === 'cut') {
                    doc.execCommand('delete', false, null); // Видаляємо вирізане
                }
            }
        } else {
            // Усі інші команди (undo, redo, selectAll) залишаємо через execCommand
            doc.execCommand(command, false, null);
        }
    } catch (err) {
        console.warn("Clipboard/ExecCommand operation failed:", err);
        // Резервний фолбек, якщо Clipboard API заблоковано політикою безпеки iframe
        try { doc.execCommand(command, false, null); } catch(e){}
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


setInterval(updateTime, 500);
window.addEventListener('message', function(event) {

    if (event.data && event.data.source === 'IR_Scanner') {
        const command = event.data.command;
        const key = event.data.key;
        
        
        
        if (command === 'KeyPress') {


            if (key === 'F1') {

                 
            } else if (key === 'Enter') {

                 console.log("OS: Виконано дію Enter (OK)");
            }

        }
    }
});


async function updateBattery() {
    try {
        const battery = await navigator.getBattery();
        const batContainer = document.getElementById("batt");
        
        const updateInfo = () => {

            const level = Math.round(battery.level * 100);
            
            if (batContainer) {
if (level <= 20){
batContainer.innerText = "🪫";
if (!battery.charging){
new Notification(_("low_batt"), {body:_("low_batt_body")})
}
}else{
batContainer.innerText = "🔋";
}

                batContainer.title = `${level}%`;
            }
        };

        updateInfo();

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
    let volDN = "AudioVolumeDown";
    let volUP = "AudioVolumeUp";

    if (typeof currentKeyboardLayout !== 'undefined' && currentKeyboardLayout === "mac") {
        volDN = 'F11';
        volUP = 'F10';
    }

    if (event.key === volUP || event.key === volDN) {
        event.preventDefault();
        let volPercent = Math.round(getMasterVolume() * 100); 

        if (event.key === volUP) {
            volPercent = Math.min(volPercent + 5, 100);
        } else if (event.key === volDN) {
            volPercent = Math.max(volPercent - 5, 0);
        }

        const targetVol = volPercent / 100;
        if (typeof setMasterVolume === 'function') {
            setMasterVolume(targetVol); 
        } else {
            vol = targetVol; // fallback, якщо це глобальна змінна
        }
    }

    /*
    if (event.key === 'Meta') {
        event.preventDefault();
        openMenu();
    }
    */

    if (event.altKey && event.key === 'F4') {
        event.preventDefault();
        const activeWindow = document.querySelector('.winbox.focus');
        if (activeWindow && activeWindow.winbox) {
            activeWindow.winbox.close();
        }
    }

    if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();

        const blacklisted = ['s', 'p', 'f']; 

        if (blacklisted.includes(key)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
});



/*
indexedDB.deleteDatabase(DB_NAME);
localStorage.clear();
*/