import { sql } from "../config/db.js";
import { db } from "../config/firebase.js";
import { getISTTime } from "../utils/common.method.js";

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
