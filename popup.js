const autoTranslateEl = document.getElementById("autoTranslate");
const showTriggerEl = document.getElementById("showTrigger");
const appidEl = document.getElementById("appid");
const secretKeyEl = document.getElementById("secretKey");
const saveApiBtn = document.getElementById("saveApi");
const saveStatusEl = document.getElementById("saveStatus");

const DEFAULT_SETTINGS = {
  autoTranslate: true,
  showTrigger: true,
  appid: "",
  secretKey: "",
};

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  autoTranslateEl.checked = settings.autoTranslate;
  showTriggerEl.checked = settings.showTrigger;
  appidEl.value = settings.appid;
  secretKeyEl.value = settings.secretKey;
});

function saveSettings() {
  chrome.storage.sync.set({
    autoTranslate: autoTranslateEl.checked,
    showTrigger: showTriggerEl.checked,
  });
}

function saveApiConfig() {
  const appid = appidEl.value.trim();
  const secretKey = secretKeyEl.value.trim();

  if (!appid || !secretKey) {
    saveStatusEl.style.color = "#dc2626";
    saveStatusEl.textContent = "请填写 App ID 和密钥";
    return;
  }

  chrome.storage.sync.set({ appid, secretKey }, () => {
    saveStatusEl.style.color = "#16a34a";
    saveStatusEl.textContent = "已保存";
    setTimeout(() => {
      saveStatusEl.textContent = "";
    }, 2000);
  });
}

autoTranslateEl.addEventListener("change", saveSettings);
showTriggerEl.addEventListener("change", saveSettings);
saveApiBtn.addEventListener("click", saveApiConfig);
