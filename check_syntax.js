const fs = require('fs');
fetch('http://localhost:3000/_next/static/chunks/app/layout.js').then(r => r.text()).then(text => {
    const lines = text.split('\n');
    const line = lines[885];
    try {
        new Function(line);
        console.log("Line parses OK in Node!");
    } catch (e) {
        console.log("Line parse error:", e.name, e.message);
        // Find exactly where the error is
        let validUpTo = 0;
        for (let i = 1; i <= line.length; i++) {
            try {
                new Function(line.substring(0, i));
            } catch (err) {
                if (err.message !== "Unexpected end of input" && err.message !== "Invalid or unexpected token") {
                    console.log("Fails differently at", i, ":", err.message);
                }
            }
        }
        // Write the line to a file so we can inspect it manually or run it directly
        fs.writeFileSync('error_line.js', line);
        console.log("Wrote error_line.js. Length:", line.length);
    }
}).catch(console.error);
