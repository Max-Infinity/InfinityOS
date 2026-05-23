async function redefineAdaptations() {
  // Краще використовувати window.onerror для повного перехоплення системних помилок
window.onerror = (message, source, lineno, colno, error) => {
    // 1. Спершу виводимо в консоль для дебагу (щоб бачити помилку, якщо WinBox впаде)
    console.error("System Intercepted Error:", message, source);

    
    
    // Формуємо HTML
    const htm = (lineno == null) 
        ? `<div><img width="70" src="${icns.dialogErr}"><br>${message}</div>` 
        : `<div><img width="70" src="${icns.dialogErr}"><br>${message}<br><small>${source}<br>${lineno}:${colno}</small></div>`;

    // 2. Створюємо вікно WinBox (переконуємося, що всі дужки закриті)
    try {
        new wm(_("js_error_title"), {
            x: "center", y: "center",
            class: ["no-full", wbtheme || "glass", "no-max"],
            icon: icns.dialogErr,
            height: 200,
            width: 230,
            minheight: 200,
            minwidth: 230,
            html: htm
        });

        if (sounds && typeof sounds.play === "function") {
            sounds.play("error");
        }
    } catch (e) {
        alert("Critical System Error: " + message); // Fallback, якщо UI ядро не працює
    }

    return true; // Запобігає виводу стандартної помилки в консоль браузера
};

// Код, що виконується при ініціалізації вікна додатка
window.print = async function() {
    // 1. Отримуємо контент (твій механізм getRawContent)
    const targetDoc = this.document || document;
    const content = targetDoc.body.innerHTML; 
    
    // 2. Викликаємо твій кастомний діалог Infinity OS
const pri = new wm( _("print_btn"), {x: "center",y: "center",class: wbtheme+" no-full",minheight: 700, height: 700, minwidth:500, width: 500, html: `
<style>

    /* Container to provide 3D depth */
    .preview-container {
        perspective: 1000px;
        display: inline-block;
        padding: 20px;
    }

    .content {
        white-space: pre-wrap;
        width: 400px;
        aspect-ratio: 210 / 297;
        background: white;
        box-sizing: border-box;
        overflow-y: auto;
        border: 1px solid #ddd;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        
        /* Animation setup */
        transform-origin: top left; /* "Draws" from this corner */
        animation: drawDocument 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }

    @keyframes drawDocument {
        0% {
            opacity: 0;
            transform: rotateX(30deg) rotateY(-30deg) scale(0);
        }
        100% {
            opacity: 1;
            transform: rotateX(0deg) rotateY(0deg) scale(1);
        }
    }


</style>

<div class="preview-container">
    <div class="content">
        ${content}
    </div>
</div>

<button data-i18n="print_btn">print_btn</button>
`, oncreate: function() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = _(key);
    });
} } )
};

  // alert
  window.alert = (msg) => {
  return new Promise((resolve) => {
    const icon = icns.dialogInfo;

    new wm(_("info"), {x: "center",y: "center",
      class: ["no-header", wbtheme, "no-max", "no-resize"],
      icon: icon,
      height: 200,
      width: 230,
      minheight: 100,
      minwidth: 230,
      html: `
        <div style="text-align:left; padding:10px;">
<img width="70" src="${icns.dialogInfo}">
          ${msg}<br>
          <button id="okBtn">OK</button>
        </div>
      `,
      oncreate: function() {
        // this — це сам wm об’єкт
        this.body.querySelector("#okBtn").onclick = () => this.close();
      },
      onclose: () => resolve()  // завершуємо Promise при закритті
    });
  });
}
window.confirm = async (msg) => {
  return new Promise((resolve) => {
    new wm(_("confirm"), {
      x: "center", y: "center",
      class: ["no-header", wbtheme, "no-max", "no-resize"],
      height: 150, // Трохи зменшив висоту для компактності
      width: 320,  // Збільшив ширину для кращого вигляду в ряд
      html: `
        <div style="display: flex; padding: 15px; align-items: center; gap: 15px;">
          <div style="flex-shrink: 0;">
            <img width="50" src="${icns.dialogQues}">
          </div>
          <div style="flex-grow: 1; font-size: 14px; color: black; line-height: 1.4;">
            ${msg}
          </div>
        </div>
        <div style="text-align: right; padding: 0 15px 15px;">
          <button id="cancelBtn" style="margin-right: 8px;">${_("cancel")}</button>
          <button id="okBtn" style="font-weight: bold;">${_("ok")}</button>
        </div>
      `,
      oncreate: function () {
       if ( sounds.play === "function") {
            sounds.play("question");
        }
        this.body.querySelector("#okBtn").onclick = () => { this.close(); resolve(true); };
        this.body.querySelector("#cancelBtn").onclick = () => { this.close(); resolve(false); };
      }
    });
  });
};

