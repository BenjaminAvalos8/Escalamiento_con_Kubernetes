const { ESTADOS, RADIO_PANICO, TICKS_POR_PASO, decidir } = require("./fsm");

module.exports = {
  ESTADOS,
  RADIO_PANICO,
  TICKS_POR_PASO,
  decidir,
  CANALES_REDIS: {
    MUNDO_ESTADO: "canal:mundo:estado",
    COLA_PENDIENTES: "cola:decisiones:pendientes",
    COLA_RESUELTAS: "cola:decisiones:resueltas",
    EVENTO_SEQUIA: "canal:eventos:sequia",
    EVENTO_DEPREDADOR: "canal:eventos:depredador",
    EVENTO_ABUNDANCIA: "canal:eventos:abundancia",
  },
};
