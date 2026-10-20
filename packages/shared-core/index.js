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
  },
};
