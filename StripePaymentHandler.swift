import SwiftUI

// Dans la définition de la structure DreamInsightApp
@UIApplicationDelegateAdaptor private var appDelegate: AppDelegate

// Ajoutez cette classe en dehors de la structure DreamInsightApp
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        // Vérifier si c'est un retour de Stripe
        if url.absoluteString.contains("success") {
            print("✅ Retour de paiement: Succès")
            // Le paiement a réussi, synchroniser l'état de l'abonnement
            NotificationCenter.default.post(name: NSNotification.Name("SubscriptionSucceeded"), object: nil)
            return true
        } else if url.absoluteString.contains("cancel") {
            print("❌ Retour de paiement: Annulé")
            // Le paiement a été annulé
            NotificationCenter.default.post(name: NSNotification.Name("SubscriptionCancelled"), object: nil)
            return true
        }
        return false
    }
}

// Extension pour gérer les URLs dans les vues SwiftUI
extension View {
    func handleStripePaymentURL() -> some View {
        self.onOpenURL { url in
            // Vérifier si c'est un retour de Stripe
            if url.absoluteString.contains("success") {
                print("✅ Retour de paiement: Succès")
                // Le paiement a réussi, synchroniser l'état de l'abonnement
                NotificationCenter.default.post(name: NSNotification.Name("SubscriptionSucceeded"), object: nil)
            } else if url.absoluteString.contains("cancel") {
                print("❌ Retour de paiement: Annulé")
                // Le paiement a été annulé
                NotificationCenter.default.post(name: NSNotification.Name("SubscriptionCancelled"), object: nil)
            }
        }
    }
} 