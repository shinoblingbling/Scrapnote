// ============================================================
// Scrapnote - Secure Storage
// API Key 等の機密データを AES-256-GCM で暗号化して
// chrome.storage.local に保存する
// ============================================================

// 暗号化対象のキー
const SENSITIVE_KEYS = new Set(['groqApiKey', 'notionToken']);

// 内部ストレージキー
const EK_STORAGE_KEY = '_ek';
const ENC_PREFIX = '_enc_';

// ------------------------------------------------------------
// Base64 <-> ArrayBuffer 変換
// ------------------------------------------------------------

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function base64ToBuffer(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

// ------------------------------------------------------------
// 暗号鍵の管理
// ------------------------------------------------------------

let _keyCache = null;

async function getOrCreateKey() {
  if (_keyCache) return _keyCache;

  const stored = await chrome.storage.local.get([EK_STORAGE_KEY]);
  if (stored[EK_STORAGE_KEY]) {
    _keyCache = await crypto.subtle.importKey(
      'raw',
      base64ToBuffer(stored[EK_STORAGE_KEY]),
      'AES-GCM',
      false,
      ['encrypt', 'decrypt']
    );
    return _keyCache;
  }

  // 初回インストール時: 鍵を生成して保存
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  await chrome.storage.local.set({ [EK_STORAGE_KEY]: bufferToBase64(raw) });

  _keyCache = await crypto.subtle.importKey(
    'raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']
  );
  return _keyCache;
}

// ------------------------------------------------------------
// 暗号化・復号
// ------------------------------------------------------------

async function encryptValue(plaintext) {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { iv: bufferToBase64(iv), data: bufferToBase64(ciphertext) };
}

async function decryptValue(encrypted) {
  if (!encrypted?.iv || !encrypted?.data) return '';
  const key = await getOrCreateKey();
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuffer(encrypted.iv) },
      key,
      base64ToBuffer(encrypted.data)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return '';
  }
}

// ------------------------------------------------------------
// 公開 API
// ------------------------------------------------------------

/**
 * 設定を保存する。機密フィールドは AES-256-GCM で暗号化される。
 * @param {Object} config - 保存するキー・値のオブジェクト
 */
export async function saveSecureConfig(config) {
  const toStore = {};
  const toRemove = [];

  for (const [k, v] of Object.entries(config)) {
    if (SENSITIVE_KEYS.has(k)) {
      if (v) {
        toStore[ENC_PREFIX + k] = await encryptValue(v);
      } else {
        toRemove.push(ENC_PREFIX + k);
      }
      // 平文キーは常に削除対象
      toRemove.push(k);
    } else {
      toStore[k] = v;
    }
  }

  if (toRemove.length > 0) {
    await chrome.storage.local.remove(toRemove);
  }
  await chrome.storage.local.set(toStore);
}

/**
 * 設定を読み込む。機密フィールドは自動で復号される。
 * 平文で保存された既存データは暗号化形式に自動マイグレーションされる。
 * @param {string[]} keys - 読み込むキーの配列
 * @param {Object} defaults - デフォルト値
 * @returns {Object} 復号済みの設定オブジェクト
 */
export async function loadSecureConfig(keys, defaults = {}) {
  const encKeys = keys
    .filter((k) => SENSITIVE_KEYS.has(k))
    .map((k) => ENC_PREFIX + k);
  const stored = await chrome.storage.local.get([...keys, ...encKeys]);

  const result = { ...defaults };

  for (const k of keys) {
    if (SENSITIVE_KEYS.has(k)) {
      const encKey = ENC_PREFIX + k;
      if (stored[encKey]) {
        // 暗号化済み → 復号
        result[k] = await decryptValue(stored[encKey]);
      } else if (stored[k]) {
        // マイグレーション: 平文 → 暗号化して保存し直す
        result[k] = stored[k];
        await chrome.storage.local.set({
          [encKey]: await encryptValue(stored[k])
        });
        await chrome.storage.local.remove([k]);
      }
    } else {
      if (stored[k] !== undefined) {
        result[k] = stored[k];
      }
    }
  }

  return result;
}
