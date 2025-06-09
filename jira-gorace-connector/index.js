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
  const payload = req.body;
  const issue = payload.issue;
  const changelog = payload.changelog;

  if (payload.webhookEvent === 'jira:issue_updated'){
    //console.log('🧾 Payload completo:');
    //console.log(JSON.stringify(payload, null, 2));

    if (!issue || !issue.fields || !issue.fields.reporter || !changelog) {
      console.log('⚠️ Webhook incompleto');
      return res.status(400).send('Formato inválido');
    }

    const cambios = changelog.items || [];
    const cambioEstado = cambios.find(c => c.field === 'status');

    if (!cambioEstado) {
      return res.status(200).send('OK (sin cambio de estado)');
    }

    const from = cambioEstado.fromString?.toLowerCase();
    const to = cambioEstado.toString?.toLowerCase();
    const reporterId = issue.fields.reporter.accountId;
    const email = "albertops4conil@gmail.com";

    if (!email) {
      console.log('⚠️ No se pudo obtener el email');
      return res.status(500).send('Falta email');
    }

    // ✔️ Si pasa de En Curso a Terminado
    if ((from === 'in progress' || from === 'to do') && to === 'done') {
      const puntos = issue.fields.customfield_10038 ?? 0;
      const duedateStr = issue.fields.duedate;
      let puntosFinales = puntos;

      if (duedateStr) {
        const fechaEntrega = new Date();
        const duedate = new Date(duedateStr);
        const msPorDia = 1000 * 60 * 60 * 24;
        const diasRetraso = Math.floor((fechaEntrega - duedate) / msPorDia);

        if (diasRetraso > 0) {
          puntosFinales -= diasRetraso;
          if (puntosFinales < 0) puntosFinales = 0;
          console.log(`⏰ Entregado tarde: ${diasRetraso} días de retraso.`);
        } else {
          console.log('✅ Entregado en plazo');
        }
      } else {
        console.log('⏳ Sin fecha límite. Se entregan puntos sin descuento.');
      }

      console.log(`📧 Email: ${email}`);
      console.log(`🏁 Puntos a enviar: ${puntosFinales}`);
      await enviarPuntosAGoRace(email, puntosFinales);
    }


    /*
    // Si pasa de Terminado a En Curso
    if (from === 'done' && to === 'in progress') {
      const penalizacion = -3;
      console.log(`🔁 Tarea reabierta, se penaliza con ${penalizacion} puntos`);
      console.log(`📧 Email: ${email}`);
      await enviarPuntosAGoRace(email, penalizacion);
    }
    */
  }

  res.status(200).send('OK');

});




// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
