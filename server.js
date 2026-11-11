const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.post('/api/disassemble', upload.single('binary'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No binary file provided.' });
    }

    const binaryPath = path.resolve(req.file.path);
    const rootDir = path.resolve(__dirname, 'uroboros-engine');
    const srcDir = path.resolve(__dirname, 'uroboros-engine', 'src');

    // Automatically detect whether uroboros.py is in src/ or the root folder
    let workDir = rootDir;
    if (fs.existsSync(path.join(srcDir, 'uroboros.py'))) {
        workDir = srcDir;
    }

    const command = `python3 uroboros.py "${binaryPath}"`;
    console.log(`Executing "${command}" inside ${workDir}`);

    exec(command, { cwd: workDir }, (error, stdout, stderr) => {
        fs.unlink(binaryPath, () => {});

        const outputPath = path.join(workDir, 'final.s');
        if (fs.existsSync(outputPath)) {
            const assemblyCode = fs.readFileSync(outputPath, 'utf8');
            fs.unlink(outputPath, () => {});
            return res.json({ code: assemblyCode });
        }

        if (error) {
            console.error("Uroboros failed:", stderr || stdout || error.message);
            return res.status(500).json({ error: stderr || stdout || error.message });
        }

        res.json({ code: stdout || "// Disassembly completed, but final.s was not produced." });
    });
});

app.listen(3001, () => {
    console.log('Real Uroboros Backend running on port 3001');
});