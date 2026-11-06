module.exports = {
  ESTADOS: {
    EXPLORANDO: 1,
    BUSCANDO: 2,
    HUYENDO: 3,
  },
  CANALES_REDIS: {
    MUNDO_ESTADO: "canal:mundo:estado",
    COLA_PENDIENTES: "cola:decisiones:pendientes",
    COLA_RESUELTAS: "cola:decisiones:resueltas",
    EVENTO_SEQUIA: "canal:eventos:sequia",
    EVENTO_DEPREDADOR: "canal:eventos:depredador",
    EVENTO_ABUNDANCIA: "canal:eventos:abundancia",
  },
};
