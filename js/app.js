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
const API_URL = "";


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
        history: chat.messages
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

    article.appendChild(avatar);
    article.appendChild(content);

    messages.appendChild(article);


    scrollToBottom();
}


/* =========================================================
   MESSAGE CONTENT
   ========================================================= */

function renderMessageContent(element, content) {

    /*
     * Separamos bloques de código simples para evitar
     * mostrar todo como texto plano.
     */

    const codeRegex =
        /```([\w-]*)\n?([\s\S]*?)```/g;


    let lastIndex = 0;
    let match;


    while ((match = codeRegex.exec(content)) !== null) {

        const before =
            content.slice(
                lastIndex,
                match.index
            );


        if (before) {
            appendFormattedText(
                element,
                before
            );
        }


        const pre =
            document.createElement("pre");

        const code =
            document.createElement("code");


        code.textContent = match[2].trim();

        pre.appendChild(code);

        element.appendChild(pre);


        lastIndex =
            match.index +
            match[0].length;
    }


    const remaining =
        content.slice(lastIndex);


    if (remaining) {
        appendFormattedText(
            element,
            remaining
        );
    }
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

async function loadUser() {
    try {
        const response = await fetch(
            `${AUTH_API}/auth/me`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            console.warn("No hay una sesión activa.");
            return;
        }

        const data = await response.json();

        if (!data.success || !data.user) {
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