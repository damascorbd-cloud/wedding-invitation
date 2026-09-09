const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

// 1. DATABASE CONNECTION
const mongoURI = 'mongodb+srv://damascorbd_db_user:ryan198424@cluster0.cdsqfyv.mongodb.net/wedding_db?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoURI)
.then(() => console.log("SUCCESS NA! Database Connected na!"))
.catch(err => console.log("ETO ANG ERROR SA MONGODB:", err));

// Master Guest Schema
const guestSchema = new mongoose.Schema({
    guestName: String,
    token: { type: String, unique: true },
    deviceFingerprint: { type: String, default: null },
    attendance: { type: String, default: null },
    guestEmail: { type: String, default: null },
    message: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});
const Guest = mongoose.model('Guest', guestSchema);

// 2. ADMIN UI: Built-in page para sa /admin/generate kung gugustuhin mo
app.get('/admin/generate', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Generate Guest Link</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; padding: 40px; display: flex; justify-content: center; }
                .card { background: white; padding: 30px; border-radius: 10px; width: 100%; max-width: 450px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                h2 { color: #4F46E5; text-align: center; margin-top: 0; }
                label { display: block; margin-top: 15px; font-weight: 600; font-size: 14px; color: #374151; }
                input { width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; }
                button { background: #4F46E5; color: white; border: none; padding: 12px; width: 100%; border-radius: 6px; font-weight: bold; margin-top: 20px; cursor: pointer; }
                button:hover { background: #4338ca; }
                .result { margin-top: 20px; background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 6px; word-break: break-all; font-size: 13px; display: none; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Generate Guest Link</h2>
                <form id="genForm">
                    <label>Guest Full Name:</label>
                    <input type="text" id="name" placeholder="Hal. Juan Dela Cruz" required>
                    <button type="submit">Create Link</button>
                </form>
                <div id="resultBox" class="result"></div>
            </div>
            <script>
                document.getElementById('genForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const name = document.getElementById('name').value;
                    const res = await fetch(\`/api/admin/generate-token\`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ guestName: name })
                    });
                    const data = await res.json();
                    const box = document.getElementById('resultBox');
                    if (data.success) {
                        box.style.display = 'block';
                        box.innerHTML = \`<b>Eksklusibong Link para kay \${name}:</b><br><br><a href="\${data.uniqueLink}" target="_blank">\${data.uniqueLink}</a>\`;
                    } else {
                        alert('Error: ' + data.message);
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// 3. API ENDPOINT (Sinusuportahan na ang POST galing sa iyong Netlify admin.html)
app.post('/api/admin/generate-token', async (req, res) => {
    try {
        const { guestName } = req.body;
        if (!guestName) {
            return res.status(400).json({ success: false, message: 'Ibigay ang pangalan ng bisita.' });
        }

        const token = crypto.randomBytes(16).toString('hex');
        const newGuest = new Guest({ guestName, token });
        await newGuest.save();

        // Nakaturo na sa iyong live Netlify frontend URL
        const frontendUrl = "https://aldringotcharm.netlify.app/"; 
        const uniqueLink = `${frontendUrl}?token=${token}`;
        
        res.status(200).json({
            success: true,
            message: `Na-generate na ang link para kay ${guestName}!`,
            token: token,
            uniqueLink: uniqueLink
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Support din kung GET ang gamitin sa /api/guest/add
app.get('/api/guest/add', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Ibigay ang pangalan ng bisita.' });
        }

        const token = crypto.randomBytes(16).toString('hex');
        const newGuest = new Guest({ guestName: name, token });
        await newGuest.save();

        const frontendUrl = "https://aldringotcharm.netlify.app/"; 
        const uniqueLink = `${frontendUrl}?token=${token}`;
        
        res.status(200).json({
            success: true,
            message: `Na-generate na ang link para kay ${name}!`,
            uniqueLink
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. API ENDPOINT: I-verify ang Token at Device
app.get('/api/verify-guest', async (req, res) => {
    try {
        const { token, ua } = req.query;
        const guest = await Guest.findOne({ token });

        if (!guest) {
            return res.json({ success: false });
        }

        if (guest.deviceFingerprint && guest.deviceFingerprint !== ua) {
            const bibleVerses = [
                "\"Proverbs 19:5 - A false witness will not go unpunished, and whoever pours out lies will not go free.\"",
                "\"Proverbs 12:22 - Lying lips are an abomination to the Lord, but those who act faithfully are his delight.\"",
                "\"Ephesians 4:25 - Therefore, having put away falsehood, let each one of you speak the truth with his neighbor.\""
            ];
            const randomVerse = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
            return res.json({ success: false, verse: randomVerse });
        }

        if (!guest.deviceFingerprint) {
            guest.deviceFingerprint = ua;
            await guest.save();
        }

        res.json({ success: true, guestName: guest.guestName });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. API ENDPOINT: Pag-submit ng RSVP
app.post('/api/rsvp/submit', async (req, res) => {
    try {
        const { token, guestName, guestEmail, attendance, message } = req.body;
        const guest = await Guest.findOne({ token });

        if (!guest) {
            return res.status(404).json({ success: false, error: 'Invalid guest token.' });
        }

        guest.guestName = guestName || guest.guestName;
        guest.guestEmail = guestEmail;
        guest.attendance = attendance;
        guest.message = message;
        await guest.save();

        res.status(200).json({ success: true, message: 'RSVP submitted successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. ADMIN DASHBOARD: Tingnan ang mga nag-RSVP
app.get('/api/rsvp/list', async (req, res) => {
    try {
        const allGuests = await Guest.find().sort({ createdAt: -1 });
        const attending = allGuests.filter(g => g.attendance === 'Joyfully accepts');

        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Admin Dashboard - Wedding RSVP</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; padding: 30px; color: #333; }
                    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                    h1 { color: #4F46E5; text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
                    th { background-color: #4F46E5; color: white; }
                    .badge-yes { background: #dcfce7; color: #166534; padding: 5px 10px; border-radius: 20px; font-weight: 600; font-size: 12px; }
                    .badge-no { background: #fee2e2; color: #991b1b; padding: 5px 10px; border-radius: 20px; font-weight: 600; font-size: 12px; }
                    .badge-pending { background: #fef3c7; color: #92400e; padding: 5px 10px; border-radius: 20px; font-weight: 600; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>💍 Guest List & RSVP Status</h1>
                    <p>Total Invited: <b>${allGuests.length}</b> | Attending: <b>${attending.length}</b></p>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Message</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allGuests.map((g, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td><b>${g.guestName}</b></td>
                                    <td>${g.guestEmail || '-'}</td>
                                    <td>
                                        <span class="${g.attendance === 'Joyfully accepts' ? 'badge-yes' : g.attendance === 'Regretfully declines' ? 'badge-no' : 'badge-pending'}">
                                            ${g.attendance || 'Pending / Not yet opened'}
                                        </span>
                                    </td>
                                    <td><em>${g.message || '-'}</em></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});
