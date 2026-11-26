const bodyHidden = () => {
    document.querySelector('body').style.overflow = 'hidden';
}

const bodyVisible = () => {
    document.querySelector('body').style.overflow = 'visible';
}

const phoneInp = document.querySelectorAll('input[type="tel"]');

if (phoneInp.length) {
    phoneInp.forEach(el => {
        IMask(el, {
            mask: '+{7}(000) 000-00-00',
        })
    });
}

// ===== Клавиатура =====

// Viewport balandligi: klaviatura ochilganda input uning ustida, tabbar esa yashirin turadi
const screenEl = document.querySelector("[data-screen]");
if (screenEl && window.visualViewport) {
  let fullHeight = window.visualViewport.height;
  let lastWidth = window.innerWidth;

  const updateViewport = () => {
    const height = window.visualViewport.height;
    if (window.visualViewport.scale > 1) return;
    if (window.innerWidth !== lastWidth) {
      lastWidth = window.innerWidth;
      fullHeight = height;
    }
    fullHeight = Math.max(fullHeight, height);
    const isInput = document.activeElement && document.activeElement.matches("input, textarea");
    const isKeyboard = isInput && fullHeight - height > 150;
    screenEl.classList.toggle("is-keyboard", isKeyboard);
    document.documentElement.style.setProperty("--app-height", `${height}px`);
    if (isKeyboard) window.scrollTo(0, 0);
  };

  window.visualViewport.addEventListener("resize", updateViewport, { passive: true });
  updateViewport();
}
// Клавиатура end

// ===== Компоненты =====

// Tab-Selector: chap/o'ng holat
document.querySelectorAll("[data-tabs]").forEach((tabs) => {
  const buttons = tabs.querySelectorAll("[data-tabs-btn]");
  buttons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      tabs.classList.toggle("is-right", index === 1);
      buttons.forEach((item) => item.setAttribute("aria-pressed", item === btn));
    });
  });
});

// Type-Input: maydonni tozalash; mousedown fokusni yo'qotmaslik uchun
document.querySelectorAll("[data-field-clear]").forEach((btn) => {
  btn.addEventListener("mousedown", (event) => event.preventDefault());
  btn.addEventListener("click", () => {
    const input = btn.closest("[data-field]").querySelector("input");
    input.value = "";
    input.focus();
  });
});

// Btn-Activate: yoqish/o'chirish (demo, backend yo'q)
document.querySelectorAll("[data-power]").forEach((btn) => {
  const status = btn.parentElement.querySelector("[data-power-status]");
  btn.addEventListener("click", () => {
    const isActive = btn.classList.toggle("is-active");
    btn.setAttribute("aria-pressed", isActive);
    if (status) status.textContent = isActive ? "Активен" : "Неактивен";
  });
});
// Компоненты end

// ===== Чат поддержки =====

// demo, backend yo'q: operator javoblari navbat bilan ko'rsatiladi
const CHAT_REPLIES = [
  { type: "text", text: "Не мороси..." },
  { type: "instruction" },
  { type: "photo", text: "Посмотрите фото", src: "./assets/images/photo-plane.jpg" },
  { type: "photo", text: "Посмотрите фото", src: "./assets/images/photo-plane-vertical.jpg", isVertical: true },
];
const CHAT_UNREAD = "Доброе утро! Покажите, пожалуйста, скриншот с открытым приложением ВПН.";
const CHAT_DELAY = { send: 800, error: 3000, read: 2000, typing: 2000, photo: 1800, unread: 5000 };