window.prompt = async (msg, defaultValue = "") => {
  return new Promise((resolve) => {
    new wm(_("prompt"), {
      x: "center", y: "center",
      class: ["no-header", wbtheme, "no-max", "no-resize"],
      height: 160,
      width: 350,
      html: `
        <div style="display: flex; padding: 15px; gap: 15px;">
          <div style="flex-shrink: 0;">
            <img width="50" src="${icns.dialogQues}">
          </div>
          <div style="flex-grow: 1;">
            <div style="font-size: 14px; margin-bottom: 10px;">${msg}</div>
            <input id="inputPrompt" value="${defaultValue}" 
                   style="width: 100%; box-sizing: border-box; padding: 5px;">
            
            <div style="margin-top: 20px; text-align: right;">
              <button id="cancelBtn" style="margin-right: 10px;">${_("cancel")}</button>
              <button id="okBtn" style="font-weight: bold;">${_("ok")}</button>
            </div>
          </div>
        </div>
      `,
      oncreate: function () {
        const input = this.body.querySelector("#inputPrompt");
        input.focus(); // Автофокус для зручності
        
        this.body.querySelector("#okBtn").onclick = () => { this.close(); resolve(input.value); };
        this.body.querySelector("#cancelBtn").onclick = () => { this.close(); resolve(null); };
        
        // Обробка Enter для швидкого підтвердження
        input.onkeypress = (e) => { if(e.key === "Enter") this.body.querySelector("#okBtn").click(); };
      }
    });
  });
};


}

function redefineNotifications() {
  const NotificationWrapper = `
class OSNotification {
  constructor(title, options = {}) {
    this.title = title;
    this.options = options;
    

  const box = document.createElement("div");

  box.className = "notification";

  const titleEl = document.createElement("strong");
titleEl.textContent = title;

const bodyEl = document.createElement("div");
bodyEl.textContent = options.body || "";
if (options.icon){
const ic = document.createElement("img");
ic.style.width = "32px";
ic.style.marginRight = "10px"; 

ic.src = options.icon;

box.appendChild(ic);
}
box.appendChild(titleEl);
box.appendChild(bodyEl);
let doc;
try {
  doc = parent?.document || document;
} catch {
  doc = document;
}
  doc.body.appendChild(box);
  
  
  if (options.onshow){
    options.onshow();
  }
box.addEventListener("click", () =>{this.close(); if (options.onclick) options.onclick()});

  if (!options.silent) {
    if (window.sounds) {
  window.sounds.play(options.sound || "notify");
}else if (parent?.window?.sounds){
  parent.window.sounds.play(options.sound || "notify");
}
  }
let closed = false;

this.close = () => {
  if (closed) return;
     closed = true;
  box.remove();
  if (options.onclose) options.onclose();
};
  setTimeout(()=>{
    this.close();
  }, 2500);
  }

  static requestPermission() {
    return Promise.resolve("granted");
  }

  static get permission() {
    return "granted";
  }
}

window.Notification = OSNotification;
`;
  
  const sc = document.createElement("script");
  sc.innerText = NotificationWrapper;
  document.head.appendChild(sc);
  
  return NotificationWrapper;
}


function redefineUSB() {
  const usbWrapper = `
class usbWrapper(){
  
  
}
  `;
  const sc = document.createElement("script");
  sc.innerText = usbWrapper;
  document.head.appendChild(sc);
  
  return usbWrapper;
  
}
