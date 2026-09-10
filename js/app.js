/* =========================================================
   NEXUSAI — APP.JS
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const STORAGE_KEY = "nexusai_chats";
const THEME_KEY = "nexusai_theme";

/*
 * Cuando tengas tu API/backend, cambia esta URL.
 *
 * Ejemplo:
 * const API_URL = "https://tu-api.com/api/chat";
 *
 * Por ahora NexusAI funciona en modo demo para que
 * toda la interfaz pueda probarse sin backend.
 */
const API_URL = "https://nexusaia.onrender.com/api/chat";


/* =========================================================
   DOM
   ========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const sidebar = $("#sidebar");
const sidebarOverlay = $("#sidebarOverlay");

const newChatBtn = $("#newChatBtn");
const mobileNewChat = $("#mobileNewChat");

const searchToggle = $("#searchToggle");
const searchBox = $("#searchBox");
const chatSearch = $("#chatSearch");
const closeSearch = $("#closeSearch");

const clearHistoryBtn = $("#clearHistoryBtn");
const chatList = $("#chatList");
const emptyHistory = $("#emptyHistory");

const themeBtn = $("#themeBtn");
const menuBtn = $("#menuBtn");

menuBtn?.addEventListener("click", () => {
    if (window.innerWidth >= 769) {
        document.body.classList.toggle("sidebar-collapsed");

        localStorage.setItem(
            "nexusai_sidebar_collapsed",
            document.body.classList.contains("sidebar-collapsed")
        );
    } else {
        document.body.classList.toggle("sidebar-open");
    }
});

const conversation = $("#conversation");
const welcome = $("#welcome");
const messages = $("#messages");

const messageInput = $("#messageInput");
const sendBtn = $("#sendBtn");

const fileInput = $("#fileInput");
const attachmentPreview = $("#attachmentPreview");

const contextMenu = $("#contextMenu");

const modalBackdrop = $("#modalBackdrop");
const cancelDelete = $("#cancelDelete");
const confirmDelete = $("#confirmDelete");

const toast = $("#toast");

const userName = $("#userName");
const userEmail = $("#userEmail");
const userAvatar = $("#userAvatar");


/* =========================================================
   STATE
   ========================================================= */

let chats = [];
let currentChatId = null;

let selectedChatId = null;
let selectedFile = null;

let isGenerating = false;


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    loadChats();

    setupEvents();
    setupPromptCards();

    autoResizeTextarea();
    updateSendButton();

    renderChatList();

    /*
     * Si no existe ningún chat, mostramos la pantalla
     * inicial de bienvenida.
     */
    showWelcome();
    loadUser();
});


if (
    window.innerWidth >= 769 &&
    localStorage.getItem("nexusai_sidebar_collapsed") === "true"
) {
    document.body.classList.add("sidebar-collapsed");
}


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    /* Nuevo chat */
    newChatBtn?.addEventListener("click", createNewChat);

    mobileNewChat?.addEventListener("click", () => {
        createNewChat();
        closeMobileSidebar();
    });


    /* Menú móvil */
    menuBtn?.addEventListener("click", openMobileSidebar);

    sidebarOverlay?.addEventListener("click", closeMobileSidebar);


    /* Búsqueda */
    searchToggle?.addEventListener("click", openSearch);

    closeSearch?.addEventListener("click", closeSearchBox);

    chatSearch?.addEventListener("input", () => {
        renderChatList(chatSearch.value.trim());
    });


    /* Atajo Ctrl + K */
    document.addEventListener("keydown", (event) => {

        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "k"
        ) {
            event.preventDefault();

            openSearch();
        }
    });


    /* Mensaje */
    messageInput?.addEventListener("input", () => {
        autoResizeTextarea();
        updateSendButton();
    });


    messageInput?.addEventListener("keydown", (event) => {

        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();

            if (!isGenerating) {
                sendMessage();
            }
        }
    });


    /* Enviar */
    sendBtn?.addEventListener("click", sendMessage);


    /* Archivo */
    fileInput?.addEventListener("change", handleFile);


    /* Tema */
    themeBtn?.addEventListener("click", toggleTheme);


    /* Borrar historial */
    clearHistoryBtn?.addEventListener("click", openDeleteModal);

    cancelDelete?.addEventListener("click", closeDeleteModal);

    confirmDelete?.addEventListener("click", clearAllChats);


    /* Cerrar menú contextual */
    document.addEventListener("click", (event) => {

        if (
            contextMenu &&
            !contextMenu.contains(event.target)
        ) {
            closeContextMenu();
        }
    });


    /* Acciones del menú contextual */
    contextMenu?.addEventListener("click", handleContextAction);


    /* ESC */
    document.addEventListener("keydown", (event) => {

        if (event.key === "Escape") {
            closeContextMenu();
            closeDeleteModal();
            closeSearchBox();
            closeMobileSidebar();
        }
    });
}


/* =========================================================
   PROMPT CARDS
   ========================================================= */

function setupPromptCards() {

    $$(".prompt-card").forEach((button) => {

        button.addEventListener("click", () => {

            const prompt = button.dataset.prompt;

            if (!prompt) return;

            messageInput.value = prompt;

            autoResizeTextarea();
            updateSendButton();

            messageInput.focus();
        });
    });
}


/* =========================================================
   CHAT CREATION
   ========================================================= */