const chat = document.querySelector("[data-chat]");
if (chat) {
  const list = chat.querySelector("[data-chat-list]");
  const btnDown = document.querySelector("[data-chat-down]");
  const pillDown = btnDown.querySelector("[data-chat-pill]");
  const status = document.querySelector("[data-chat-status]");
  const statusText = document.querySelector("[data-chat-status-text]");
  const btnInfo = document.querySelector("[data-info-open]");
  const composer = document.querySelector("[data-composer]");
  const field = composer.querySelector("[data-composer-field]");
  const input = composer.querySelector("[data-composer-input]");
  const btnSend = composer.querySelector("[data-composer-send]");
  const btnClip = composer.querySelector("[data-composer-clip]");
  const btnEmoji = composer.querySelector("[data-composer-emoji]");
  const replyBox = composer.querySelector("[data-composer-reply]");
  const replyQuote = composer.querySelector("[data-composer-quote]");
  const emojiPanel = document.querySelector("[data-emoji]");
  const layer = document.querySelector("[data-menu]");
  const photosInput = document.querySelector("[data-photos]");
  const fileInput = document.querySelector("[data-file]");
  const cameraInput = document.querySelector("[data-camera]");
  // demo: chat.html#error da va internet yo'qligida yuborish xato bilan tugaydi
  const hasError = () => window.location.hash === "#error" || !navigator.onLine;
  let replyTarget = null;
  let menuTarget = null;
  let unreadCount = 0;
  let replyIndex = 0;
  let lastScroll = 0;

  const getTime = () => new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const getDistance = () => chat.scrollHeight - chat.scrollTop - chat.clientHeight;
  const cloneTemplate = (name) => document.querySelector(`[data-template="${name}"]`).content.firstElementChild.cloneNode(true);
  const getText = (el) => {
    const label = el.querySelector("[data-message-text]");
    return label && !label.hidden ? label.innerText.trim() : "Фото";
  };

  const scrollDown = (behavior = "smooth") => chat.scrollTo({ top: chat.scrollHeight, behavior });

  const updatePill = (count) => {
    unreadCount = count;
    pillDown.textContent = count;
    pillDown.hidden = !count;
  };

  const updateMark = (el, name) => {
    const mark = el.querySelector("[data-mark]");
    if (mark) mark.className = `receipt receipt--${name}`;
    el.classList.toggle("is-error", name === "error");
  };

  // Ketma-ket xabarlar bitta guruhda turadi
  const getGroup = (side) => {
    const last = list.lastElementChild;
    if (last && last.dataset.group === side) return last;
    const group = document.createElement("div");
    group.className = `message-group message-group--${side}`;
    group.dataset.group = side;
    list.append(group);
    return group;
  };

  const addItem = (el, side) => {
    const isNear = getDistance() < 100;
    el.classList.add("is-new");
    getGroup(side).append(el);
    if (side === "user" || isNear) {
      scrollDown();
    } else {
      updatePill(unreadCount + 1);
      btnDown.classList.add("is-visible");
    }
    return el;
  };

  const removeItem = (el) => {
    el.classList.add("is-removed");
    setTimeout(() => {
      const group = el.parentElement;
      el.remove();
      if (group && !group.children.length) group.remove();
    }, 200);
  };

  const setReply = (el, quote) => {
    const reply = el.querySelector("[data-message-reply]");
    const isPhoto = quote === "Фото";
    reply.hidden = false;
    reply.querySelector("[data-message-label]").hidden = !isPhoto;
    reply.querySelector("[data-message-quote]").textContent = quote;
    el.classList.add("message--reply");
  };

  const createMessage = (side, text, quote) => {
    const el = cloneTemplate(`message-${side}`);
    el.querySelector("[data-message-text]").textContent = text;
    el.querySelector("[data-time]").textContent = getTime();
    if (quote) setReply(el, quote);
    return el;
  };

  const showStatus = (text) => {
    statusText.textContent = text;
    status.hidden = !text;
  };

  // demo: operator navbatdagi javobni yuboradi
  let isAnswering = false;
  const answer = () => {
    const reply = CHAT_REPLIES[replyIndex];
    if (isAnswering || !reply) return;
    isAnswering = true;
    replyIndex += 1;
    showStatus(reply.type === "photo" ? "загружает фото" : "печатает");
    setTimeout(() => {
      showStatus("");
      isAnswering = false;
      if (reply.type === "instruction") {
        const el = cloneTemplate("message-instruction");
        el.querySelector("[data-time]").textContent = getTime();
        addItem(el, "support");
        btnInfo.classList.remove("is-hidden");
        return;
      }
      addItem(createMessage("support", reply.text), "support");
      if (reply.type === "photo") {
        const photo = cloneTemplate("photo-support");
        photo.querySelector("img").src = reply.src;
        photo.querySelector("[data-time]").textContent = getTime();
        photo.classList.toggle("photo--vertical", !!reply.isVertical);
        addItem(photo, "support");
      }
    }, CHAT_DELAY.typing);
  };

  // Yuborish holatlari: soat → bitta belgi → ikkita belgi yoki xato
  const sendItem = (el) => {
    updateMark(el, "loading");
    const isPhoto = el.matches("[data-photo]");
    if (isPhoto) el.classList.add("is-loading");
    clearTimeout(el.sendTimer);
    const isError = hasError();
    const delay = isError ? CHAT_DELAY.error : isPhoto ? CHAT_DELAY.photo : CHAT_DELAY.send;
    el.sendTimer = setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-loading");
      updateMark(el, isError ? "error" : "one");
      if (isError) return;
      setTimeout(() => {
        updateMark(el, "two");
        answer();
      }, CHAT_DELAY.read);
    }, delay);
  };

  const closeReply = () => {
    replyTarget = null;
    replyBox.hidden = true;
  };

  const updateInput = () => {
    field.dataset.value = input.value;
    const isTyping = !!input.value.trim();
    composer.classList.toggle("is-typing", isTyping);
    btnSend.tabIndex = isTyping ? 0 : -1;
    btnClip.tabIndex = isTyping ? -1 : 0;
    field.scrollTop = field.scrollHeight;
  };

  const toggleEmoji = (isOpen) => {
    emojiPanel.classList.toggle("is-open", isOpen);
    emojiPanel.inert = !isOpen;
    screenEl.classList.toggle("is-emoji", isOpen);
    btnEmoji.setAttribute("aria-label", isOpen ? "Клавиатура" : "Эмодзи");
    btnEmoji.firstElementChild.className = `icon icon--${isOpen ? "keyboard" : "emoji"}`;
    if (isOpen) setTimeout(scrollDown, 200);
  };

  const sendMessage = () => {
    const text = input.value.trim();
    if (!text) return;
    const el = createMessage("user", text, replyTarget ? getText(replyTarget) : "");
    input.value = "";
    closeReply();
    updateInput();
    addItem(el, "user");
    sendItem(el);
  };

  const sendPhoto = (src) => {
    const photo = cloneTemplate("photo-user");
    const img = photo.querySelector("img");
    img.addEventListener("load", () => scrollDown(), { once: true });
    img.src = src;
    photo.querySelector("[data-time]").textContent = getTime();
    addItem(photo, "user");
    sendItem(photo);
  };

  input.addEventListener("input", updateInput);
  input.addEventListener("focus", () => {
    toggleEmoji(false);
    setTimeout(scrollDown, 300);
  });
  input.addEventListener("keydown", (event) => {
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (event.key !== "Enter" || event.shiftKey || isTouch || event.isComposing) return;
    event.preventDefault();
    sendMessage();
  });
  btnSend.addEventListener("mousedown", (event) => event.preventDefault());
  btnSend.addEventListener("click", sendMessage);
  composer.querySelector("[data-composer-cancel]").addEventListener("click", closeReply);

  btnEmoji.addEventListener("click", () => {
    const isOpen = !emojiPanel.classList.contains("is-open");
    if (isOpen) {
      input.blur();
      toggleEmoji(true);
    } else {
      toggleEmoji(false);
      input.focus();
    }
  });

  emojiPanel.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-emoji-btn]");
    if (!btn) return;
    const el = createMessage("user", btn.textContent.trim());
    el.classList.add("message--emoji");
    addItem(el, "user");
    sendItem(el);
  });

  // Меню сообщения
  const closeMenu = () => {
    layer.classList.remove("is-open");
    if (menuTarget) menuTarget.focus({ preventScroll: true });
    menuTarget = null;
  };

  const openMenu = (el) => {
    const isError = el.classList.contains("is-error");
    const isUser = el.closest("[data-group]").dataset.group === "user";
    const menu = layer.querySelector("[data-menu-box]");
    const clone = el.cloneNode(true);
    menuTarget = el;
    clone.classList.remove("is-new");
    clone.classList.toggle("message--next", el.matches("[data-message]") && !!el.previousElementSibling);
    clone.removeAttribute("tabindex");
    layer.querySelector("[data-menu-clone]").replaceChildren(clone);
    layer.querySelectorAll("[data-menu-error]").forEach((btn) => { btn.hidden = !isError; });
    layer.querySelectorAll("[data-menu-reply]").forEach((btn) => { btn.hidden = isError; });
    const rect = el.getBoundingClientRect();
    layer.classList.toggle("is-short", !isUser && rect.width < menu.offsetWidth + 10);
    layer.style.setProperty("--menu-width", `${rect.width}px`);
    const height = layer.querySelector("[data-menu-wrap]").offsetHeight;
    layer.style.setProperty("--menu-left", `${rect.left}px`);
    layer.style.setProperty("--menu-top", `${Math.max(10, Math.min(rect.top, window.innerHeight - height - 10))}px`);
    layer.classList.add("is-open");
    menu.querySelector("button:not([hidden])").focus({ preventScroll: true });
  };

  const actions = {
    reply: (el) => {
      replyTarget = el;
      replyQuote.textContent = getText(el);
      replyBox.hidden = false;
      input.focus();
    },
    copy: (el) => {
      if (navigator.clipboard) navigator.clipboard.writeText(getText(el)).catch(() => {});
    },
    retry: (el) => sendItem(el),
    cancel: (el) => removeItem(el),
  };

  layer.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    const el = menuTarget;
    closeMenu();
    if (btn && el) actions[btn.dataset.action](el);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuTarget) closeMenu();
  });

  // Просмотр фото
  const viewer = document.querySelector("[data-viewer]");
  const viewerImg = viewer.querySelector("[data-viewer-img]");
  let viewerTarget = null;

  const openViewer = (photo) => {
    viewerTarget = photo;
    viewerImg.src = photo.querySelector("img").src;
    viewer.querySelector("[data-viewer-remove]").classList.toggle("is-hidden", !photo.classList.contains("photo--user"));
    bootstrap.Modal.getOrCreateInstance(viewer).show();
  };

  // Zoom: bosish yoki ikki barmoq bilan kattalashadi, surish rasm chegarasida to'xtaydi
  const viewerBox = viewer.querySelector(".viewer__box");
  const ZOOM_TAP = 2.5;
  const ZOOM_MAX = 4;
  const zoom = { scale: 1, x: 0, y: 0 };
  const pointers = new Map();
  let gesture = null;

  const getLimits = (scale) => {
    const ratio = viewerImg.naturalWidth / viewerImg.naturalHeight || 1;
    const width = Math.min(viewerImg.offsetWidth, viewerImg.offsetHeight * ratio);
    const height = Math.min(viewerImg.offsetHeight, viewerImg.offsetWidth / ratio);
    return {
      x: Math.max(0, (width * scale - viewerBox.clientWidth) / 2),
      y: Math.max(0, (height * scale - viewerBox.clientHeight) / 2),
    };
  };

  const updateZoom = (scale, x, y) => {
    const limits = getLimits(scale);
    zoom.scale = scale;
    zoom.x = Math.min(limits.x, Math.max(-limits.x, x));
    zoom.y = Math.min(limits.y, Math.max(-limits.y, y));
    viewerImg.style.setProperty("--scale", zoom.scale);
    viewerImg.style.setProperty("--x", `${zoom.x}px`);
    viewerImg.style.setProperty("--y", `${zoom.y}px`);
    viewerImg.classList.toggle("is-zoom", zoom.scale > 1);
  };

  const getPoint = (event) => {
    const rect = viewerBox.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };

  const getCenter = () => {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  };

  const startGesture = () => {
    const point = pointers.size > 1 ? getCenter() : [...pointers.values()][0];
    gesture = { ...zoom, point, isMoved: gesture ? gesture.isMoved : false };
  };

  viewerBox.addEventListener("pointerdown", (event) => {
    if (event.target !== viewerImg) return;
    pointers.set(event.pointerId, getPoint(event));
    if (viewerBox.hasPointerCapture && event.isTrusted) viewerBox.setPointerCapture(event.pointerId);
    viewerImg.classList.add("is-moving");
    startGesture();
  });

  viewerBox.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, getPoint(event));
    const start = gesture.point;
    if (pointers.size > 1) {
      const center = getCenter();
      const scale = Math.min(ZOOM_MAX, Math.max(1, gesture.scale * center.distance / start.distance));
      const factor = scale / gesture.scale;
      updateZoom(scale, center.x - (start.x - gesture.x) * factor, center.y - (start.y - gesture.y) * factor);
      gesture.isMoved = true;
      return;
    }
    const point = pointers.get(event.pointerId);
    if (Math.hypot(point.x - start.x, point.y - start.y) > 6) gesture.isMoved = true;
    if (gesture.isMoved && zoom.scale > 1) updateZoom(zoom.scale, gesture.x + point.x - start.x, gesture.y + point.y - start.y);
  });

  const endPointer = (event) => {
    if (!pointers.has(event.pointerId)) return;
    const point = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (pointers.size) {
      startGesture();
      return;
    }
    viewerImg.classList.remove("is-moving");
    if (event.type === "pointerup" && !gesture.isMoved) {
      if (zoom.scale > 1) updateZoom(1, 0, 0);
      else updateZoom(ZOOM_TAP, -point.x * (ZOOM_TAP - 1), -point.y * (ZOOM_TAP - 1));
    }
    gesture = null;
  };

  viewerBox.addEventListener("pointerup", endPointer);
  viewerBox.addEventListener("pointercancel", endPointer);
  window.addEventListener("resize", () => updateZoom(zoom.scale, zoom.x, zoom.y), { passive: true });
  viewer.addEventListener("hidden.bs.modal", () => updateZoom(1, 0, 0));
  viewer.querySelector("[data-viewer-remove]").addEventListener("click", () => {
    bootstrap.Modal.getInstance(viewer).hide();
    if (viewerTarget) removeItem(viewerTarget);
  });

  // Operator fotosi: bosilganda yuklanadi, krest yuklashni bekor qiladi
  const loadPhoto = (photo) => {
    photo.classList.remove("is-load");
    photo.classList.add("is-loading");
    photo.querySelector("[data-loader]").classList.remove("loader--download");
    photo.loadTimer = setTimeout(() => photo.classList.remove("is-loading"), CHAT_DELAY.photo);
  };

  const cancelPhoto = (photo) => {
    clearTimeout(photo.loadTimer);
    clearTimeout(photo.sendTimer);
    if (photo.classList.contains("photo--user")) {
      removeItem(photo);
      return;
    }
    photo.classList.remove("is-loading");
    photo.classList.add("is-load");
    photo.querySelector("[data-loader]").classList.add("loader--download");
  };

  const pressItem = (target) => {
    const photo = target.closest("[data-photo]");
    const message = target.closest("[data-message]");
    if (photo) {
      if (photo.classList.contains("is-loading")) cancelPhoto(photo);
      else if (photo.classList.contains("is-load")) loadPhoto(photo);
      else if (photo.classList.contains("is-error")) openMenu(photo);
      else openViewer(photo);
    } else if (message) {
      openMenu(message);
    }
  };

  // Uzoq bosish: fotoga javob berish menyusi
  let pressTimer = null;
  let isPressed = false;
  list.addEventListener("pointerdown", (event) => {
    const photo = event.target.closest("[data-photo]");
    isPressed = false;
    if (!photo || photo.matches(".is-load, .is-loading")) return;
    pressTimer = setTimeout(() => {
      isPressed = true;
      openMenu(photo);
    }, 500);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((name) => {
    list.addEventListener(name, () => clearTimeout(pressTimer));
  });
  list.addEventListener("contextmenu", (event) => {
    if (event.target.closest("[data-photo]")) event.preventDefault();
  });

  chat.addEventListener("click", (event) => {
    if (isPressed) {
      isPressed = false;
      return;
    }
    const isOpen = emojiPanel.classList.contains("is-open") || screenEl.classList.contains("is-keyboard");
    if (isOpen) {
      toggleEmoji(false);
      input.blur();
      return;
    }
    if (!window.getSelection().toString()) pressItem(event.target);
  });

  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!event.target.matches("[data-message], [data-photo]")) return;
    event.preventDefault();
    pressItem(event.target);
  });

  // Кнопка вниз: suhbat oxiridan uzoqda pastga skroll boshlanganda chiqadi
  chat.addEventListener("scroll", () => {
    const distance = getDistance();
    if (distance < 100) {
      btnDown.classList.remove("is-visible");
      updatePill(0);
    } else if (chat.scrollTop > lastScroll && distance > 200) {
      btnDown.classList.add("is-visible");
    } else if (chat.scrollTop < lastScroll && !unreadCount) {
      btnDown.classList.remove("is-visible");
    }
    lastScroll = chat.scrollTop;
  }, { passive: true });
  btnDown.addEventListener("click", () => scrollDown());

  // Прикрепление
  // Telefonning o'z galereyasi, kamerasi va fayl oynasi ochiladi
  [photosInput, fileInput, cameraInput].forEach((el) => {
    el.addEventListener("change", () => {
      [...el.files].filter((file) => file.type.startsWith("image/")).forEach((file) => sendPhoto(URL.createObjectURL(file)));
      el.value = "";
      bootstrap.Offcanvas.getOrCreateInstance(document.querySelector("[data-sheet]")).hide();
    });
  });

  // Информация для поддержки
  document.querySelector("[data-info-send]").addEventListener("click", () => {
    const el = cloneTemplate("message-info");
    el.querySelector("[data-time]").textContent = getTime();
    bootstrap.Offcanvas.getInstance(document.querySelector("[data-info]")).hide();
    addItem(el, "user");
    sendItem(el);
  });

  // demo: bosh sahifadan kelganda o'qilmagan xabar ko'rsatiladi
  if (window.location.hash === "#unread") {
    const unread = document.createElement("div");
    unread.className = "event event--line";
    unread.textContent = "Непрочитанные сообщения";
    list.append(unread);
    list.querySelectorAll("[data-mark]").forEach((mark) => { mark.className = "receipt receipt--two"; });
    addItem(createMessage("support", CHAT_UNREAD), "support");
    setTimeout(() => unread.remove(), CHAT_DELAY.unread);
  }

  updateInput();
  scrollDown("instant");
}
// Чат поддержки end

// ===== Настройки =====

// Tema: tanlov localStorage'da turadi, sahifa ochilishida head'dagi skript qo'yadi
const themeToggle = document.querySelector("[data-theme-toggle]");
if (themeToggle) {
  themeToggle.addEventListener("change", () => {
    const theme = themeToggle.checked ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch (error) {
      // private rejimda xotira yopiq: tema faqat shu sahifada qoladi
    }
  });
}

// Boshqa tab yoki "orqaga" orqali qaytilgan sahifada tema yangilanadi
const syncTheme = () => {
  try {
    document.documentElement.dataset.theme = localStorage.getItem("theme") === "dark" ? "dark" : "light";
  } catch (error) {
    return;
  }
  if (themeToggle) themeToggle.checked = document.documentElement.dataset.theme === "dark";
};
window.addEventListener("storage", syncTheme);
window.addEventListener("pageshow", syncTheme);
// Настройки end
