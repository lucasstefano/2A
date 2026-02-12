import functions from "@google-cloud/functions-framework";
import cors from "cors";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const corsHandler = cors({ origin: true });

// ========================================
// DELETE COLLECTION
// ========================================

async function deleteCollection(collectionPath, batchSize = 500) {
  const collectionRef = db.collection(collectionPath);

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();

    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

// ========================================
// DELETE ALL
// ========================================

async function deleteAllAppCollections() {
  await deleteCollection("chat_sessions");
  await deleteCollection("leads");
  await deleteCollection("lead_index_phone");
}

// ========================================
// HTTP FUNCTION
// ========================================

functions.http("adminTools", async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // 🔒 Permitir apenas POST
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }
      const { action } = req.body;

      if (action === "delete_all") {
        await deleteAllAppCollections();
        return res.json({ success: true });
      }

      return res.status(400).json({ error: "Invalid action" });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal error" });
    }
  });
});