function createNewChat() {

    const chat = {
        id: generateId(),
        title: "Nueva conversación",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    chats.unshift(chat);

    currentChatId = chat.id;

    saveChats();
    renderChatList();

    showChat(chat);

    messageInput.value = "";

    autoResizeTextarea();
    updateSendButton();

    messageInput.focus();
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    if (isGenerating) return;

    const text = messageInput.value.trim();

    if (!text) return;


    /* Crear chat automáticamente */
    if (!currentChatId) {
        createNewChat();
    }


    const chat = getCurrentChat();

    if (!chat) return;


    /* Ocultar bienvenida */
    hideWelcome();


    /* Mensaje del usuario */
    const userMessage = {
        id: generateId(),
        role: "user",
        content: text,
        createdAt: Date.now()
    };

    chat.messages.push(userMessage);


    /* Primer mensaje = título */
    if (
        chat.title === "Nueva conversación" ||
        !chat.title
    ) {
        chat.title = createChatTitle(text);
    }


    chat.updatedAt = Date.now();

    saveChats();
    renderChatList();

    appendMessage(userMessage);


    /* Limpiar input */
    messageInput.value = "";

    autoResizeTextarea();
    updateSendButton();


    /* Archivo */
    const file = selectedFile;

    clearAttachment();


    /* Generar respuesta */
    await generateResponse(chat, text, file);
}


/* =========================================================
   GENERATE RESPONSE
   ========================================================= */

async function generateResponse(chat, userText, file) {

    isGenerating = true;

    updateSendButton();


    /* Mostrar typing */
    const typingElement = appendTyping();


    try {

        let responseText;


        /*
         * Si API_URL está configurada, intenta utilizar
         * el backend real.
         */
        if (API_URL) {

            responseText = await requestAPI(
                chat,
                userText,
                file
            );

        } else {

            /*
             * Modo demo.
             *
             * Esto permite probar la interfaz antes de
             * conectar el backend.
             */
            responseText = await demoResponse(
                userText
            );
        }


        typingElement.remove();


        const assistantMessage = {
            id: generateId(),
            role: "assistant",
            content: responseText,
            createdAt: Date.now()
        };


        chat.messages.push(assistantMessage);
        chat.updatedAt = Date.now();

        saveChats();

        appendMessage(assistantMessage);


    } catch (error) {

        console.error("NexusAI error:", error);

        typingElement.remove();


        const errorMessage = {
            id: generateId(),
            role: "assistant",
            content:
                "Lo siento, ocurrió un error al procesar tu mensaje. Comprueba la conexión con el servidor e inténtalo de nuevo.",
            createdAt: Date.now()
        };


        chat.messages.push(errorMessage);

        saveChats();

        appendMessage(errorMessage);

        showToast("No se pudo obtener una respuesta");


    } finally {

        isGenerating = false;

        updateSendButton();
    }
}


/* =========================================================
   API REQUEST
   ========================================================= */

async function requestAPI(chat, text, file) {

    const payload = {
        message: text,
        conversation_id: chat.id,
        history: chat.messages,
        custom_instructions: getCustomInstructions()
    };


    /*
     * Si hay archivo, se envía como FormData.
     */
    if (file) {

        const formData = new FormData();

        formData.append(
            "message",
            text
        );

        formData.append(
            "conversation_id",
            chat.id
        );

        formData.append(
            "history",
            JSON.stringify(chat.messages)
        );

        formData.append(
            "file",
            file
        );


        const response = await fetch(
            API_URL,
            {
                method: "POST",
                body: formData
            }
        );


        if (!response.ok) {
            throw new Error(
                `API error: ${response.status}`
            );
        }


        const data = await response.json();

        return extractAPIResponse(data);
    }


    /*
     * Petición normal JSON.
     */
    const response = await fetch(
        API_URL,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)
        }
    );


    if (!response.ok) {
        throw new Error(
            `API error: ${response.status}`
        );
    }


    const data = await response.json();

    return extractAPIResponse(data);
}


/* =========================================================
   API RESPONSE
   ========================================================= */

function extractAPIResponse(data) {

    /*
     * Admite diferentes formatos comunes de API.
     */

    if (typeof data === "string") {
        return data;
    }


    if (data.response) {
        return data.response;
    }


    if (data.message) {
        return data.message;
    }


    if (data.content) {
        return data.content;
    }


    if (data.reply) {
        return data.reply;
    }


    if (
        data.choices &&
        data.choices[0]
    ) {

        const choice = data.choices[0];

        if (choice.message?.content) {
            return choice.message.content;
        }

        if (choice.text) {
            return choice.text;
        }
    }


    return "El servidor respondió, pero no se encontró contenido en la respuesta.";
}


/* =========================================================
   DEMO RESPONSE
   ========================================================= */

function demoResponse(text) {

    return new Promise((resolve) => {

        const delay =
            700 +
            Math.random() * 900;


        setTimeout(() => {

            const lower = text.toLowerCase();


            if (
                lower.includes("hola") ||
                lower.includes("buenas")
            ) {

                resolve(
                    "¡Hola! 👋 Soy NexusAI. ¿Qué hacemos hoy?"
                );

                return;
            }


            if (
                lower.includes("historia")
            ) {

                resolve(
                    "¡Claro! Podemos crear una historia desde cero. Dame un personaje, un lugar y un problema, y empezamos. ✨"
                );

                return;
            }


            if (
                lower.includes("organizar") ||
                lower.includes("día")
            ) {

                resolve(
                    "Podemos organizarlo fácilmente. Divide tu día en bloques: estudio, tareas importantes, descansos y tiempo libre. 📅"
                );

                return;
            }


            if (
                lower.includes("película")
            ) {

                resolve(
                    "Puedo ayudarte a encontrar una película según el género, duración o tipo de historia que tengas ganas de ver. 🎬"
                );

                return;
            }


            if (
                lower.includes("html") ||
                lower.includes("css") ||
                lower.includes("javascript")
            ) {

                resolve(
                    "¡Sí! Puedo ayudarte con HTML, CSS y JavaScript. Si me pasas tu código, podemos revisarlo y mejorarlo paso a paso. 💻"
                );

                return;
            }


            resolve(
                `Entendido. Recibí tu mensaje: "${text}". Cuando conectemos el backend de NexusAI, esta respuesta será generada por tu modelo de IA. 🚀`
            );

        }, delay);
    });
}


/* =========================================================
   RENDER MESSAGE
   ========================================================= */

