import { sql } from "../config/db.js";
import { db } from "../config/firebase.js";
import { getISTTime } from "../utils/common.method.js";
import NotificationService from "../utils/notification_service.js";

export async function updateLottery() {
  const currentTime = getISTTime();

  try {
    const snapshot = await db.collection("lottery-db").get();

    for (const doc of snapshot.docs) {
      const data = doc.data();

      if (data.isMarketExpired) continue;

      let startTime = parseDate(data.start_time);
      let endTime = parseDate(data.end_time);

      if (!startTime || !endTime || isNaN(startTime) || isNaN(endTime)) {
        continue;
      }

      let updates = {};
      let shouldUpdate = false;

      // Market goes live
      if (currentTime >= startTime && currentTime <= endTime && !data.isActive) {
        updates.isActive = true;
        updates.hideMarketUser = true;
        updates.inactiveGame = true;
        updates.updatedAt = new Date().toISOString();
        shouldUpdate = true;
      }

      // Market closes
      if (currentTime > endTime && data.isActive) {
        updates.isActive = false;
        updates.updatedAt = new Date().toISOString();
        shouldUpdate = true;
      }

      if (!shouldUpdate) continue;

      console.log("Updating market:", doc.id);
      await db.collection("lottery-db").doc(doc.id).update(updates);

      await sql.query(`CALL updateTicketRange(?,?,?,?)`, [
        doc.id,
        updates.isActive,
        updates.hideMarketUser ?? data.hideMarketUser,
        updates.inactiveGame ?? data.inactiveGame,
      ]);

      const [allUsers] = await sql.execute(`
        SELECT id, fcm_token, userName, userId 
        FROM colorgame_refactor.user 
        WHERE isActive = true AND fcm_token IS NOT NULL
      `);

      for (const user of allUsers) {
        if (!user.fcm_token) continue;

        let title = "";
        let message = "";

        if (updates.isActive === true) {
          title = `Market Live: ${data.marketName}`;
          message = `The market "${data.marketName}" is now live. Start playing now!`;
        } else if (updates.isActive === false) {
          title = `Market Closed: ${data.marketName}`;
          message = `The market "${data.marketName}" has been closed. Stay tuned for the next round.`;
        }

        await NotificationService.sendNotification(
          title,
          message,
          {
            type: "lottery",
            marketId: doc.id.toString(),
            userId: user.userId.toString(),
          },
          user.fcm_token
        );
        await sql.execute(
          `INSERT INTO colorgame_refactor.Notifications 
    (UserId, MarketId, message, type, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [user.userId, doc.id, message, "lottery"]
        );
        const marketRef = db
          .collection("lottery-notification")
          .doc(String(user.userId));
        await marketRef.set(
          {
            updatedAt: new Date().toISOString(),
            UserId: user.userId,
            marketId: doc.id,
            message: message,
            type: "lottery",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }
  } catch (error) {
    console.error("Error updating lottery:", error);
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
    console.error("Unknown date format:", dateInput);
    return null;
  }
}
