const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = 3001; // Choose any port you prefer
var base64 = require('base-64');

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
// Endpoint to fetch MoMo token
app.get('/', (req, res) => {
		res.send('Hello World!');
});

app.post('/get-momo-token', async (req, res) => {
		try {
				const { apiKey, subscriptionKey } = req.body;
				console.log(apiKey, subscriptionKey);

				const momoTokenResponse = await axios.post(
						momoTokenUrl,
						{},
						{
								headers: {
										'Content-Type': 'application/json',
										'Ocp-Apim-Subscription-Key': subscriptionKey,
										Authorization: `Basic ${encodedData}`,
								},
						}
				);
						console.log(momoTokenResponse.data);
				momoToken = momoTokenResponse.data.access_token;

				res.json({ momoToken });
		} catch (error) {
				console.error(error);
				res.status(500).json({ error: 'An error occurred' });
		}
});

// Endpoint to make a request to pay
app.post('/request-to-pay', async (req, res) => {





  try {

    
   
    if (!momoToken) {
      return res.status(400).json({ error: 'MoMo token not available' });
    }

    const { total, phone } = req.body;

    const body = {
      amount: total,
      currency: 'UGX',
      externalId: 'c8f060db-5126-47a7-a67b-2fee08c0f30d',
      payer: {
        partyIdType: phone,
        partyId: 46733123454,
      },
      payerMessage: 'Payment for order',
      payeeNote: 'Payment for order',
    };

    const momoResponse = await axios.post(
      momoRequestToPayUrl,
      body,
      {
        headers: {
										'X-Reference-Id': 'c8f060db-5126-47a7-a67b-2fee077930c',
										'X-Target-Environment': 'mtnuganda',
										'Ocp-Apim-Subscription-Key':'13dfa4a0af1e48f0ab2114635c9319d9',
										Authorization: `Bearer: ${momoToken}`,
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



app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
