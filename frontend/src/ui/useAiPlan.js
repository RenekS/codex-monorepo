// src/hooks/useAiPlan.js
export default function useAiPlan(apiBase = process.env.REACT_APP_API_URL) {
  const planWithAI = async ({ selected, startTime, serviceMin, workWindow }) => {
    if (!selected || selected.length < 2) return null;

    const candidates = selected.map((p, i) => ({
      localIndex: i,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      desired: p.desired || '',
      durationMin: Number(p.durationMin || serviceMin || 30)
    }));

    const res = await fetch(`${apiBase}/api/ai/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates,
        startTime: startTime || '08:00',
        defaultDurationMin: Number(serviceMin || 30),
        workWindow: workWindow || null
      })
    });

    const json = await res.json();
    if (!res.ok || !json?.success) throw new Error(json?.error || 'AI plán selhal');

    return json; // { success:true, order:[...], notes:"..." }
  };

  return { planWithAI };
}
