import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
app.listen(port, "0.0.0.0", () => {
  process.stdout.write(`CotizApp Backend escuchando en puerto ${port}\n`);
});
