const https = require('https');
const fs = require('fs');

// Downloading a safe, standard Linux executable (BusyBox)
const url = "https://busybox.net/downloads/binaries/1.31.0-defconfig-multiarch-musl/busybox-x86_64";
const file = fs.createWriteStream("example_binary.elf");

console.log("Downloading ELF binary...");

https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log("✅ Success! 'example_binary.elf' is now in your folder.");
    });
}).on('error', (err) => {
    console.error("Error downloading file: ", err.message);
});