const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function get(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  return res.json();
}

export async function post(path: string, body: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

export default { get, post };
