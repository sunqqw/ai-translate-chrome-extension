importScripts("js-sdk/md5.js");

const CACHE_MAX = 200;
const cache = new Map();

const BAIDU_API = "https://api.fanyi.baidu.com/api/trans/vip/translate";

const BAIDU_ERRORS = {
  52001: "请求超时，请重试",
  52002: "系统错误，请重试",
  52003: "未授权用户，请检查 App ID 和密钥",
  54000: "必填参数为空",
  54001: "签名错误，请检查密钥是否正确",
  54003: "访问频率受限，请稍后再试",
  54004: "账户余额不足",
  54005: "长 query 请求频繁",
  58000: "客户端 IP 非法，请在百度控制台配置 IP 白名单",
  58001: "译文语言方向不支持",
  58002: "服务当前已关闭",
  90107: "认证未通过或未生效",
};

function cacheGet(key) {
  if (!cache.has(key)) return null;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function cacheSet(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

function getBaiduCredentials() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ appid: "", secretKey: "" }, resolve);
  });
}

function getBaiduErrorMessage(code, fallback) {
  return BAIDU_ERRORS[Number(code)] || fallback || `百度翻译错误 (${code})`;
}

async function translateWithBaidu(text, appid, secretKey) {
  const salt = Date.now().toString();
  const sign = MD5(appid + text + salt + secretKey);

  const url = new URL(BAIDU_API);
  url.searchParams.set("q", text);
  url.searchParams.set("from", "en");
  url.searchParams.set("to", "zh");
  url.searchParams.set("appid", appid);
  url.searchParams.set("salt", salt);
  url.searchParams.set("sign", sign);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`百度翻译请求失败 (${res.status})`);

  const data = await res.json();
  if (data.error_code) {
    throw new Error(getBaiduErrorMessage(data.error_code, data.error_msg));
  }

  const translated = data.trans_result?.map((item) => item.dst).join("\n");
  if (!translated) throw new Error("未获取到翻译结果");
  return translated;
}

async function translateText(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("未选中有效文本");

  const { appid, secretKey } = await getBaiduCredentials();
  if (!appid || !secretKey) {
    throw new Error("请先在扩展设置中填写百度翻译 App ID 和密钥");
  }

  const cacheKey = trimmed.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const translated = await translateWithBaidu(trimmed, appid, secretKey);
  cacheSet(cacheKey, translated);
  return translated;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "translate") return false;

  translateText(message.text)
    .then((translation) => sendResponse({ ok: true, translation }))
    .catch((err) =>
      sendResponse({ ok: false, error: err.message || "翻译失败" })
    );

  return true;
});