function appendMessage(message) {

    if (!messages) return;


    const article = document.createElement("article");

    article.className =
        `message ${message.role === "user" ? "user" : "assistant"}`;


    const avatar = document.createElement("div");

    avatar.className = "message-avatar";


    if (message.role === "user") {
        avatar.textContent = getUserInitial();
    } else {
        avatar.innerHTML =
            `<img src="img/icon.png" alt="NexusAI" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`;
    }


    const content = document.createElement("div");

    content.className = "message-content";


    const role = document.createElement("div");

    role.className = "message-role";

    role.textContent =
        message.role === "user"
            ? getUserName()
            : "NexusAI";


    const text = document.createElement("div");

    text.className = "message-text";

    renderMessageContent(
        text,
        message.content
    );


    content.appendChild(role);
    content.appendChild(text);


    /* Acciones (copiar / like / dislike) — solo en respuestas del asistente */
    if (message.role === "assistant") {
        content.appendChild(createMessageActions(message));
    }


    article.appendChild(avatar);
    article.appendChild(content);

    messages.appendChild(article);


    scrollToBottom();
}


/* =========================================================
   MESSAGE ACTIONS — COPIAR / LIKE / DISLIKE
   ========================================================= */

function createMessageActions(message) {

    const actions = document.createElement("div");
    actions.className = "message-actions";


    /* Copiar */
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "message-action-btn";
    copyBtn.title = "Copiar";
    copyBtn.setAttribute("aria-label", "Copiar mensaje");
    copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i>`;

    copyBtn.addEventListener("click", () => {
        copyMessageText(message.content, copyBtn);
    });


    /* Like */
    const likeBtn = document.createElement("button");
    likeBtn.type = "button";
    likeBtn.className = "message-action-btn message-like-btn";
    likeBtn.title = "Buena respuesta";
    likeBtn.setAttribute("aria-label", "Buena respuesta");


    /* Dislike */
    const dislikeBtn = document.createElement("button");
    dislikeBtn.type = "button";
    dislikeBtn.className = "message-action-btn message-dislike-btn";
    dislikeBtn.title = "Mala respuesta";
    dislikeBtn.setAttribute("aria-label", "Mala respuesta");


    updateFeedbackButtons(message.feedback, likeBtn, dislikeBtn);


    likeBtn.addEventListener("click", () => {
        const next = message.feedback === "like" ? null : "like";

        setMessageFeedback(message, next);
        updateFeedbackButtons(message.feedback, likeBtn, dislikeBtn);
    });

    dislikeBtn.addEventListener("click", () => {
        const next = message.feedback === "dislike" ? null : "dislike";

        setMessageFeedback(message, next);
        updateFeedbackButtons(message.feedback, likeBtn, dislikeBtn);
    });


    actions.appendChild(copyBtn);
    actions.appendChild(likeBtn);
    actions.appendChild(dislikeBtn);

    return actions;
}


function updateFeedbackButtons(feedback, likeBtn, dislikeBtn) {

    likeBtn.classList.toggle("active", feedback === "like");
    dislikeBtn.classList.toggle("active", feedback === "dislike");

    likeBtn.innerHTML =
        feedback === "like"
            ? `<i class="fa-solid fa-thumbs-up"></i>`
            : `<i class="fa-regular fa-thumbs-up"></i>`;

    dislikeBtn.innerHTML =
        feedback === "dislike"
            ? `<i class="fa-solid fa-thumbs-down"></i>`
            : `<i class="fa-regular fa-thumbs-down"></i>`;
}


function setMessageFeedback(message, value) {

    message.feedback = value;


    /* Sincronizar con el objeto guardado en el chat (por si difiere la referencia) */
    const chat = getCurrentChat();

    if (chat) {
        const target = chat.messages.find(
            (item) => item.id === message.id
        );

        if (target) {
            target.feedback = value;
        }
    }

    saveChats();

    if (value === "like") {
        showToast("Gracias por tu feedback 👍");
    } else if (value === "dislike") {
        showToast("Gracias por tu feedback 👎");
    }
}


function copyMessageText(content, button) {

    if (!content) return;


    const finish = () => {
        const icon = button.querySelector("i");
        if (!icon) return;

        const original = icon.className;
        icon.className = "fa-solid fa-check";

        showToast("Mensaje copiado");

        setTimeout(() => {
            icon.className = original;
        }, 1500);
    };


    if (navigator.clipboard?.writeText) {

        navigator.clipboard.writeText(content)
            .then(finish)
            .catch(() => fallbackCopy(content, finish));

    } else {

        fallbackCopy(content, finish);
    }
}


function fallbackCopy(text, callback) {

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    try {
        document.execCommand("copy");
        callback?.();
    } catch (error) {
        console.error("No se pudo copiar:", error);
        showToast("No se pudo copiar el mensaje");
    }

    document.body.removeChild(textarea);
}


/* =========================================================
   MESSAGE CONTENT — MARKDOWN
   ========================================================= */

function unescapeMarkdown(text) {
    // Algunos modelos devuelven markdown "escapado" (\#, \|, \*...)
    // como si el destino fuera Telegram MarkdownV2 u otro canal.
    // Aquí quitamos ese backslash para que nuestro parser lo
    // interprete como markdown normal.
    return text.replace(/\\([#|_*`~\[\]()>\-.!{}=+])/g, "$1");
}

