
Install the packages
- googleapis
- uuid
 
The port should be 3000 beacuse it where the app is configed and the route should stay the same

```js
const express = require('express');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const {v4 :uuidv4}=require('uuid')

const CLIENT_ID = '258347103096-i4rfpvh91lnodedd3vh2se9328un3emt.apps.googleusercontent.com'
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/redirect';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const oAuth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const app = express();
const PORT = 3000;
// the enry point 
app.get('/', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.send(`<a href="${authUrl}">Authorize with Google</a>`);
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
```