
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const port = 3000; // Choose any port you prefer
var base64 = require('base-64');
const express = require('express');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const {v4 :uuidv4}=require('uuid')
const app = express();

app.use(bodyParser.json());
app.use(cors( {
  allowedHeaders:"*"
})); // Enable CORS for all routes

const momoHost = 'proxy.momoapi.mtn.com';
const momoTokenUrl = `https://${momoHost}/collection/token/`;
const momoRequestToPayUrl = `https://${momoHost}/collection/v1_0/requesttopay`;

const momoPaymentStatusUrl = `https://${momoHost}/collection/v2_0/payment/`;
let momoToken = null;
var encodedData = base64.encode( "491bece6-0474-4e71-9209-ac54bb653edd:e4e3fcbceeee4f4a8bca9ac334e5ce25");
console.log("the encoded is " + encodedData);


// Endpoint to fetch MoMo token and request payment
app.post('/pay', async (req, res) => {
  try {
    const { total, phone } = req.body;

    // Step 1: Get MoMo token
    const tokenResponse = await axios.post(
      momoTokenUrl,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key':'04a79371a8834513a4031e5f4bf0778f',
          Authorization: `Basic ${encodedData}`,
        },
      }
    );

    const momoToken = tokenResponse.data.access_token;

    // Step 2: Make request to pay
    const referenceId = uuidv4();
    console.log(referenceId);
    const body = {
      amount: total,
      currency: 'UGX',
      externalId: uuidv4(),
      payer: {
        partyIdType: 'MSISDN',
        partyId: phone.startsWith('+') ? phone.substring(1) : phone,
      },
      payerMessage: 'Payment for order',
      payeeNote: 'Payment for order',
    };

    const momoResponse = await axios.post(
      momoRequestToPayUrl,
      body,
      {
        headers: {
          'X-Reference-Id': referenceId ,
          'X-Target-Environment': 'mtnuganda',
          'Ocp-Apim-Subscription-Key': '04a79371a8834513a4031e5f4bf0778f',
          Authorization: `Bearer ${momoToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ momoResponse: momoResponse.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// Endpoint to get payment status
app.get('/payment-status/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;

    // Step 1: Get MoMo token
    const tokenResponse = await axios.post(
      momoTokenUrl,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': '04a79371a8834513a4031e5f4bf0778f',
          Authorization: `Basic ${encodedData}`,
        },
      }
    );

    const momoToken = tokenResponse.data.access_token;

    // Step 2: Get payment status
    const paymentStatusResponse = await axios.get(
      `${momoPaymentStatusUrl}${referenceId}`,
      {
        headers: {
          'X-Target-Environment': 'mtnuganda',
          'Ocp-Apim-Subscription-Key': '04a79371a8834513a4031e5f4bf0778f',
          Authorization: `Bearer ${momoToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(paymentStatusResponse.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});
const CLIENT_ID = '258347103096-i4rfpvh91lnodedd3vh2se9328un3emt.apps.googleusercontent.com'
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/redirect';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const oAuth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);


// the enry point 
app.get('/', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.redirect(authUrl);
});
//  the redirect route to handle the concent
app.get('/redirect', async (req, res) => {
  const code = req.query.code;
  console.log('Code:', code);
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    console.log('Access Token:', tokens);
    oAuth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // Create an event with a Meet link
    const event = {
      summary: 'My Important Meeting',
      description: 'A chance to talk with important people.',
      start: {
        dateTime: '2024-06-03T10:00:00Z',
        timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: '2024-06-03T10:30:00Z',
        timeZone: 'America/Los_Angeles',
      },
      attendees: [
        { email: 'kalungirasuli495@gmail.com' },
        { email: 'kalungirasu@gmail.com' },
      ],
      conferenceData: {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
    });

    const meetUrl = response.data.hangoutLink;
    // the meet link returned
    res.send(`Meet URL: <a href="${meetUrl}">${meetUrl}</a>`);
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.status(500).send('Error during authentication');
  }
});



app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
