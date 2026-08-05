fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY)
  .then(r => r.json())
  .then(d => {
    console.log(d.models.map(m => m.name).filter(n => n.includes('flash')));
  });