function renderMessageContent(element, content) {
    if (!element) return;

    element.innerHTML = "";

    if (!content) return;

    const blocks = unescapeMarkdown(content)
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}/);

    blocks.forEach((block) => {
        block = block.trim();

        if (!block) return;

        // Código
        const codeMatch = block.match(/^```([\w-]*)\n?([\s\S]*?)```$/);

        if (codeMatch) {
            const pre = document.createElement("pre");
            const code = document.createElement("code");

            if (codeMatch[1]) {
                code.dataset.language = codeMatch[1];
            }

            code.textContent = codeMatch[2].trim();

            pre.appendChild(code);
            element.appendChild(pre);
            return;
        }

        // Encabezados
        const headingMatch = block.match(/^(#{1,3})\s+(.+)$/);

        if (headingMatch) {
            const level = headingMatch[1].length;
            const heading = document.createElement(`h${level}`);

            appendInlineMarkdown(
                heading,
                headingMatch[2]
            );

            element.appendChild(heading);
            return;
        }

        // Tabla Markdown
        const lines = block.split("\n");

        if (
            lines.length >= 2 &&
            lines[0].includes("|") &&
            /^\s*\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/.test(lines[1])
        ) {
            renderMarkdownTable(element, lines);
            return;
        }

        // Lista
        if (lines.every(line => /^[-*+]\s+/.test(line))) {
            const ul = document.createElement("ul");

            lines.forEach(line => {
                const li = document.createElement("li");

                appendInlineMarkdown(
                    li,
                    line.replace(/^[-*+]\s+/, "")
                );

                ul.appendChild(li);
            });

            element.appendChild(ul);
            return;
        }

        // Lista numerada
        if (lines.every(line => /^\d+\.\s+/.test(line))) {
            const ol = document.createElement("ol");

            lines.forEach(line => {
                const li = document.createElement("li");

                appendInlineMarkdown(
                    li,
                    line.replace(/^\d+\.\s+/, "")
                );

                ol.appendChild(li);
            });

            element.appendChild(ol);
            return;
        }

        // Cita
        if (lines.every(line => /^>\s?/.test(line))) {
            const blockquote = document.createElement("blockquote");

            lines.forEach(line => {
                appendInlineMarkdown(
                    blockquote,
                    line.replace(/^>\s?/, "")
                );
            });

            element.appendChild(blockquote);
            return;
        }

        // Separador
        if (/^([-*_])\s*\1\s*\1\s*$/.test(block)) {
            const hr = document.createElement("hr");
            element.appendChild(hr);
            return;
        }

        // Párrafo normal
        const paragraph = document.createElement("p");

        lines.forEach((line, index) => {
            if (index > 0) {
                paragraph.appendChild(
                    document.createElement("br")
                );
            }

            appendInlineMarkdown(
                paragraph,
                line
            );
        });

        element.appendChild(paragraph);
    });
}


/* =========================================================
   INLINE MARKDOWN
   ========================================================= */

function appendInlineMarkdown(parent, text) {
    const fragment = document.createDocumentFragment();

    const regex =
        /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {

        if (match.index > lastIndex) {
            fragment.appendChild(
                document.createTextNode(
                    text.slice(lastIndex, match.index)
                )
            );
        }

        const token = match[0];

        // Negrita
        if (
            token.startsWith("**") &&
            token.endsWith("**")
        ) {
            const strong = document.createElement("strong");

            strong.textContent =
                token.slice(2, -2);

            fragment.appendChild(strong);
        }

        // Cursiva
        else if (
            token.startsWith("*") &&
            token.endsWith("*")
        ) {
            const em = document.createElement("em");

            em.textContent =
                token.slice(1, -1);

            fragment.appendChild(em);
        }

        // Código inline
        else if (token.startsWith("`")) {
            const code = document.createElement("code");

            code.textContent =
                token.slice(1, -1);

            fragment.appendChild(code);
        }

        // Enlace
        else {
            const linkMatch =
                token.match(/^\[(.*?)\]\((.*?)\)$/);

            if (linkMatch) {
                const a = document.createElement("a");

                a.textContent = linkMatch[1];
                a.href = linkMatch[2];
                a.target = "_blank";
                a.rel = "noopener noreferrer";

                fragment.appendChild(a);
            }
        }

        lastIndex =
            match.index + token.length;
    }

    if (lastIndex < text.length) {
        fragment.appendChild(
            document.createTextNode(
                text.slice(lastIndex)
            )
        );
    }

    parent.appendChild(fragment);
}


/* =========================================================
   MARKDOWN TABLE
   ========================================================= */

function renderMarkdownTable(parent, lines) {
    const table = document.createElement("table");
    table.className = "message-table";

    const header = lines[0]
        .split("|")
        .map(cell => cell.trim())
        .filter(Boolean);

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    header.forEach(cell => {
        const th = document.createElement("th");

        appendInlineMarkdown(th, cell);

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    lines.slice(2).forEach(line => {
        const cells = line
            .split("|")
            .map(cell => cell.trim())
            .filter(Boolean);

        if (!cells.length) return;

        const row = document.createElement("tr");

        cells.forEach(cell => {
            const td = document.createElement("td");

            appendInlineMarkdown(td, cell);

            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);

    const wrapper = document.createElement("div");
    wrapper.className = "message-table-wrapper";

    wrapper.appendChild(table);

    parent.appendChild(wrapper);
}


/* =========================================================
   SIMPLE FORMATTER
   ========================================================= */

function appendFormattedText(
    parent,
    text
) {

    const lines =
        text.split("\n");


    lines.forEach((line, index) => {

        if (index > 0) {
            parent.appendChild(
                document.createElement("br")
            );
        }


        const fragment =
            document.createDocumentFragment();


        /*
         * Negrita
         */
        const parts =
            line.split(/(\*\*.*?\*\*)/g);


        parts.forEach((part) => {

            if (
                part.startsWith("**") &&
                part.endsWith("**")
            ) {

                const strong =
                    document.createElement("strong");

                strong.textContent =
                    part.slice(2, -2);

                fragment.appendChild(
                    strong
                );

            } else {

                fragment.appendChild(
                    document.createTextNode(part)
                );
            }
        });


        parent.appendChild(fragment);
    });
}


/* =========================================================
   TYPING
   ========================================================= */

function appendTyping() {

    const article =
        document.createElement("article");

    article.className =
        "message assistant";


    const avatar =
        document.createElement("div");

    avatar.className =
        "message-avatar";


    avatar.innerHTML =
        `<img src="img/icon.png" alt="NexusAI" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`;


    const content =
        document.createElement("div");

    content.className =
        "message-content";


    const role =
        document.createElement("div");

    role.className =
        "message-role";

    role.textContent =
        "NexusAI";


    const typing =
        document.createElement("div");

    typing.className =
        "typing";


    typing.innerHTML =
        `
            <span></span>
            <span></span>
            <span></span>
        `;


    content.appendChild(role);
    content.appendChild(typing);

    article.appendChild(avatar);
    article.appendChild(content);

    messages.appendChild(article);


    scrollToBottom();


    return article;
}


/* =========================================================
   CHAT DISPLAY
   ========================================================= */

function showChat(chat) {

    currentChatId = chat.id;

    hideWelcome();

    messages.innerHTML = "";


    chat.messages.forEach((message) => {
        appendMessage(message);
    });


    renderChatList();

    scrollToBottom();
}


function showWelcome() {

    if (welcome) {
        welcome.style.display = "";
    }

    if (messages) {
        messages.innerHTML = "";
    }
}


function hideWelcome() {

    if (welcome) {
        welcome.style.display = "none";
    }
}


/* =========================================================
   CHAT LIST
   ========================================================= */

function renderChatList(filter = "") {

    if (!chatList) return;


    chatList.innerHTML = "";


    const normalized =
        filter.toLowerCase();


    const filtered =
        chats.filter((chat) => {

            return chat.title
                .toLowerCase()
                .includes(normalized);
        });


    if (
        filtered.length === 0
    ) {

        if (emptyHistory) {
            emptyHistory.style.display =
                "flex";
        }

        return;
    }


    if (emptyHistory) {
        emptyHistory.style.display =
            "none";
    }


    filtered.forEach((chat) => {

        const item =
            document.createElement("div");


        item.className =
            "chat-item";


        if (
            chat.id === currentChatId
        ) {
            item.classList.add("active");
        }


        item.dataset.id =
            chat.id;


        const icon =
            document.createElement("i");

        icon.className =
            "fa-regular fa-message";


        const title =
            document.createElement("span");

        title.className =
            "chat-item-title";

        title.textContent =
            chat.title;


        const menu =
            document.createElement("button");

        menu.className =
            "chat-item-menu";

        menu.type =
            "button";

        menu.title =
            "Opciones";

        menu.innerHTML =
            `<i class="fa-solid fa-ellipsis"></i>`;


        item.appendChild(icon);
        item.appendChild(title);
        item.appendChild(menu);


        item.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.closest(
                        ".chat-item-menu"
                    )
                ) {

                    openContextMenu(
                        event,
                        chat.id
                    );

                    return;
                }


                openChat(chat.id);

                closeMobileSidebar();
            }
        );


        chatList.appendChild(item);
    });
}


/* =========================================================
   OPEN CHAT
   ========================================================= */

function openChat(id) {

    const chat =
        chats.find(
            (item) => item.id === id
        );


    if (!chat) return;


    currentChatId = id;

    showChat(chat);

    messageInput.focus();
}


/* =========================================================
   CONTEXT MENU
   ========================================================= */

function openContextMenu(
    event,
    chatId
) {

    event.preventDefault();
    event.stopPropagation();


    selectedChatId =
        chatId;


    contextMenu.classList.add(
        "active"
    );


    const rect =
        contextMenu.getBoundingClientRect();


    let x =
        event.clientX;

    let y =
        event.clientY;


    if (
        x + rect.width >
        window.innerWidth
    ) {
        x =
            window.innerWidth -
            rect.width -
            10;
    }


    if (
        y + rect.height >
        window.innerHeight
    ) {
        y =
            window.innerHeight -
            rect.height -
            10;
    }


    contextMenu.style.left =
        `${Math.max(10, x)}px`;

    contextMenu.style.top =
        `${Math.max(10, y)}px`;
}


function closeContextMenu() {

    if (!contextMenu) return;

    contextMenu.classList.remove(
        "active"
    );

    selectedChatId = null;
}


function handleContextAction(event) {

    const button =
        event.target.closest(
            "button"
        );


    if (!button) return;


    const action =
        button.dataset.action;


    if (!selectedChatId) return;


    if (action === "rename") {
        renameChat(selectedChatId);
    }


    if (action === "delete") {
        deleteChat(selectedChatId);
    }


    closeContextMenu();
}


/* =========================================================
   RENAME CHAT
   ========================================================= */

function renameChat(id) {

    const chat =
        chats.find(
            (item) => item.id === id
        );


    if (!chat) return;


    const newTitle =
        window.prompt(
            "Nuevo nombre de la conversación:",
            chat.title
        );


    if (
        newTitle === null
    ) {
        return;
    }


    const cleanTitle =
        newTitle.trim();


    if (!cleanTitle) {
        showToast("El nombre no puede estar vacío");
        return;
    }


    chat.title =
        cleanTitle.slice(0, 80);

    chat.updatedAt =
        Date.now();


    saveChats();
    renderChatList();

    showToast("Conversación renombrada");
}


/* =========================================================
   DELETE CHAT
   ========================================================= */

function deleteChat(id) {

    const index =
        chats.findIndex(
            (chat) => chat.id === id
        );


    if (index === -1) return;


    chats.splice(index, 1);


    if (
        currentChatId === id
    ) {

        currentChatId =
            null;

        showWelcome();
    }


    saveChats();
    renderChatList();

    showToast("Conversación eliminada");
}


/* =========================================================
   DELETE ALL
   ========================================================= */

function openDeleteModal() {

    if (chats.length === 0) {
        showToast("No hay conversaciones para borrar");
        return;
    }


    modalBackdrop.classList.add(
        "active"
    );
}


function closeDeleteModal() {

    modalBackdrop?.classList.remove(
        "active"
    );
}


function clearAllChats() {

    chats = [];

    currentChatId = null;

    saveChats();

    renderChatList();

    showWelcome();

    closeDeleteModal();

    showToast("Historial eliminado");
}


/* =========================================================
   SEARCH
   ========================================================= */

function openSearch() {

    if (!searchBox) return;


    searchBox.classList.add(
        "active"
    );


    searchToggle.style.display =
        "none";


    setTimeout(() => {
        chatSearch?.focus();
    }, 50);
}


function closeSearchBox() {

    if (!searchBox) return;


    searchBox.classList.remove(
        "active"
    );


    searchToggle.style.display =
        "";


    if (chatSearch) {
        chatSearch.value = "";
    }


    renderChatList();
}


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function openMobileSidebar() {

    sidebar?.classList.add(
        "open"
    );

    sidebarOverlay?.classList.add(
        "active"
    );
}


function closeMobileSidebar() {

    sidebar?.classList.remove(
        "open"
    );

    sidebarOverlay?.classList.remove(
        "active"
    );
}


/* =========================================================
   THEME
   ========================================================= */

function loadTheme() {

    const saved =
        localStorage.getItem(
            THEME_KEY
        );


    if (saved === "dark") {

        document.documentElement
            .setAttribute(
                "data-theme",
                "dark"
            );

        updateThemeIcon(true);

    } else {

        document.documentElement
            .removeAttribute(
                "data-theme"
            );

        updateThemeIcon(false);
    }
}


function toggleTheme() {

    const dark =
        document.documentElement
            .getAttribute(
                "data-theme"
            ) === "dark";


    if (dark) {

        document.documentElement
            .removeAttribute(
                "data-theme"
            );

        localStorage.setItem(
            THEME_KEY,
            "light"
        );

        updateThemeIcon(false);

        showToast("Modo claro activado");

    } else {

        document.documentElement
            .setAttribute(
                "data-theme",
                "dark"
            );

        localStorage.setItem(
            THEME_KEY,
            "dark"
        );

        updateThemeIcon(true);

        showToast("Modo oscuro activado");
    }
}


function updateThemeIcon(isDark) {

    if (!themeBtn) return;


    const icon =
        themeBtn.querySelector("i");


    if (!icon) return;


    icon.className =
        isDark
            ? "fa-solid fa-sun"
            : "fa-solid fa-moon";
}


/* =========================================================
   FILES
   ========================================================= */

function handleFile(event) {

    const file =
        event.target.files?.[0];


    if (!file) return;


    selectedFile = file;


    renderAttachment(file);
}


function renderAttachment(file) {

    if (!attachmentPreview) return;


    attachmentPreview.innerHTML = "";


    const chip =
        document.createElement("div");


    chip.className =
        "attachment-chip";


    const icon =
        document.createElement("i");


    icon.className =
        "fa-solid fa-paperclip";


    const name =
        document.createElement("span");


    name.textContent =
        file.name;


    const remove =
        document.createElement("button");


    remove.type =
        "button";

    remove.style.marginLeft =
        "auto";

    remove.style.background =
        "transparent";

    remove.style.color =
        "inherit";

    remove.style.cursor =
        "pointer";

    remove.innerHTML =
        `<i class="fa-solid fa-xmark"></i>`;


    remove.addEventListener(
        "click",
        clearAttachment
    );


    chip.appendChild(icon);
    chip.appendChild(name);
    chip.appendChild(remove);


    attachmentPreview.appendChild(
        chip
    );
}


function clearAttachment() {

    selectedFile = null;


    if (fileInput) {
        fileInput.value = "";
    }


    if (attachmentPreview) {
        attachmentPreview.innerHTML =
            "";
    }
}


/* =========================================================
   TEXTAREA
   ========================================================= */

function autoResizeTextarea() {

    if (!messageInput) return;


    messageInput.style.height =
        "auto";


    const height =
        Math.min(
            messageInput.scrollHeight,
            180
        );


    messageInput.style.height =
        `${height}px`;
}


function updateSendButton() {

    if (!sendBtn) return;


    const hasText =
        messageInput?.value.trim()
            .length > 0;


    sendBtn.disabled =
        !hasText ||
        isGenerating;
}


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {

    if (!conversation) return;


    requestAnimationFrame(() => {

        conversation.scrollTo({
            top:
                conversation.scrollHeight,
            behavior:
                "smooth"
        });

    });
}


/* =========================================================
   STORAGE
   ========================================================= */

function loadChats() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );


        if (!saved) {
            chats = [];
            return;
        }


        const parsed =
            JSON.parse(saved);


        chats =
            Array.isArray(parsed)
                ? parsed
                : [];


    } catch (error) {

        console.error(
            "No se pudo cargar el historial:",
            error
        );

        chats = [];
    }
}


