const fs = require('fs');

const html = fs.readFileSync('C:/Users/selvin/Downloads/2026-03-30-ZAP-Report-.html', 'utf8');

function extractSection(id) {
    const startIdx = html.indexOf(`id="${id}"`);
    if (startIdx === -1) return `Section ${id} not found`;
    const nextSectionIdx = html.indexOf(`id="alert-type-`, startIdx + 10);
    const endIdx = nextSectionIdx !== -1 ? nextSectionIdx : html.length;
    return html.substring(startIdx, endIdx);
}

const hstsSection = extractSection('alert-type-5');
const commentsSection = extractSection('alert-type-9');

console.log("=== HSTS ===");
const hstsUris = [...hstsSection.matchAll(/<td class="word-wrapable">([^<]+)<\/td>/g)].map(m => m[1]);
console.log(hstsUris.filter(u => u.includes('http')).slice(0, 10));

console.log("\n=== Comments ===");
const commentsUris = [...commentsSection.matchAll(/<td class="word-wrapable">([^<]+)<\/td>/g)].map(m => m[1]);
console.log(commentsUris.filter(u => u.includes('http')).slice(0, 10));
