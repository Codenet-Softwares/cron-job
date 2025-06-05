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

    snapshot.docs.forEach(async (doc) => {
      const data = doc.data();

      if (data.isMarketClosed) return;

      let startTime = data.startTime;
      let endTime = data.endTime;

      if (!startTime || !endTime) {
        return;
      }

      startTime = parseDate(startTime);
      endTime = parseDate(endTime);

      if (!startTime || !endTime || isNaN(startTime) || isNaN(endTime)) {
        return;
      }

      let updates = {};
      let shouldUpdate = false;

      if (
        currentTime >= startTime &&
        currentTime <= endTime &&
        !data.isActive
      ) {
        updates.isActive = true;
        updates.hideMarketWithUser = true;
        updates.updatedAt = currentTime.toISOString();
        shouldUpdate = true;
      }

      if (currentTime > endTime && data.isActive) {
        updates.isActive = false;
        updates.isMarketClosed = true;
        updates.updatedAt = currentTime.toISOString();
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        await db.collection("color-game-db").doc(doc.id).update(updates);
        await sql.query(`CALL colorgame_refactor.UpdateMarketStatus(?,?,?)`, [
          doc.id,
          updates.isActive,
          updates.hideMarketWithUser ?? data.hideMarketWithUser,
        ]);

        // Notification
        const [allUsers] = await sql.execute(`SELECT id, fcm_token, userName, userId 
       FROM colorgame_refactor.user 
       WHERE isActive = true AND fcm_token IS NOT NULL`
        );

        const notificationService = new NotificationService();

        for (const user of allUsers) {
          if (user.fcm_token) {
            let title
            let message

            if (updates.hideMarketWithUser === true && updates.isActive === true) {
              title = `Market Live: ${data.marketName}`;
              message = `The market "${data.marketName}" is now live. Start playing now!`;
            } else if (updates.hideMarketWithUser === false) {
              title = `Market Closed: ${data.marketName}`;
              message = `The market "${data.marketName}" has been closed. Stay tuned for updates.`;
            } else if (updates.isActive === false) {
              title = `Market Suspended: ${data.marketName}`;
              message = `The market "${data.marketName}" has been Suspended. Stay tuned for updates.`;
            }

            await notificationService.sendNotification(
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
              `INSERT INTO colorgame_refactor.notification (UserId, MarketId, message, type)
               VALUES (?, ?, ?, ?)`,
              [user.userId, doc.id, message, "colorgame"]
            );
          }
        }
      }
    });
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