function saveChats() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(chats)
        );

    } catch (error) {

        console.error(
            "No se pudo guardar el historial:",
            error
        );
    }
}


/* =========================================================
   HELPERS
   ========================================================= */

function getCurrentChat() {

    return chats.find(
        (chat) =>
            chat.id === currentChatId
    );
}


function generateId() {

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );
}


function createChatTitle(text) {

    const clean =
        text
            .replace(/\s+/g, " ")
            .trim();


    if (!clean) {
        return "Nueva conversación";
    }


    if (clean.length <= 38) {
        return clean;
    }


    return (
        clean.substring(0, 38) +
        "..."
    );
}


function getUserName() {

    const value =
        userName?.textContent?.trim();


    return value ||
        "Usuario";
}


function getUserInitial() {

    const name =
        getUserName();


    return name
        .charAt(0)
        .toUpperCase();
}

/* =========================================================
   USER AUTH
========================================================= */

const AUTH_API = "https://nexus-ai-api-iwqr.onrender.com/api";

// Guarda/lee el token en localStorage. Esto evita depender
// solo de la cookie cross-site, que Chrome/Firefox/Safari
// pueden bloquear por ser de "tercero" (frontend y backend
// están en dominios distintos: netlify.app vs onrender.com).
function getAuthToken() {
    return localStorage.getItem("nexusai_token");
}

