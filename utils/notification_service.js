import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { sql } from "../config/db.js";
import serviceAccount from "../firebase.json" assert { type: "json" };

export default class NotificationService {
  static FIREBASE_APP = null;

  static initializeFirebase() {
    if (!getApps().length) {
      console.log("⚡ Initializing Firebase Admin SDK...");
      this.FIREBASE_APP = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      console.log("✅ Firebase already initialized");
      this.FIREBASE_APP = getApps()[0];
    }
  }

  static async sendNotification(title, body, data = {}, fcm_token) {
    if (!fcm_token) {
      console.warn("⚠️ Missing FCM token");
      return;
    }

    if (!this.FIREBASE_APP) {
      this.initializeFirebase();
    }

    const message = {
      notification: { title, body },
      data: {
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK", // optional for React Native/Flutter
      },
      token: fcm_token,
    };

    console.log("📤 Sending message to FCM:", message);

    try {
      const response = await getMessaging(this.FIREBASE_APP).send(message);
      console.log("✅ Notification sent:", response);
    } catch (error) {
      console.error("❌ Error sending FCM:", error.message, error.code);

      if (
        error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered"
      ) {
        console.log("🗑 Deleting invalid FCM token...");
        await this.deleteFcmToken(fcm_token);
      }
    }
  }

  static async deleteFcmToken(fcm_token) {
    try {
      const [rows] = await sql.query(
        "SELECT * FROM colorgame_refactor.user WHERE fcm_token = ? LIMIT 1",
        [fcm_token]
      );

      if (!rows.length) return;

      const userId = rows[0].userId;

      await sql.query(
        "UPDATE colorgame_refactor.user SET fcm_token = '' WHERE userId = ?",
        [userId]
      );

      console.log("🧹 Cleaned FCM token for user:", userId);
    } catch (err) {
      console.error("❌ Error removing FCM token:", err.message);
    }
  }
}
