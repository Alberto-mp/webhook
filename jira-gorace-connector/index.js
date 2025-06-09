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


// Endpoint para recibir el webhook de Jira
app.post('/webhook', async (req, res) => {
  console.log('📩 Webhook recibido:');
  console.log(JSON.stringify(req.body, null, 2));

  const issue = req.body.issue;

  if (!issue || !issue.fields || !issue.fields.reporter) {
    console.log('⚠️ Webhook no tiene el formato esperado');
    return res.status(400).send('Formato inválido');
  }

  const reporterId = issue.fields.reporter.accountId;
  const puntos = issue.fields.customfield_10038;

  const email = "albertops4conil@gmail.com";//await getEmailFromAccountId(reporterId);

  if (!email || puntos == null) {
    console.log('⚠️ No se pudo obtener el email o los puntos del issue.');
    return res.status(500).send('Faltan datos');
  }

  console.log(`📧 Email del reportero: ${email}`);
  console.log(`🏁 Puntos a enviar: ${puntos}`);

  await enviarPuntosAGoRace(email, puntos);

  res.status(200).send('OK');
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
