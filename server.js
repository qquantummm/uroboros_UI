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
    
    // FIX 1: Point back to the root of the engine, NOT 'src'
    const uroborosDir = path.resolve(__dirname, 'uroboros-engine');
    
    // FIX 2: Smart Execution fallback. Check if the Python wrapper exists; if not, use the native OCaml binary.
    const pythonScript = path.join(uroborosDir, 'uroboros.py');
    const nativeBinary = path.join(uroborosDir, 'src', 'uroboros');
    
    let command = '';
    if (fs.existsSync(pythonScript)) {
        command = `python3 uroboros.py ${binaryPath}`;
    } else if (fs.existsSync(nativeBinary)) {
        command = `./src/uroboros ${binaryPath}`;
    } else {
        fs.unlink(binaryPath, () => {});
        return res.status(500).json({ error: "Uroboros engine not found. Docker compilation likely failed." });
    }

    console.log(`Executing command: ${command}`);

    exec(command, { cwd: uroborosDir }, (error, stdout, stderr) => {
        // Clean up the uploaded ELF file
        fs.unlink(binaryPath, () => {});

        if (error) {
            console.error("Uroboros crashed:", stderr || error.message);
            return res.status(500).json({ error: stderr || error.message });
        }
        
        // FIX 3: Read the actual output file. Uroboros saves the assembly to 'final.s'.
        const outputPath = path.join(uroborosDir, 'final.s');
        
        if (fs.existsSync(outputPath)) {
            const assemblyCode = fs.readFileSync(outputPath, 'utf8');
            fs.unlink(outputPath, () => {}); // Clean up the output file so it's ready for the next request
            res.json({ code: assemblyCode });
        } else {
            res.status(500).json({ error: "Uroboros completed, but final.s was not generated." });
        }
    });
});

app.listen(3001, () => {
    console.log('Real Uroboros Backend running on port 3001');
});