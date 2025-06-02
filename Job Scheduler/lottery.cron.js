import { sql } from "../config/db.js";
import { db } from "../config/firebase.js";
import { getISTTime } from "../utils/common.method.js";

export async function updateLottery() {
  const currentTime = getISTTime();

  try {
    const snapshot = await db.collection("lottery-db").get();

    snapshot.docs.forEach(async (doc) => {
      const data = doc.data();

      if (data.isMarketExpired) return;

      let startTime = parseDate(data.start_time);
      let endTime = parseDate(data.end_time);

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
        updates.hideMarketUser = true;
        updates.inactiveGame = true;
        updates.updatedAt = new Date().toISOString();
        shouldUpdate = true;
      }
      if (currentTime > endTime && data.isActive) {
        updates.isActive = false;
        updates.isMarketExpired = true;
        updates.updatedAt = new Date().toISOString();
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        console.log("first update", doc.id);
        await db.collection("lottery-db").doc(doc.id).update(updates);

        await sql.query(`CALL updateTicketRange(?,?,?,?)`, [
          doc.id,
          updates.isActive,
          updates.hideMarketUser ?? data.hideMarketUser,
          updates.inactiveGame ?? data.inactiveGame,
        ]);
      }
    });
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
