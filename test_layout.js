const fs = require('fs');
fetch('http://localhost:3000/_next/static/chunks/app/layout.js').then(r => r.text()).then(text => {
    const lines = text.split('\n');
    console.log("Total lines:", lines.length);
    if (lines.length > 885) {
        let codeStr = lines[885];
        console.log("Starts with:", codeStr.substring(0, 100));
        // Simple extraction: find the string inside eval(__webpack_require__.ts(" ... "));
        // actually just look at the whole file for the syntax error string
        try {
            new Function(text);
            console.log("File parsed by new Function without error");
        } catch (e) {
            console.log("Global parse error:", e.name, e.message);
        }
        
        const match = codeStr.match(/eval\("(.*)"\);/);
        if (match) {
            let innerCode = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            try {
                new Function(innerCode);
                console.log("Inner parse OK");
            } catch (e) {
                console.log("Inner parse error:", e.name, e.message);
                // find where
                const linesInner = innerCode.split('\n');
                for (let i=0; i<linesInner.length; i++) {
                    try {
                        new Function(linesInner.slice(0, i+1).join('\n'));
                    } catch (e2) {
                        if (e2.message !== "Unexpected end of input") {
                            console.log("Error likely at line", i+1, linesInner[i]);
                            break;
                        }
                    }
                }
            }
        } else {
             // In dev it's typically eval(__webpack_require__.ts(" ... "))
             let match2 = codeStr.match(/__webpack_require__\.ts\("(.*?)"\);/);
             if (match2) {
                 let innerCode = match2[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                 try {
                     new Function(innerCode);
                     console.log("Inner parse OK");
                 } catch (e) {
                     console.log("Inner parse error:", e.name, e.message);
                     const linesInner = innerCode.split('\n');
                     for (let i=0; i<linesInner.length; i++) {
                         try {
                             new Function(linesInner.slice(0, i+1).join('\n'));
                         } catch (e2) {
                             if (e2.message !== "Unexpected end of input" && !e2.message.includes("Unexpected token")) {
                                 // Wait, if it's an unexpected token, maybe it's the real error!
                                 if (e2.message === "Invalid or unexpected token") {
                                     console.log("Error at line", i+1, ":", linesInner[i]);
                                     console.log("Context:");
                                     for(let j=Math.max(0, i-1); j<Math.min(linesInner.length, i+6); j++) {
                                        console.log(j+1, ":", linesInner[j]);
                                     }
                                     break;
                                 }
                             }
                         }
                     }
                 }
             }
        }
    }
}).catch(console.error);
