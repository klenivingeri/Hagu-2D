// Camada de persistência desacoplada (CLAUDE.md / GUIDELINES.md). Hoje usa
// localStorage, mas está preparada para trocar de implementação (IndexedDB,
// storage nativo Android/Capacitor) sem exigir mudanças em quem consome
// save()/load()/remove() — nenhuma outra parte do projeto deve chamar
// localStorage diretamente.
const STORAGE_PREFIX = 'phaser-vite:';

function buildKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

export function save(key, value) {
  try {
    window.localStorage.setItem(buildKey(key), JSON.stringify(value));
  } catch (error) {
    console.warn(`[StorageService] Falha ao salvar "${key}":`, error);
  }
}

export function load(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(buildKey(key));
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn(`[StorageService] Falha ao carregar "${key}":`, error);
    return fallback;
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(buildKey(key));
  } catch (error) {
    console.warn(`[StorageService] Falha ao remover "${key}":`, error);
  }
}

// Apaga só as chaves deste jogo (prefixadas com STORAGE_PREFIX) — nunca
// localStorage.clear(), que apagaria dados de outros sites/apps que
// dividem o mesmo domínio. Usado pelo botão de reset em Configurações (ver
// GameManager.resetProgress()).
export function clearAll() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn('[StorageService] Falha ao limpar armazenamento:', error);
  }
}
