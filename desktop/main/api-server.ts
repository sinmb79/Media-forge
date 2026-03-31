export async function fetchDashboardHealth(url: string): Promise<unknown> {
  const response = await fetch(new URL("/api/health", url));

  if (!response.ok) {
    throw new Error(`Dashboard health check failed with ${response.status}.`);
  }

  return response.json();
}
