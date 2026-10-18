# Arena FFA — shooter 3D online

Free-for-all en un mapa pequeño: apareces en un punto aleatorio y peleas con 3 armas.

## Estructura

```
arena-ffa/
├── package.json
├── server.js          # servidor Node: sirve el juego + WebSocket
└── public/
    └── index.html     # cliente 3D (Three.js)
```

## Cómo correrlo

1. Instala Node.js 18+ (https://nodejs.org).
2. En la carpeta del proyecto:
   ```
   npm install
   npm start
   ```
3. Abre http://localhost:3000
   - **Jugar SOLO**: 5 bots, no necesita servidor.
   - **Jugar ONLINE**: se conecta al servidor. Abre varias pestañas para probar.

## Controles

WASD mover · Espacio saltar · Mouse apuntar · Click disparar · 1/2/3 o rueda cambiar arma · Tab puntajes

## Cómo funciona el online

- El **servidor** guarda de cada jugador: posición, vida, kills y muertes. Elige los puntos de aparición (al azar, lejos de jugadores vivos) y hace el respawn a los 3 s.
- Cada cliente manda su posición y mirada 20 veces por segundo (`state`).
- El servidor manda a todos un `snap` 20 veces por segundo; el cliente interpola para que el movimiento se vea suave.
- Al disparar, el cliente calcula a quién le pegó (raycast) y manda `hit`. El **servidor calcula el daño** con su propia tabla de armas y limita la cadencia, así el cliente no puede mandar daño inventado.

Limitación: las posiciones y los aciertos los decide el cliente, así que un tramposo podría teletransportarse o apuntar con aimbot. Para un juego entre amigos está bien. Para algo público, el siguiente paso es simular el movimiento en el servidor y validar los aciertos allí.

## Jugar con amigos por internet

Opción rápida: `npx cloudflared tunnel --url http://localhost:3000` (o ngrok) te da una URL pública; tus amigos la abren y juegan.

Opción permanente: sube la carpeta a Render, Railway o Fly.io (soportan WebSockets). El comando de inicio es `npm start` y el puerto se toma de la variable `PORT`. Con https el cliente usa `wss://` automáticamente.

## Ideas para seguir

- Munición y recarga, pickups de vida/armas.
- Más mapas (edita `BOX_DEFS` en el cliente y `SPAWNS` en cliente y servidor).
- Modelos 3D reales (GLTF) en vez de cilindros.
- Salas/lobbies y límite de kills para terminar partidas.
