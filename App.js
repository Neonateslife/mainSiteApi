
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const port = 3000; // Choose any port you prefer
var base64 = require('base-64');
const express = require('express');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const { v4: uuidv4 } = require('uuid')
const app = express();
const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Replace escaped newline characters
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
};


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
app.use(bodyParser.json());
app.use(cors({
  allowedHeaders: "*"
})); // Enable CORS for all routes

const momoHost = 'proxy.momoapi.mtn.com';
const momoTokenUrl = `https://${momoHost}/collection/token/`;
const momoRequestToPayUrl = `https://${momoHost}/collection/v1_0/requesttopay`;

const momoPaymentStatusUrl = `https://${momoHost}/collection/v2_0/payment/`;
let momoToken = null;
var encodedData = base64.encode("491bece6-0474-4e71-9209-ac54bb653edd:e4e3fcbceeee4f4a8bca9ac334e5ce25");
console.log("the encoded is " + encodedData);

// Endpoint to fetch MoMo token and request payment
app.post('/pay', async (req, res) => {
  try {
    const { total, phone,bookingId } = req.body;
    // const {bookingId } = req.query;
    console.log("the booking id is", bookingId)
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

    // Step 2: Make request to pay
    const referenceId = uuidv4();
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
          'X-Reference-Id': referenceId,
          'X-Target-Environment': 'mtnuganda',
          'Ocp-Apim-Subscription-Key': '04a79371a8834513a4031e5f4bf0778f',
          Authorization: `Bearer ${momoToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    let times=0
    // Step 3: Regenerate MoMo token
    setTimeout(async () => {
      try {
        const newTokenResponse = await axios.post(
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

        const newMomoToken = newTokenResponse.data.access_token;

        // Step 4: Get payment status
        const paymentStatusResponse = await axios.get(
          `${momoPaymentStatusUrl}${referenceId}`,
          {
            headers: {
              'X-Target-Environment': 'mtnuganda',
              'Ocp-Apim-Subscription-Key': '04a79371a8834513a4031e5f4bf0778f',
              Authorization: `Bearer ${newMomoToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if(paymentStatusResponse.data.status == 'SUCCESSFUL'){
          return res.json({ momoResponse: momoResponse.data, paymentStatus: paymentStatusResponse.data });
        }else if(paymentStatusResponse.data.status == 'PENDING'){
          res.json({ momoResponse: momoResponse.data, paymentStatus: paymentStatusResponse.data });
        } else{
          // this call the payment process again
          if(times>2){
            times++
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
          }else{
          return res.json({ momoResponse: momoResponse.data, paymentStatus: paymentStatusResponse.data })
          }

        }
      } catch (statusError) {
        console.error(statusError);
        res.status(500).json({ error: 'An error occurred while fetching payment status' });
      }
    }, 30000);

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
const UserId = {
  userId: '',
  doctorId: '',
  meetingLink: '',
  id: '',
  bookingId:''
}

// the enry point 
app.get('/', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  //this the id picked from the id from the frontend use this id
  const {bookingId } = req.query;
  console.log("the bookig id from server is ",bookingId)
  // UserId.email = email;
  UserId.bookingId = bookingId; 
console.log("the user is ", UserId.bookingId)
  res.redirect(authUrl);
});
//  the redirect route to handle the concent
app.get('/redirect', async (req, res) => {
  const code = req.query.code;
  console.log('Code:', UserId);
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    console.log('Access Token:', tokens);
    oAuth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

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
    console.log('Meeting URL:', meetUrl);

    UserId.meeting = meetUrl;
    UserId.id = uuidv4();
    const isInitialized = admin.apps.length > 0;

    if (isInitialized) {
      const { meeting, id, bookingId } = UserId;
      console.log('Meeting:', meeting);
      console.log('ID:', id);
      console.log('Booking ID:', bookingId);

      // if (!userId || !doctorId || !meetingLink || !id || !bookingId) {
      //   return res.status(400).json({ error: 'Missing required fields' });
      // }

      const timestamp = admin.firestore.Timestamp.now();

      // Update the booking with the Hangout link
      const bookingRef = db.collection('bookings').doc(bookingId);
      await bookingRef.update({
        meetingLink: meetUrl,
      });
      console.log('Booking updated successfully.');

    } else {
      res.status(500).render('./404.html');
      return;
    }
    res.redirect('http://localhost:5173/sign-in')
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.status(500).send('Error during authentication');
  }
});




// Endpoint to check Firebase initialization status
app.get('/firebase-status', async (req, res) => {
  try {
    // Check if Firebase Admin app has been initialized

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});
app.post('/save-data', async (req, res) => {
  try {

    res.status(201).json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
