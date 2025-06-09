import { sql } from "../config/db.js";
import { db } from "../config/firebase.js";
import { getISTTime } from "../utils/common.method.js";
import NotificationService from "../utils/notification_service.js";

export async function updateColorGame() {
  const currentTime = getISTTime();

  try {
    const snapshot = await db.collection("color-game-db").get();

    if (!snapshot || !snapshot.docs || snapshot.docs.length === 0) {
      return;
    }

    NotificationService.initializeFirebase();

    for (const doc of snapshot.docs) {
      const data = doc.data();

      if (data.isMarketClosed) continue;

      let startTime = parseDate(data.startTime);
      let endTime = parseDate(data.endTime);

      if (!startTime || !endTime || isNaN(startTime) || isNaN(endTime)) continue;

      let updates = {};
      let shouldUpdate = false;

      if (currentTime >= startTime && currentTime <= endTime && !data.isActive) {
        updates.isActive = true;
        updates.hideMarketWithUser = true;
        updates.updatedAt = currentTime.toISOString();
        shouldUpdate = true;
      }

      if (currentTime > endTime && data.isActive) {
        updates.isActive = false;
        updates.isMarketClosed = true;
        updates.hideMarketWithUser = false;
        updates.updatedAt = currentTime.toISOString();
        shouldUpdate = true;
      }

      if (!shouldUpdate) continue;

      // Apply updates to Firestore
      await db.collection("color-game-db").doc(doc.id).update(updates);

      // Apply updates to MySQL
      await sql.query(`CALL colorgame_refactor.UpdateMarketStatus(?,?,?)`, [
        doc.id,
        updates.isActive,
        updates.hideMarketWithUser ?? data.hideMarketWithUser,
      ]);

      if ("isActive" in updates) {
        const [allUsers] = await sql.execute(`
          SELECT id, fcm_token, userName, userId 
          FROM colorgame_refactor.user 
          WHERE isActive = true AND fcm_token IS NOT NULL
        `);

        const title = updates.isActive
          ? `Market Live: ${data.marketName}`
          : `Market Closed: ${data.marketName}`;

        const message = updates.isActive
          ? `The market "${data.marketName}" is now live. Start playing now!`
          : `The market "${data.marketName}" has been closed. Stay tuned for the next round.`;

        for (const user of allUsers) {
          if (!user.fcm_token) continue;

          await NotificationService.sendNotification(
            title,
            message,
            {
              type: "colorgame",
              marketId: doc.id.toString(),
              userId: user.userId.toString(),
            },
            user.fcm_token
          );

          await sql.execute(
            `INSERT INTO colorgame_refactor.Notifications (UserId, MarketId, message, type)
             VALUES (?, ?, ?, ?)`,
            [user.userId, doc.id, message, "colorgame"]
          );
          const marketRef = db.collection("color-game-notification").doc(user.userId)

          await marketRef.set(
            {
              UserId: user.userId,
              marketId: doc.id,
              message: message,
              type: "colorgame",
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          );
        }
      }
    }
  } catch (error) {
    console.error("Error updating ColorGame:", error);
  }
}

function parseDate(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === "string") {
    const [datePart, timePart] = dateInput.split(" ");
    if (!datePart || !timePart) return null;
    return new Date(`${datePart}T${timePart}Z`);
  } else if (typeof dateInput === "number") {
    return new Date(dateInput);
  } else if (dateInput instanceof Date) {
    return dateInput;
  } else {
    return null;
  }
}
