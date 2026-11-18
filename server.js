const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());

// Increase body limit to 50mb so full assembly files aren't rejected
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const upload = multer({ dest: 'uploads/' });

function getWorkDir() {
    const rootDir = path.resolve(__dirname, 'uroboros-engine');
    const srcDir = path.resolve(__dirname, 'uroboros-engine', 'src');
    if (fs.existsSync(path.join(srcDir, 'uroboros.py'))) {
        return srcDir;
    }
    return rootDir;
}

// Helper: Resolve any S_0x... symbols that Uroboros referenced but didn't define as labels
function patchMissingUroborosSymbols(assembly) {
    const definedLabels = new Set();
    const labelRegex = /\b(S_0x[0-9a-fA-F]+)\s*:/g;
    let match;

    while ((match = labelRegex.exec(assembly)) !== null) {
        definedLabels.add(match[1]);
    }

    const missingSymbols = new Map();
    const refRegex = /\b(S_0x([0-9a-fA-F]+))\b/g;

    while ((match = refRegex.exec(assembly)) !== null) {
        const fullSym = match[1];
        const hexAddr = match[2];
        if (!definedLabels.has(fullSym) && !missingSymbols.has(fullSym)) {
            missingSymbols.set(fullSym, hexAddr);
        }
    }

    if (missingSymbols.size === 0) {
        return assembly;
    }

    let footer = '\n/* Auto-resolved missing Uroboros address symbols */\n';
    for (const [sym, hex] of missingSymbols.entries()) {
        footer += `.set ${sym}, 0x${hex}\n`;
    }

    console.log(`Auto-resolved ${missingSymbols.size} missing Uroboros symbol(s).`);
    return assembly + footer;
}

// 1. Disassemble Endpoint (ELF -> final.s)
app.post('/api/disassemble', upload.single('binary'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No binary file provided.' });
    }

    const binaryPath = path.resolve(req.file.path);
    const workDir = getWorkDir();

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

// 2. Reassemble Endpoint (Edited Assembly -> ELF Binary)
app.post('/api/reassemble', (req, res) => {
    const { assembly, originalName } = req.body;

    if (!assembly) {
        return res.status(400).json({ error: 'No assembly code provided.' });
    }

    const workDir = getWorkDir();
    const buildDir = fs.existsSync(workDir) ? workDir : __dirname;

    const asmPath = path.join(buildDir, 'final.s');
    const outBinaryPath = path.join(buildDir, `rebuilt_${Date.now()}.elf`);

    try {
        const patchedAssembly = patchMissingUroborosSymbols(assembly);
        fs.writeFileSync(asmPath, patchedAssembly, 'utf8');
    } catch (writeErr) {
        return res.status(500).json({ error: `Failed to save assembly: ${writeErr.message}` });
    }

    // Detect 64-bit vs 32-bit from register names so we never run -m32 on 64-bit assembly
    const is64Bit = /%r(sp|bp|ax|bx|cx|dx|di|si|8|9|1[0-5])\b/.test(assembly);
    const archFlag = is64Bit ? '-m64' : '-m32';
    const libs = '-lm -lpthread -ldl -lrt';

    // Compile with GCC; if any external symbol is still unresolved, ignore unresolved object symbols
    const compileCmd = `gcc ${archFlag} -no-pie "${asmPath}" ${libs} -o "${outBinaryPath}" || gcc ${archFlag} -no-pie -Wl,--unresolved-symbols=ignore-in-object-files "${asmPath}" ${libs} -o "${outBinaryPath}"`;
    console.log(`Reassembling (${is64Bit ? '64-bit' : '32-bit'}) binary into ${outBinaryPath}`);

    exec(compileCmd, { cwd: buildDir, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
        fs.unlink(asmPath, () => {});

        if (fs.existsSync(outBinaryPath)) {
            return res.download(outBinaryPath, `reassembled_${originalName || 'out.elf'}`, () => {
                fs.unlink(outBinaryPath, () => {});
            });
        }

        console.error("Reassembly failed:", stderr || error?.message);
        return res.status(500).json({
            error: stderr || error?.message || 'GCC failed to reassemble final.s.'
        });
    });
});

app.listen(3001, () => {
    console.log('Real Uroboros Backend running on port 3001');
});