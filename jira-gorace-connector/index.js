const express = require('express');
const axios = require('axios');
const app = express();

require('dotenv').config();

// Mapeo manual de accountId de Jira a emails reales
const userMap = {
  '712020:c82bcfe4-c6d9-429b-b939-c004df25ff84': 'albertops4conil@gmail.com',
  // Puedes añadir más mapeos aquí si hay más usuarios
};


app.use(express.json());


// Función para formatear la fecha actual en UTC
function getFormattedUTCDate() {
  const now = new Date();

  const pad = (num) => String(num).padStart(2, '0');

  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  const hours = pad(now.getUTCHours());
  const minutes = pad(now.getUTCMinutes());
  const seconds = pad(now.getUTCSeconds());

  // El offset será siempre +00:00 para UTC
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+00:00`;
}

// Función genérica para enviar un valor 1 a una variable específica en GoRace
async function enviarEventoAGoRace(email, variable, valor = 1) {
  try {
    const fechaFormateada = getFormattedUTCDate();

    console.log(`📤 Enviando evento "${variable}" con valor ${valor} para ${email} en ${fechaFormateada}`);

    const payload = [
      {
        assignment: process.env.GORACE_ASSIGNMENT,
        email,
        time: fechaFormateada,
        [variable]: valor
      }
    ];

    const response = await axios.post(process.env.GORACE_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${process.env.GORACE_JWT}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Resultado enviado a GoRace:', response.data);
  } catch (error) {
    console.error('❌ Error al enviar a GoRace:', error.response?.data || error.message);
  }
}




app.post('/webhook', async (req, res) => {
  console.log('📩 Webhook recibido');
  const payload = req.body;
  const issue = payload.issue;
  const changelog = payload.changelog;
  const webhookEvent = payload.webhookEvent;

  const accountId = payload.user?.accountId;
  const email = userMap[accountId];

  if (!email) {
    console.log('⚠️ No se pudo mapear el email del usuario con accountId:', accountId);
    return res.status(400).send('Email no encontrado');
  } else {
    console.log(`📧 Email del usuario: ${email}`);
  }



  if (!issue || !issue.fields || !email) {
    console.log('⚠️ Webhook incompleto o falta email');
    return res.status(400).send('Formato inválido');
  }

  const dificultad = issue.fields?.customfield_10060 ?? '?';
  console.log(`🎯 Nivel de dificultad de la tarea: ${dificultad}`);

  // 🗒️ Comentario creado
  if (webhookEvent === 'comment_created') {
    console.log('💬 Comentario añadido');
    await enviarEventoAGoRace(email, 'COMMENT');
    return res.status(200).send('OK');
  }

  // 🔄 Actualización del issue
  if (webhookEvent === 'jira:issue_updated' && changelog) {
    const cambios = changelog.items || [];
    const cambioEstado = cambios.find(c => c.field === 'status');
    const cambioAssignee = cambios.find(c => c.field === 'assignee');
    const cambioLabels = cambios.find(c => c.field === 'labels');
    const cambioDesc = cambios.find(c => c.field === 'description');
    const cambioAttachment = cambios.find(c => c.field === 'Attachment');

    if (cambioAttachment) {
      console.log('📎 Archivo adjunto añadido');
      await enviarEventoAGoRace(email, 'FILE');
    }

    if (cambioEstado) {
      const from = cambioEstado.fromString?.toLowerCase();
      const to = cambioEstado.toString?.toLowerCase();

      if ((from === 'to do' || from === 'selected for development') && to === 'in progress') {
        console.log('🚀 Tarea iniciada');
        await enviarEventoAGoRace(email, 'TINIT');
      }

      if ((from === 'to do' || from === 'in progress') && to === 'done') {
        console.log('🏁 Tarea finalizada');
        const dificultad = issue.fields?.customfield_10060;
        const valorDificultad = typeof dificultad === 'number' ? dificultad : 1; // valor por defecto si no se encuentra
        await enviarEventoAGoRace(email, 'TFIN', valorDificultad);
      }

    }

    if (cambioAssignee) {
      console.log('👤 Cambio de asignación');
      await enviarEventoAGoRace(email, 'TASIG');
    }

    if (cambioLabels) {
      console.log('🏷️ Etiquetas modificadas');
      await enviarEventoAGoRace(email, 'LABEL');
    }

    if (cambioDesc) {
      console.log('📝 Descripción actualizada');
      await enviarEventoAGoRace(email, 'DESCRIP');
    }
  }

  // 🆕 Creación de issue
  if (webhookEvent === 'jira:issue_created') {
    console.log('🆕 Issue creado');

    if (issue.fields?.assignee) {
      console.log('👤 Issue creado con responsable asignado');
      await enviarEventoAGoRace(email, 'TASIG');
    }
  }

  res.status(200).send('OK');
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
