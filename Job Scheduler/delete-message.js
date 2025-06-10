import { sql } from "../config/db.js";
import { db } from "../config/firebase.js";
import { getISTTime } from "../utils/common.method.js";

export async function deleteMessage() {
  try {
    const snapshot = await db.collectionGroup("notifications").get();

    if (!snapshot || !snapshot.docs || snapshot.docs.length === 0) {
      console.log("No notifications found to delete");
      return;
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const userId = data.UserId;
      
      console.log("Processing document:", userId);

      try {
        await doc.ref.delete();
        console.log(`Deleted Firebase document with ID: ${doc.id}`);
      } catch (firebaseError) {
        console.error(`Error deleting Firebase document ${doc.id}:`, firebaseError);
        continue;
      }

      if (userId) {
        try {
          const result = await sql.query(`DELETE FROM colorgame_refactor.Notifications WHERE UserId = ? AND type = ?`, [userId, data.type]);

          console.log(`Deleted ${result.affectedRows} records from SQL for user ${userId}`);
        } catch (sqlError) {
          console.error(`Error deleting SQL records for user ${userId}:`, sqlError);
        }
      }
    }

    console.log("Deletion process completed");
  } catch (error) {
    console.error("Error in deleteMessage function:", error);
  }
}