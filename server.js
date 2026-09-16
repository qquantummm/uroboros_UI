const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Configure file uploads to a temporary directory
const upload = multer({ dest: 'uploads/' });

app.post('/api/disassemble', upload.single('binary'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  const filePath = req.file.path;
  
  // Run Uroboros on the uploaded file. 
  // NOTE: Uroboros must be installed/configured on the server environment.
  exec(`python3 path/to/uroboros.py ${filePath}`, (error, stdout, stderr) => {
     if (error) {
         return res.status(500).json({ error: 'Uroboros execution failed', details: stderr });
     }
     
     // Uroboros outputs the disassembled code to 'final.s'
     fs.readFile('final.s', 'utf8', (err, data) => {
         if (err) return res.status(500).json({ error: 'Failed to read output file' });
         
         // Send the code back to React
         res.json({ code: data });
     });
  });
});

app.listen(3001, () => console.log('Backend running on port 3001'));