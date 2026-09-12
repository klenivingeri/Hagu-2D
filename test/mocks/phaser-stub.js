// Stub de 'phaser' usado SÓ pelos testes (ver alias em vitest.config.js).
// A lib real dispara feature-detection via <canvas> assim que é importada
// (CanvasPool/checkInverseAlpha), o que quebra em jsdom sem o pacote nativo
// `canvas`. Nossos testes unitários nunca instanciam um Phaser.Game de
// verdade nem chamam os helpers que usam este objeto — só precisam que o
// import não derrube o processo. Qualquer propriedade acessada devolve uma
// função no-op, então mesmo um uso inesperado não lança.
const noop = () => undefined;

const handler = {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (prop === 'default' || prop === '__esModule') return undefined;
    return new Proxy(noop, handler);
  },
  apply() {
    return undefined;
  },
};

const PhaserStub = new Proxy({}, handler);

export default PhaserStub;
