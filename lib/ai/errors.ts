export function aiErrorMessage(error: unknown): string {
  const value = error as { status?: number; code?: string; message?: string }
  if (value?.status === 401) return "AUTH_ERROR"
  if (value?.status === 403) return "Accès refusé : vérifiez les droits de votre compte et du modèle."
  if (value?.status === 429) return "RATE_LIMIT"
  if (value?.status === 404) return "Modèle ou endpoint introuvable. Vérifiez le modèle, l’URL et le protocole."
  if (value?.status === 400 || value?.status === 422) return "Requête IA refusée : vérifiez que le modèle prend en charge le protocole et les outils."
  if (value?.code === "subscription_sharing_user_not_eligible") return "Ce compte n’est pas éligible à l’utilisation de son abonnement dans l’application."
  // Do not send upstream response bodies/headers (which may contain secrets) to clients.
  return "Le service IA n’a pas terminé la requête. Vérifiez la connexion et réessayez."
}
