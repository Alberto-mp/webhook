const express = require('express');
const axios = require('axios');
const app = express();

require('dotenv').config();

app.use(express.json());

// Función para obtener el email del usuario usando su accountId
async function getEmailFromAccountId(accountId) {
  try {
    const response = await axios.get(`${process.env.JIRA_DOMAIN}/rest/api/3/user`, {
      params: { accountId },
      auth: {
        username: process.env.JIRA_EMAIL,
        password: process.env.JIRA_API_TOKEN
      }
    });

    return response.data.emailAddress;
  } catch (error) {
    console.error('❌ Error al obtener el email de Jira:', error.response?.data || error.message);
    return null;
  }
}

// Función para enviar los puntos a GoRace
async function enviarPuntosAGoRace(email, puntos) {
  try {
    //const fechaFormateada = new Date()
    //  .toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' })
    //  .replace('T', ' '); // "YYYY-MM-DD HH:mm:ss"

    const fechaFormateada = "2025-06-04T16:32:33+02:00";

    console.log('📅 Fecha enviada:', fechaFormateada);
    console.log('🌍 URL destino GoRace:', process.env.GORACE_API_URL);

    const response = await axios.post(
      process.env.GORACE_API_URL,
      [
        {
          assignment: process.env.GORACE_ASSIGNMENT,
          email,
          time: fechaFormateada,
          [process.env.GORACE_VARIABLE]: puntos
        }
      ],
      {
        headers: {
          Authorization: `Bearer ${process.env.GORACE_JWT}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Resultado enviado a GoRace:', response.data);
  } catch (error) {
    console.error('❌ Error al enviar puntos a GoRace:', error.response?.data || error.message);
  }
}


app.post('/webhook', async (req, res) => {
  console.log('📩 Webhook recibido:');
  const payload = req.body;
  const issue = payload.issue;
  const changelog = payload.changelog;
  //console.log('🔍 Changelog recibido:', JSON.stringify(changelog, null, 2));
  const webhookEvent = payload.webhookEvent;

  const email = "albertops4conil@gmail.com";

  // 🗒️ Comentarios añadidos
  if (webhookEvent === 'comment_created') {
    console.log(`💬 Comentario añadido: +1 punto`);
    await enviarPuntosAGoRace(email, 1);
    return res.status(200).send('OK');
  }

  // 🔄 Cambios en el issue
  if (webhookEvent === 'jira:issue_updated' && changelog) {
    const cambios = changelog.items || [];
    const cambioEstado = cambios.find(c => c.field === 'status');
    const cambioAssignee = cambios.find(c => c.field === 'assignee');
    const cambioLabels = cambios.find(c => c.field === 'labels');
    const cambioDesc = cambios.find(c => c.field === 'description');
    const cambioAttachment = cambios.find(c => c.field === 'Attachment');

    if (cambioAttachment) {
      console.log(`📎 Archivo adjuntado: +1 punto`);
      await enviarPuntosAGoRace(email, 1);
      return res.status(200).send('OK');
    }

    if (!issue || !issue.fields || !email) {
      console.log('⚠️ Webhook incompleto o falta email');
      return res.status(400).send('Formato inválido');
    }

    const puntosBase = issue.fields.customfield_10038 ?? 1;
    const duedateStr = issue.fields.duedate;

    // ✔️ Cambio a Done
    if (cambioEstado) {
      const from = cambioEstado.fromString?.toLowerCase();
      const to = cambioEstado.toString?.toLowerCase();

      if ((from === 'in progress' || from === 'to do') && to === 'done') {
        let puntosFinales = puntosBase;
        if (duedateStr) {
          const now = new Date();
          const due = new Date(duedateStr);
          const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            puntosFinales = Math.max(0, puntosFinales - diffDays);
            console.log(`⏰ Entregado tarde (${diffDays} días). Puntos ajustados.`);
          } else {
            console.log('✅ Entregado en plazo.');
          }
        }
        console.log(`📧 Email: ${email} | 🏁 Puntos a enviar: ${puntosFinales}`);
        await enviarPuntosAGoRace(email, puntosFinales);
      }

      if (to === 'in progress') {
        console.log(`🚀 Estado cambiado a In Progress: +2 puntos`);
        await enviarPuntosAGoRace(email, 2);
      }
    }

    if (cambioAssignee) {
      console.log(`👤 Asignación cambiada: +2 puntos`);
      await enviarPuntosAGoRace(email, 2);
    }

    if (cambioLabels) {
      console.log(`🏷️ Etiquetas modificadas: +1 punto`);
      await enviarPuntosAGoRace(email, 1);
    }

    if (cambioDesc) {
      console.log(`📝 Descripción actualizada: +1 punto`);
      await enviarPuntosAGoRace(email, 1);
    }
  }

  // 🆕 Creación de issue
  if (webhookEvent === 'jira:issue_created') {
    console.log(`🆕 Issue creado: +1 punto`);
    await enviarPuntosAGoRace(email, 1);
  }

  res.status(200).send('OK');
});





// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
