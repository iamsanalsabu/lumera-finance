async function testGroqKey() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      }
    });
    const data = await res.json();
    if (res.ok) {
      console.log("SUCCESS! Groq Key is valid. Available models count:", data.data?.length);
    } else {
      console.error("Groq Key Error:", data);
    }
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
testGroqKey();
