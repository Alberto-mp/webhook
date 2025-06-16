# 📘 Guía: Añadir manualmente el email del usuario para GoRace

En algunos planes de Jira Cloud, no es posible obtener directamente el email del usuario a través de la API. Para que GoRace funcione correctamente (requiere el email del usuario), debemos hacer un **mapeo manual entre el `accountId` de Jira y su email real**.

## 🛠️ Pasos para configurar el mapeo manual

---

### 1. 🧩 Buscar el `accountId` del usuario

Cada vez que se dispara un webhook de Jira, puedes encontrar el `accountId` del usuario en:

```json
payload.user.accountId
```

También puedes verlo si haces un `console.log(payload.user)`.

Ejemplo:

```json
{
  "accountId": "712020:c82bcfe4-c6d9-429b-b939-c004df25ff84",
  "displayName": "Alberto Muñoz Piña"
}
```

---

### 2. 🗺️ Añadir el `accountId` al mapa manual

En tu archivo del servidor (por ejemplo, `index.js` o `server.js`), justo debajo de `require('dotenv').config();`, añade o edita el siguiente objeto:

```js
const userMap = {
  '712020:c82bcfe4-c6d9-429b-b939-c004df25ff84': 'albertops4conil@gmail.com',
  // Añade aquí más usuarios según sea necesario
};
```

---

### 3. 🧪 Usar el mapa para obtener el email

Dentro del `app.post('/webhook')`, utiliza el `accountId` para obtener el email desde el mapa:

```js
const accountId = payload.user?.accountId;
const email = userMap[accountId];

if (!email) {
  console.log('⚠️ No se pudo mapear el email del usuario con accountId:', accountId);
  return res.status(400).send('Email no encontrado');
} else {
  console.log(`📧 Email del usuario: ${email}`);
}
```

---

### 4. ✅ Resultado

Cuando llegue un webhook, se usará el email correcto y se enviará el evento a GoRace sin errores.

---

## ➕ ¿Cómo añadir un nuevo usuario?

1. Espera a que ese usuario realice alguna acción que dispare un webhook.
2. Copia el `accountId` del `payload.user`.
3. Añádelo al `userMap` con su email correspondiente:

```js
const userMap = {
  'nuevo-account-id-aqui': 'su.email@ejemplo.com',
};
```

---

## 📌 Importante

- Este método **solo es necesario porque la API de Jira oculta los emails en ciertos planes**.
- El mapeo manual es una solución funcional, pero debes mantenerlo actualizado si se añaden más usuarios al proyecto.