function setAuthToken(token) {
    if (token) {
        localStorage.setItem("nexusai_token", token);
    }
}

async function loadUser() {

    const params = new URLSearchParams(window.location.search);
    const userParam = params.get("user");
    const tokenParam = params.get("token");

    // Si venimos de la redirección de Google OAuth, el token
    // llega por query string: lo guardamos y limpiamos la URL.
    if (tokenParam) {
        setAuthToken(tokenParam);

        params.delete("token");
        params.delete("user");

        const newUrl =
            window.location.pathname +
            (params.toString() ? `?${params.toString()}` : "");

        window.history.replaceState({}, "", newUrl);
    }

    const token = getAuthToken();

    // Sin token guardado: no hay sesión, directo al login.
    if (!token) {
        window.location.href = "index.html";
        return;
    }

    try {
        const response = await fetch(
            `${AUTH_API}/auth/me`,
            {
                method: "GET",
                credentials: "include",
                headers: token
                    ? { Authorization: `Bearer ${token}` }
                    : {}
            }
        );

        if (!response.ok) {
    let errorData = {};

    try {
        errorData = await response.json();
    } catch {
        errorData = {};
    }

    console.error("AUTH /ME ERROR:", response.status, errorData);

    // No hay sesión válida: fuera de aquí, al login.
    localStorage.removeItem("nexusai_token");
    localStorage.removeItem("nexusai_user");
    window.location.href = "index.html";
    return;
}

        const data = await response.json();

        if (!data.success || !data.user) {
            localStorage.removeItem("nexusai_token");
            localStorage.removeItem("nexusai_user");
            window.location.href = "index.html";
            return;
        }

        const user = data.user;

        if (userName) {
            userName.textContent = user.name || "Usuario";
        }

        if (userEmail) {
            userEmail.textContent = user.email || "NexusAI";
        }

        if (userAvatar) {
            userAvatar.textContent =
                (user.name || "U").charAt(0).toUpperCase();
        }

        // Guardar datos públicos del usuario
        localStorage.setItem(
            "nexusai_user",
            JSON.stringify({
                id: user.id,
                name: user.name,
                email: user.email
            })
        );

    } catch (error) {
        console.error("Error cargando usuario:", error);
    }
}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;


