import UIKit
import Capacitor

/// Process-level events only. The window, links and foreground/background live in `SceneDelegate`: apps built with the
/// iOS 27 SDK must use the scene life cycle, or they do not launch.
@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    /// Only the app's own window runs the site. Capacitor's template hands `SceneDelegate` to every session role, so an
    /// external display or AirPlay mirroring started a second copy of the web app (ionic-team/capacitor#8648); other
    /// roles get the system default and simply mirror.
    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        if connectingSceneSession.role == .windowApplication {
            config.delegateClass = SceneDelegate.self
        }
        return config
    }

    // APNs device token for @capacitor/push-notifications: the callback has no scene equivalent and stays here.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}
