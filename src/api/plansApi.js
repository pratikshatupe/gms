import { apiJson } from './http';

/**
 * Public plans catalogue used by the Create Organisation modal "Choose
 * Plan" step. Failure to reach the backend is non-fatal — the modal
 * falls back to the static PLANS_REG defaults so signup still works
 * offline / in demo mode.
 */
export async function fetchPlans() {
  try {
    const json = await apiJson('/plans');
    const list = json?.data || [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function fetchPlanById(id) {
  try {
    const json = await apiJson(`/plans/${id}`);
    return json?.data || null;
  } catch {
    return null;
  }
}