function showToast(message) {

    if (!toast) return;


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 2200);
}


/* =========================================================
   WINDOW RESIZE
   ========================================================= */

window.addEventListener(
    "resize",
    () => {

        if (
            window.innerWidth > 700
        ) {
            closeMobileSidebar();
        }
    }
);


/* =========================================================
   CLOSE MODAL BY BACKDROP
   ========================================================= */

modalBackdrop?.addEventListener(
    "click",
    (event) => {

        if (
            event.target ===
            modalBackdrop
        ) {
            closeDeleteModal();
        }
    }
);


/* =========================================================
   NEXUSAI READY
   ========================================================= */

console.log(
    "%cNexusAI",
    "color:#2563eb;font-size:20px;font-weight:700;"
);

console.log(
    "NexusAI frontend inicializado correctamente."
);

/* =========================================
   SIDEBAR PC
========================================= */

const desktopSidebarToggle =
    document.getElementById("desktopSidebarToggle");

if (desktopSidebarToggle) {

    desktopSidebarToggle.addEventListener("click", () => {

        if (window.innerWidth < 769) return;

        document.body.classList.toggle(
            "sidebar-collapsed"
        );

        const collapsed =
            document.body.classList.contains(
                "sidebar-collapsed"
            );

        localStorage.setItem(
            "nexusai_sidebar_collapsed",
            collapsed
        );

        desktopSidebarToggle.setAttribute(
            "aria-label",
            collapsed
                ? "Abrir barra lateral"
                : "Cerrar barra lateral"
        );
    });
}


/* Recuperar estado */

if (
    window.innerWidth >= 769 &&
    localStorage.getItem(
        "nexusai_sidebar_collapsed"
    ) === "true"
) {

    document.body.classList.add(
        "sidebar-collapsed"
    );
}


/* =========================================================
   MENÚ DE USUARIO (⋯) Y AJUSTES
   ========================================================= */

const SETTINGS_KEY = "nexusai_settings";

const userMoreBtn = $("#userMoreBtn");
const userMenu = $("#userMenu");

const settingsBackdrop = $("#settingsBackdrop");
const closeSettingsBtn = $("#closeSettings");

const settingsTabs = $("#settingsTabs");
const settingsPanels = $$(".settings-panel");

// General
const settingsThemeSelect = $("#settingsThemeSelect");
const settingsLangSelect = $("#settingsLangSelect");
const settingsPromptCards = $("#settingsPromptCards");

// Personalización
const settingsNickname = $("#settingsNickname");
const settingsCustomInstructions = $("#settingsCustomInstructions");
const savePersonalizationBtn = $("#savePersonalizationBtn");

// Cuenta
const settingsNameForm = $("#settingsNameForm");
const settingsName = $("#settingsName");
const settingsNameBtn = $("#settingsNameBtn");

const settingsPasswordForm = $("#settingsPasswordForm");
const settingsCurrentPassword = $("#settingsCurrentPassword");
const settingsNewPassword = $("#settingsNewPassword");
const settingsPasswordBtn = $("#settingsPasswordBtn");

const deleteAccountBtn = $("#deleteAccountBtn");

// Datos
const exportChatsBtn = $("#exportChatsBtn");
const deleteAllChatsFromSettingsBtn = $("#deleteAllChatsFromSettingsBtn");


function getSettings() {
    try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch {
        return {};
    }
}

function saveSettings(patch) {
    const current = getSettings();
    const updated = { ...current, ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
}

function getCustomInstructions() {
    const settings = getSettings();
    return {
        nickname: settings.nickname || "",
        instructions: settings.instructions || ""
    };
}


// --- Abrir / cerrar menú (⋯) ---

userMoreBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    userMenu?.classList.toggle("active");
});

document.addEventListener("click", (event) => {
    if (
        userMenu &&
        !userMenu.contains(event.target) &&
        event.target !== userMoreBtn
    ) {
        userMenu.classList.remove("active");
    }
});


// --- Acciones del menú ---

userMenu?.addEventListener("click", (event) => {

    const button = event.target.closest("button[data-action]");
    if (!button) return;

    userMenu.classList.remove("active");

    if (button.dataset.action === "settings") {
        openSettingsModal();
    }

    if (button.dataset.action === "logout") {
        handleLogout();
    }
});


// --- Pestañas ---

settingsTabs?.addEventListener("click", (event) => {

    const tabBtn = event.target.closest(".settings-tab");
    if (!tabBtn) return;

    const target = tabBtn.dataset.tab;

    $$(".settings-tab").forEach((tab) => {
        tab.classList.toggle("active", tab === tabBtn);
    });

    settingsPanels.forEach((panel) => {
        panel.classList.toggle(
            "active",
            panel.dataset.panel === target
        );
    });
});


// --- Abrir / cerrar modal ---

