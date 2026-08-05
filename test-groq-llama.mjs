async function testGroqLlama() {
  const prompt = `
    You are an expert AI finance keeper.
    Extract the transaction details from the user's speech.
    User speech: "Chai koodichathinu 20 roopa"
    Respond strictly in JSON:
    {
      "type": "EXPENSE" or "INCOME",
      "amount": number,
      "category": "Food" | "Transport" | "Shopping" | "Bills" | "Entertainment" | "Salary" | "Other",
      "description": "Short English summary"
    }
  `;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
    const data = await res.json();
    console.log("Llama 3.3 Result:", data.choices[0].message.content);
  } catch (err) {
    console.error("Error:", err);
  }
}
testGroqLlama();
