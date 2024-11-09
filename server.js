const http = require('http');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { exec, spawnSync } = require('child_process');

const app = express();
const PORT = 3000;

const USERNAME = 'admin';
const PASSWORD = 'admin';
const TOKEN_SECRET = 'mysecrettoken';
let currentSessionToken = null;
let uploadCounter = 0;

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

// Middleware to check token-based session
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token && token === `Bearer ${currentSessionToken}`) {
    next();
  } else {
    res.status(403).send('Forbidden');
  }
};

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === USERNAME && password === PASSWORD) {
    currentSessionToken = TOKEN_SECRET;
    res.json({ token: currentSessionToken });
  } else {
    res.status(401).send('Unauthorized');
  }
});


let callOllama = (obj, onData, onError) => {
const options = {
    hostname: 'localhost',
    port: '11434',
    path: '/api/generate',
    method: 'POST'
};
console.log
const req = http.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        onData(data);
    });
});
req.on("error", (err) => {
    onError(err);
});
req.write(JSON.stringify(obj));
req.end();
};

// Image upload endpoint
app.post('/upload', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const sessionDir = `uploads/session_${TOKEN_SECRET}`;
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir);
  }

  uploadCounter++;
  const newFilePath = `${sessionDir}/image_${uploadCounter}.jpg`;
  fs.renameSync(req.file.path, newFilePath);
  const base64Encoded = fs.readFileSync(newFilePath, 'base64');
  callOllama({ "model": "llama3.2-vision", 
           "prompt": "In the image, there must be bill of sale. If it is not bill of sale then answer one word: ```ERROR```."+
           " If it is bill of sale then answer with the CSV row. CSV must use semicolon as a field separator. Do not comment or explain your thoughts. Comma sign in the amount payed must be interpreted as decimal separator." +
           " If you are not sure about the company name, then write 'unknown' as <company name>. Do not add quotation marks around date or other fields." + 
           " Use decimal point in values." +
           " Columns must be:\n\n```\n<company name>;<date of sale in YYYY-MM-DD format without any quotation marks>;<the total amount payed without currency symbol or code>;<ISO 4217 currency code>\n```\n",
           "stream": false,
           "images":[`${base64Encoded}`] 
           },
           (data) => {
			   res.json({ response: JSON.parse(data).response })
		   },
		   (error) => {
			   res.status(500).send('Error processing image: ' + error);
		   }
          )
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
