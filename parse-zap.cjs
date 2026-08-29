const fs = require('fs');
const html = fs.readFileSync('C:/Users/selvin/Downloads/2026-03-30-ZAP-Report-.html', 'utf8');

const regex = /<li\s+id="alert-type-(\d+)">([\s\S]*?)<\/ul>\s*<\/li>\s*<\/ul>\s*<\/li>/g;
// actually, let's just use simple split
const alerts = html.split('<li\n						id="alert-type-');

for (let i = 1; i < Math.min(alerts.length, 20); i++) {
    const chunk = alerts[i];
    if (chunk.includes('gen-lang-client-0683754671.web.app')) {
        const titleMatch = chunk.match(/<h4>([^<]+)<\/h4>/);
        const title = titleMatch ? titleMatch[1] : 'Unknown';
        console.log(`- ${title}`);
    }
}
