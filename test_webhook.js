const payload = {
  "results": [
    {
      "from": "919604136010",
      "to": "15558835946",
      "integrationType": "WHATSAPP",
      "receivedAt": "2025-01-01T10:10:00.000+0000",
      "messageId": "wamid.REAL_TEST_123",
      "message": {
        "text": "Hi",
        "type": "TEXT"
      }
    }
  ]
};

fetch("https://waba-flame.vercel.app/api/webhook/whatsapp?token=bunny@6010", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
}).then(res => res.text()).then(console.log).catch(console.error);
