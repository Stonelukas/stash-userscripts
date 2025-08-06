// Test popup script
document.addEventListener('DOMContentLoaded', () => {
    const output = document.getElementById('output');
    
    document.getElementById('get').addEventListener('click', async () => {
        const data = await chrome.storage.local.get(null);
        output.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    });
    
    document.getElementById('set').addEventListener('click', async () => {
        await chrome.storage.local.set({ 
            enableAutomateStash: true,
            enableBulkOperations: false,
            testValue: new Date().toISOString()
        });
        output.innerHTML = '<p>Values set!</p>';
    });
    
    document.getElementById('clear').addEventListener('click', async () => {
        await chrome.storage.local.clear();
        output.innerHTML = '<p>Storage cleared!</p>';
    });
});