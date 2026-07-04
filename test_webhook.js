const payload = {
  "results": [
    {
      "from": "385919998888",
      "to": "41793026731",
      "integrationType": "WHATSAPP",
      "receivedAt": "2025-01-01T10:10:00.000+0000",
      "messageId": "wamid.HBgLMjc4MTMzMjE0ODIVAgAonoIAUsydhfskYyRDdEMjE4Njg3MzlBMDU2NzI4NgA=",
      "callbackData": "callbackData",
      "message": {
        "text": "Hello, World!",
        "type": "TEXT"
      },
      "price": {
        "pricePerMessage": 0,
        "currency": "EUR"
      },
      "contact": {
        "name": "Frank",
        "phoneNumber": "385919998888",
        "userId": "HR.123123123",
        "parentUserId": "HR.ENT.456456456",
        "username": "Frank"
      }
    }
  ],
  "messageCount": 1,
  "pendingMessageCount": 0
};

fetch("https://waba-flame.vercel.app/api/webhook/whatsapp?token=bunny@6010", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
}).then(res => res.text()).then(console.log).catch(console.error);
