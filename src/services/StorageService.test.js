import { describe, it, expect, beforeEach } from 'vitest';
import { save, load, remove, clearAll } from './StorageService.js';

// StorageService é a camada desacoplada obrigatória (CLAUDE.md regra 3) —
// estes testes garantem que ela funciona e que outra chave do mesmo
// localStorage (de outro app/domínio) nunca é tocada por engano.
describe('StorageService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('save/load faz round-trip de valores JSON (objeto, array, número)', () => {
    save('coins', 42);
    save('upgrade', { damage: 3, life: 2 });
    save('list', [1, 2, 3]);

    expect(load('coins')).toBe(42);
    expect(load('upgrade')).toEqual({ damage: 3, life: 2 });
    expect(load('list')).toEqual([1, 2, 3]);
  });

  it('load retorna o fallback quando a chave não existe', () => {
    expect(load('nunca-salvo', 'default')).toBe('default');
    expect(load('nunca-salvo')).toBeNull();
  });

  it('remove apaga só a chave pedida', () => {
    save('coins', 42);
    save('diamant', 7);

    remove('coins');

    expect(load('coins')).toBeNull();
    expect(load('diamant')).toBe(7);
  });

  it('usa um prefixo próprio, sem pisar em chaves de outras origens', () => {
    window.localStorage.setItem('outro-app:token', 'abc');

    save('coins', 42);

    expect(window.localStorage.getItem('outro-app:token')).toBe('abc');
  });

  it('clearAll remove só as chaves do jogo (prefixo phaser-vite:), nunca localStorage inteiro', () => {
    window.localStorage.setItem('outro-app:token', 'abc');
    save('coins', 42);
    save('diamant', 7);

    clearAll();

    expect(load('coins')).toBeNull();
    expect(load('diamant')).toBeNull();
    expect(window.localStorage.getItem('outro-app:token')).toBe('abc');
  });

  it('load nunca lança quando o JSON salvo está corrompido', () => {
    window.localStorage.setItem('phaser-vite:coins', '{not-json');
    expect(() => load('coins', 0)).not.toThrow();
    expect(load('coins', 0)).toBe(0);
  });
});