function openSettingsModal() {

    const savedUser = JSON.parse(
        localStorage.getItem("nexusai_user") || "null"
    );

    const settings = getSettings();

    // General
    const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";

    if (settingsThemeSelect) settingsThemeSelect.value = isDark ? "dark" : "light";
    if (settingsLangSelect) settingsLangSelect.value = settings.lang || "es";
    if (settingsPromptCards) {
        settingsPromptCards.checked = settings.showPromptCards !== false;
    }

    // Personalización
    if (settingsNickname) settingsNickname.value = settings.nickname || "";
    if (settingsCustomInstructions) {
        settingsCustomInstructions.value = settings.instructions || "";
    }

    // Cuenta
    if (settingsName) {
        settingsName.value =
            savedUser?.name ||
            userName?.textContent.trim() ||
            "";
    }

    if (settingsCurrentPassword) settingsCurrentPassword.value = "";
    if (settingsNewPassword) settingsNewPassword.value = "";

    settingsBackdrop?.classList.add("active");
}

function closeSettingsModal() {
    settingsBackdrop?.classList.remove("active");
}

closeSettingsBtn?.addEventListener("click", closeSettingsModal);

settingsBackdrop?.addEventListener("click", (event) => {
    if (event.target === settingsBackdrop) {
        closeSettingsModal();
    }
});


/* =========================================================
   GENERAL
   ========================================================= */

settingsThemeSelect?.addEventListener("change", () => {

    const wantDark = settingsThemeSelect.value === "dark";
    const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";

    if (wantDark !== isDark) {
        toggleTheme();
    }
});

settingsLangSelect?.addEventListener("change", () => {
    saveSettings({ lang: settingsLangSelect.value });
    showToast("Idioma guardado (próximamente disponible)");
});

settingsPromptCards?.addEventListener("change", () => {

    const show = settingsPromptCards.checked;

    saveSettings({ showPromptCards: show });

    const promptGrid = document.querySelector(".prompt-grid");

    if (promptGrid) {
        promptGrid.style.display = show ? "" : "none";
    }
});


/* =========================================================
   PERSONALIZACIÓN
   ========================================================= */

savePersonalizationBtn?.addEventListener("click", () => {

    saveSettings({
        nickname: settingsNickname.value.trim(),
        instructions: settingsCustomInstructions.value.trim()
    });

    showToast("Personalización guardada");
});


/* =========================================================
   CUENTA
   ========================================================= */

settingsNameForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    const name = settingsName.value.trim();

    if (!name) {
        showToast("El nombre no puede estar vacío");
        return;
    }

    const token = getAuthToken();

    settingsNameBtn.disabled = true;

    try {

        const response = await fetch(
            `${AUTH_API}/user/name`,
            {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ name })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.message || "No se pudo actualizar el nombre");
            return;
        }

        if (userName) userName.textContent = data.user.name;

        if (userAvatar) {
            userAvatar.textContent =
                (data.user.name || "U").charAt(0).toUpperCase();
        }

        localStorage.setItem(
            "nexusai_user",
            JSON.stringify(data.user)
        );

        showToast("Nombre actualizado");

    } catch (error) {
        console.error("Update name error:", error);
        showToast("No se pudo conectar con el servidor");

    } finally {
        settingsNameBtn.disabled = false;
    }
});


settingsPasswordForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    const currentPassword = settingsCurrentPassword.value;
    const newPassword = settingsNewPassword.value;

    if (newPassword.length < 8) {
        showToast("La nueva contraseña debe tener al menos 8 caracteres");
        return;
    }

    const token = getAuthToken();

    settingsPasswordBtn.disabled = true;

    try {

        const response = await fetch(
            `${AUTH_API}/user/password`,
            {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ currentPassword, newPassword })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.message || "No se pudo actualizar la contraseña");
            return;
        }

        settingsPasswordForm.reset();
        showToast("Contraseña actualizada");

    } catch (error) {
        console.error("Update password error:", error);
        showToast("No se pudo conectar con el servidor");

    } finally {
        settingsPasswordBtn.disabled = false;
    }
});


deleteAccountBtn?.addEventListener("click", async () => {

    const confirmed = window.confirm(
        "¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    const token = getAuthToken();

    try {

        const response = await fetch(
            `${AUTH_API}/user`,
            {
                method: "DELETE",
                credentials: "include",
                headers: token
                    ? { Authorization: `Bearer ${token}` }
                    : {}
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.message || "No se pudo eliminar la cuenta");
            return;
        }

        localStorage.removeItem("nexusai_token");
        localStorage.removeItem("nexusai_user");

        window.location.href = "index.html";

    } catch (error) {
        console.error("Delete account error:", error);
        showToast("No se pudo conectar con el servidor");
    }
});


/* =========================================================
   DATOS
   ========================================================= */

exportChatsBtn?.addEventListener("click", () => {

    if (!chats || chats.length === 0) {
        showToast("No hay conversaciones para exportar");
        return;
    }

    const blob = new Blob(
        [JSON.stringify(chats, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "nexusai-conversaciones.json";
    link.click();

    URL.revokeObjectURL(url);

    showToast("Conversaciones exportadas");
});

deleteAllChatsFromSettingsBtn?.addEventListener("click", () => {
    closeSettingsModal();
    openDeleteModal();
});


// --- Cerrar sesión ---

async function handleLogout() {

    const token = getAuthToken();

    try {
        await fetch(
            `${AUTH_API}/auth/logout`,
            {
                method: "POST",
                credentials: "include",
                headers: token
                    ? { Authorization: `Bearer ${token}` }
                    : {}
            }
        );
    } catch (error) {
        console.error("Logout error:", error);
    }

    localStorage.removeItem("nexusai_token");
    localStorage.removeItem("nexusai_user");

    window.location.href = "index.html";
}


// --- Aplicar preferencia de tarjetas de inicio al cargar ---

(function applyStoredGeneralSettings() {
    const settings = getSettings();

    if (settings.showPromptCards === false) {
        const promptGrid = document.querySelector(".prompt-grid");
        if (promptGrid) promptGrid.style.display = "none";
    }
})();