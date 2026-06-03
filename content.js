(function () {
  const MAX_TEXT_LENGTH = 500;
  const POPUP_ID = "ai-trans-popup";

  let popup = null;
  let triggerBtn = null;
  let hideTimer = null;
  let currentSelection = "";

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        { autoTranslate: true, showTrigger: true },
        resolve
      );
    });
  }

  function getSelectedText() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return "";

    const text = selection.toString().trim();
    if (!text || text.length > MAX_TEXT_LENGTH) return "";
    if (!/[a-zA-Z]/.test(text)) return "";

    return text;
  }

  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    return rect;
  }

  function removeElement(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function hideAll() {
    clearTimeout(hideTimer);
    removeElement(popup);
    removeElement(triggerBtn);
    popup = null;
    triggerBtn = null;
    currentSelection = "";
  }

  function createTriggerButton(rect) {
    removeElement(triggerBtn);

    triggerBtn = document.createElement("div");
    triggerBtn.id = "ai-trans-trigger";
    triggerBtn.title = "翻译选中文本";
    triggerBtn.innerHTML = `<span class="ai-trans-trigger-icon">译</span>`;

    const top = Math.max(8, rect.top - 36);
    const left = Math.min(
      window.innerWidth - 40,
      Math.max(8, rect.left + rect.width / 2 - 16)
    );

    triggerBtn.style.top = `${top}px`;
    triggerBtn.style.left = `${left}px`;

    triggerBtn.addEventListener("mousedown", (e) => e.preventDefault());
    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showTranslation(currentSelection);
    });

    document.documentElement.appendChild(triggerBtn);
  }

  function positionPopup(el, rect) {
    const margin = 12;
    const popupRect = el.getBoundingClientRect();
    let top = rect.bottom + margin;
    let left = rect.left + rect.width / 2 - popupRect.width / 2;

    if (top + popupRect.height > window.innerHeight - margin) {
      top = rect.top - popupRect.height - margin;
    }
    if (left < margin) left = margin;
    if (left + popupRect.width > window.innerWidth - margin) {
      left = window.innerWidth - popupRect.width - margin;
    }

    el.style.top = `${Math.max(margin, top)}px`;
    el.style.left = `${Math.max(margin, left)}px`;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function showPopupContent({ text, state, translation, error }) {
    const rect = getSelectionRect();
    if (!rect) return;

    removeElement(popup);

    popup = document.createElement("div");
    popup.id = POPUP_ID;

    let bodyHtml = "";
    if (state === "loading") {
      bodyHtml = `<div class="ai-trans-loading"><span class="ai-trans-spinner"></span>翻译中…</div>`;
    } else if (state === "error") {
      bodyHtml = `<div class="ai-trans-error">${escapeHtml(error)}</div>`;
    } else {
      bodyHtml = `
        <div class="ai-trans-original">${escapeHtml(text)}</div>
        <div class="ai-trans-divider"></div>
        <div class="ai-trans-result">${escapeHtml(translation)}</div>
      `;
    }

    popup.innerHTML = `
      <div class="ai-trans-header">
        <span class="ai-trans-title">英 → 中</span>
        <div class="ai-trans-actions">
          ${
            state === "done"
              ? `<button class="ai-trans-btn" data-action="copy" title="复制译文">复制</button>`
              : ""
          }
          <button class="ai-trans-btn ai-trans-btn-close" data-action="close" title="关闭">×</button>
        </div>
      </div>
      <div class="ai-trans-body">${bodyHtml}</div>
    `;

    popup.style.visibility = "hidden";
    document.documentElement.appendChild(popup);
    positionPopup(popup, rect);
    popup.style.visibility = "visible";

    popup.querySelector('[data-action="close"]')?.addEventListener("click", hideAll);
    popup.querySelector('[data-action="copy"]')?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(translation);
        const btn = popup.querySelector('[data-action="copy"]');
        if (btn) {
          btn.textContent = "已复制";
          setTimeout(() => {
            if (btn) btn.textContent = "复制";
          }, 1500);
        }
      } catch {
        /* clipboard may be blocked on some pages */
      }
    });

    popup.addEventListener("mousedown", (e) => e.stopPropagation());
  }

  async function showTranslation(text) {
    removeElement(triggerBtn);
    triggerBtn = null;

    showPopupContent({ text, state: "loading" });

    try {
      const response = await chrome.runtime.sendMessage({
        type: "translate",
        text,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "翻译失败");
      }

      showPopupContent({
        text,
        state: "done",
        translation: response.translation,
      });
    } catch (err) {
      showPopupContent({
        text,
        state: "error",
        error: err.message || "翻译失败，请稍后重试",
      });
    }
  }

  async function handleSelection() {
    clearTimeout(hideTimer);

    const text = getSelectedText();
    if (!text) {
      hideTimer = setTimeout(hideAll, 120);
      return;
    }

    if (text === currentSelection && (popup || triggerBtn)) return;

    currentSelection = text;
    const rect = getSelectionRect();
    if (!rect) return;

    const settings = await getSettings();

    if (settings.autoTranslate) {
      showTranslation(text);
    } else if (settings.showTrigger) {
      removeElement(popup);
      popup = null;
      createTriggerButton(rect);
    }
  }

  document.addEventListener("mouseup", (e) => {
    if (e.target.closest?.(`#${POPUP_ID}, #ai-trans-trigger`)) return;
    setTimeout(handleSelection, 10);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideAll();
  });

  document.addEventListener(
    "scroll",
    () => {
      hideAll();
    },
    true
  );
})();
